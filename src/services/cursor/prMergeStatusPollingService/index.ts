import { validateConfig } from '@/config';
import {
  findCompletedJobRunsWithOpenPRs,
  updateJobRun,
} from '@/db/repositories/jobRunsRepository';
import { JobRun, PRStatus } from '@/db/types';
import {
  GitHubTokenManager,
  githubTokenManager as defaultGitHubTokenManager,
} from '@/services/github';
import logger from '@/utils/logger';

/** Milliseconds after which an open PR is considered abandoned (30 days) */
const ABANDONED_PR_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

export interface PrMergeStatusPollingConfig {
  githubTokenManager: GitHubTokenManager;
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
 * Polls GitHub API for PR merge status and updates job runs accordingly
 *
 * This service:
 * 1. Finds all completed job runs with open PRs
 * 2. Calls GitHub API directly for each PR
 * 3. Checks if PR is merged or closed
 * 4. Updates job run with PR status and timestamps
 */
export class PrMergeStatusPollingService {
  private config: PrMergeStatusPollingConfig;

  constructor(config: PrMergeStatusPollingConfig) {
    this.config = config;
  }

  /**
   * Process a single job run - check PR merge status and update accordingly
   * @param job - The job run to process
   * @returns The result of processing the job
   */
  private async processJob(job: JobRun): Promise<JobPollingResult> {
    const jobId = job._id?.toString() ?? 'unknown';
    const ticketKey = job.jiraTicketKey;

    try {
      if (!job.pr?.url) {
        logger.warn(`Job ${jobId} missing PR URL`, {
          jobId,
          ticketKey,
        });
        return {
          jobId,
          ticketKey,
          success: true,
          skipped: true,
          skipReason: 'Missing PR URL',
        };
      }

      // Check if the job is stale (completed more than 30 days ago)
      const staleThreshold = new Date(Date.now() - ABANDONED_PR_THRESHOLD_MS);
      if (job.completedAt && job.completedAt < staleThreshold) {
        // Mark as abandoned to stop future polling
        await updateJobRun(job._id!, {
          pr: {
            ...job.pr,
            status: PRStatus.Abandoned,
            updatedAt: new Date(),
          },
        });

        logger.info(`Marked stale PR as abandoned for job ${jobId}`, {
          jobId,
          ticketKey,
          prUrl: job.pr.url,
          completedAt: job.completedAt,
        });

        return { jobId, ticketKey, success: true };
      }

      // Get PR status from GitHub
      const prInfo = await this.config.githubTokenManager.getPullRequestByUrl(
        job.pr.url
      );

      if (!prInfo) {
        logger.debug(`PR not found in GitHub for job ${jobId}`, {
          jobId,
          ticketKey,
          prUrl: job.pr.url,
        });
        return {
          jobId,
          ticketKey,
          success: true,
          skipped: true,
          skipReason: 'PR not found in GitHub',
        };
      }

      // Determine new PR status
      let newStatus: PRStatus;
      if (prInfo.merged) {
        newStatus = PRStatus.Merged;
      } else if (prInfo.state === 'closed') {
        newStatus = PRStatus.Declined;
      } else {
        newStatus = PRStatus.Open;
      }

      // Check if PR status has changed
      if (newStatus === PRStatus.Open) {
        // Still open, no update needed
        logger.debug(`PR still open for job ${jobId}`, {
          jobId,
          ticketKey,
          prUrl: job.pr.url,
        });
        return {
          jobId,
          ticketKey,
          success: true,
          skipped: true,
          skipReason: 'PR still open',
        };
      }

      // PR status has changed - update job run with status and timestamp
      await updateJobRun(job._id!, {
        pr: {
          ...job.pr,
          status: newStatus,
          updatedAt: prInfo.mergedAt ? new Date(prInfo.mergedAt) : new Date(),
        },
      });

      logger.info(`Updated PR status for job ${jobId}`, {
        jobId,
        ticketKey,
        prUrl: job.pr.url,
        status: newStatus,
        merged: prInfo.merged,
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
      const completedJobs = await findCompletedJobRunsWithOpenPRs();
      result.jobsFound = completedJobs.length;

      logger.info(
        `Found ${completedJobs.length} completed jobs with open PRs to check`
      );

      if (completedJobs.length === 0) {
        return result;
      }

      // Process jobs sequentially to avoid bursting GitHub API calls.
      // Running these in parallel (e.g. via Promise.all) can easily exceed
      // external rate limits and cause 429/throttling responses.
      for (const job of completedJobs) {
        // eslint-disable-next-line no-await-in-loop -- intentional sequential processing
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

      logger.info('Completed PR merge status polling run', {
        jobsFound: result.jobsFound,
        jobsProcessed: result.jobsProcessed,
        jobsSkipped: result.jobsSkipped,
        jobsErrored: result.jobsErrored,
      });

      return result;
    } catch (error) {
      logger.error('PR merge status polling run failed', error);
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
      logger.info('Connecting to database for PR merge status polling job');
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
 * @param githubTokenManager - The GitHub token manager instance
 * @returns A new PrMergeStatusPollingService instance
 */
export const createPrMergeStatusPollingService = (
  githubTokenManager: GitHubTokenManager
): PrMergeStatusPollingService =>
  new PrMergeStatusPollingService({
    githubTokenManager,
  });

/**
 * Default instance of the PR merge status polling service
 */
export const prMergeStatusPollingService =
  createPrMergeStatusPollingService(defaultGitHubTokenManager);
