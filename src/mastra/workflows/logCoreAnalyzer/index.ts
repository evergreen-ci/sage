import { createTool } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { TracingContext } from '@mastra/core/ai-tracing';
import { IMastraLogger } from '@mastra/core/logger';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { MDocument } from '@mastra/rag';
import { z } from 'zod';
import { logAnalyzerConfig } from './config';
import { MB_TO_BYTES } from './constants';
import {
  loadFromFile,
  loadFromUrl,
  loadFromText,
  type LoadResult,
} from './dataLoader';
import {
  INITIAL_ANALYZER_INSTRUCTIONS,
  REFINEMENT_AGENT_INSTRUCTIONS,
  REPORT_FORMATTER_INSTRUCTIONS,
  USER_INITIAL_PROMPT,
  USER_REFINE,
  USER_MARKDOWN_PROMPT,
  USER_CONCISE_SUMMARY_PROMPT,
} from './prompts';
import { normalizeLineEndings, cropMiddle } from './utils';

// ============================================================================
// Schemas
// ============================================================================

// This workflow takes either a file path, raw text, or an URL as input, and optional additional instructions
// and returns a structured analysis report, as well as a concise summary.
const WorkflowInputSchema = z.object({
  path: z
    .string()
    .optional()
    .describe(
      'Absolute file path on the local filesystem (e.g., "/var/log/app.log", "/tmp/debug.txt"). The file must be accessible from the server.'
    ),
  text: z
    .string()
    .optional()
    .describe(
      'Raw text content to analyze. Use this when you already have the log content in memory or received it from another tool.'
    ),
  url: z
    .string()
    .optional()
    .describe(
      'HTTP/HTTPS URL to fetch and analyze content from. Must be a direct link to raw text/log content (e.g., "https://pastebin.com/raw/abc123").'
    ),
  analysisContext: z
    .string()
    .optional()
    .describe(
      'Additional context or specific analysis instructions. Can include file origin, what to focus on, or specific questions to answer during analysis.'
    ),
});

const WorkflowOutputSchema = z.object({
  markdown: z.string(),
  summary: z.string(),
});

const RefinementAgentOutputSchema = z.object({
  updated: z.boolean(),
  summary: z.string(),
});

const WorkflowStateSchema = z.object({
  text: z.string(),
  idx: z.number().default(0),
  chunks: z.array(z.object({ text: z.string() })).optional(),
  analysisContext: z.string().optional(),
});

// ============================================================================
// Agents
// ============================================================================

// Initial analyzer - uses a bigger model for the first chunk for better understanding of structure and context
const initialAnalyzerAgent = new Agent({
  name: 'initial-analyzer-agent',
  description:
    'Performs initial analysis of technical documents to understand structure and key patterns',
  instructions: INITIAL_ANALYZER_INSTRUCTIONS,
  model: logAnalyzerConfig.models.initial,
});

// Refinement agent - cheaper model for iterative processing
// This model is used when we have larger files and we need to iterate through the whole document to get a better summary
const refinementAgent = new Agent({
  name: 'refinement-agent',
  description:
    'Iteratively refines and updates technical summaries with new chunks',
  instructions: REFINEMENT_AGENT_INSTRUCTIONS,
  model: logAnalyzerConfig.models.refinement,
});

