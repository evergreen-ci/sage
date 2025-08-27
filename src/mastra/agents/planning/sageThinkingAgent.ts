import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { gpt41 } from '../../models/openAI/gpt41';
import { memoryStore } from '../../utils/memory';
import { USER_ID } from '../constants';
import { askEvergreenAgentTool } from '../evergreenAgent';
import { askQuestionClassifierAgentTool } from './questionClassifierAgent';

const sageThinkingAgentMemory = new Memory({
  storage: memoryStore,
  options: {
    workingMemory: {
      enabled: true,
      scope: 'thread',
    },
  },
});
// @ts-expect-error - Agent is not typed correctly
export const sageThinkingAgent: Agent = new Agent({
  name: 'Sage Thinking Agent',
  description:
    'A agent that thinks about the user question and decides the next action.',
  memory: sageThinkingAgentMemory,
  instructions: ({ runtimeContext }) => {
    const userID = runtimeContext.get(USER_ID);
    const logMetadata = runtimeContext.get('logMetadata');
    return `
  You are Parsley AI. A senior software engineer that can think about a users questions and decide on a course of action. To answer the question. 
  You have a deep understanding of the evergreen platform and have access to a series of tools that can help you answer any question.

  You have access to the following tools:
  - evergreenAgent: A agent that can answer questions about the evergreen platform.
  - logCoreAnalyzerWorkflow: A agent that can analyze logs and answer questions about the logs.

  You have access to the following tools:
  - questionClassifierAgent: A agent that can classify the user question and help you decide the next action.


  <ADDITIONAL_CONTEXT>
  User ID: ${userID}
  Log Metadata: ${JSON.stringify(logMetadata)}
  </ADDITIONAL_CONTEXT>

  `;
  },
  model: gpt41,
  tools: {
    askQuestionClassifierAgentTool,
    askEvergreenAgentTool,
  },
  workflows: {
    logCoreAnalyzerWorkflow,
  },
});
