import { validateConfig } from '@/config';
import {
  findCompletedJobRunsWithOpenPRs,
  updateJobRun,
} from '@/db/repositories/jobRunsRepository';
import { JobRun } from '@/db/types';
import {
  JiraClient,
  jiraClient as defaultJiraClient,
  DevStatusResponse,
} from '@/services/jira/jiraClient';
import logger from '@/utils/logger';

export interface PrMergeStatusPollingConfig {
  jiraClient: JiraClient;
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
 * Polls Jira Dev Status API for PR merge status and updates job runs accordingly
 *
 * This service:
 * 1. Finds all completed job runs with open PRs
 * 2. Calls Jira Dev Status API for each job's ticket
 * 3. Matches PR by URL and checks if status is MERGED or DECLINED
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

      // Get dev status from Jira
      const devStatus = await this.config.jiraClient.getDevStatus(ticketKey);

      if (!devStatus) {
        logger.debug(`No dev status found for job ${jobId}`, {
          jobId,
          ticketKey,
        });
        return {
          jobId,
          ticketKey,
          success: true,
          skipped: true,
          skipReason: 'No dev status found in Jira',
        };
      }

      // Find matching PR by URL
      const matchingPr = this.findMatchingPr(devStatus, job.pr.url);

      if (!matchingPr) {
        logger.debug(`No matching PR found for job ${jobId}`, {
          jobId,
          ticketKey,
          prUrl: job.pr.url,
        });
        return {
          jobId,
          ticketKey,
          success: true,
          skipped: true,
          skipReason: 'PR not found in Jira dev status',
        };
      }

      // Check if PR status has changed
      if (matchingPr.status === 'OPEN') {
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

      // PR status has changed - update job run
      const now = new Date();
      const statusMap: Record<string, 'merged' | 'closed' | 'open'> = {
        MERGED: 'merged',
        DECLINED: 'closed',
      };
      const newStatus = statusMap[matchingPr.status] ?? 'open';

      await updateJobRun(job._id!, {
        pr: {
          ...job.pr,
          status: newStatus,
          mergedAt: matchingPr.status === 'MERGED' ? now : job.pr.mergedAt,
          closedAt: matchingPr.status === 'DECLINED' ? now : job.pr.closedAt,
        },
      });

      logger.info(`Updated PR status for job ${jobId}`, {
        jobId,
        ticketKey,
        prUrl: job.pr.url,
        newStatus,
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
   * Find the PR in dev status response that matches the job's PR URL
   * @param devStatus - The dev status response from Jira
   * @param prUrl - The PR URL to match
   * @returns The matching PR, or null if not found
   */
  private findMatchingPr(
    devStatus: DevStatusResponse,
    prUrl: string
  ): DevStatusResponse['detail'][0]['pullRequests'][0] | null {
    // Normalize URLs for comparison (remove trailing slashes, etc.)
    const normalizeUrl = (url: string): string => url.trim().replace(/\/$/, '');

    const normalizedPrUrl = normalizeUrl(prUrl);

    for (const detail of devStatus.detail || []) {
      for (const pr of detail.pullRequests || []) {
        if (normalizeUrl(pr.url) === normalizedPrUrl) {
          return pr;
        }
      }
    }

    return null;
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

      // Process jobs sequentially to avoid bursting Jira API calls.
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
 * @param jiraClient - The Jira client instance
 * @returns A new PrMergeStatusPollingService instance
 */
export const createPrMergeStatusPollingService = (
  jiraClient: JiraClient
): PrMergeStatusPollingService =>
  new PrMergeStatusPollingService({
    jiraClient,
  });

/**
 * Default instance of the PR merge status polling service
 */
export const prMergeStatusPollingService =
  createPrMergeStatusPollingService(defaultJiraClient);
