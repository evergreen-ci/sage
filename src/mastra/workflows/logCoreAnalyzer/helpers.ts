import { Agent } from '@mastra/core/agent';
import { IMastraLogger } from '@mastra/core/logger';
import { TracingContext } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { USER_MARKDOWN_PROMPT, USER_CONCISE_SUMMARY_PROMPT } from './prompts';

export const generateMarkdownAndSummary = async ({
  abortSignal,
  agent,
  analysisContext,
  context,
  logger,
  text,
}: {
  abortSignal?: AbortSignal;
  agent: Agent;
  analysisContext?: string;
  logger: IMastraLogger;
  text: string;
  context: {
    requestContext: RequestContext;
    tracingContext: TracingContext;
  };
}): Promise<{ markdown: string; summary: string }> => {
  logger.debug('Generating markdown report', {
    textLength: text.length,
  });

  const markdownResult = await agent.generate(
    USER_MARKDOWN_PROMPT(text, analysisContext),
    {
      abortSignal,
      ...context,
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
      ...context,
    }
  );
  const summary = summaryResult.text;

  logger.debug('Concise summary generated', {
    summaryLength: summary.length,
  });

  return { markdown, summary };
};
