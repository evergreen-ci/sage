export { jiraClient } from './jiraClient';
export {
  buildJqlQuery,
  pollJiraTickets,
  runPollingJob,
} from './jiraPollingService';

// Re-export schemas
export {
  jiraAssigneeSchema,
  jiraIssueFieldsSchema,
  jiraIssueSchema,
  parsedTicketDataSchema,
  pollingResultSchema,
  ticketProcessingResultSchema,
  validationResultSchema,
} from './schemas';

// Re-export types
export type {
  JiraAssignee,
  JiraIssue,
  JiraIssueFields,
  ParsedTicketData,
  PollingResult,
  TicketProcessingResult,
  ValidationResult,
} from './types';