// Report formatter agent - formats final output
const reportFormatterAgent = new Agent({
  name: 'report-formatter-agent',
  description: 'Formats technical summaries into various output formats',
  instructions: REPORT_FORMATTER_INSTRUCTIONS,
  model: logAnalyzerConfig.models.formatter,
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generates both a markdown report and concise summary from input text
 * @param {AbortSignal} [abortSignal] - Optional abort signal
 * @param {Agent} agent - Agent to use for generation
 * @param {string} [analysisContext] - Optional context for analysis
 * @param {IMastraLogger} logger - Logger instance
 * @param {string} text - Input text to analyze
 * @param {TracingContext} tracingContext - Tracing context for observability
 * @returns {{ markdown: string, summary: string }} Object containing markdown report and concise summary
 */
const generateMarkdownAndSummary = async ({
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
}) => {
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

// ============================================================================
// Steps
// ============================================================================

// Unified load step that handles all I/O with validation
const loadDataStep = createStep({
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

const chunkStep = createStep({
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

const singlePassStep = createStep({
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

const initialStep = createStep({
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

const refineStep = createStep({
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

const finalizeStep = createStep({
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

// ============================================================================
// Workflows
// ============================================================================

const iterativeRefinementWorkflow = createWorkflow({
  id: 'iterative-refinement',
  description: `Perform a 3 step iterative refinement process: initial and final analysis with an expensive model,
    and a lightweight refinement loop going through the whole document`,
  inputSchema: z.object({}),
  outputSchema: WorkflowOutputSchema,
  stateSchema: WorkflowStateSchema,
  // Occasionally, the workflow fails at a step, so we retry it a few times
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
})
  .then(initialStep)
  .dowhile(
    refineStep,
    async ({ state }) =>
      // Access inputData from the full params object
      state.idx < (state.chunks?.length ?? 0)
  )
  .then(finalizeStep)
  .commit();

const decideAndRunStep = createStep({
  id: 'decide-and-run',
  description: 'Choose single-pass vs iterative workflow and run it',
  inputSchema: z.object({}),
  outputSchema: WorkflowOutputSchema,
  stateSchema: WorkflowStateSchema,
  execute: async params => {
    const { mastra, state } = params;
    const logger = mastra.getLogger();
    if (!state.chunks) {
      throw new Error('Chunks are not available');
    }
    if (state.chunks.length === 1) {
      logger.debug('Running single-pass step for single chunk');
      // run the single-pass step directly
      return singlePassStep.execute(params);
    }
    logger.debug('Running iterative refinement workflow for multiple chunks');
    // run the iterative workflow
    return iterativeRefinementWorkflow.execute(params);
  },
});

export const logCoreAnalyzerWorkflow = createWorkflow({
  id: 'log-core-analyzer',
  description:
    'Analyzes and summarizes log files, technical documents, or any text content. Produces a structured markdown report with key findings and a concise summary. ' +
    'INPUTS (provide exactly ONE): ' +
    '• path: Absolute file path on the local filesystem (e.g., "/var/log/app.log") ' +
    '• url: HTTP/HTTPS URL to fetch content from (e.g., "https://example.com/logs.txt") ' +
    '• text: Raw text content as a string (for content already in memory) ' +
    'OPTIONAL: analysisContext - Additional instructions for what to focus on (e.g., "Look for timeout errors", "Focus on authentication issues") ' +
    'NOTE: This tool analyzes raw file content. It does NOT fetch data from Evergreen or other APIs - provide the actual content or a direct URL/path to it.',
  inputSchema: WorkflowInputSchema,
  outputSchema: WorkflowOutputSchema,
  stateSchema: WorkflowStateSchema,
})
  .then(loadDataStep) // Use the new unified load step with validation
  .then(chunkStep)
  .then(decideAndRunStep)
  .commit();

// ============================================================================
// Tool Export
// ============================================================================

export const logCoreAnalyzerTool: ReturnType<
  typeof createTool<
    typeof logCoreAnalyzerWorkflow.inputSchema,
    typeof logCoreAnalyzerWorkflow.outputSchema
  >
> = createTool({
  id: 'logCoreAnalyzerTool',
  description:
    logCoreAnalyzerWorkflow.description ||
    'Analyzes log files and text content',
  inputSchema: logCoreAnalyzerWorkflow.inputSchema,
  outputSchema: logCoreAnalyzerWorkflow.outputSchema,
  execute: async ({
    context,
    resourceId,
    runId,
    runtimeContext,
    tracingContext,
  }) => {
    const run = await logCoreAnalyzerWorkflow.createRunAsync({
      resourceId,
      runId,
    });

    const runResult = await run.start({
      inputData: context,
      runtimeContext,
      tracingContext,
    });
    if (runResult.status === 'success') {
      return runResult.result;
    }
    if (runResult.status === 'failed') {
      const errorMessage =
        runResult.error instanceof Error
          ? runResult.error.message
          : String(runResult.error);
      throw new Error(`Log analyzer workflow failed: ${errorMessage}`);
    }
    throw new Error(
      `Unexpected workflow execution status: ${runResult.status}. Expected 'success' or 'failed'.`
    );
  },
});
