import { createWorkflow, createStep, Agent } from '@mastra/core';
import { z } from 'zod';
import {
  questionClassifierAgent,
  outputSchema as questionClassifierOutputSchema,
} from '../../agents/classifiers/questionClassifierAgent';
import { evergreenAgent } from '../../agents/evergreenAgent';
import { gpt41 } from '../../models/openAI/gpt41';
import listAgentsAndTools from '../../tools/planning/listAgentsAndTools';

const workflowInputSchema = z.object({
  prompt: z.string(),
});

const workflowOutputSchema = z.object({
  output: z.string(),
});

const classifyQuestionStep1 = createStep({
  id: 'classify-question-step-1',
  description: 'Classify the question into a category',
  inputSchema: z.object({
    prompt: z.string(),
  }),
  outputSchema: questionClassifierOutputSchema,
  execute: async ({ inputData }) => {
    const { prompt } = inputData;
    const result = await questionClassifierAgent.generate(prompt);
    if (result.object === undefined) {
      throw new Error('Question classifier agent returned undefined');
    }
    return result.object;
  },
});

const askEvergreenAgentStep = createStep({
  id: 'ask-evergreen-agent-step',
  description: 'Ask the evergreen agent to answer the question',
  inputSchema: questionClassifierOutputSchema,
  outputSchema: z.string(),
  execute: async ({ inputData, workflowId }) => {
    const { originalQuestion } = inputData;
    const result = await evergreenAgent.generate(originalQuestion);
    if (result.object === undefined) {
      throw new Error('Could not get an answer from the evergreen agent');
    }
    return result.text;
  },
});

const askLogAnalysisAgentStep = createStep({
  id: 'ask-log-analysis-agent-step',
  description: 'Ask the log analysis agent to answer the question',
  inputSchema: questionClassifierOutputSchema,
  outputSchema: z.string(),
  execute: async ({ inputData }) => {
    const { originalQuestion } = inputData;

    return `Performed analysis on ${originalQuestion}`;
  },
});

const askCombinationAnalysisAgentStep = createStep({
  id: 'ask-combination-analysis-agent-step',
  description: 'Ask the combination analysis agent to answer the question',
  inputSchema: questionClassifierOutputSchema,
  outputSchema: z.string(),
  execute: async ({ inputData }) => {
    const { originalQuestion } = inputData;
    return `Performed analysis on ${originalQuestion}`;
  },
});

const doNotAnswerStep = createStep({
  id: 'do-not-answer-step',
  description: 'Do not answer the question',
  inputSchema: questionClassifierOutputSchema,
  outputSchema: z.string(),
  execute: async ({ inputData }) => 'I cannot answer that question!',
});

export const planAndDelegateQuestionWorkflow = createWorkflow({
  id: 'plan-and-delegate-question-workflow',
  description:
    'Workflow to plan and delegate a question to the appropriate agent',
  inputSchema: z.object({
    prompt: z.string(),
  }),
  outputSchema: workflowOutputSchema,
})
  .then(classifyQuestionStep1)
  .branch([
    [
      async ({ inputData }) => inputData.nextAction === 'USE_EVERGREEN_AGENT',
      askEvergreenAgentStep,
    ],
    [
      async ({ inputData }) =>
        inputData.nextAction === 'USE_LOG_ANALYSIS_AGENT',
      askLogAnalysisAgentStep,
    ],
    [
      async ({ inputData }) =>
        inputData.nextAction === 'USE_COMBINATION_ANALYSIS',
      askCombinationAnalysisAgentStep,
    ],
    [
      async ({ inputData }) => inputData.nextAction === 'DO_NOT_ANSWER',
      doNotAnswerStep,
    ],
  ])
  .commit();
