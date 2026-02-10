import { createStep } from '@mastra/core/workflows';
import { MDocument } from '@mastra/rag';
import { z } from 'zod';
import {
  prefilterInitialAnalyzerAgent,
  prefilterRefinementAgent,
  prefilterReportFormatterAgent,
} from './agents';
import { prefilterAnalyzerConfig } from './config';
import { generateMarkdownAndSummary } from './helpers';
import { USER_INITIAL_PROMPT, USER_REFINE } from './prompts';
import { scanLogForErrors } from './scanner';
import {
  WorkflowOutputSchema,
  PrefilterStateSchema,
  RefinementAgentOutputSchema,
} from './schemas';

export const errorScanStep = createStep({
  id: 'error-scan',
  description:
    'Scan loaded text with regex to extract error-relevant lines with context',
  inputSchema: z.object({}),
  stateSchema: PrefilterStateSchema,
  outputSchema: z.object({}),
  execute: async ({ mastra, setState, state, tracingContext }) => {
    const logger = mastra.getLogger();
    const { text } = state;

    if (!text) {
      throw new Error('Text content is missing in state');
    }

    const scanResult = scanLogForErrors(text, {
      contextLinesBefore: prefilterAnalyzerConfig.scanner.contextLinesBefore,
      contextLinesAfter: prefilterAnalyzerConfig.scanner.contextLinesAfter,
      maxTopTerms: prefilterAnalyzerConfig.scanner.maxTopTerms,
    });

    logger.info('Error scan complete', {
      totalLines: scanResult.totalLines,
      matchedLines: scanResult.matchedLineCount,
      matchRate: `${((scanResult.matchedLineCount / Math.max(scanResult.totalLines, 1)) * 100).toFixed(1)}%`,
      topTerms: scanResult.topTerms.slice(0, 5).map(([term]) => term),
      excerptLength: scanResult.matchedExcerpt.length,
    });

    if (scanResult.matchedLineCount === 0) {
      logger.info('No error patterns found, falling back to full text');
    }

    const filteredText =
      scanResult.matchedLineCount > 0 ? scanResult.matchedExcerpt : text;

    tracingContext.currentSpan?.update({
      metadata: {
        totalLines: scanResult.totalLines,
        matchedLines: scanResult.matchedLineCount,
        filteredTextLength: filteredText.length,
        originalTextLength: text.length,
        reductionRatio: `${((1 - filteredText.length / text.length) * 100).toFixed(1)}%`,
      },
    });

    setState({
      ...state,
      filteredText,
      scanResult,
    });

    return {};
  },
});

export const chunkFilteredStep = createStep({
  id: 'chunk-filtered',
  description: 'Token-aware chunking of the pre-filtered content',
  stateSchema: PrefilterStateSchema,
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  execute: async ({ mastra, setState, state, tracingContext }) => {
    const logger = mastra.getLogger();
    const { filteredText } = state;

    if (!filteredText) {
      throw new Error('Filtered text content is missing in state');
    }

    const doc = MDocument.fromText(filteredText);
    const chunks = await doc.chunk({
      strategy: 'token',
      encodingName: prefilterAnalyzerConfig.chunking.tokenizer,
      maxSize: prefilterAnalyzerConfig.chunking.maxSize,
      overlap: prefilterAnalyzerConfig.chunking.overlapTokens,
    });

    logger.debug('Filtered content chunking complete', {
      chunkCount: chunks.length,
    });

    tracingContext.currentSpan?.update({
      metadata: {
        chunkCount: chunks.length,
        chunkSize: prefilterAnalyzerConfig.chunking.maxSize,
      },
    });

    setState({
      ...state,
      chunks,
    });
    return {};
  },
});

export const singlePassStep = createStep({
  id: 'prefilter-single-pass',
  description:
    'Direct analysis and report generation for single-chunk pre-filtered content',
  stateSchema: PrefilterStateSchema,
  inputSchema: z.object({}),
  outputSchema: WorkflowOutputSchema,
  execute: async ({
    abortSignal,
    mastra,
    requestContext,
    state,
    tracingContext,
  }) => {
    const logger = mastra.getLogger();
    const { analysisContext, chunks, scanResult } = state;

    if (!chunks || chunks.length !== 1) {
      throw new Error(
        `Single-pass step requires exactly one chunk, got ${chunks?.length ?? 0}`
      );
    }

    if (!scanResult) {
      throw new Error('Scan result is missing in state');
    }

    const text = chunks[0]?.text ?? '';

    logger.debug('Pre-filter single-pass analysis starting', {
      textLength: text.length,
    });

    const result = await generateMarkdownAndSummary({
      abortSignal,
      agent: prefilterReportFormatterAgent,
      analysisContext,
      logger,
      text,
      scanResult,
      context: {
        requestContext,
        tracingContext,
      },
      existingLineReferences: [],
    });

    logger.debug('Pre-filter single-pass analysis complete', {
      markdownLength: result.markdown.length,
      summaryLength: result.summary.length,
    });

    return result;
  },
});

