import { Agent } from '@mastra/core/agent';
import { IMastraLogger } from '@mastra/core/logger';
import { TracingContext } from '@mastra/core/observability';
import { RequestContext } from '@mastra/core/request-context';
import { z } from 'zod';
import {
  USER_MARKDOWN_PROMPT,
  USER_CONCISE_SUMMARY_PROMPT,
  USER_LINE_REFERENCES_PROMPTS,
} from './prompts';
import { LineReferenceSchema } from './schemas';

export const generateMarkdownAndSummary = async ({
  abortSignal,
  agent,
  analysisContext,
  context,
  existingLineReferences,
  logger,
  text,
}: {
  abortSignal?: AbortSignal;
  agent: Agent;
  analysisContext?: string;
  logger: IMastraLogger;
  text: string;
  existingLineReferences: Array<z.infer<typeof LineReferenceSchema>>;
  context: {
    requestContext: RequestContext;
    tracingContext: TracingContext;
  };
}): Promise<{
  markdown: string;
  summary: string;
  lineReferences: Array<z.infer<typeof LineReferenceSchema>>;
}> => {
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

  logger.debug('Generating line references');

  const lineReferencesResult = await agent.generate(
    USER_LINE_REFERENCES_PROMPTS(
      markdown,
      existingLineReferences,
      analysisContext
    ),
    {
      abortSignal,
      ...context,
    }
  );

  let lineReferences: Array<z.infer<typeof LineReferenceSchema>> =
    existingLineReferences;
  try {
    lineReferences = JSON.parse(lineReferencesResult.text);
    logger.debug('Line references generated', {
      lineReferencesLength: lineReferences.length,
    });
  } catch (error) {
    logger.debug('Failed to parse line references, using empty array', {
      error,
    });
  }

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

  return {
    markdown,
    summary,
    lineReferences,
  };
};
