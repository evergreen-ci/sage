import { z } from 'zod';

export const LineReferenceSchema = z.object({
  line: z.number().optional(),
  context: z.string(),
  type: z.enum(['error', 'warning', 'info', 'success']),
});

// This workflow takes either a file path, raw text, or an URL as input, and optional additional instructions
// and returns a structured analysis report, as well as a concise summary.
export const WorkflowInputSchema = z.object({
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

export const WorkflowOutputSchema = z.object({
  markdown: z.string(),
  summary: z.string(),
  lineReferences: z.array(LineReferenceSchema).default([]),
});

export const RefinementAgentOutputSchema = z.object({
  updated: z.boolean(),
  summary: z.string(),
  lineReferences: z.array(LineReferenceSchema).optional().default([]),
});

export const WorkflowStateSchema = z.object({
  text: z.string().optional(),
  idx: z.number().default(0),
  chunks: z.array(z.object({ text: z.string() })).optional(),
  analysisContext: z.string().optional(),
  accumulatedLineReferences: z.array(LineReferenceSchema).default([]),
});
