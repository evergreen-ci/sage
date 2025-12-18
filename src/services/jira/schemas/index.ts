import { z } from 'zod';

/**
 * Zod schema for Jira assignee field
 */
export const jiraAssigneeSchema = z
  .object({
    emailAddress: z.string().optional(),
    displayName: z.string().optional(),
  })
  .nullable();

/**
 * Zod schema for Jira issue fields we care about
 */
export const jiraIssueFieldsSchema = z.object({
  summary: z.string(),
  description: z.string().nullable(),
  assignee: jiraAssigneeSchema,
  labels: z.array(z.string()),
});

/**
 * Zod schema for a Jira issue as returned from search
 */
export const jiraIssueSchema = z.object({
  key: z.string(),
  fields: jiraIssueFieldsSchema,
});

/**
 * Zod schema for parsed ticket data from Jira
 */
export const parsedTicketDataSchema = z.object({
  ticketKey: z.string(),
  summary: z.string(),
  description: z.string().nullable(),
  assigneeEmail: z.string().nullable(),
  targetRepository: z.string().nullable(),
  labels: z.array(z.string()),
});

/**
 * Zod schema for result of processing a single ticket
 */
export const ticketProcessingResultSchema = z.object({
  ticketKey: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
  skipped: z.boolean().optional(),
  skipReason: z.string().optional(),
});

/**
 * Zod schema for result of a polling run
 */
export const pollingResultSchema = z.object({
  ticketsFound: z.number(),
  ticketsProcessed: z.number(),
  ticketsSkipped: z.number(),
  ticketsErrored: z.number(),
  results: z.array(ticketProcessingResultSchema),
});

/**
 * Zod schema for ticket validation result
 */
export const validationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
});
