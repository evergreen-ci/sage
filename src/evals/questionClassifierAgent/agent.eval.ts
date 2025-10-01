import { ExactMatch } from 'autoevals';
import { Eval } from 'braintrust';
import { ReporterName, PROJECT_NAME } from 'evals/constants';
import { QUESTION_CLASSIFIER_AGENT_NAME } from 'mastra/agents/constants';
import { tracedAgentEval } from '../utils/tracedAgent';
import { getTestCases } from './testCases';
import { TestInput, TestResult } from './types';

Eval(
  PROJECT_NAME,
  {
    data: getTestCases(),
    task: tracedAgentEval<TestInput, TestResult>({
      agentName: QUESTION_CLASSIFIER_AGENT_NAME,
      transformResponse: response => {
        const responseJSON = JSON.parse(response.text);
        return {
          questionClass: responseJSON.questionClass,
          nextAction: responseJSON.nextAction,
        };
      },
    }),
    scores: [
      ({ expected, output }) =>
        ExactMatch({
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
