import { validateConfig } from '@/config';
import { JiraClient } from '@/services/jira/jiraClient';
import {
  JiraIssue,
  PollingResult,
  TicketProcessingResult,
} from '@/services/jira/types';
import logger from '@/utils/logger';

export interface BaseJiraPollingConfig {
  jiraClient: JiraClient;
  buildJqlQuery: () => string;
  processTicket: (issue: JiraIssue) => Promise<TicketProcessingResult>;
}

/**
 * Base polling service implementation providing reusable workflow logic
 *
 * This class provides a generic polling workflow that can be configured with
 * specific JQL queries and ticket processing logic.
 *
 * Example usage:
 * ```typescript
 * const myPollingService = new BaseJiraPollingService({
 *   jiraClient,
 *   buildJqlQuery: () => 'project = "PROJ"',
 *   processTicket: async (issue) => ({ ticketKey: issue.key, success: true })
 * });
 *
 * await myPollingService.poll();
 * ```
 */
export class BaseJiraPollingService {
  private config: BaseJiraPollingConfig;

  constructor(config: BaseJiraPollingConfig) {
    this.config = config;
  }

  /**
   * Execute the polling workflow
   *
   * This is a reusable implementation of the polling algorithm that:
   * - Builds a JQL query via the config's buildJqlQuery() method
   * - Searches for tickets using the JiraClient
   * - Iterates through tickets sequentially (to respect API rate limits)
   * - Processes each ticket via the config's processTicket() method
   * - Aggregates results with metrics (found/processed/skipped/errored)
   * @returns Polling result with counts and individual ticket results
   */
  async poll(): Promise<PollingResult> {
    const { buildJqlQuery, jiraClient, processTicket } = this.config;
    const result: PollingResult = {
      ticketsFound: 0,
      ticketsProcessed: 0,
      ticketsSkipped: 0,
      ticketsErrored: 0,
      results: [],
    };

    try {
      const jql = buildJqlQuery();
      logger.debug('Executing JQL query', { jql });

      const issues = await jiraClient.searchIssues(jql);
      result.ticketsFound = issues.length;

      logger.info(`Found ${issues.length} tickets to process`);

      if (issues.length === 0) {
        return result;
      }

      for (const issue of issues) {
        // Sequential processing is intentional to avoid overwhelming Jira API
        // eslint-disable-next-line no-await-in-loop
        const processingResult = await processTicket(issue);
        result.results.push(processingResult);

        if (processingResult.skipped) {
          result.ticketsSkipped += 1;
        } else if (processingResult.success) {
          result.ticketsProcessed += 1;
        } else {
          result.ticketsErrored += 1;
        }
      }

      logger.info('Completed polling run', {
        ticketsFound: result.ticketsFound,
        ticketsProcessed: result.ticketsProcessed,
        ticketsSkipped: result.ticketsSkipped,
        ticketsErrored: result.ticketsErrored,
      });

      return result;
    } catch (error) {
      logger.error('Polling run failed', error);
      throw error;
    }
  }

  /**
   * Execute as a cronjob with full lifecycle management
   *
   * This method handles:
   * - Configuration validation
   * - Database connection and disconnection
   * - Calling the polling workflow
   * - Setting appropriate exit codes for errors
   * @returns Promise that resolves when the job completes
   */
  async runAsJob(): Promise<void> {
    logger.info('Validating configuration');
    const configErrors = validateConfig();

    if (configErrors) {
      logger.error('Configuration errors:', configErrors);
      process.exitCode = 1;
      return;
    }

    const { db } = await import('@/db/connection');

    try {
      logger.info('Connecting to database for polling job');
      await db.connect();

      const result = await this.poll();

      // Only exit with error code for system errors, not user validation failures
      if (result.ticketsErrored > 0) {
        logger.error(
          `Polling completed with ${result.ticketsErrored} system errors`
        );
        process.exitCode = 1;
      }
    } finally {
      logger.info('Disconnecting from database');
      await db.disconnect();
    }
  }
}
