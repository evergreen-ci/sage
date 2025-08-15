import { AgentNetwork } from '@mastra/core/network';
import { parsleyAgent } from '../agents/parsleyAgent';
import { gpt41Nano } from '../models/openAI/gpt41';

export const parsleyNetwork = new AgentNetwork({
  name: 'Parsley Network',
  instructions: `
    You are the routing agent for the Parsley Network. Your role is to coordinate 
    the Parsley Agent to answer questions about tasks, test results, and build information 
    in the Evergreen system.
    
    Currently, you have one specialized agent available:
    - Parsley Agent: Helps with task questions, can retrieve task information, history, 
      version details, test results, and file information from Evergreen.
    
    Route all questions to the Parsley Agent for now. In the future, additional agents 
    may be added for specialized capabilities like log analysis, performance metrics, 
    or failure pattern detection.
  `,
  model: gpt41Nano,
  agents: [parsleyAgent],
});
