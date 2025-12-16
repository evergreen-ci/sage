import { z } from 'zod';
import {
  releaseNotesInputSchema,
  releaseNotesOutputSchema,
  type ReleaseNotesOutput,
} from '@/mastra/agents/releaseNotesAgent';

export const WorkflowInputSchema = releaseNotesInputSchema;

export const WorkflowOutputSchema = releaseNotesOutputSchema;

export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;
export type WorkflowOutput = ReleaseNotesOutput;

export const WorkflowStateSchema = z.object({
  input: WorkflowInputSchema.optional(),
  sectionPlans: z
    .object({
      sections: z.array(
        z.object({
          title: z.string(),
          focus: z.string().optional(),
        })
      ),
      issues: z.array(
        z.object({
          key: z.string(),
          issueType: z.string(),
          summary: z.string(),
          description: z.string().optional(),
          curatedCopy: z.string().optional(),
          metadata: z.record(z.string(), z.string()).optional(),
          pullRequests: z.array(
            z.object({
              title: z.string(),
              description: z.string().optional(),
            })
          ),
        })
      ),
      hasSecurityIssues: z.boolean(),
    })
    .optional(),
  formattedPrompt: z.string().optional(),
  rawAgentOutput: z.unknown().optional(),
});
