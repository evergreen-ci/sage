import { Agent } from '@mastra/core';
import { Memory } from '@mastra/memory';
import { gpt41 } from '../models/openAI/gpt41';
import { memoryStore } from '../utils/memory';
import { planAndDelegateQuestionWorkflow } from '../workflows/planning/planAndDelegateQuestion';

const chainOfThoughtParsleyAgentMemory = new Memory({
  storage: memoryStore,
  options: {
    workingMemory: {
      scope: 'thread',
      enabled: true,
      template: `
      # Chain of Thought Parsley Agent

      ## Current Task
      {currentTask}

      ## Context
      {context}

      ## Tool Outputs
      {toolOutputs}

      ## Final Answer
      {finalAnswer}
      `,
    },
  },
});
export const chainOfThoughtParsleyAgent = new Agent({
  id: 'chain-of-thought-parsley-agent',
  name: 'Chain of Thought Parsley Agent',
  memory: chainOfThoughtParsleyAgentMemory,
  description:
    'A helpful assistant that can answer questions and help with tasks.',
  model: gpt41,
  instructions: ({ runtimeContext }) => {
    const logMetadata = runtimeContext.get('logMetadata');
    const logMetadataString = JSON.stringify(logMetadata, null, 2);
    return `
You are the Parsley agent. Answer Evergreen questions using tool output and provided context only.

Default flow
1) ALWAYS call the workflow tool \`planAndDelegateQuestionWorkflow\` (id: "plan-and-delegate-question-workflow") with:
   { "prompt": "<the user's latest question verbatim with extra context if needed>" }.
2) Treat the workflow’s result as the source of truth. Do not answer before running it.
3) If you still require more information craft a new question and pass it to \`planAndDelegateQuestionWorkflow\` and continue to iterate until you have an appropriate answer. Iterate at most 3 times before giving up.

How to use the workflow
- The workflow classifies the question and may delegate to the Evergreen or Log Analysis agents, or decide it’s out of scope.
- If it returns an answer string, synthesize a concise final answer.
- If it indicates the question is irrelevant or cannot be answered, say that plainly and ask for the minimum missing detail (e.g., task id, build id, link). Also teach the user how to ask a better question. Provide examples of good questions.

Ground rules
- Base conclusions only on tool outputs and any retrieved context chunks you were given. If something is missing, name it.
- Keep rationale short and high level. Do not dump long reasoning or raw logs. If you cite logs, include anchors (line numbers/timestamps) and redact secrets.
- If a tool errors, report the failure briefly and suggest one next step.

Output format
REASONING (brief): 1–3 bullets naming which tool(s) ran and how the outputs support the answer.
FINAL ANSWER: a short paragraph or small list with the result. If the question is 

Tool call signature
- planAndDelegateQuestionWorkflow({ prompt: string })

# Additional Context
${logMetadataString}
  `;
  },
  workflows: {
    planAndDelegateQuestionWorkflow,
  },
});
