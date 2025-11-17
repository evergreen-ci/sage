import { Agent } from '@mastra/core/agent';
import { z } from 'zod';
import { DEVPROD_TEAMS, TEAM_NAMES } from '@/constants/teams';
import { gpt41 } from '@/mastra/models/openAI/gpt41';
import { createToolFromAgent } from '@/mastra/tools/utils';

/** Output schema for team routing */
export const questionOwnershipOutputSchema = z.object({
  teamName: z.enum(TEAM_NAMES),
  teamId: z.string(),
  reasoning: z.string().min(1),
  originalQuestion: z.string().min(1),
});

/** @returns Full list of team descriptions in one string. */
const buildTeamDescriptions = (): string =>
  Object.entries(DEVPROD_TEAMS)
    .map(([key, team]) => `- ${key}: ${team.description}`)
    .join('\n');

export const questionOwnershipAgent = new Agent({
  name: 'questionOwnershipAgent',
  description: `Routes user questions to the appropriate DevProd team 
    based on content analysis.`,
  instructions: `
You are an expert at classifying technical questions into the DevProd
engineering team that is most suited to answer it correctly. Given a
user's question, identify the most appropriate team to handle it.
1) Analyze the user's question. Look for the main systems that they
   are asking about.
2) Determine which DevProd team should handle it from the list below.
3) Explain your reasoning
4) Return JSON only that matches the output schema

## Available Teams

${buildTeamDescriptions()}

## Routing Guidelines

1. **Primary Indicators**:
   - Look for explicit mentions of team names or their core technologies
   - Consider the domain and context of the question

2. **Edge Cases**:
   - If question spans multiple teams, pick the primary team and note in reasoning
   - If question is too vague, route to Unassigned
   - If question mentions multiple technologies, prioritize the main subject

3. **Reasoning**:
   - Briefly explain which keywords or concepts led to your decision
   - Mention any historical patterns if applicable
   - Note if the question is ambiguous or spans multiple teams

## Output Contract

Return **only** a JSON object with keys:
{
  "teamName": the name field of one of ${TEAM_NAMES.join(', ')},
  "teamId": the team ID as a string,
  "reasoning": string explaining the routing decision,
  "originalQuestion": string (the user's question)
}

## Examples

### Example 1
Q: "How do I check the status of my Evergreen build?"
A:
{"teamName":"DevProd Evergreen App","teamId":"26748","reasoning":"Question explicitly mentions 'Evergreen build' and relates to build status monitoring, which is core to the Evergreen team.","originalQuestion":"How do I check the status of my Evergreen build?"}

### Example 2
Q: "Where can I find the logs for my failed test?"
A:
{"teamName":"DevProd Evergreen UI","teamId":"26749","reasoning":"Question asks about logs and debugging a failed test, which is handled by the Parsley log analysis team.","originalQuestion":"Where can I find the logs for my failed test?"}

### Example 3
Q: "How do I set up Backstage?"
A:
{"teamName":"DevProd Developer Experience","teamId":"31057","reasoning":"Question about Backstage, which falls under Developer Experience team's domain.","originalQuestion":"How do I set up Backstage?"}

### Example 4
Q: "Our deployment is failing to make it to production"
A:
{"teamName":"DevProd Release Infrastructure","teamId":"26752","reasoning":"Question about production deployment issues relates to platform infrastructure and deployment systems.","originalQuestion":"Our deployment is failing in production"}

### Example 5
Q: "What's for lunch?"
A:
{"teamName":"Unassigned","teamId":"unassigned","reasoning":"Question is unrelated to DevProd team domains and does not match any team keywords or responsibilities.","originalQuestion":"What's for lunch?"}
  `,
  defaultGenerateOptions: {
    output: questionOwnershipOutputSchema,
    temperature: 0,
  },
  model: gpt41,
});

export const questionOwnershipAgentTool = createToolFromAgent(
  questionOwnershipAgent.id,
  questionOwnershipAgent.getDescription(),
  questionOwnershipOutputSchema
);
