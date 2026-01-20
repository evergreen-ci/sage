import { config } from '@/config';
import {
  createJobRun,
  findJobRunByTicketKey,
  updateJobRun,
} from '@/db/repositories/jobRunsRepository';
import { JobRunStatus } from '@/db/types';
import { launchCursorAgent } from '@/services/cursor';
import {
  JiraClient,
  jiraClient as defaultJiraClient,
} from '@/services/jira/jiraClient';
import { JiraIssue, TicketProcessingResult } from '@/services/jira/types';
import {
  formatAgentLaunchedPanel,
  formatAgentLaunchFailedPanel,
  formatValidationErrorPanel,
} from '@/services/jira/utils/jiraMarkupUtils';
import { validateTicket } from '@/services/jira/utils/validationUtils';
import { getDefaultBranch } from '@/services/repositories';
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
 * 7. Launching a Cursor Cloud Agent for valid tickets
 * 8. Updating job status and posting agent launch results to Jira
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

          await updateJobRun(jobRun._id!, {
            status: JobRunStatus.Failed,
            errorMessage,
          });

          const comment = formatValidationErrorPanel(validation.errors);
          await jiraClient.addComment(ticketKey, comment);

          return {
            ticketKey,
            success: true,
            skipped: true,
            skipReason: errorMessage,
          };
        }

        // Resolve the ref: use inline ref if provided, otherwise get from config
        let { targetRef } = ticketData;
        if (!targetRef) {
          const defaultBranch = getDefaultBranch(ticketData.targetRepository!);

          if (!defaultBranch) {
            const errorMessage =
              `No default branch configured for repository ${ticketData.targetRepository}. ` +
              `See the [pre-configured repositories documentation](https://github.com/evergreen-ci/sage/blob/main/docs/sage-bot/usage.md#pre-configured-repositories) for more information.`;

            logger.error(
              `Failed to determine default branch for ticket ${ticketKey}`,
              {
                jobRunId: jobRun._id?.toString(),
                targetRepository: ticketData.targetRepository,
              }
            );

            await updateJobRun(jobRun._id!, {
              status: JobRunStatus.Failed,
              errorMessage,
            });

            const comment = formatAgentLaunchFailedPanel(errorMessage);
            await jiraClient.addComment(ticketKey, comment);

            return {
              ticketKey,
              success: false,
              error: errorMessage,
            };
          }

          targetRef = defaultBranch;
        }

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

          const comment = formatAgentLaunchFailedPanel(
            launchResult.error || 'Unknown error'
          );
          await jiraClient.addComment(ticketKey, comment);

          return {
            ticketKey,
            success: false,
            error: errorMessage,
          };
        }

        // Ensure agentId is present when launch succeeded
        if (!launchResult.agentId) {
          const errorMessage =
            'Agent launch reported success but did not return an agentId';

          logger.error(
            `Agent launch returned no agentId for ticket ${ticketKey}`,
            {
              jobRunId: jobRun._id?.toString(),
            }
          );

          await updateJobRun(jobRun._id!, {
            status: JobRunStatus.Failed,
            errorMessage,
          });

          const comment = formatAgentLaunchFailedPanel(errorMessage);
          await jiraClient.addComment(ticketKey, comment);

          return {
            ticketKey,
            success: false,
            error: errorMessage,
          };
        }

        // Update job run with agent ID and set status to Running
        await updateJobRun(jobRun._id!, {
          cursorAgentId: launchResult.agentId,
          status: JobRunStatus.Running,
        });

        // Post success comment with link to agent session
        if (launchResult.agentUrl) {
          const comment = formatAgentLaunchedPanel(launchResult.agentUrl);
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
    },
  });

/**
 * Default instance of the Sage Auto PR Bot Jira polling service
 */
export const SageAutoPRBotJiraPollingService =
  createSageAutoPRBotJiraPollingService(defaultJiraClient);
