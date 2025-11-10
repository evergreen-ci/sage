import { Agent } from '@mastra/core/agent';
import { TracingContext } from '@mastra/core/ai-tracing';
import { IMastraLogger } from '@mastra/core/logger';
import { USER_MARKDOWN_PROMPT, USER_CONCISE_SUMMARY_PROMPT } from './prompts';

export const generateMarkdownAndSummary = async ({
  abortSignal,
  agent,
  analysisContext,
  logger,
  text,
  tracingContext,
}: {
  abortSignal?: AbortSignal;
  agent: Agent;
  analysisContext?: string;
  logger: IMastraLogger;
  text: string;
  tracingContext: TracingContext;
}): Promise<{ markdown: string; summary: string }> => {
  logger.debug('Generating markdown report', {
    textLength: text.length,
  });

  const markdownResult = await agent.generate(
    USER_MARKDOWN_PROMPT(text, analysisContext),
    {
      abortSignal,
      tracingContext,
    }
  );
  const markdown = markdownResult.text;

  logger.debug('Markdown report generated', {
    markdownLength: markdown.length,
  });

  logger.debug('Generating concise summary');

  const summaryResult = await agent.generate(
    USER_CONCISE_SUMMARY_PROMPT(markdown, analysisContext),
    {
      abortSignal,
      tracingContext,
    }
  );
  const summary = summaryResult.text;

  logger.debug('Concise summary generated', {
    summaryLength: summary.length,
  });

  return { markdown, summary };
};
