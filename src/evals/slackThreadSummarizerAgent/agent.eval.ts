import { Factuality } from 'autoevals';
import { Eval } from 'braintrust';
import { ReporterName, PROJECT_NAME } from '@/evals/constants';
import { loadTestCases } from '@/evals/loadTestCases';
import { TechnicalAccuracy } from '@/evals/scorers';
import { tracedAgentEval } from '@/evals/utils/tracedAgent';
import { SLACK_THREAD_SUMMARIZER_AGENT_NAME } from '@/mastra/agents/constants';
import { TestCase, TestInput, TestResult } from './types';

Eval(
  PROJECT_NAME,
  {
    data: loadTestCases<TestCase>('slack_thread_summarizer_agent_dataset'),
    task: tracedAgentEval<TestInput, TestResult>({
      agentName: SLACK_THREAD_SUMMARIZER_AGENT_NAME,
      transformResponse: response => ({
        text: response.text,
      }),
    }),
    scores: [
      ({ expected, input, output }) =>
        Factuality({
          expected: expected.text,
          output: output.text,
          input: input,
        }),
      ({ expected, output }) =>
        TechnicalAccuracy({
          output: output.text,
          expected: expected.text,
        }),
    ],
    experimentName: 'Slack Thread Summarizer Agent Eval',
    description: 'Tests for the Slack Thread Summarizer agent.',
  },
  {
    reporter: ReporterName.SlackThreadSummarizer,
  }
);
