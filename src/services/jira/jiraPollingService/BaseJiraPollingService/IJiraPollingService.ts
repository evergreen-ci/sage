import { JiraIssue, PollingResult, TicketProcessingResult } from '../types';

/**
 * Interface for Jira polling services
 *
 * Defines the contract that all polling services must implement.
 * Services implementing this interface can process Jira tickets based on custom queries
 * and business logic.
 *
 * Example implementation:
 * ```typescript
 * export class MyPollingService implements IJiraPollingService {
 *   buildJqlQuery(): string {
 *     return 'labels = "my-label" AND project IN ("PROJ1")';
 *   }
 *
 *   async processTicket(issue: JiraIssue): Promise<TicketProcessingResult> {
 *     // Custom processing logic - parse issue as needed
 *     return { ticketKey: issue.key, success: true };
 *   }
 *
 *   async poll(): Promise<PollingResult> {
 *     return BaseJiraPollingService.executePolling(this, this.jiraClient);
 *   }
 *
 *   async runAsJob(): Promise<void> {
 *     return BaseJiraPollingService.executeJobWithLifecycle(this, this.jiraClient);
 *   }
 * }
 * ```
 */
export interface IJiraPollingService {
  /**
   * Build the JQL query for finding tickets to process
   * Implementations should define their specific query logic
   * @returns JQL query string
   */
  buildJqlQuery(): string;

  /**
   * Process a single ticket with custom business logic
   * Implementations define their specific processing logic and can parse the issue as needed
   * @param issue - Raw Jira issue from the API
   * @returns Processing result indicating success, skip, or error
   */
  processTicket(issue: JiraIssue): Promise<TicketProcessingResult>;

  /**
   * Main polling execution - searches for tickets and processes them
   * @returns Polling result with counts and individual ticket results
   */
  poll(): Promise<PollingResult>;

  /**
   * Entry point for running as a cronjob
   * Handles configuration validation, database connection lifecycle, and error codes
   * @returns Promise that resolves when the job completes
   */
  runAsJob(): Promise<void>;
}
