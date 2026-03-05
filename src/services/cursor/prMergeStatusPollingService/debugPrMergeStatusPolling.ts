#!/usr/bin/env node
/**
 * Debug script for testing PR merge status polling locally
 *
 * Usage:
 *   NODE_ENV=staging dotenv-flow vite-node src/services/cursor/jobs/debugPrMergeStatusPolling.ts
 */

import { db } from '@/db/connection';
import {
  findCompletedJobRunsWithOpenPRs,
  updateJobRun,
} from '@/db/repositories/jobRunsRepository';
import { PRStatus } from '@/db/types';
import { githubTokenManager } from '@/services/github';
import logger from '@/utils/logger';

const runDebug = async () => {
  console.log('\n=== PR Merge Status Polling Debug Script ===\n');

  try {
    console.log('Connecting to database...');
    await db.connect();
    console.log('Connected to database\n');

    console.log('Looking for completed jobs with open PRs...');
    const jobs = await findCompletedJobRunsWithOpenPRs();
    console.log(`Found ${jobs.length} jobs with open PRs\n`);

    if (jobs.length === 0) {
      console.log('No jobs found with open PRs.');
      console.log('Required: status=completed, pr.status=OPEN, pr.url set\n');
      return;
    }

    // Show all found jobs
    console.log('All jobs with open PRs:');
    for (const [i, job] of jobs.entries()) {
      console.log(
        `  ${i + 1}. ${job.jiraTicketKey} | ${job.pr?.url} | completed: ${job.completedAt?.toISOString()}`
      );
    }
    console.log('');

    // Pick a specific PR to test, or fall back to first evergreen-ci PR
    const targetPrUrl = 'https://github.com/evergreen-ci/sage/pull/313';
    const targetJob =
      jobs.find(j => j.pr?.url === targetPrUrl) ??
      jobs.find(j => j.pr?.url?.includes('evergreen-ci/')) ??
      jobs[0];

    if (!targetJob?.pr?.url) {
      console.log('No suitable job found with a PR URL.');
      return;
    }

    console.log(`--- Testing with job: ${targetJob._id} ---`);
    console.log(`  Ticket: ${targetJob.jiraTicketKey}`);
    console.log(`  PR URL: ${targetJob.pr.url}`);
    console.log(`  PR Status (before): ${targetJob.pr.status}`);
    console.log(`  PR Number: ${targetJob.pr.number}`);
    console.log(`  Repository: ${targetJob.pr.repository}\n`);

    // Call GitHub API directly to check PR status
    console.log('Calling GitHub API...');
    const prInfo = await githubTokenManager.getPullRequestByUrl(
      targetJob.pr.url
    );

    if (!prInfo) {
      console.log('PR not found on GitHub (404). It may have been deleted.\n');
      return;
    }

    console.log('GitHub API response:');
    console.log(`  State: ${prInfo.state}`);
    console.log(`  Merged: ${prInfo.merged}`);
    console.log(`  Merged at: ${prInfo.mergedAt ?? 'N/A'}`);
    console.log(`  Title: ${prInfo.title}\n`);

    // Map to PRStatus
    let newStatus: PRStatus;
    if (prInfo.merged) {
      newStatus = PRStatus.Merged;
    } else if (prInfo.state === 'closed') {
      newStatus = PRStatus.Declined;
    } else {
      newStatus = PRStatus.Open;
    }

    console.log(`Mapped status: ${targetJob.pr.status} -> ${newStatus}`);

    if (newStatus === targetJob.pr.status) {
      console.log('No status change needed.\n');
      return;
    }

    // Update the job run in the database
    console.log(`\nUpdating job run ${targetJob._id} in database...`);
    await updateJobRun(targetJob._id!, {
      pr: {
        ...targetJob.pr,
        status: newStatus,
        updatedAt: prInfo.mergedAt ? new Date(prInfo.mergedAt) : new Date(),
      },
    });

    console.log(`Successfully updated PR status to ${newStatus}!`);
    console.log(`  Job ID: ${targetJob._id}`);
    console.log(`  Ticket: ${targetJob.jiraTicketKey}`);
    console.log(`  PR: ${targetJob.pr.url}\n`);
  } catch (error) {
    console.error('\nError:', error);
    logger.error('Debug script failed', { error });
    process.exitCode = 1;
  } finally {
    console.log('Disconnecting from database...');
    await db.disconnect();
    console.log('Disconnected.\n');
  }
};

runDebug();
