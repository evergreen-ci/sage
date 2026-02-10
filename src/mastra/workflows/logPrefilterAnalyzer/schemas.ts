import { z } from 'zod';
import {
  WorkflowInputSchema,
  WorkflowOutputSchema,
  LineReferenceSchema,
  RefinementAgentOutputSchema,
} from '../logCoreAnalyzer/schemas';
import { LogScanResultSchema } from './scanner';

// Re-export shared schemas so consumers can import from one place
export {
  WorkflowInputSchema,
  WorkflowOutputSchema,
  LineReferenceSchema,
  RefinementAgentOutputSchema,
};

export const PrefilterStateSchema = z.object({
  text: z.string().optional(),
  filteredText: z.string().optional(),
  idx: z.number().default(0),
  chunks: z.array(z.object({ text: z.string() })).optional(),
  analysisContext: z.string().optional(),
  accumulatedLineReferences: z.array(LineReferenceSchema).default([]),
  scanResult: LogScanResultSchema.optional(),
});
