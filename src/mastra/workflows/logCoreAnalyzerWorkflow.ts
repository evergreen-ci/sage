import { Agent } from '@mastra/core/agent';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { MDocument } from '@mastra/rag';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config';
import { WinstonMastraLogger } from '../../utils/logger/winstonMastraLogger';
import { gpt41, gpt41Nano } from '../models/openAI/gpt41';
import {
  INITIAL_ANALYZER_INSTRUCTIONS,
  REFINEMENT_AGENT_INSTRUCTIONS,
  REPORT_FORMATTER_INSTRUCTIONS,
  USER_INITIAL_PROMPT,
  USER_REFINE,
  USER_MARKDOWN_PROMPT,
  USER_EXECUTIVE_SUMMARY_PROMPT,
  SINGLE_PASS_PROMPT,
} from './logCoreAnalyzer/prompts';

// Initialize logger for this workflow
const logger = new WinstonMastraLogger({
  name: 'LogCoreAnalyzerWorkflow',
  level: 'debug',
});

// TODO:
// - push to staging with drone
// - postman to send chat request
// - braintrust to check token usage
// - support fetching from URLs, look at evergreenClient.ts for auth headers
// - cap file limit for v0

// TODO: follow up PR with tests

// Input: path to the file or content as string, initial prompt (optional, can contain more information about the task, the goal...)
// Output: summary/analysis,

const WorkflowInputSchema = z.object({
  path: z.string().optional(),
  text: z.string().optional(),
  url: z.string().optional(),
  contextHint: z.string().optional(),
});

