import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { MDocument } from "@mastra/rag";
import { Agent } from "@mastra/core/agent";
import { encode } from "gpt-tokenizer";
import { gpt41 } from '../models/openAI/gpt41';
import fs from "node:fs/promises";
import path from "node:path";
import { WinstonMastraLogger } from "../../utils/logger/winstonMastraLogger";

// Initialize logger for this workflow
const logger = new WinstonMastraLogger({
  name: "LogCoreAnalyzerWorkflow",
  level: "debug"
});

// Input: path to the file or content as string, initial prompt (optional, can contain more information about the task, the goal...)
// Output: summary/analysis, 

const WorkflowInputSchema = z.object({
  path: z.string().optional(),
  text: z.string().optional(),
  contextHint: z.string().optional()
});

const readStep = createStep({
  id: "read-input",
  description: "Read file or accept provided text, normalize",
  inputSchema: WorkflowInputSchema,
  outputSchema: z.object({ text: z.string(), contextHint: z.string().optional() }),
  execute: async ({ inputData }) => {
    const { path: p, text, contextHint } = inputData;
    let raw = text ?? "";
    if (p) {
      const buf = await fs.readFile(path.resolve(p));
      raw = buf.toString("utf8");
    }
    // cheap normalization
    raw = raw.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n");
    return { text: raw, contextHint };
  }
});

// Step 1: Chunking

const ChunkedSchema = z.object({
  chunks: z.array(z.object({ text: z.string() })),   // from MDocument.chunk
  contextHint: z.string().optional()
});

// Default to o200k_base tokenizer
const countTokens = (s: string) => encode(s).length;

// Chunking configuration for GPT-4.1 nano (Assume max 128k context, but may be 1M)
const CHUNK_SIZE = 30_000;  // Optimal size for GPT-4 models
const OVERLAP_TOKENS = 1000;  // Overlap to maintain context between chunks
const GPT_DEFAULT_TOKENIZER = "o200k_base"; // Tokenizer for GPT-4 TODO: auto selection based on model

const chunkStep = createStep({
  id: "chunk",
  description: "Token-aware chunking with overlap",
  inputSchema: z.object({ text: z.string(), contextHint: z.string().optional() }),
  outputSchema: ChunkedSchema,
  execute: async ({ inputData }) => {
    const { text, contextHint } = inputData;

    const doc = MDocument.fromText(text);
    const chunks = await doc.chunk({
      strategy: "token",
      encodingName: GPT_DEFAULT_TOKENIZER,
      maxSize: CHUNK_SIZE,
      overlap: OVERLAP_TOKENS
    });
    console.log
    return { chunks, contextHint };
  }
});

// Step 2: First chunk analysis

// This schema will be passed in the whole summarization loop
const LoopStateSchema = z.object({
  idx: z.number(),
  chunks: z.array(z.object({ text: z.string() })),
  summary: z.string(),
  contextHint: z.string().optional()
});

const LoopStateOutputSchema = z.object({
        updated: z.literal(true),
        summary: z.string(),
        evidence: z.array(z.string()).optional()
      })

// Define the log analyzer agent
const logAnalyzerAgent = new Agent({
  name: "log-analyzer-agent",
  description: "Analyzes and summarizes technical text chunks (logs, code, configs, telemetry, build output)",
  instructions: `You are a senior engineer compressing *technical* text (logs, code, configs, telemetry, build output).
You always respond as compact JSON matching the provided schema.
- Preserve facts, identifiers, timestamps, error codes, and concrete evidence.
- Collapse repeated patterns; merge equivalent lines; prefer timelines for events.
- If a new chunk adds nothing material, set "updated": false.`,
  model: gpt41,
});

const USER_INITIAL_PROMPT = (chunk: string, hint?: string) =>
  `Summarize this first chunk into a concise technical brief.
${hint ? `Context hint:\n${hint}\n` : ""}

Chunk:
"""${chunk}"""

Return JSON:
{ "updated": true, "summary": "<concise but comprehensive summary>", "evidence": ["<short quotes or line ranges>"] }`;

