import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { gpt41Nano } from '../models/openAI/gpt41';
import getTaskTool from '../tools/evergreen/getTask';
import getTaskFilesTool from '../tools/evergreen/getTaskFiles';
import getTaskHistoryTool from '../tools/evergreen/getTaskHistory';
import getTaskTestsTool from '../tools/evergreen/getTaskTests';
import getVersionTool from '../tools/evergreen/getVersion';
import { memoryStore } from '../utils/memory';

const parsleyMemory = new Memory({
  storage: memoryStore,
  options: {
    workingMemory: {
      // TODO: Memory is scoped to the thread, so we will only recall from the current chat window.
      scope: 'thread',
      enabled: true,
      // Define the template for the working memory
      // The working memory is like a notepad that the agent can use to remember information
      template: `
      # Task Information
      - Task ID: {{taskId}}
      - Execution: {{execution}}
      - Task Name: {{displayName}}
      - Task Status: {{displayStatus}}
      - Version: {{version}}
      - Build Variant: {{buildVariant}}
      - Patch Number: {{patchNumber}}
      - Details: {{details}}

      # Other interesting information
      - {{otherInformation}}
      `,
    },
  },
});

export const parsleyAgent: Agent = new Agent({
  name: 'Parsley Agent',
  description:
    'Parsley is a helpful assistant that can help with tasks questions when embedded in the parsley log viewer',
  instructions: `
   You are parsley ai, a helpful assistant that can help with tasks and questions.  You should only use the tools provided to you.
   You do not need to use a tool to answer a question. Only use a tool if you are sure that you need to.
`,
  model: gpt41Nano,
  tools: {
    getTask: getTaskTool,
    getTaskFiles: getTaskFilesTool,
    getTaskHistory: getTaskHistoryTool,
    getTaskTests: getTaskTestsTool,
    getVersion: getVersionTool,
  },
  memory: parsleyMemory,
  workflows: {},
});
