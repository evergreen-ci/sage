import {
  createJobRun,
  findJobRunByTicketKey,
  findJobRunByTicketKeyAndRepository,
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
 * 1. Checking for active job runs (to prevent duplicates, per repository)
 * 2. Finding who added the sage-bot label
 * 3. Removing the sage-bot label
 * 4. Creating a job run per repository in the database
 * 5. Validating the ticket (repo label, assignee, credentials)
 * 6. Posting validation errors to Jira if applicable
 * 7. Launching a Cursor Cloud Agent per repository for valid tickets
 * 8. Updating job status and posting agent launch results to Jira
 * @param jiraClient - The Jira client to use for API calls
 * @returns A BaseJiraPollingService instance configured for Sage Auto PR Bot
 */
export const createSageAutoPRBotJiraPollingService = (
  jiraClient: JiraClient
): BaseJiraPollingService =>
  new BaseJiraPollingService({
    jiraClient,
    buildJqlQuery: () => `labels = "${SAGE_BOT_LABEL}"`,
    processTicket: async (
      issue: JiraIssue
    ): Promise<TicketProcessingResult> => {
      // Parse the issue into the format we need
      const ticketData = extractTicketData(issue);
      const { targetRepositories, ticketKey } = ticketData;

      try {
        // Case 1: No repo labels - use single-job flow (validation will fail)
        if (targetRepositories.length === 0) {
          // Check if we already have an active job run for this ticket
          const existingJob = await findJobRunByTicketKey(ticketKey);
          if (existingJob && ACTIVE_STATUSES.includes(existingJob.status)) {
            logger.info(
              `Active job run exists for ticket ${ticketKey}, skipping to prevent duplicates`,
              {
                existingJobId: existingJob._id?.toString(),
                existingStatus: existingJob.status,
              }
            );

            try {
              await jiraClient.removeLabel(ticketKey, SAGE_BOT_LABEL);
            } catch (removeLabelError) {
              logger.warn(
                `Failed to remove label "${SAGE_BOT_LABEL}" from ticket ${ticketKey} while skipping duplicate job`,
                removeLabelError
              );
            }

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

          // This path is unreachable (no repo label always fails validation)
          // but kept for completeness
          return { ticketKey, success: true };
        }

        // Case 2: One or more repo labels - process each repo independently

        // Determine which repos still need to be processed (no active job yet)
        const reposToProcess: typeof targetRepositories = [];
        for (const repo of targetRepositories) {
          // eslint-disable-next-line no-await-in-loop
          const existingJob = await findJobRunByTicketKeyAndRepository(
            ticketKey,
            repo.repository
          );
          if (existingJob && ACTIVE_STATUSES.includes(existingJob.status)) {
            logger.info(
              `Active job run exists for ticket ${ticketKey} and repository ${repo.repository}, skipping`,
              {
                existingJobId: existingJob._id?.toString(),
                existingStatus: existingJob.status,
              }
            );
          } else {
            reposToProcess.push(repo);
          }
        }

        // If all repos already have active jobs, skip this polling cycle
        if (reposToProcess.length === 0) {
          logger.info(
            `All repositories have active job runs for ticket ${ticketKey}, skipping to prevent duplicates`
          );

          try {
            await jiraClient.removeLabel(ticketKey, SAGE_BOT_LABEL);
          } catch (removeLabelError) {
            logger.warn(
              `Failed to remove label "${SAGE_BOT_LABEL}" from ticket ${ticketKey} while skipping duplicate jobs`,
              removeLabelError
            );
          }

          return {
            ticketKey,
            success: true,
            skipped: true,
            skipReason: `All repositories have active job runs`,
          };
        }

        const initiatedBy = await jiraClient.findLabelAddedBy(
          ticketKey,
          SAGE_BOT_LABEL
        );

        await jiraClient.removeLabel(ticketKey, SAGE_BOT_LABEL);

        // Validate common ticket requirements (assignee, credentials) once.
        // Use the first repo to satisfy the repo label check.
        const firstRepo = reposToProcess[0];
        const validationTicketData = {
          ...ticketData,
          targetRepository: firstRepo.repository,
          targetRef: firstRepo.ref,
        };

        const validation = await validateTicket(validationTicketData);
        if (!validation.isValid) {
          const errorMessage = `Validation failed: ${validation.errors.join('; ')}`;

          logger.warn(`Ticket ${ticketKey} failed validation`, {
            errors: validation.errors,
          });

          // Create one job run to record the validation failure
          const jobRun = await createJobRun({
            jiraTicketKey: ticketKey,
            initiatedBy: initiatedBy || 'unknown',
            assignee: ticketData.assigneeEmail,
            metadata: {
              summary: ticketData.summary,
              description: ticketData.description,
              targetRepository: firstRepo.repository,
            },
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

        // Launch a Cursor agent for each repo that needs processing
        let hasSuccess = false;
        let lastError: string | undefined;

        for (const repo of reposToProcess) {
          // eslint-disable-next-line no-await-in-loop
          const jobRun = await createJobRun({
            jiraTicketKey: ticketKey,
            initiatedBy: initiatedBy || 'unknown',
            assignee: ticketData.assigneeEmail,
            metadata: {
              summary: ticketData.summary,
              description: ticketData.description,
              targetRepository: repo.repository,
            },
          });

          logger.info(
            `Created job run for ticket ${ticketKey} and repository ${repo.repository}`,
            {
              jobRunId: jobRun._id?.toString(),
              initiatedBy,
              assignee: ticketData.assigneeEmail,
              targetRepository: repo.repository,
            }
          );

          // targetRef is optional - if not provided, Cursor uses the repo's default branch
          // eslint-disable-next-line no-await-in-loop
          const launchResult = await launchCursorAgent({
            ticketKey,
            summary: ticketData.summary,
            description: ticketData.description,
            targetRepository: repo.repository,
            targetRef: repo.ref ?? undefined,
            assigneeEmail: ticketData.assigneeEmail!,
            autoCreatePr: true,
          });

          if (!launchResult.success) {
            const errorMessage = `Agent launch failed: ${launchResult.error}`;

            logger.error(
              `Failed to launch agent for ticket ${ticketKey} and repository ${repo.repository}`,
              {
                jobRunId: jobRun._id?.toString(),
                error: launchResult.error,
              }
            );

            // eslint-disable-next-line no-await-in-loop
            await updateJobRun(jobRun._id!, {
              status: JobRunStatus.Failed,
              errorMessage,
            });

            const comment = formatAgentLaunchFailedPanel(
              launchResult.error || 'Unknown error'
            );
            // eslint-disable-next-line no-await-in-loop
            await jiraClient.addComment(ticketKey, comment);

            lastError = errorMessage;
            continue;
          }

          // Ensure agentId is present when launch succeeded
          if (!launchResult.agentId) {
            const errorMessage =
              'Agent launch reported success but did not return an agentId';

            logger.error(
              `Agent launch returned no agentId for ticket ${ticketKey} and repository ${repo.repository}`,
              {
                jobRunId: jobRun._id?.toString(),
              }
            );

            // eslint-disable-next-line no-await-in-loop
            await updateJobRun(jobRun._id!, {
              status: JobRunStatus.Failed,
              errorMessage,
            });

            const comment = formatAgentLaunchFailedPanel(errorMessage);
            // eslint-disable-next-line no-await-in-loop
            await jiraClient.addComment(ticketKey, comment);

            lastError = errorMessage;
            continue;
          }

          // Update job run with agent ID and set status to Running
          // eslint-disable-next-line no-await-in-loop
          await updateJobRun(jobRun._id!, {
            cursorAgentId: launchResult.agentId,
            status: JobRunStatus.Running,
          });

          // Post success comment with link to agent session
          if (launchResult.agentUrl) {
            const comment = formatAgentLaunchedPanel(launchResult.agentUrl);
            // eslint-disable-next-line no-await-in-loop
            await jiraClient.addComment(ticketKey, comment);
          }

          logger.info(
            `Successfully launched agent for ticket ${ticketKey} and repository ${repo.repository}`,
            {
              jobRunId: jobRun._id?.toString(),
              agentId: launchResult.agentId,
              agentUrl: launchResult.agentUrl,
            }
          );

          hasSuccess = true;
        }

        if (!hasSuccess && lastError) {
          return { ticketKey, success: false, error: lastError };
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
