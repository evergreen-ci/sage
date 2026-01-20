import { validateConfig } from '@/config';
import {
  findRunningJobRuns,
  updateJobRun,
} from '@/db/repositories/jobRunsRepository';
import { JobRun, JobRunStatus } from '@/db/types';
import { getAgentStatus, CursorAgentStatus } from '@/services/cursor';
import {
  JiraClient,
  jiraClient as defaultJiraClient,
} from '@/services/jira/jiraClient';
import {
  formatAgentCompletedPanel,
  formatAgentExpiredPanel,
  formatAgentFailedPanel,
  formatAgentTimeoutPanel,
} from '@/services/jira/utils/jiraMarkupUtils';
import logger from '@/utils/logger';

/** Default TTL in minutes before a running job is considered timed out */
const DEFAULT_TTL_MINUTES = 120; // 2 hours

export interface CursorAgentPollingConfig {
  jiraClient: JiraClient;
  ttlMinutes?: number;
}

export interface JobPollingResult {
  jobId: string;
  ticketKey: string;
  success: boolean;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
}

export interface PollingResult {
  jobsFound: number;
  jobsProcessed: number;
  jobsSkipped: number;
  jobsErrored: number;
  results: JobPollingResult[];
}

/**
 * Polls Cursor API for running agent statuses and updates job runs accordingly
 *
 * This service:
 * 1. Finds all job runs with status 'Running'
 * 2. Polls Cursor API for current agent status
 * 3. If agent is still running, checks TTL (marks as FailedTimeout if exceeded)
 * 4. Updates job run status based on agent status
 * 5. Posts appropriate notifications to Jira
 */
export class CursorAgentStatusPollingService {
  private config: CursorAgentPollingConfig;
  private ttlMs: number;

  constructor(config: CursorAgentPollingConfig) {
    this.config = config;
    this.ttlMs = (config.ttlMinutes ?? DEFAULT_TTL_MINUTES) * 60 * 1000;
  }

  /**
   * Check if a job has exceeded the TTL
   * @param job - The job run to check
   * @returns True if the job has exceeded the TTL
   */
  private isJobTimedOut(job: JobRun): boolean {
    // Use startedAt if available, otherwise fall back to createdAt
    const startTime = job.startedAt ?? job.createdAt;
    const elapsed = Date.now() - startTime.getTime();

    return elapsed > this.ttlMs;
  }

