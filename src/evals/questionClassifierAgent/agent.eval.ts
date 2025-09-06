import { ExactMatch } from 'autoevals';
import { Eval } from 'braintrust';
import { ReporterName, PROJECT_NAME } from 'evals/constants';
import { callModelWithTrace } from 'evals/tracer';
import { ModelOutput } from 'evals/types';
import { mastra } from 'mastra';
import { QUESTION_CLASSIFIER_AGENT_NAME } from 'mastra/agents/constants';
import { testCases } from './testCases';
import { TestInput, TestResult } from './types';

const callQuestionClassifierAgent = async (
  input: TestInput
): ModelOutput<TestInput, TestResult> => {
  const agent = mastra.getAgent(QUESTION_CLASSIFIER_AGENT_NAME);
  const response = await agent.generateVNext(input, { format: 'aisdk' });
  const responseJSON = JSON.parse(response.text);
  const output = {
    questionClass: responseJSON.questionClass,
    nextAction: responseJSON.nextAction,
  };
  return {
    ...response,
    input,
    output,
  };
};

Eval(
  PROJECT_NAME,
  {
    data: testCases,
    task: async (input: TestInput) =>
      await callModelWithTrace<TestInput, TestResult>(() =>
        callQuestionClassifierAgent(input)
      ),
    scores: [
      ({ expected, output }) =>
        ExactMatch.partial({})({
          expected: {
            questionClass: expected.questionClass,
            nextAction: expected.nextAction,
          },
          output: {
            questionClass: output.questionClass,
            nextAction: output.nextAction,
          },
        }),
    ],
    experimentName: 'Question Classifier Agent Eval',
    description: 'Tests for the Question Classifier agent.',
  },
  {
    reporter: ReporterName.QuestionClassifier,
  }
);