const initialStep = createStep({
  id: "initial-summary",
  description: "Summarize first chunk using log analyzer agent",
  inputSchema: ChunkedSchema,
  outputSchema: LoopStateSchema,
  execute: async ({ inputData }) => {
    const { chunks, contextHint } = inputData;
    const first = chunks[0]?.text ?? "";
    
    const result = await logAnalyzerAgent.generate(
        USER_INITIAL_PROMPT(first, contextHint), 
        {
            experimental_output: LoopStateOutputSchema
        },
    );

    const summary = result.object?.summary ?? "";
    return { idx: 1, chunks, summary, contextHint };
  }
});

// Step 3: Recursive iterative refinement
// TODO cheaper agent (model) for the loop

const USER_REFINE = (existing: string, chunk: string, hint?: string) =>
  `Refine the existing summary with ONLY *material* additions or corrections from the new chunk.
If the chunk adds nothing substantive, return {"updated": false, "summary": "<unchanged>"}.

${hint ? `Context hint:\n${hint}\n` : ""}

Existing summary:
"""${existing}"""

New chunk:
"""${chunk}"""

Return JSON:
{ "updated": <bool>, "summary": "<updated or unchanged>", "evidence": ["<short quotes or line ranges>"] }`;


const refineStep = createStep({
  id: "refine-summary",
  description: "Iteratively refine the summary with context from previous chunks",
  inputSchema: LoopStateSchema,
  outputSchema: LoopStateSchema,
  execute: async ({ inputData }) => {
    const { idx, chunks, summary: existingSummary, contextHint } = inputData;
    const chunk = chunks[idx]?.text ?? "";

    // TODO: make sure summary size stays manageable
    if (!chunk) {
      throw new Error("No more chunks to process");
    }

    const result = await logAnalyzerAgent.generate(
        USER_REFINE(existingSummary, chunk, contextHint), 
        {
            experimental_output: LoopStateOutputSchema // TODO: define error handling strategy when schema validation fails
        },
    );

    const updated = result.object?.updated ?? false;
    var newSummary = existingSummary;
    if (updated) {
      newSummary = result.object?.summary ?? existingSummary; // TODO: error if no new summary
    }

    return {
      idx: idx + 1,
      chunks,
      summary: newSummary,
      contextHint,
    };

  }
});

// Step 4: Final report

const ResultSchema = z.object({
  report: z.string(),
});

const MAX_FINAL_SUMMARY_TOKENS = 2048;

const USER_FINALIZE_PROMPT = (summary: string) =>
  `Rewrite the accumulated summary into a clean technical report with sections:
1) Overview
2) Key Entities/Modules
3) Timeline / Key Events (chronological)
4) Anomalies / Errors (with likely causes)
5) Metrics / Counts (if present)
6) Open Questions / Next Actions

Keep it <= ${MAX_FINAL_SUMMARY_TOKENS} tokens; compress without losing facts.

Source material:
"""${summary}"""`;

const finalizeStep = createStep({
  id: "finalize",
  description: "Normalize and format final report",
  inputSchema: LoopStateSchema,
  outputSchema: ResultSchema,
  execute: async ({ inputData }) => {
    const { summary } = inputData;
    const finalRes = await logAnalyzerAgent.generate(
      USER_FINALIZE_PROMPT(summary),
    );
    return {
      report: finalRes.text,
    };
  }
});

export const logCoreAnalyzer = createWorkflow({
  id: "log-core-analyzer",
  description: "Hierarchical refine summarization for arbitrary technical text files",
  inputSchema: WorkflowInputSchema,
  outputSchema: ResultSchema
})
  .then(readStep)
  .then(chunkStep)
  .then(initialStep)
  // sequential refine until idx == chunks.length
  .dowhile(refineStep, async ({ inputData }) => inputData.idx < inputData.chunks.length)
  .then(finalizeStep)
  .commit();