  /**
   * Process a single job run - check status and update accordingly
   * @param job - The job run to process
   * @returns The result of processing the job
   */
  private async processJob(job: JobRun): Promise<JobPollingResult> {
    const jobId = job._id?.toString() ?? 'unknown';
    const ticketKey = job.jiraTicketKey;

    try {
      // This should never happen, but just in case
      if (!job.cursorAgentId || !job.assignee) {
        logger.warn(`Job ${jobId} missing agent metadata`, {
          jobId,
          ticketKey,
          cursorAgentId: job.cursorAgentId,
          assignee: job.assignee,
        });
        return {
          jobId,
          ticketKey,
          success: true,
          skipped: true,
          skipReason: 'Missing cursor agent id or assignee email',
        };
      }

      // Get agent status from Cursor API first
      // This ensures we capture completed agents even if they exceeded TTL
      const statusResult = await getAgentStatus({
        agentId: job.cursorAgentId,
        assigneeEmail: job.assignee,
      });

      if (!statusResult.success) {
        logger.error(`Failed to get agent status for job ${jobId}`, {
          jobId,
          ticketKey,
          error: statusResult.error,
        });
        // Don't mark as failed - could be transient API error
        return {
          jobId,
          ticketKey,
          success: true,
          skipped: true,
          skipReason: `API error: ${statusResult.error}`,
        };
      }

      const agentStatus = statusResult.status!;

      // Only apply TTL timeout if the agent is still running
      // This ensures we don't mark completed agents as timed out
      if (
        (agentStatus === 'RUNNING' || agentStatus === 'CREATING') &&
        this.isJobTimedOut(job)
      ) {
        logger.info(`Job ${jobId} for ticket ${ticketKey} has timed out`, {
          jobId,
          ticketKey,
          startedAt: job.startedAt,
          agentStatus,
        });

        await updateJobRun(job._id!, {
          status: JobRunStatus.FailedTimeout,
          errorMessage: 'Job exceeded maximum runtime',
        });

        const comment = formatAgentTimeoutPanel();
        await this.config.jiraClient.addComment(ticketKey, comment);

        return { jobId, ticketKey, success: true };
      }

      // Process based on agent status
      await this.handleAgentStatus(job, agentStatus, {
        prUrl: statusResult.prUrl,
        summary: statusResult.summary,
      });

      return { jobId, ticketKey, success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to process job ${jobId}`, {
        jobId,
        ticketKey,
        error: errorMessage,
      });
      return { jobId, ticketKey, success: false, error: errorMessage };
    }
  }

  /**
   * Handle agent status and update job run accordingly
   * @param job - The job run to update
   * @param status - The current agent status from Cursor API
   * @param details - Additional details including PR URL and summary
   * @param details.prUrl - URL to the pull request (optional)
   * @param details.summary - Summary of the agent's work (optional)
   */
  private async handleAgentStatus(
    job: JobRun,
    status: CursorAgentStatus,
    details: { prUrl?: string; summary?: string }
  ): Promise<void> {
    const jobId = job._id?.toString() ?? 'unknown';
    const ticketKey = job.jiraTicketKey;

    logger.debug(`Agent status for job ${jobId}: ${status}`, {
      jobId,
      ticketKey,
      status,
      prUrl: details.prUrl,
    });

    switch (status) {
      case 'RUNNING':
      case 'CREATING':
        // Still in progress, no action needed
        logger.debug(`Job ${jobId} still in progress`, { jobId, ticketKey });
        break;

      case 'FINISHED': {
        logger.info(`Job ${jobId} completed successfully`, {
          jobId,
          ticketKey,
          prUrl: details.prUrl,
        });

        await updateJobRun(job._id!, {
          status: JobRunStatus.Completed,
        });

        const completedComment = formatAgentCompletedPanel(
          details.prUrl,
          details.summary
        );
        await this.config.jiraClient.addComment(ticketKey, completedComment);
        break;
      }

      case 'ERROR': {
        logger.info(`Job ${jobId} failed with error`, {
          jobId,
          ticketKey,
        });

        await updateJobRun(job._id!, {
          status: JobRunStatus.Failed,
          errorMessage: 'Cursor agent encountered an error',
        });

        const errorComment = formatAgentFailedPanel(
          'The agent encountered an error during execution'
        );
        await this.config.jiraClient.addComment(ticketKey, errorComment);
        break;
      }

      case 'EXPIRED': {
        logger.info(`Job ${jobId} agent session expired`, {
          jobId,
          ticketKey,
        });

        await updateJobRun(job._id!, {
          status: JobRunStatus.Failed,
          errorMessage: 'Cursor agent session expired',
        });

        const expiredComment = formatAgentExpiredPanel();
        await this.config.jiraClient.addComment(ticketKey, expiredComment);
        break;
      }

      default:
        logger.warn(`Unknown agent status: ${status}`, {
          jobId,
          ticketKey,
          status,
        });
    }
  }

  /**
   * Execute the polling workflow
   * @returns The result of the polling run
   */
  async poll(): Promise<PollingResult> {
    const result: PollingResult = {
      jobsFound: 0,
      jobsProcessed: 0,
      jobsSkipped: 0,
      jobsErrored: 0,
      results: [],
    };

    try {
      const runningJobs = await findRunningJobRuns();
      result.jobsFound = runningJobs.length;

      logger.info(`Found ${runningJobs.length} running jobs to check`);

      if (runningJobs.length === 0) {
        return result;
      }

      // Process jobs sequentially to respect API rate limits
      for (const job of runningJobs) {
        // eslint-disable-next-line no-await-in-loop
        const processingResult = await this.processJob(job);
        result.results.push(processingResult);

        if (processingResult.skipped) {
          result.jobsSkipped += 1;
        } else if (processingResult.success) {
          result.jobsProcessed += 1;
        } else {
          result.jobsErrored += 1;
        }
      }

      logger.info('Completed Cursor agent status polling run', {
        jobsFound: result.jobsFound,
        jobsProcessed: result.jobsProcessed,
        jobsSkipped: result.jobsSkipped,
        jobsErrored: result.jobsErrored,
      });

      return result;
    } catch (error) {
      logger.error('Cursor agent status polling run failed', error);
      throw error;
    }
  }

  /**
   * Execute as a cronjob with full lifecycle management
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
      logger.info('Connecting to database for Cursor agent status polling job');
      await db.connect();

      const result = await this.poll();

      // Only exit with error code for system errors
      if (result.jobsErrored > 0) {
        logger.error(
          `Polling completed with ${result.jobsErrored} system errors`
        );
        process.exitCode = 1;
      }
    } finally {
      logger.info('Disconnecting from database');
      await db.disconnect();
    }
  }
}

/**
 * Factory function to create a polling service instance
 * @param jiraClient - The Jira client instance for posting comments
 * @returns A new CursorAgentStatusPollingService instance
 */
export const createCursorAgentStatusPollingService = (
  jiraClient: JiraClient
): CursorAgentStatusPollingService =>
  new CursorAgentStatusPollingService({
    jiraClient,
  });

/**
 * Default instance of the Cursor agent status polling service
 */
export const cursorAgentStatusPollingService =
  createCursorAgentStatusPollingService(defaultJiraClient);
