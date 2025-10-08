#!/usr/bin/env vite-node --script

/**
 * Test script for chatting with the Sage agent deployed on staging
 *
 * This script connects to the staging environment API using cookie authentication
 * and handles the streaming responses properly.
 *
 * Usage:
 * yarn chat-with-staging
 */

import { execSync } from 'child_process';
import https from 'https';
import readline from 'readline';
import { UIMessageChunk } from 'ai';

const STAGING_URL = 'https://sage.devprod-evergreen.staging.corp.mongodb.com';
const CHAT_ENDPOINT = '/completions/parsley/conversations/chat';

class StagingChatClient {
  kanopyAuthToken: string;
  rl: readline.Interface;

  constructor() {
    this.kanopyAuthToken = execSync('kanopy-oidc login').toString().trim();
    if (!this.kanopyAuthToken) {
      console.error('❌ Error: Kanopy OIDC login failed');
      process.exit(1);
    }

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  generateMessageId() {
    return `randomID${Math.floor(Math.random() * 100000000)}`;
  }

  parseStreamData(chunk: string) {
    const lines = chunk.split('\n');
    const messages = [];

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          messages.push({ type: 'done' });
        } else {
          try {
            const parsed = JSON.parse(data);
            messages.push(parsed);
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }

    return messages;
  }

  async sendMessage(message: string) {
    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();
      const data = JSON.stringify({
        message: message,
        id: messageId,
      });

      const options = {
        hostname: 'sage.devprod-evergreen.staging.corp.mongodb.com',
        path: CHAT_ENDPOINT,
        method: 'POST',
        headers: {
          'User-Agent': 'ChatBot script',
          'X-Kanopy-Authorization': `Bearer ${this.kanopyAuthToken}`,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          Connection: 'keep-alive',

          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      };

      let fullResponse = '';
      let currentToolCall: string | null = null;

      const req = https.request(options, res => {
        if (res.statusCode !== 200) {
          console.error(`❌ HTTP ${res.statusCode}: ${res.statusMessage}`);
          if (res.statusCode === 401 || res.statusCode === 403) {
            console.log(
              '\n⚠️  Your cookie may have expired. Please get a fresh one.'
            );
          }
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        res.on('data', (chunk: UIMessageChunk) => {
          const messages = this.parseStreamData(
            chunk.toString()
          ) as UIMessageChunk[];

          for (const msg of messages) {
            switch (msg.type) {
              case 'start':
              case 'start-step':
              case 'finish-step':
                // Silent events
                break;

              case 'tool-input-start':
                currentToolCall = msg.toolName;
                process.stdout.write(`\n📧 Using tool: ${msg.toolName} `);
                break;

              case 'tool-input-delta':
                if (currentToolCall) {
                  process.stdout.write('.');
                }
                break;

              case 'tool-input-available':
                if (currentToolCall) {
                  console.log(' ✓');
                  currentToolCall = null;
                }
                break;

              case 'tool-output-available':
                // Tool completed
                break;

              case 'text-start':
                // Start of text response
                break;

              case 'text-delta': {
                const delta = msg.delta || '';
                fullResponse += delta;
                process.stdout.write(delta);
                break;
              }

              case 'text-end':
                // End of text response
                break;

              case 'finish':
                // Stream finished
                break;

              default:
                break;
            }
          }
        });

        res.on('end', () => {
          console.log('\n');
          resolve(fullResponse);
        });
      });

      req.on('error', error => {
        console.error('❌ Request error:', error.message);
        reject(error);
      });

      req.write(data);
      req.end();
    });
  }

  async startChat() {
    console.log('\n🌐 Sage Staging Environment Chat Test');
    console.log('═'.repeat(60));
    console.log(`URL: ${STAGING_URL}`);
    console.log('Authentication: Using Kanopy OIDC');
    console.log('─'.repeat(60));
    console.log('Type "exit" to quit, "clear" to clear screen\n');

    const askQuestion = () => {
      this.rl.question('👤 You: ', async input => {
        if (input.toLowerCase() === 'exit') {
          console.log('\n👋 Goodbye!');
          this.rl.close();
          process.exit(0);
        }

        if (input.toLowerCase() === 'clear') {
          console.clear();
          console.log('🌐 Sage Staging Chat (cleared)\n');
          askQuestion();
          return;
        }

        try {
          console.log('\n🤖 Sage (staging): ');
          await this.sendMessage(input);
          console.log('─'.repeat(60));
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error(`\n❌ Error: ${error.message}`);
            console.log('─'.repeat(60));
          } else {
            console.error(`\n❌ Error: ${error}`);
            console.log('─'.repeat(60));
          }
        }

        askQuestion();
      });
    };

    // Test connection with a simple message
    try {
      console.log('Testing connection...\n');
      console.log('🤖 Sage (staging): ');
      await this.sendMessage('Hello');
      console.log('✅ Connected successfully!');
      console.log('─'.repeat(60));
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`❌ Failed to connect: ${error.message}`);
      } else {
        console.error(`❌ Failed to connect: ${error}`);
      }
      console.log('\nPlease check your Kanopy OIDC token.');
      process.exit(1);
    }

    askQuestion();
  }
}

// Main execution
/**
 *
 */
const main = async () => {
  const client = new StagingChatClient();
  await client.startChat();
};

main().catch(console.error);
