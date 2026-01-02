import { config } from '@/config';
import {
  createJobRun,
  findJobRunByTicketKey,
  updateJobRunStatus,
} from '@/db/repositories/jobRunsRepository';
import { JobRunStatus } from '@/db/types';
import {
  JiraClient,
  jiraClient as defaultJiraClient,
} from '@/services/jira/jiraClient';
import { JiraIssue, TicketProcessingResult } from '@/services/jira/types';
import { formatValidationErrorPanel } from '@/services/jira/utils/jiraMarkupUtils';
import { validateTicket } from '@/services/jira/utils/validationUtils';
import logger from '@/utils/logger';
import { BaseJiraPollingService } from '../BaseJiraPollingService';
import { SAGE_BOT_LABEL } from './constants';
import { extractTicketData } from './ticketParser';

/** Statuses that indicate a job is actively being processed */
const ACTIVE_STATUSES = [JobRunStatus.Pending, JobRunStatus.Running];

/**
 * Creates an instance of the Jira polling service for Sage Auto PR Bot
 *
 * This service polls for tickets labeled with "sage-bot" across configured projects
 * and processes them by:
 * 1. Checking for active job runs (to prevent duplicates)
 * 2. Finding who added the sage-bot label
 * 3. Removing the sage-bot label
 * 4. Creating a job run in the database
 * 5. Validating the ticket (repo label, assignee, credentials)
 * 6. Posting validation errors to Jira if applicable
 * @param jiraClient - The Jira client to use for API calls
 * @returns A BaseJiraPollingService instance configured for Sage Auto PR Bot
 */
export const createSageAutoPRBotJiraPollingService = (
  jiraClient: JiraClient
): BaseJiraPollingService =>
  new BaseJiraPollingService({
    jiraClient,
    buildJqlQuery: () => {
      const projects = config.sageBot.supportedProjects;
      const projectList = projects.map(p => `"${p}"`).join(', ');
      return `labels = "${SAGE_BOT_LABEL}" AND project IN (${projectList})`;
    },
    processTicket: async (
      issue: JiraIssue
    ): Promise<TicketProcessingResult> => {
      // Parse the issue into the format we need
      const ticketData = extractTicketData(issue);
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

          await updateJobRunStatus(
            jobRun._id!,
            JobRunStatus.Failed,
            errorMessage
          );

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
    },
  });

/**
 * Default instance of the Sage Auto PR Bot Jira polling service
 */
export const SageAutoPRBotJiraPollingService =
  createSageAutoPRBotJiraPollingService(defaultJiraClient);
