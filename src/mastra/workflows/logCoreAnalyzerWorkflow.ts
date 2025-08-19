import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { MDocument } from "@mastra/rag";
import { generateText } from "ai";
import { encode } from "gpt-tokenizer"; // o200k_base by default, the GPT 4 tokenizer

// Input: path to the file or content as string, initial prompt (optional, can contain more information about the task, the goal...)
// Output: summary/analysis, 

// Workflow steps :
// Read, preprocess (line endings, consecutive blank lines, reject binary files...)
// Chunking
// - Count tokens (o200k_base)
// - Have some overlap, compute budget, chunk size
// First chunk analysis
// Recursive iterative refinement (gpt41 nano) ; pass context about where we are in the file
// Last step analysis, producing final output
const step1 = createStep({
  id: "step-1",
  description: "passes value from input to output",
  inputSchema: z.object({
    value: z.number()
  }),
  outputSchema: z.object({
    value: z.number()
  }),
  execute: async ({ inputData }) => {
    const { value } = inputData;
    return {
      value
    };
  }
});


const ChunkedSchema = z.object({
  chunks: z.array(z.object({ text: z.string() })),   // from MDocument.chunk
  contextHint: z.string().optional()
});

// TODO: enable auto selection of tokenizer
const countTokens = (s: string) => encode(s).length;

const MAX_CONTEXT_TOKENS = 128_000; // 128k to start, but gpt4 models can hanle 1M
const SAFETY_MARGIN_TOKENS = 2000;
const DEFAULT_CHUNK_TOKENS = 30000;  // Much larger for GPT-4 models
const OVERLAP_TOKENS = 500;  // Larger overlap for bigger chunks
const MAX_FINAL_SUMMARY_TOKENS = 4000; 


function fitLinesToTokens(text: string, maxTokens: number) {
  const lines = text.split(/\r?\n/);
  let lo = 0, hi = lines.length, best = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const slice = lines.slice(0, mid).join("\n");
    if (countTokens(slice) <= maxTokens) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
  }
  return { uptoLine: best, text: lines.slice(0, best).join("\n") };
}

function getChunkSize(promptBudget: number, prevSummaryBudget: number) {
  const perStep = MAX_CONTEXT_TOKENS - SAFETY_MARGIN_TOKENS - promptBudget - prevSummaryBudget;
  // Use 80% of available space, but cap at DEFAULT_CHUNK_TOKENS
  const calculated = Math.floor(perStep * 0.8);
  return Math.min(DEFAULT_CHUNK_TOKENS, Math.max(800, calculated));
}

const SYSTEM_REFINE_PROMPT = `You are a senior engineer compressing *technical* text (logs, code, configs, telemetry, build output).
You always respond as compact JSON matching the provided schema.
- Preserve facts, identifiers, timestamps, error codes, and concrete evidence.
- Collapse repeated patterns; merge equivalent lines; prefer timelines for events.
- If a new chunk adds nothing material, set "updated": false.`;

const chunkStep = createStep({
  id: "chunk",
  description: "Token-aware chunking with overlap",
  inputSchema: z.object({ text: z.string(), contextHint: z.string().optional() }),
  outputSchema: ChunkedSchema,
  execute: async ({ inputData }) => {
    const { text, contextHint } = inputData;
    // rough budgets for prompts (measured once)
    const promptTokens = countTokens(SYSTEM_REFINE_PROMPT) + 200;
    const prevSummaryBudget = 1500;
    const maxSize = getChunkSize(promptTokens, prevSummaryBudget);

    const doc = MDocument.fromText(text);
    const chunks = await doc.chunk({
      strategy: "token",
      encodingName: "o200k_base",
      maxSize,
      overlap: OVERLAP_TOKENS
    });
    return { chunks, contextHint };
  }
});