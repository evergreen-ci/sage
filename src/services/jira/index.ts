/**
 * Jira service public API
 * Exports all classes, functions, types, and schemas
 */

// Client
export { jiraClient } from './jiraClient';

// Polling service
export {
  buildJqlQuery,
  pollJiraTickets,
  runPollingJob,
} from './jiraPollingService';

// Utilities
export * from './utils';

// Types
export type {
  JiraAssignee,
  JiraIssue,
  JiraIssueFields,
  ParsedTicketData,
  PollingResult,
  TicketProcessingResult,
  ValidationResult,
} from './types';

// Schemas
export {
  jiraAssigneeSchema,
  jiraIssueFieldsSchema,
  jiraIssueSchema,
  parsedTicketDataSchema,
  pollingResultSchema,
  ticketProcessingResultSchema,
  validationResultSchema,
} from './schemas';

// Constants
export {
  SAGE_BOT_LABEL,
  REPO_LABEL_PATTERN,
  MAX_SEARCH_RESULTS,
  DEFAULT_ISSUE_FIELDS,
} from './constants';
