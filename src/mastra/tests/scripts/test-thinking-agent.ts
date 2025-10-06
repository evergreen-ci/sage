#!/usr/bin/env vite-node --script

import readline from 'readline';
import { createParsleyRuntimeContext } from '@/mastra/memory/parsley/runtimeContext';
import { mastra } from '../..';
import { USER_ID } from '../../agents/constants';

/**
 * Test script for the sageThinkingAgent - THIS MATCHES STAGING BEHAVIOR
 *
 * Usage:
 * yarn test-thinking-agent --interactive                          # Interactive chat mode
 * yarn test-thinking-agent --question "What failed?"              # Single question
 * yarn test-thinking-agent --task "task_id" --question "Status?"  # With task context
 */
const testThinkingAgent = async () => {
  const args = process.argv.slice(2);

  // Parse command line arguments
  const interactive = args.includes('--interactive');
  let initialQuestion = 'What is happening in this build?';
  const logMetadata: any = {};

  const questionIndex = args.indexOf('--question');
  if (questionIndex !== -1 && args[questionIndex + 1]) {
    initialQuestion = args[questionIndex + 1]!;
  }

  const taskIndex = args.indexOf('--task');
  if (taskIndex !== -1 && args[taskIndex + 1]) {
    logMetadata.task_id = args[taskIndex + 1];
  }

  const executionIndex = args.indexOf('--execution');
  if (executionIndex !== -1 && args[executionIndex + 1]) {
    logMetadata.execution = parseInt(args[executionIndex + 1]!, 10);
  }

  const buildIndex = args.indexOf('--build');
  if (buildIndex !== -1 && args[buildIndex + 1]) {
    logMetadata.build_id = args[buildIndex + 1];
  }

  const versionIndex = args.indexOf('--version');
  if (versionIndex !== -1 && args[versionIndex + 1]) {
    logMetadata.version_id = args[versionIndex + 1];
  }

  console.log('\n🤖 Testing Sage Thinking Agent (Staging Behavior)');
  console.log('═'.repeat(60));
  console.log(`Mode: ${interactive ? 'Interactive Chat' : 'Single Question'}`);
  console.log(`Log Metadata: ${JSON.stringify(logMetadata, null, 2)}`);
  console.log('─'.repeat(60));

  try {
    // Create runtime context
    const runtimeContext = createParsleyRuntimeContext();
    runtimeContext.set(USER_ID, process.env.USER_NAME || 'test_user');
    runtimeContext.set('logMetadata', logMetadata);

    // Get the thinking agent
    const agent = mastra.getAgent('sageThinkingAgent');

    // Create a new conversation thread
    const memory = await agent.getMemory({ runtimeContext });
    const thread = await memory?.createThread({
      metadata: runtimeContext.toJSON(),
      resourceId: 'test_local',
      threadId: `test-${Date.now()}`,
    });

    console.log(`\n📝 Thread ID: ${thread?.id}`);

    // Function to send a message and display response
    const sendMessage = async (message: string) => {
      console.log(`\n👤 User: ${message}`);
      console.log('─'.repeat(60));
      console.log('🤖 Sage: ');

      const streamOptions: any = {
        runtimeContext,
      };

      if (thread) {
        streamOptions.memory = {
          thread: { id: thread.id },
          resource: thread.resourceId,
        };
      }

      const result = await agent.generateVNext(message, streamOptions);
      const fullResponse = result.text || '';
      console.log(fullResponse);

      console.log(`\n${'─'.repeat(60)}`);
      return fullResponse;
    };

    // Interactive mode
    if (interactive) {
      console.log('\n💬 Interactive mode enabled. Type "exit" to quit.');
      console.log(
        'This simulates the chatbot experience users will have in the UI.'
      );
      console.log('─'.repeat(60));

      // Send initial greeting
      await sendMessage(
        "Hello! I'm ready to help with your Evergreen questions."
      );

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const askQuestion = () => {
        rl.question('\n👤 You: ', async answer => {
          if (answer.toLowerCase() === 'exit') {
            console.log('\n👋 Goodbye!');
            rl.close();
            process.exit(0);
          }

          await sendMessage(answer);
          askQuestion(); // Continue the conversation
        });
      };

      askQuestion();
    } else {
      // Single question mode
      await sendMessage(initialQuestion);

      console.log(`\n${'═'.repeat(60)}`);
      console.log('✅ Test completed successfully');

      // Give time for all output to flush before exiting
      setTimeout(() => {
        process.exit(0);
      }, 100);
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
};

// Run the test
testThinkingAgent().catch(console.error);