const readStep = createStep({
  id: 'read-input',
  description: 'Read file or accept provided text, normalize',
  inputSchema: WorkflowInputSchema,
  outputSchema: z.object({
    text: z.string(),
    contextHint: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const { contextHint, path: p, text, url } = inputData;

    let raw = text ?? '';
    if (p) {
      const buf = await fs.readFile(path.resolve(p));
      raw = buf.toString('utf8');
    } else if (url) {
      // Build authentication headers for Evergreen API
      const headers = new Headers();
      headers.set('Accept', 'text/plain,application/json');

      // Add Evergreen API authentication if credentials are configured
      if (config.evergreen.apiUser && config.evergreen.apiKey) {
        headers.set('Api-User', config.evergreen.apiUser);
        headers.set('Api-Key', config.evergreen.apiKey);
      } else {
        logger.warn(
          'Evergreen API credentials are not set in config; making unauthenticated request'
        );
      }

      logger.debug('Fetching URL with authentication', {
        url,
        hasAuth: !!(config.evergreen.apiUser && config.evergreen.apiKey),
      });

      try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
          throw new Error(
            `Failed to fetch URL: ${url} (${response.status} ${response.statusText})`
          );
        }
        raw = await response.text();
      } catch (error) {
        logger.error('Failed to fetch URL', { url, error });
        throw new Error(
          `Failed to fetch URL ${url}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    // cheap normalization
    raw = raw.replace(/\r\n/g, '\n').replace(/\n{4,}/g, '\n\n\n');
    return { text: raw, contextHint };
  },
});

// Step 1: Chunking

const ChunkedSchema = z.object({
  chunks: z.array(z.object({ text: z.string() })), // from MDocument.chunk
  contextHint: z.string().optional(),
});

// Default to o200k_base tokenizer
// const countTokens = (s: string) => encode(s).length;

// Chunking configuration for GPT-4.1 nano (Assume max 128k context, but may be 1M)
// TODO: hyperparameters below, need to find a right balance. Currently just for quick prototyping
const CHUNK_SIZE = 20_000; // Optimal size for GPT-4 models
const OVERLAP_TOKENS = 800; // Overlap to maintain context between chunks
const GPT_DEFAULT_TOKENIZER = 'o200k_base'; // Tokenizer for GPT-4 TODO: auto selection based on model

const chunkStep = createStep({
  id: 'chunk',
  description: 'Token-aware chunking with overlap',
  inputSchema: z.object({
    text: z.string(),
    contextHint: z.string().optional(),
  }),
  outputSchema: ChunkedSchema,
  execute: async ({ inputData }) => {
    const { contextHint, text } = inputData;

    const doc = MDocument.fromText(text);
    const chunks = await doc.chunk({
      strategy: 'token',
      encodingName: GPT_DEFAULT_TOKENIZER,
      maxSize: CHUNK_SIZE,
      overlap: OVERLAP_TOKENS,
    });
    logger.debug('Chunking complete', { chunkCount: chunks.length });
    return { chunks, contextHint };
  },
});

// Step 2: First chunk analysis

// This schema will be passed in the whole summarization loop
const LoopStateSchema = z.object({
  idx: z.number(),
  chunks: z.array(z.object({ text: z.string() })),
  summary: z.string(),
  contextHint: z.string().optional(),
});

const LoopStateOutputSchema = z.object({
  updated: z.boolean(),
  summary: z.string(),
  evidence: z.array(z.string()).optional(),
});

// Define the log analyzer agent for chunked processing
// Ultimately, the first call should be 4.1, and all other iterations should use nano
// Initial analyzer - smarter model for understanding structure and context

const initialAnalyzerAgent = new Agent({
  name: 'initial-analyzer-agent',
  description:
    'Performs initial analysis of technical documents to understand structure and key patterns',
  instructions: INITIAL_ANALYZER_INSTRUCTIONS,
  model: gpt41,
});


const initialStep = createStep({
  id: 'initial-summary',
  description: 'Summarize first chunk using log analyzer agent',
  inputSchema: ChunkedSchema,
  outputSchema: LoopStateSchema,
  execute: async ({ inputData }) => {
    const { chunks, contextHint } = inputData;
    const first = chunks[0]?.text ?? '';
    logger.debug('Initial chunk for analysis', {
      first: first.slice(0, 100),
      contextHint,
    });
    logger.debug('Chunk length', { length: first.length });
    logger.debug('Calling LLM for initial summary');

    const result = await initialAnalyzerAgent.generateVNext(
      [{ role: 'user', content: USER_INITIAL_PROMPT(first, contextHint) }],
      {
        structuredOutput: { schema: LoopStateOutputSchema, model: gpt41 },
      }
    );

    const summary = result.object?.summary ?? '';
    return { idx: 1, chunks, summary, contextHint };
  },
});

// Step 3: Recursive iterative refinement (using cheaper model)

// Refinement agent - cheaper model for iterative updates

const refinementAgent = new Agent({
  name: 'refinement-agent',
  description:
    'Iteratively refines and updates technical summaries with new chunks',
  instructions: REFINEMENT_AGENT_INSTRUCTIONS,
  model: gpt41Nano,
});


const refineStep = createStep({
  id: 'refine-summary',
  description:
    'Iteratively refine the summary with context from previous chunks',
  inputSchema: LoopStateSchema,
  outputSchema: LoopStateSchema,
  execute: async ({ inputData }) => {
    const { chunks, contextHint, idx, summary: existingSummary } = inputData;
    const chunk = chunks[idx]?.text ?? '';

    // TODO: make sure summary size stays manageable
    if (!chunk) {
      return {
        idx: idx + 1,
        chunks,
        summary: existingSummary,
        contextHint,
      };
    }

    logger.debug('Refine step for chunk #:', {
      current: idx + 1,
      total: chunks.length,
    });
    const result = await refinementAgent.generateVNext(
      [
        {
          role: 'user',
          content: USER_REFINE(existingSummary, chunk, contextHint),
        },
      ],
      {
        structuredOutput: { schema: LoopStateOutputSchema, model: gpt41Nano }, // TODO: define error handling strategy when schema validation fails
      }
    );

    const updated = result.object?.updated ?? false;
    let newSummary = existingSummary;
    if (updated) {
      newSummary = result.object?.summary ?? existingSummary; // TODO: error if no new summary
    }

    return {
      idx: idx + 1,
      chunks,
      summary: newSummary,
      contextHint,
    };
  },
});

// Step 4: Final report

const ReportsSchema = z.object({
  markdown: z.string(),
  summary: z.string(),
});

const ResultSchema = z.object({
  markdown: z.string(),
  summary: z.string(),
  filePath: z.string().optional(),
});

// Define the report formatter agent for final output

const reportFormatterAgent = new Agent({
  name: 'report-formatter-agent',
  description: 'Formats technical summaries into various output formats',
  instructions: REPORT_FORMATTER_INSTRUCTIONS,
  model: gpt41,
});



// Single-pass step for files that fit in one chunk - generates both markdown and summary in one call

const singlePassStep = createStep({
  id: 'single-pass-analysis',
  description: 'Direct analysis and report generation for single-chunk files',
  inputSchema: ChunkedSchema,
  outputSchema: ReportsSchema,
  execute: async ({ inputData }) => {
    const { chunks, contextHint } = inputData;

    // Validate we have exactly one chunk
    if (chunks.length !== 1) {
      logger.warn('Single-pass step called with multiple chunks', {
        chunkCount: chunks.length,
      });
    }

    const text = chunks[0]?.text ?? '';

    logger.debug('Single-pass analysis starting', {
      textLength: text.length,
      contextHint,
    });

    // Use structured output to get both markdown and summary
    const result = await reportFormatterAgent.generateVNext(
      [{ role: 'user', content: SINGLE_PASS_PROMPT(text, contextHint) }],
      { structuredOutput: { schema: ReportsSchema, model: gpt41 } }
    );

    logger.debug('Single-pass analysis complete', {
      markdownLength: result.object?.markdown?.length ?? 0,
      summaryLength: result.object?.summary?.length ?? 0,
    });

    return {
      markdown: result.object?.markdown || '',
      summary: result.object?.summary || '',
    };
  },
});

const finalizeStep = createStep({
  id: 'finalize',
  description: 'Generate final markdown report and executive summary',
  inputSchema: LoopStateSchema,
  outputSchema: ReportsSchema,
  execute: async ({ inputData }) => {
    const { summary } = inputData;
    logger.debug('Generating final markdown report', {
      summary: summary.slice(0, 100),
    });

    // Generate markdown report
    const markdownRes = await reportFormatterAgent.generateVNext([
      { role: 'user', content: USER_MARKDOWN_PROMPT(summary) },
    ]);
    logger.debug('Final markdown report generated', {
      length: markdownRes.text.length,
    });

    // Generate executive summary from the markdown report
    logger.debug('Generating executive summary');
    const execSummaryRes = await reportFormatterAgent.generateVNext([
      {
        role: 'user',
        content: USER_EXECUTIVE_SUMMARY_PROMPT(markdownRes.text),
      },
    ]);
    logger.debug('Executive summary generated', {
      length: execSummaryRes.text.length,
    });

    return {
      markdown: markdownRes.text,
      summary: execSummaryRes.text,
    };
  },
});

// Step 5: Save markdown report to disk
const presentationStep = createStep({
  id: 'save-report',
  description: 'Save markdown report to disk with timestamp',
  inputSchema: ReportsSchema,
  outputSchema: ResultSchema,
  execute: async ({ inputData }) => {
    const { markdown, summary } = inputData;

    // Validate inputs
    if (!markdown) {
      logger.error('No markdown content to save', {
        hasMarkdown: !!markdown,
        hasSummary: !!summary,
        inputDataKeys: Object.keys(inputData),
      });
      return {
        markdown: '',
        summary: summary || '',
        filePath: undefined,
      };
    }

    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), 'reports');
    try {
      await fs.mkdir(reportsDir, { recursive: true });
    } catch (err) {
      logger.debug('Reports directory creation', { error: err });
    }

    // Generate timestamp for filename
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, -5);
    const filename = `report-${timestamp}.md`;
    const filePath = path.join(reportsDir, filename);

    // Save markdown file
    await fs.writeFile(filePath, markdown, 'utf8');
    logger.info('Report saved', { filePath });

    return {
      markdown,
      summary: summary || '',
      filePath,
    };
  },
});

const iterativeRefinementWorkflow = createWorkflow({
  id: 'iterative-refinement',
  description: `Perform a 3 step iterative refinement process: initial and final analysis with an expensive model, 
    and a lightweight refinement loop going through the whole document`,
  inputSchema: ChunkedSchema,
  outputSchema: ReportsSchema,
})
  .then(initialStep)
  .dowhile(
    refineStep,
    async params =>
      // Access inputData from the full params object
      params.inputData.idx < params.inputData.chunks.length
  )
  .then(finalizeStep)
  .commit();

// This was initially a `.branch()` workflow step, but it involved too much complexity like unwrapping types correctly,
// or wrapping iterativeRefinementWorkflow into its own step. This option is much simpler.
const decideAndRunStep = createStep({
  id: 'decide-and-run',
  description: 'Choose single-pass vs iterative workflow and run it',
  inputSchema: ChunkedSchema,
  outputSchema: ReportsSchema,
  execute: async params => {
    const { chunks } = params.inputData;
    if (chunks.length === 1) {
      // run the single-pass step directly
      return singlePassStep.execute(params);
    }
    // run the iterative workflow
    return iterativeRefinementWorkflow.execute(params);
  },
});

export const logCoreAnalyzerWorkflow = createWorkflow({
  id: 'log-core-analyzer',
  // In the description, tell the agent to use the "url" parameter, but any of them work.
  description:
    'Analyze, iteratively summarize, and produce a complete report of technical files of arbitrary types and structures. Pass the full URL of the file in the `url:` parameter.',
  inputSchema: WorkflowInputSchema,
  outputSchema: ResultSchema,
})
  .then(readStep)
  .then(chunkStep)
  .then(decideAndRunStep)
  .then(presentationStep)
  .commit();
