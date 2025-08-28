#!/usr/bin/env node

/**
 * Test script for chatting with the Sage agent deployed on staging
 * 
 * This script connects to the staging environment API using cookie authentication
 * and handles the streaming responses properly.
 * 
 * Usage:
 * export SAGE_COOKIE="your_auth_cookies_here"
 * node src/mastra/tests/scripts/chat-with-staging.js
 */

const https = require('https');
const readline = require('readline');

const STAGING_URL = 'https://sage.devprod-evergreen.staging.corp.mongodb.com';
const CHAT_ENDPOINT = '/completions/parsley/conversations/chat';

class StagingChatClient {
  constructor() {
    this.cookie = process.env.SAGE_COOKIE;
    if (!this.cookie) {
      console.error('❌ Error: SAGE_COOKIE environment variable is required');
      console.log('\nTo get your cookie:');
      console.log('1. Open the staging environment in your browser');
      console.log('2. Open Developer Tools (F12)');
      console.log('3. Go to Network tab');
      console.log('4. Make a request to the chat endpoint');
      console.log('5. Copy the Cookie header value');
      console.log('6. Export it: export SAGE_COOKIE="<cookie_value>"');
      process.exit(1);
    }
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  generateMessageId() {
    return `randomID${Math.floor(Math.random() * 100000000)}`;
  }

  parseStreamData(chunk) {
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

  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      const messageId = this.generateMessageId();
      const data = JSON.stringify({
        message: message,
        id: messageId
      });

      const options = {
        hostname: 'sage.devprod-evergreen.staging.corp.mongodb.com',
        path: CHAT_ENDPOINT,
        method: 'POST',
        headers: {
          'User-Agent': 'ChatBot script',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br, zstd',
          'Connection': 'keep-alive',
          'Cookie': this.cookie,
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      let fullResponse = '';
      let currentToolCall = null;
      let toolInputBuffer = '';

      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          console.error(`❌ HTTP ${res.statusCode}: ${res.statusMessage}`);
          if (res.statusCode === 401 || res.statusCode === 403) {
            console.log('\n⚠️  Your cookie may have expired. Please get a fresh one.');
          }
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        res.on('data', (chunk) => {
          const messages = this.parseStreamData(chunk.toString());
          
          for (const msg of messages) {
            switch (msg.type) {
              case 'start':
              case 'start-step':
              case 'finish-step':
                // Silent events
                break;
                
              case 'tool-input-start':
                currentToolCall = msg.toolName;
                toolInputBuffer = '';
                process.stdout.write(`\n📧 Using tool: ${msg.toolName} `);
                break;
                
              case 'tool-input-delta':
                if (currentToolCall) {
                  toolInputBuffer += msg.inputTextDelta || '';
                  process.stdout.write('.');
                }
                break;
                
              case 'tool-input-available':
                if (currentToolCall) {
                  console.log(' ✓');
                  currentToolCall = null;
                  toolInputBuffer = '';
                }
                break;
                
              case 'tool-output-available':
                // Tool completed
                break;
                
              case 'text-start':
                // Start of text response
                break;
                
              case 'text-delta':
                const delta = msg.delta || '';
                fullResponse += delta;
                process.stdout.write(delta);
                break;
                
              case 'text-end':
                // End of text response
                break;
                
              case 'finish':
              case 'done':
                // Stream finished
                break;
            }
          }
        });

        res.on('end', () => {
          console.log('\n');
          resolve(fullResponse);
        });
      });

      req.on('error', (error) => {
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
    console.log('Authentication: Using cookie from SAGE_COOKIE env var');
    console.log('─'.repeat(60));
    console.log('Type "exit" to quit, "clear" to clear screen\n');

    const askQuestion = () => {
      this.rl.question('👤 You: ', async (input) => {
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
        } catch (error) {
          console.error(`\n❌ Error: ${error.message}`);
          console.log('─'.repeat(60));
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
    } catch (error) {
      console.error(`❌ Failed to connect: ${error.message}`);
      console.log('\nPlease check your SAGE_COOKIE environment variable.');
      process.exit(1);
    }

    askQuestion();
  }
}

// Main execution
async function main() {
  const client = new StagingChatClient();
  await client.startChat();
}

main().catch(console.error);