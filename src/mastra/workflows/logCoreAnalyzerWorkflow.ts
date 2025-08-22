import { Agent } from '@mastra/core/agent';
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { MDocument } from '@mastra/rag';
import { encode } from 'gpt-tokenizer';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { WinstonMastraLogger } from '../../utils/logger/winstonMastraLogger';
import { gpt41, gpt41Nano } from '../models/openAI/gpt41';

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
    const { contextHint, path: p, text } = inputData;
    let raw = text ?? '';
    if (p) {
      const buf = await fs.readFile(path.resolve(p));
      raw = buf.toString('utf8');
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
const countTokens = (s: string) => encode(s).length;

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
const INITIAL_ANALYZER_INSTRUCTIONS = `You are a senior engineer performing initial analysis of technical text (logs, code, configs, telemetry, build output).
You always respond as compact JSON matching the provided schema.
Focus on:
- Understanding the overall structure and format of the content
- Identifying key patterns, sections, and data types
- Establishing context and technical domain
- Preserving critical facts, identifiers, timestamps, error codes
- Creating a strong foundation summary for further refinement`;

const initialAnalyzerAgent = new Agent({
  name: 'initial-analyzer-agent',
  description:
    'Performs initial analysis of technical documents to understand structure and key patterns',
  instructions: INITIAL_ANALYZER_INSTRUCTIONS,
  model: gpt41,
});

const USER_INITIAL_PROMPT = (chunk: string, hint?: string) =>
  `Analyze this first chunk to understand the document structure and create an initial technical summary.
Identify the type of content (logs, code, config, telemetry, etc.) and key patterns.
${hint ? `Context hint:\n${hint}\n` : ''}

Chunk:
"""${chunk}"""

Return JSON:
{ "updated": true, "summary": "<concise but comprehensive summary>", "evidence": ["<short quotes or line ranges>"] }`;

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
        output: LoopStateOutputSchema,
      }
    );

    const summary = result.object?.summary ?? '';
    return { idx: 1, chunks, summary, contextHint };
  },
});

// Step 3: Recursive iterative refinement (using cheaper model)

// Refinement agent - cheaper model for iterative updates
const REFINEMENT_AGENT_INSTRUCTIONS = `You are a technical analyst updating existing summaries with new information.
You always respond as compact JSON matching the provided schema.
- Merge new facts into the existing summary efficiently
- Collapse repeated patterns; prefer timelines for events
- If a new chunk adds nothing material, set "updated": false
- Keep the summary concise while preserving all important details`;

const refinementAgent = new Agent({
  name: 'refinement-agent',
  description:
    'Iteratively refines and updates technical summaries with new chunks',
  instructions: REFINEMENT_AGENT_INSTRUCTIONS,
  model: gpt41Nano,
});

const USER_REFINE = (existing: string, chunk: string, hint?: string) =>
  `Refine the existing summary with ONLY *material* additions or corrections from the new chunk.
If the chunk adds nothing substantive, return {"updated": false, "summary": "<unchanged>", "evidence": []}.

${hint ? `Context hint:\n${hint}\n` : ''}

Existing summary:
"""${existing}"""

New chunk:
"""${chunk}"""

Return JSON:
{ "updated": <bool>, "summary": "<updated or unchanged>", "evidence": ["<short quotes or line ranges>"] }`;

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
        output: LoopStateOutputSchema, // TODO: define error handling strategy when schema validation fails
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

const FinalizeSchema = z.object({
  markdown: z.string(),
  summary: z.string(),
});

const ResultSchema = z.object({
  markdown: z.string(),
  summary: z.string(),
  filePath: z.string().optional(),
});

const MAX_FINAL_SUMMARY_TOKENS = 2048;

// Common executive summary requirements
const EXECUTIVE_SUMMARY_REQUIREMENTS = `- 3-4 lines maximum
- Focus on: what happened, key impacts/metrics, critical actions needed
- Plain text only, no markdown formatting
- Be direct and factual`;

// Common markdown report formatting instructions
const MARKDOWN_REPORT_FORMAT = `Use the following structure with proper Markdown headers:
# Technical Analysis Report

## Overview
(Concise summary of the situation)

## Key Entities/Modules
- Use bullet points
- Include identifiers and technical names

## Timeline / Key Events
(Chronological list with clear sequence)

## Anomalies / Errors
### Error 1 Title
- **Description:** ...
- **Evidence:** ...
- **Likely Cause:** ...

## Metrics / Counts
| Metric | Value |
|--------|-------|
| ... | ... |

## Open Questions / Next Actions
- [ ] Action item 1
- [ ] Action item 2

Format with proper Markdown: use **bold** for emphasis, \`code\` for technical terms, proper headers (#, ##, ###), tables where appropriate.
Keep it <= ${MAX_FINAL_SUMMARY_TOKENS} tokens; compress without losing facts.`;

