import { z } from 'zod';
import {
  jiraAssigneeSchema,
  jiraIssueFieldsSchema,
  jiraIssueSchema,
  parsedTicketDataSchema,
  pollingResultSchema,
  ticketProcessingResultSchema,
  validationResultSchema,
} from './schemas';

// Re-export schemas for convenience
export {
  jiraAssigneeSchema,
  jiraIssueFieldsSchema,
  jiraIssueSchema,
  parsedRepositorySchema,
  parsedTicketDataSchema,
  pollingResultSchema,
  ticketProcessingResultSchema,
  validationResultSchema,
} from './schemas';

/**
 * TypeScript type inferred from JiraAssignee schema
 */
export type JiraAssignee = z.infer<typeof jiraAssigneeSchema>;

/**
 * TypeScript type inferred from JiraIssueFields schema
 */
export type JiraIssueFields = z.infer<typeof jiraIssueFieldsSchema>;

/**
 * TypeScript type inferred from JiraIssue schema
 */
export type JiraIssue = z.infer<typeof jiraIssueSchema>;

/**
 * TypeScript type inferred from ParsedTicketData schema
 */
export type ParsedTicketData = z.infer<typeof parsedTicketDataSchema>;

/**
 * TypeScript type inferred from TicketProcessingResult schema
 */
export type TicketProcessingResult = z.infer<
  typeof ticketProcessingResultSchema
>;

/**
 * TypeScript type inferred from PollingResult schema
 */
export type PollingResult = z.infer<typeof pollingResultSchema>;

/**
 * TypeScript type inferred from ValidationResult schema
 */
export type ValidationResult = z.infer<typeof validationResultSchema>;
