import { createStep } from '@mastra/core/workflows';
import { MDocument } from '@mastra/rag';
import { z } from 'zod';
import {
  initialAnalyzerAgent,
  refinementAgent,
  reportFormatterAgent,
} from './agents';
import { logAnalyzerConfig } from './config';
import { MB_TO_BYTES } from './constants';
import {
  loadFromFile,
  loadFromUrl,
  loadFromText,
  type LoadResult,
} from './dataLoader';
import { generateMarkdownAndSummary } from './helpers';
import { USER_INITIAL_PROMPT, USER_REFINE } from './prompts';
import {
  WorkflowInputSchema,
  WorkflowOutputSchema,
  WorkflowStateSchema,
  RefinementAgentOutputSchema,
} from './schemas';
import { normalizeLineEndings, cropMiddle } from './utils';

// Unified load step that handles all I/O with validation
export const loadDataStep = createStep({
  id: 'load-data',
  description: 'Load and validate data from any source',
  inputSchema: WorkflowInputSchema,
  stateSchema: WorkflowStateSchema,
  outputSchema: z.object({}), // Stores data in state, not output
  execute: async ({ inputData, mastra, setState, state, tracingContext }) => {
    const logger = mastra.getLogger();
    const { analysisContext, path: filePath, text, url } = inputData;

    let result: LoadResult;

    try {
      if (filePath) {
        result = await loadFromFile(filePath);
      } else if (url) {
        result = await loadFromUrl(url);
      } else if (text) {
        result = await loadFromText(text);
      } else {
        throw new Error(
          'No input source provided (path, url, or text required)'
        );
      }
    } catch (error) {
      logger.error('Failed to load data', error);
      throw error;
    }

    // Normalize the text
    let normalizedText = normalizeLineEndings(result.text);

    // Crop text to reasonable size, keeping 20% from head and 80% from tail
    normalizedText = cropMiddle(
      normalizedText,
      logAnalyzerConfig.limits.maxChars,
      0.2
    );

    logger.info('Data loaded successfully', {
      source: result.metadata.source,
      sizeMB: (result.metadata.originalSize / MB_TO_BYTES).toFixed(2),
      estimatedTokens: result.metadata.estimatedTokens,
    });

    // Append truncation warning to analysis context if content was truncated
    let enrichedContext = analysisContext;
    if (result.metadata.truncated) {
      const truncationNote = `\n\nIMPORTANT: The source content exceeded the ${logAnalyzerConfig.limits.maxSizeMB}MB size limit and was truncated during download. You are analyzing only the first ${logAnalyzerConfig.limits.maxSizeMB}MB of the original content. Keep this in mind when drawing conclusions - there may be additional information in the truncated portion.`;
      enrichedContext = analysisContext
        ? `${analysisContext}${truncationNote}`
        : truncationNote.trim();
    }

    tracingContext.currentSpan?.update({
      metadata: {
        analysisContext: analysisContext ?? 'No analysis context provided',
        textLength: normalizedText?.length ?? 0,
      },
    });
    setState({
      ...state,
      text: normalizedText,
      analysisContext: enrichedContext,
    });

    return {};
  },
});

export const chunkStep = createStep({
  id: 'chunk',
  description: 'Token-aware chunking with overlap',
  stateSchema: WorkflowStateSchema,
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  execute: async ({ mastra, setState, state, tracingContext }) => {
    const logger = mastra.getLogger();
    const { text } = state;
    const doc = MDocument.fromText(text);
    const chunks = await doc.chunk({
      strategy: 'token',
      encodingName: logAnalyzerConfig.chunking.tokenizer,
      maxSize: logAnalyzerConfig.chunking.maxSize,
      overlap: logAnalyzerConfig.chunking.overlapTokens,
    });

    logger.debug('Chunking complete', {
      chunkCount: chunks.length,
    });

    tracingContext.currentSpan?.update({
      metadata: {
        chunkCount: chunks.length,
        chunkSize: logAnalyzerConfig.chunking.maxSize,
      },
    });

    setState({
      ...state,
      chunks,
    });
    return {};
  },
});

// --- Single-Pass Path (for files with 1 chunk) ---

