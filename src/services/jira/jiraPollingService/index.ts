import { config, validateConfig } from '@/config';
import {
  createJobRun,
  findJobRunByTicketKey,
  updateJobRunStatus,
} from '@/db/repositories/jobRunsRepository';
import { JobRunStatus } from '@/db/types';
import logger from '@/utils/logger';
import { SAGE_BOT_LABEL } from '../constants';
import { jiraClient } from '../jiraClient';
import {
  ParsedTicketData,
  PollingResult,
  TicketProcessingResult,
} from '../types';
import { formatValidationErrorPanel } from '../utils/jiraMarkupUtils';
import { validateTicket } from '../utils/validationUtils';

/** Statuses that indicate a job is actively being processed */
const ACTIVE_STATUSES = [JobRunStatus.Pending, JobRunStatus.Running];

/**
 * Build the JQL query for finding sage-bot labeled tickets
 * @param projects - Array of Jira project keys to include
 * @returns JQL query string
 */
export const buildJqlQuery = (projects: string[]): string => {
  const projectList = projects.map(p => `"${p}"`).join(', ');
  return `labels = "${SAGE_BOT_LABEL}" AND project IN (${projectList})`;
};

/**
 * Process a single ticket: validate, remove label, and create job run
 * @param ticketData - The parsed ticket data to process
 * @returns Processing result indicating success, skip, or error
 */
const processTicket = async (
  ticketData: ParsedTicketData
): Promise<TicketProcessingResult> => {
  const { ticketKey } = ticketData;

  try {
    // Check if we already have an active job run for this ticket
    // Only skip if the job is pending or running; allow retries for failed/completed/cancelled
    const existingJob = await findJobRunByTicketKey(ticketKey);
    if (existingJob && ACTIVE_STATUSES.includes(existingJob.status)) {
      logger.info(
        `Active job run exists for ticket ${ticketKey}, skipping to prevent duplicates`,
        {
          existingJobId: existingJob._id?.toString(),
          existingStatus: existingJob.status,
        }
      );
      return {
        ticketKey,
        success: true,
        skipped: true,
        skipReason: `Active job run exists with status: ${existingJob.status}`,
      };
    }

    const initiatedBy = await jiraClient.findLabelAddedBy(
      ticketKey,
      SAGE_BOT_LABEL
    );

    await jiraClient.removeLabel(ticketKey, SAGE_BOT_LABEL);

    const jobRun = await createJobRun({
      jiraTicketKey: ticketKey,
      initiatedBy: initiatedBy || 'unknown',
      assignee: ticketData.assigneeEmail,
      metadata: {
        summary: ticketData.summary,
        description: ticketData.description,
        targetRepository: ticketData.targetRepository,
      },
    });

    logger.info(`Created job run for ticket ${ticketKey}`, {
      jobRunId: jobRun._id?.toString(),
      initiatedBy,
      assignee: ticketData.assigneeEmail,
      targetRepository: ticketData.targetRepository,
    });

    const validation = await validateTicket(ticketData);
    if (!validation.isValid) {
      const errorMessage = `Validation failed: ${validation.errors.join('; ')}`;

      logger.warn(`Ticket ${ticketKey} failed validation`, {
        jobRunId: jobRun._id?.toString(),
        errors: validation.errors,
      });

      await updateJobRunStatus(jobRun._id!, JobRunStatus.Failed, errorMessage);

      const comment = formatValidationErrorPanel(validation.errors);
      await jiraClient.addComment(ticketKey, comment);

      return {
        ticketKey,
        success: true,
        skipped: true,
        skipReason: errorMessage,
      };
    }

    return { ticketKey, success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to process ticket ${ticketKey}`, error);
    return { ticketKey, success: false, error: errorMessage };
  }
};

/**
 * Poll Jira for tickets with the sage-bot label and process them
 * This function is designed to be called by a Drone cronjob
 * @returns Polling result with counts and individual ticket results
 */
export const pollJiraTickets = async (): Promise<PollingResult> => {
  const projects = config.sageBot.supportedProjects;

  logger.info('Starting Jira polling run', {
    configuredProjects: projects,
  });

  const result: PollingResult = {
    ticketsFound: 0,
    ticketsProcessed: 0,
    ticketsSkipped: 0,
    ticketsErrored: 0,
    results: [],
  };

  try {
    const jql = buildJqlQuery(projects);
    logger.debug('Executing JQL query', { jql });

    const issues = await jiraClient.searchIssues(jql);
    result.ticketsFound = issues.length;

    logger.info(`Found ${issues.length} tickets with ${SAGE_BOT_LABEL} label`);

    if (issues.length === 0) {
      return result;
    }

    for (const issue of issues) {
      const ticketData = jiraClient.extractTicketData(issue);
      // Sequential processing is intentional to avoid overwhelming Jira API
      // eslint-disable-next-line no-await-in-loop
      const processingResult = await processTicket(ticketData);
      result.results.push(processingResult);

      if (processingResult.skipped) {
        result.ticketsSkipped += 1;
      } else if (processingResult.success) {
        result.ticketsProcessed += 1;
      } else {
        result.ticketsErrored += 1;
      }
    }

    logger.info('Completed Jira polling run', {
      ticketsFound: result.ticketsFound,
      ticketsProcessed: result.ticketsProcessed,
      ticketsSkipped: result.ticketsSkipped,
      ticketsErrored: result.ticketsErrored,
    });

    return result;
  } catch (error) {
    logger.error('Jira polling run failed', error);
    throw error;
  }
};

/**
 * Main entry point for running the polling service as a cronjob
 * Handles database connection and cleanup
 */
export const runPollingJob = async (): Promise<void> => {
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

    const result = await pollJiraTickets();

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
};
