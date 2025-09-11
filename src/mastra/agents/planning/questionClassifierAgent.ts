import { Agent } from '@mastra/core';
import { z } from 'zod';
import { gpt41 } from '../../models/openAI/gpt41';
import { createToolFromAgent } from '../../tools/utils';
import { wrapAgentWithTracing } from '../../utils/tracing/wrapAgentWithTracing';

/** Shared enums so prose, schema, and logic stay in sync */
const QUESTION_CLASS = [
  'EVERGREEN',
  'LOG',
  'COMBINATION',
  'CAN_ANSWER_ON_OWN',
  'IRRELEVANT',
] as const;

const NEXT_ACTION = [
  'USE_EVERGREEN_AGENT',
  'USE_LOG_ANALYSIS_AGENT',
  'USE_COMBINATION_ANALYSIS',
  'GENERATE_ANSWER_ON_OWN',
  'DO_NOT_ANSWER',
] as const;

const outputSchema = z.object({
  confidence: z.number().min(0).max(1),
  questionClass: z.enum(QUESTION_CLASS),
  nextAction: z.enum(NEXT_ACTION),
  originalQuestion: z.string().min(1),
});

export const questionClassifierAgent = wrapAgentWithTracing(
  new Agent({
    id: 'question-classifier-agent',
    name: 'Question Classifier Agent',
    description: 'Classifies a user question and decides the next action.',
    instructions: `
You are a classifier. Do not answer the user’s question. Your job is to:
1) Assign a single category to the question (questionClass).
2) Pick the appropriate nextAction.
3) Return JSON only that matches the output schema.

## Rules
- You should not answer irrelevant questions. Questions should be classified as IRRELEVANT if they do not pertain to Evergreen or logs.
- Some specific keywords that help you determine if the question is about Evergreen or logs:
  - "evergreen"
  - "logs"
  - "task"
  - "test"
  - "run"
  - "build"
  - "flake"
  - "failure"
  - "error"
  - "stack"
  - "stack trace"
  - "stack trace"


## Categories (questionClass)
- EVERGREEN: Questions about Evergreen metadata or context that do not require reading logs.
  Examples: “What’s the status of task X?”, “Show me last passing build for variant Y.”
- LOG: Questions that require reading or analyzing a specific task’s logs or test output.
  Examples: “Why did test A fail in task T?”, “Find the error stack in this task run.”
- COMBINATION: Needs both Evergreen context AND log analysis.
  Examples: “Was this failure introduced recently? Compare with last passing and show failing tests.”
- CAN_ANSWER_ON_OWN: General knowledge or policy that you can answer without tools or logs.
  Examples: “What does task status ‘undispatched’ mean?”
- IRRELEVANT: Out of scope of Evergreen and logs.
  Examples: “Write me a poem,” “What’s the weather?”, "What is the meaning of life?", "What is the capital of France?"

## Next Action mapping
- EVERGREEN -> USE_EVERGREEN_AGENT
- LOG -> USE_LOG_ANALYSIS_AGENT
- COMBINATION -> USE_COMBINATION_ANALYSIS
- CAN_ANSWER_ON_OWN -> GENERATE_ANSWER_ON_OWN
- IRRELEVANT -> DO_NOT_ANSWER 

## Edge cases and tie-breakers
- If the user mentions a specific task/run/test and asks “why/where/how it failed,” classify as LOG.
- If the user asks to compare versions, history, or correlate failure with metadata and also needs evidence from logs, classify as COMBINATION.
- If ambiguous between EVERGREEN and LOG, prefer COMBINATION.
- If the question is clearly not about Evergreen, choose IRRELEVANT.

## Output contract
Return **only** a JSON object with keys:
{ "confidence": number 0..1, "questionClass": one of ${QUESTION_CLASS.join(
      ', '
    )}, "nextAction": one of ${NEXT_ACTION.join(
      ', '
    )}, "originalQuestion": string }

## Few examples

### Example 1
Q: "What’s the status of task evg_lint_generate…?"
A:
{"confidence":0.92,"questionClass":"EVERGREEN","nextAction":"USE_EVERGREEN_AGENT","originalQuestion":"What’s the status of task evg_lint_generate…?"}

### Example 2
Q: "Why did task abc123 fail? Show the stack."
A:
{"confidence":0.95,"questionClass":"LOG","nextAction":"USE_LOG_ANALYSIS_AGENT","originalQuestion":"Why did task abc123 fail? Show the stack."}

### Example 3
Q: "Did this flake start yesterday? Compare to last passing and show failing tests."
A:
{"confidence":0.89,"questionClass":"COMBINATION","nextAction":"USE_COMBINATION_ANALYSIS","originalQuestion":"Did this flake start yesterday? Compare to last passing and show failing tests."}
  `,
    defaultGenerateOptions: {
      output: outputSchema,
      temperature: 0,
    },
    model: gpt41,
  })
);

export const askQuestionClassifierAgentTool = createToolFromAgent(
  questionClassifierAgent.id,
  questionClassifierAgent.getDescription(),
  outputSchema
);