export const singlePassStep = createStep({
  id: 'single-pass-analysis',
  description: 'Direct analysis and report generation for single-chunk files',
  stateSchema: WorkflowStateSchema,
  inputSchema: z.object({}),
  outputSchema: z.object({
    markdown: z.string(),
    summary: z.string(),
  }),
  execute: async ({ abortSignal, mastra, state, tracingContext }) => {
    const logger = mastra.getLogger();
    const { analysisContext, chunks } = state;

    if (!chunks) {
      throw new Error('Chunks are not available');
    }
    // Validate we have exactly one chunk
    if (chunks.length !== 1) {
      throw new Error(
        `Single-pass step requires exactly one chunk, but got ${chunks.length} chunks`
      );
    }

    const text = chunks[0]?.text ?? '';

    logger.debug('Single-pass analysis starting', {
      textLength: text.length,
      analysisContext,
    });

    const result = await generateMarkdownAndSummary({
      abortSignal,
      agent: reportFormatterAgent,
      analysisContext,
      logger,
      text,
      tracingContext,
    });

    logger.debug('Single-pass analysis complete', {
      markdownLength: result.markdown.length,
      summaryLength: result.summary.length,
    });

    return result;
  },
});

// --- Iterative Refinement Path (for files with multiple chunks) ---

export const initialStep = createStep({
  id: 'initial-summary',
  description: 'Summarize first chunk using log analyzer agent',
  stateSchema: WorkflowStateSchema,
  inputSchema: z.object({}),
  outputSchema: z.object({
    summary: z.string(),
  }),
  execute: async ({ abortSignal, mastra, setState, state, tracingContext }) => {
    const logger = mastra.getLogger();
    const { analysisContext, chunks } = state;
    if (!chunks) {
      throw new Error('Chunks are not available');
    }
    const first = chunks[0]?.text ?? '';

    logger.debug('Chunk length', { length: first.length });

    const result = await initialAnalyzerAgent.generate(
      USER_INITIAL_PROMPT(first, analysisContext),
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
      output: {
        summary,
      },
    });
    setState({
      ...state,
      idx: 1,
    });
    return {
      summary,
    };
  },
});

export const refineStep = createStep({
  id: 'refine-summary',
  description:
    'Iteratively refine the summary with context from previous chunks',
  stateSchema: WorkflowStateSchema,
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
    const { analysisContext, chunks, idx } = state;
    const { summary: existingSummary } = inputData;
    if (!chunks) {
      throw new Error('Chunks are not available');
    }
    const chunk = chunks[state.idx]?.text ?? '';

    // TODO: make sure summary size stays manageable
    if (!chunk) {
      return {
        summary: existingSummary,
      };
    }

    logger.debug(`Refine step for chunk #${idx + 1}:`, {
      total: chunks.length,
    });
    const result = await refinementAgent.generate(
      USER_REFINE(existingSummary, chunk, analysisContext),
      {
        structuredOutput: {
          schema: RefinementAgentOutputSchema,
          model: logAnalyzerConfig.models.schemaFormatter,
        },
        tracingContext,
        abortSignal,
      }
    );

    const response = result.object;

    const updated = response.updated ?? false;
    let newSummary = existingSummary;
    if (updated) {
      newSummary = response.summary ?? existingSummary;
    }

    tracingContext.currentSpan?.update({
      metadata: {
        idx: idx + 1,
        total: chunks.length,
      },
      output: {
        summary: newSummary,
      },
    });
    setState({
      ...state,
      idx: idx + 1,
      analysisContext,
    });
    return {
      summary: newSummary,
    };
  },
});

export const finalizeStep = createStep({
  id: 'finalize',
  description: 'Generate final markdown report and concise summary',
  inputSchema: z.object({
    summary: z.string(),
  }),
  stateSchema: WorkflowStateSchema,
  outputSchema: WorkflowOutputSchema,
  execute: async ({
    abortSignal,
    inputData,
    mastra,
    state,
    tracingContext,
  }) => {
    const logger = mastra.getLogger();
    const { summary } = inputData;
    const { analysisContext } = state;

    logger.debug('Finalize step starting');

    const result = await generateMarkdownAndSummary({
      abortSignal,
      agent: reportFormatterAgent,
      analysisContext,
      logger,
      text: summary,
      tracingContext,
    });

    logger.debug('Finalize step complete', {
      markdownLength: result.markdown.length,
      summaryLength: result.summary.length,
    });

    return result;
  },
});
