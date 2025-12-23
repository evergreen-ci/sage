import { validateConfig } from '@/config';
import { JiraClient } from '@/services/jira/jiraClient';
import { PollingResult } from '@/services/jira/types';
import logger from '@/utils/logger';
import { IJiraPollingService } from './IJiraPollingService';

/**
 * Base polling service implementation providing reusable workflow logic
 *
 * This class provides static utility methods that implement the generic polling workflow.
 * Services implementing IJiraPollingService can use these methods via composition
 * to avoid duplicating the polling logic.
 *
 * The class uses composition over inheritance - services don't extend this class,
 * they use its static methods while implementing the IJiraPollingService interface.
 *
 * Example usage:
 * ```typescript
 * export class MyPollingService implements IJiraPollingService {
 *   private jiraClient: JiraClient;
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
export class BaseJiraPollingService {
  /**
   * Execute the polling workflow for any service implementing IJiraPollingService
   *
   * This is a reusable implementation of the polling algorithm that:
   * - Builds a JQL query via the service's buildJqlQuery() method
   * - Searches for tickets using the JiraClient
   * - Iterates through tickets sequentially (to respect API rate limits)
   * - Processes each ticket via the service's processTicket() method
   * - Aggregates results with metrics (found/processed/skipped/errored)
   * @param service - The polling service that implements IJiraPollingService
   * @param jiraClient - The Jira client to use for API calls
   * @returns Polling result with counts and individual ticket results
   */
  static async executePolling(
    service: IJiraPollingService,
    jiraClient: JiraClient
  ): Promise<PollingResult> {
    const result: PollingResult = {
      ticketsFound: 0,
      ticketsProcessed: 0,
      ticketsSkipped: 0,
      ticketsErrored: 0,
      results: [],
    };

    try {
      const jql = service.buildJqlQuery();
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
        const processingResult = await service.processTicket(issue);
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
   * @param service - The polling service that implements IJiraPollingService
   * @param jiraClient - The Jira client to use for API calls
   * @returns Promise that resolves when the job completes
   */
  static async executeJobWithLifecycle(
    service: IJiraPollingService,
    jiraClient: JiraClient
  ): Promise<void> {
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

      const result = await BaseJiraPollingService.executePolling(
        service,
        jiraClient
      );

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

export type { IJiraPollingService };
