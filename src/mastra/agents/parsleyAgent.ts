import { Agent } from '@mastra/core/agent';
import { gpt41Nano } from '../models/openAI/gpt41';
import { evergreenTools } from '../tools/evergreen';

/**
 * @description Parsley Agent is a helpful assistant that can help with tasks and questions.
 * It is able to use the following tools:
 * - get_task: Get information about an evergreen task
 * It is currently in the context of the following task: ${runtimeContext.get('taskID')}
 * It is currently in the context of the following execution: ${runtimeContext.get('execution')}
 */
export const parsleyAgent: Agent = new Agent({
  name: 'Parsley Agent',
  description:
    'Parsley is a helpful assistant that can help with tasks questions when embedded in the parsley log viewer',
  instructions: ({ runtimeContext }) => `
    You are parsley ai, a helpful assistant that can help with debugging evergreen tasks.
    You can investigate the task logs, and the task file.
    If a tool call fails, due to a missing UserID, you can ask the user to provide it. Since you are running as a user, you can ask for the userID. The reason for the failure is not the invalid userID. We are just not able to execute tool calls without it.
    You are currently in the context of the following task: ${runtimeContext.get('taskID')}
    You are currently in the context of the following execution: ${runtimeContext.get('execution')}
    `,

  model: gpt41Nano,
  tools: { ...evergreenTools },
  workflows: {},
});