export const initialStep = createStep({
  id: 'prefilter-initial-summary',
  description: 'Summarize first chunk of pre-filtered error content',
  stateSchema: PrefilterStateSchema,
  inputSchema: z.object({}),
  outputSchema: z.object({
    summary: z.string(),
  }),
  execute: async ({ abortSignal, mastra, setState, state, tracingContext }) => {
    const logger = mastra.getLogger();
    const { analysisContext, chunks, scanResult } = state;

    if (!chunks) {
      throw new Error('Chunks are not available');
    }
    if (!scanResult) {
      throw new Error('Scan result is missing in state');
    }

    const first = chunks[0]?.text ?? '';

    logger.debug('Pre-filter initial chunk length', { length: first.length });

    const result = await prefilterInitialAnalyzerAgent.generate(
      USER_INITIAL_PROMPT(first, scanResult, analysisContext),
      {
        tracingContext,
        abortSignal,
      }
    );

    const summary = result.text;
    tracingContext.currentSpan?.update({
      metadata: {
        idx: 1,
        total: chunks.length,
      },
      output: { summary },
    });
    setState({
      ...state,
      idx: 1,
    });
    return { summary };
  },
});

export const refineStep = createStep({
  id: 'prefilter-refine-summary',
  description: 'Iteratively refine with pre-filtered error chunks',
  stateSchema: PrefilterStateSchema,
  inputSchema: z.object({
    summary: z.string(),
  }),
  outputSchema: z.object({
    summary: z.string(),
  }),
  execute: async ({
    abortSignal,
    inputData,
    mastra,
    setState,
    state,
    tracingContext,
  }) => {
    const logger = mastra.getLogger();
    const { analysisContext, chunks, idx, scanResult } = state;
    const { summary: existingSummary } = inputData;

    if (!chunks) {
      throw new Error('Chunks are not available');
    }
    if (!scanResult) {
      throw new Error('Scan result is missing in state');
    }

    const chunk = chunks[idx]?.text ?? '';
    if (!chunk) {
      return { summary: existingSummary };
    }

    logger.debug(`Pre-filter refine step for chunk #${idx + 1}:`, {
      total: chunks.length,
    });

    const result = await prefilterRefinementAgent.generate(
      USER_REFINE(existingSummary, chunk, scanResult, analysisContext),
      {
        structuredOutput: {
          schema: RefinementAgentOutputSchema,
          model: prefilterAnalyzerConfig.models.schemaFormatter,
        },
        tracingContext,
        abortSignal,
      }
    );

    const response = result.object;
    const updated = response.updated ?? false;
    let newSummary = existingSummary;
    const newLineReferences = response.lineReferences ?? [];

    if (updated) {
      newSummary = response.summary ?? existingSummary;
    }

    const accumulatedLineReferences = [
      ...state.accumulatedLineReferences,
      ...newLineReferences,
    ];

    tracingContext.currentSpan?.update({
      metadata: {
        idx: idx + 1,
        total: chunks.length,
      },
      output: { summary: newSummary },
    });
    setState({
      ...state,
      idx: idx + 1,
      analysisContext,
      accumulatedLineReferences,
    });
    return { summary: newSummary };
  },
});

export const finalizeStep = createStep({
  id: 'prefilter-finalize',
  description: 'Generate final markdown report from pre-filtered analysis',
  inputSchema: z.object({
    summary: z.string(),
  }),
  stateSchema: PrefilterStateSchema,
  outputSchema: WorkflowOutputSchema,
  execute: async ({
    abortSignal,
    inputData,
    mastra,
    requestContext,
    state,
    tracingContext,
  }) => {
    const logger = mastra.getLogger();
    const { summary } = inputData;
    const { analysisContext, scanResult } = state;

    if (!scanResult) {
      throw new Error('Scan result is missing in state');
    }

    logger.debug('Pre-filter finalize step starting');

    const result = await generateMarkdownAndSummary({
      abortSignal,
      agent: prefilterReportFormatterAgent,
      analysisContext,
      logger,
      text: summary,
      scanResult,
      context: {
        requestContext,
        tracingContext,
      },
      existingLineReferences: state.accumulatedLineReferences,
    });

    logger.debug('Pre-filter finalize step complete', {
      markdownLength: result.markdown.length,
      summaryLength: result.summary.length,
      lineReferencesLength: result.lineReferences.length,
    });

    return result;
  },
});
