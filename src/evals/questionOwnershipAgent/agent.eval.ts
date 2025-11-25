import { ExactMatch } from 'autoevals';
import { Eval } from 'braintrust';
import { ReporterName, PROJECT_NAME } from '@/evals/constants';
import { loadTestCases } from '@/evals/loadTestCases';
import { tracedAgentEval } from '@/evals/utils/tracedAgent';
import { SLACK_QUESTION_OWNERSHIP_AGENT_NAME } from '@/mastra/agents/constants';
import { TestCase, TestInput, TestResult } from './types';

Eval(
  PROJECT_NAME,
  {
    data: loadTestCases<TestCase>('slack_question_ownership_agent_dataset'),
    task: tracedAgentEval<TestInput, TestResult>({
      agentName: SLACK_QUESTION_OWNERSHIP_AGENT_NAME,
      transformResponse: response => {
        const responseJSON = JSON.parse(response.text);
        return {
          teamName: responseJSON.teamName,
          teamId: responseJSON.teamId,
        };
      },
    }),
    scores: [
      ({ expected, output }) =>
        ExactMatch({
          expected: {
            teamName: expected.teamName,
            teamId: expected.teamId,
          },
          output: {
            teamName: output.output.teamName,
            teamId: output.output.teamId,
          },
        }),
    ],
    experimentName: 'Slack Question Ownership Agent Eval',
    description: 'Tests for the Slack Question Ownership agent.',
  },
  {
    reporter: ReporterName.SlackQuestionOwnership,
  }
);
