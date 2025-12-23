import { config, validateConfig } from '@/config';
import {
  createJobRun,
  findJobRunByTicketKey,
  updateJobRun,
} from '@/db/repositories/jobRunsRepository';
import { credentialsExist } from '@/db/repositories/userCredentialsRepository';
import { JobRunStatus } from '@/db/types';
import { launchCursorAgent } from '@/services/cursor';
import {
  getDefaultBranch,
  isRepositoryConfigured,
} from '@/services/repositories';
import logger from '@/utils/logger';
import { jiraClient } from './jiraClient';
import {
  ParsedTicketData,
  PollingResult,
  TicketProcessingResult,
  ValidationResult,
} from './types';

const SAGE_BOT_LABEL = 'sage-bot';

/** Statuses that indicate a job is actively being processed */
const ACTIVE_STATUSES = [JobRunStatus.Pending, JobRunStatus.Running];

/**
 * Validate a ticket before processing
 * Checks:
 * - Has a repo:<org>/<repo> label (with optional \@ref)
 * - If no inline ref, repository must be configured in repositories.yaml
 * - Has an assignee
 * - Assignee has credentials in user_credentials collection
 * @param ticketData - The parsed ticket data to validate
 * @returns Validation result with isValid flag and any errors
 */
const validateTicket = async (
  ticketData: ParsedTicketData
): Promise<ValidationResult> => {
  const errors: string[] = [];

  // Check for repo label
  if (!ticketData.targetRepository) {
    errors.push(
      'Missing repository label. Please add a label in the format: repo:<org>/<repo_name> or repo:<org>/<repo_name>@<branch>'
    );
  } else if (!ticketData.targetRef) {
    // No inline ref provided - check if repo is configured
    if (!isRepositoryConfigured(ticketData.targetRepository)) {
      errors.push(
        `Repository "${ticketData.targetRepository}" is not configured. ` +
          'Either add it to the repository config or specify a branch inline: ' +
          `repo:${ticketData.targetRepository}@<branch>`
      );
    }
  }

  // Check for assignee
  if (!ticketData.assigneeEmail) {
    errors.push('No assignee set. Please assign this ticket to a user.');
  } else {
    // Check if assignee has credentials
    const hasCredentials = await credentialsExist(ticketData.assigneeEmail);
    if (!hasCredentials) {
      errors.push(
        `Assignee (${ticketData.assigneeEmail}) does not have credentials configured. ` +
          'Please register your API key before using sage-bot.'
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Format validation errors as a Jira comment
 * Uses border-only styling for dark mode compatibility
 * @param errors - Array of error messages
 * @returns Formatted Jira comment string with panel markup
 */
const formatValidationComment = (errors: string[]): string => {
  const errorList = errors.map(e => `* ${e}`).join('\n');
  return (
    `{panel:title=Sage Bot Validation Failed|borderColor=#DE350B|titleBGColor=#DE350B|titleColor=#FFFFFF}\n` +
    `The following issues must be resolved before sage-bot can process this ticket:\n\n` +
    `${errorList}\n\n` +
    `Please fix these issues and re-add the {{sage-bot}} label to retry.\n` +
    `{panel}`
  );
};

/**
 * Format agent launched success as a Jira comment
 * @param agentUrl - The URL to the Cursor agent session
 * @returns Formatted Jira comment string with panel markup
 */
const formatAgentLaunchedComment = (agentUrl: string): string =>
  `{panel:title=Sage Bot Agent Launched|borderColor=#00875A|titleBGColor=#00875A|titleColor=#FFFFFF}\n` +
  `A Cursor Cloud Agent has been launched to work on this ticket.\n\n` +
  `*Agent Session:* [View in Cursor|${agentUrl}]\n\n` +
  `The agent will create a pull request when the implementation is complete.\n` +
  `{panel}`;

/**
 * Format agent launch failure as a Jira comment
 * @param errorMessage - The error message from the launch attempt
 * @returns Formatted Jira comment string with panel markup
 */
const formatAgentLaunchFailedComment = (errorMessage: string): string =>
  `{panel:title=Sage Bot Agent Launch Failed|borderColor=#DE350B|titleBGColor=#DE350B|titleColor=#FFFFFF}\n` +
  `Failed to launch Cursor Cloud Agent for this ticket.\n\n` +
  `*Error:* ${errorMessage}\n\n` +
  `Please check the configuration and re-add the {{sage-bot}} label to retry.\n` +
  `{panel}`;

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

      await updateJobRun(jobRun._id!, {
        status: JobRunStatus.Failed,
        errorMessage,
      });

      const comment = formatValidationComment(validation.errors);
      await jiraClient.addComment(ticketKey, comment);

      return {
        ticketKey,
        success: true,
        skipped: true,
        skipReason: errorMessage,
      };
    }

    // Resolve the ref: use inline ref if provided, otherwise get from config
    const targetRef =
      ticketData.targetRef || getDefaultBranch(ticketData.targetRepository!)!;

    // Launch Cursor agent for eligible tickets
    const launchResult = await launchCursorAgent({
      ticketKey,
      summary: ticketData.summary,
      description: ticketData.description,
      targetRepository: ticketData.targetRepository!,
      targetRef,
      assigneeEmail: ticketData.assigneeEmail!,
      autoCreatePr: true,
    });

    if (!launchResult.success) {
      const errorMessage = `Agent launch failed: ${launchResult.error}`;

      logger.error(`Failed to launch agent for ticket ${ticketKey}`, {
        jobRunId: jobRun._id?.toString(),
        error: launchResult.error,
      });

      await updateJobRun(jobRun._id!, {
        status: JobRunStatus.Failed,
        errorMessage,
      });

      const comment = formatAgentLaunchFailedComment(
        launchResult.error || 'Unknown error'
      );
      await jiraClient.addComment(ticketKey, comment);

      return {
        ticketKey,
        success: false,
        error: errorMessage,
      };
    }

    // Update job run with agent ID and set status to Running
    await updateJobRun(jobRun._id!, {
      cursorAgentId: launchResult.agentId!,
      status: JobRunStatus.Running,
    });

    // Post success comment with link to agent session
    if (launchResult.agentUrl) {
      const comment = formatAgentLaunchedComment(launchResult.agentUrl);
      await jiraClient.addComment(ticketKey, comment);
    }

    logger.info(`Successfully launched agent for ticket ${ticketKey}`, {
      jobRunId: jobRun._id?.toString(),
      agentId: launchResult.agentId,
      agentUrl: launchResult.agentUrl,
    });

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
