import { Agent } from '@mastra/core/agent';
import { loadPrompt } from 'braintrust';
import { z } from 'zod';
import { gpt41 } from '@/mastra/models/openAI/gpt41';
import { SLACK_QUESTION_OWNERSHIP_AGENT_NAME } from './constants';

/** Output schema for team routing */
export const questionOwnershipOutputSchema = z.object({
  teamName: z.string(),
  teamId: z.string(),
  reasoning: z.string().min(1),
  originalQuestion: z.string().min(1),
});

export const questionOwnershipAgent = new Agent({
  name: SLACK_QUESTION_OWNERSHIP_AGENT_NAME,
  description: `Routes user questions to the appropriate DevProd team
    based on content analysis.`,
  instructions: async () => {
    const promptConfig = await loadPrompt({
      projectName: 'sage-prod',
      slug: 'slack-question-ownership-agent',
    });

    if (promptConfig.prompt?.type === 'completion') {
      return promptConfig.prompt.content;
    } else if (promptConfig.prompt?.type === 'chat') {
      return promptConfig.prompt.messages
        .map(msg =>
          'content' in msg && typeof msg.content === 'string' ? msg.content : ''
        )
        .join('\n\n');
    }
    throw new Error(`Unsupported prompt type '${promptConfig.prompt?.type}' from Braintrust`);
  },
  defaultGenerateOptions: {
    output: questionOwnershipOutputSchema,
    temperature: 0,
  },
  model: gpt41,
});