// Define the report formatter agent for final output
const REPORT_FORMATTER_INSTRUCTIONS = `You are a senior engineer creating technical reports and summaries.
You respond ONLY with the requested format - no JSON wrapper, no additional fields.
Focus on clarity, precision, and appropriate formatting for the requested output type.`;

const reportFormatterAgent = new Agent({
  name: 'report-formatter-agent',
  description: 'Formats technical summaries into various output formats',
  instructions: REPORT_FORMATTER_INSTRUCTIONS,
  model: gpt41,
});

const USER_MARKDOWN_PROMPT = (summary: string) =>
  `Rewrite the accumulated summary into a clean technical report formatted as Markdown.

${MARKDOWN_REPORT_FORMAT}

Source material:
"""${summary}"""`;

const USER_EXECUTIVE_SUMMARY_PROMPT = (markdown: string) =>
  `Create a concise executive summary from this technical report.

Requirements:
${EXECUTIVE_SUMMARY_REQUIREMENTS}

Source report:
"""${markdown}"""`;

// Single-pass step for files that fit in one chunk - generates both markdown and summary in one call
const SINGLE_PASS_PROMPT = (text: string, contextHint?: string) =>
  `Analyze this technical document and provide both a markdown report and executive summary.
${contextHint ? `Context hint:\n${contextHint}\n` : ''}

Document:
"""${text}"""

Return a JSON response with two fields:
{
  "markdown": "# Technical Analysis Report\n\n## Overview\n...[full markdown report]",
  "summary": "3-4 line executive summary"
}

Requirements for the markdown report:
${MARKDOWN_REPORT_FORMAT}

Requirements for the executive summary:
${EXECUTIVE_SUMMARY_REQUIREMENTS}`;

const singlePassStep = createStep({
  id: 'single-pass-analysis',
  description: 'Direct analysis and report generation for single-chunk files',
  inputSchema: ChunkedSchema,
  outputSchema: FinalizeSchema,
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
      {
        output: FinalizeSchema,
      }
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
  outputSchema: FinalizeSchema,
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
  inputSchema: FinalizeSchema,
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
  description:
    'Hierarchical refine summarization for arbitrary technical text files',
  inputSchema: ChunkedSchema,
  outputSchema: FinalizeSchema,
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

// Wrap refinement workflow into a step, for branching (needed because it has a dowhile loop)
const iterativeRefinementBranchStep = createStep({
  id: 'iterative-refinement-branch',
  description: 'Delegate to iterative-refinement workflow',
  inputSchema: ChunkedSchema,
  outputSchema: FinalizeSchema,
  execute: async params => {
    const result = await iterativeRefinementWorkflow.execute(params);
    return result;
  },
});

// Keyed schema needed because branch condition return it like this
const BranchOutputSchema = z.object({
  'single-pass-analysis': FinalizeSchema,
  'iterative-refinement-branch': FinalizeSchema,
});

const extractBranchOutputStep = createStep({
  id: 'extract-branch-output',
  description: 'Select the branch output (single-pass or iterative)',
  inputSchema: BranchOutputSchema,
  outputSchema: FinalizeSchema,
  execute: async ({ inputData }) => {
    const a = inputData['single-pass-analysis'];
    const b = inputData['iterative-refinement-branch'];
    const chosen = a?.markdown || a?.summary ? a : b;
    return {
      markdown: chosen?.markdown ?? '',
      summary: chosen?.summary ?? '',
    };
  },
});

export const logCoreAnalyzer = createWorkflow({
  id: 'log-core-analyzer',
  description:
    'Hierarchical refine summarization for arbitrary technical text files',
  inputSchema: WorkflowInputSchema,
  outputSchema: ResultSchema,
})
  .then(readStep)
  .then(chunkStep)
  .branch([
    [
      async params => params.inputData.chunks.length === 1,
      singlePassStep, // Use the step directly instead of wrapping it
    ],
    [
      async params => params.inputData.chunks.length > 1,
      iterativeRefinementBranchStep, // Keep the wrapper for the complex workflow
    ],
  ])
  .then(extractBranchOutputStep)
  .then(presentationStep)
  .commit();
