import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { gpt41 } from '../../models/openAI/gpt41';
import { memoryStore } from '../../utils/memory';
import { logCoreAnalyzerWorkflow } from '../../workflows/logCoreAnalyzerWorkflow';
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

export const sageThinkingAgent: Agent = new Agent({
  name: 'Sage Thinking Agent',
  description:
    'A agent that thinks about the user question and decides the next action.',
  memory: sageThinkingAgentMemory,
  instructions: ({ runtimeContext }) => {
    const userID = runtimeContext.get(USER_ID);
    const logMetadata = runtimeContext.get('logMetadata');
    return `
  You are Parsley AI. A senior software engineer that can think about a users questions and decide on a course of action to answer the question. 
  You have a deep understanding of the evergreen platform and have access to a series of tools that can help you answer any question.

  ## Available Tools:
  
  1. **evergreenAgent**: Fetches data from Evergreen APIs (tasks, builds, versions, patches, logs from Evergreen)
     - Use for: Getting task details, build status, version info, patch data, fetching logs from Evergreen
  
  2. **logCoreAnalyzerWorkflow**: Analyzes raw log/text content that you provide
     - Use for: Analyzing log files or text content when you have the actual content
     - Accepts: file path (local), URL (direct link to content), or raw text string
     - Does NOT: Fetch from Evergreen (use evergreenAgent for that first)
  
  3. **questionClassifierAgent**: Classifies user questions to determine appropriate response strategy
     - Use for: Understanding user intent and deciding which tools to use


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
