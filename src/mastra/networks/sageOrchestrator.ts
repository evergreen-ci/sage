import { AgentNetwork } from '@mastra/core/network';
import { evergreenAgent } from '../agents/evergreenAgent';
import { gpt41Nano } from '../models/openAI/gpt41';

export const sageOrchestrator = new AgentNetwork({
  name: 'sageOrchestrator',
  instructions: `
    You are the routing agent for the Parsley Network. Your role is to coordinate 
    the Evergreen Agent to answer questions about tasks, test results, and build information 
    in the Evergreen system.
    
    Currently, you have one specialized agent available:
    - Parsley Agent: Helps with task questions, can retrieve task information, history, 
      version details, test results, and file information from Evergreen.
    
    Route all questions to the Evergreen Agent for now. In the future, additional agents 
    may be added for specialized capabilities like log analysis, performance metrics, 
    or failure pattern detection.
  `,
  model: gpt41Nano,
  agents: [evergreenAgent],
});
