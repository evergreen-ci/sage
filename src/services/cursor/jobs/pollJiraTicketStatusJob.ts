/**
 * Entry point for the Jira ticket status polling cronjob
 * Run this file directly to poll Jira Dev Status API for ticket updates (PR merge status, etc.)
 */

// Initialize Sentry BEFORE any other imports to ensure proper instrumentation
import '@/sentry-instrument';

import logger from '@/utils/logger';
import { Sentry, sentryService } from '@/utils/sentry';
import { prMergeStatusPollingService } from '../prMergeStatusPollingService';

const monitorConfig = {
  schedule: {
    type: 'crontab' as const,
    value: '*/5 * * * *', // Run every 5 minutes
  },
  checkinMargin: 1, // In minutes. Optional.
  maxRuntime: 5, // In minutes. Allow time for multiple API calls.
  timezone: 'America/New_York', // Optional.
};

const checkInId = Sentry.captureCheckIn(
  {
    monitorSlug: 'jira-ticket-status-polling-job',
    status: 'in_progress',
  },
  monitorConfig
);

let hasError = false;

prMergeStatusPollingService
  .runAsJob()
  .catch(error => {
    logger.error('Jira ticket status polling job failed', { error });
    hasError = true;
    process.exitCode = 1;
  })
  .finally(async () => {
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: 'jira-ticket-status-polling-job',
      status: hasError ? 'error' : 'ok',
    });
    // Ensure Sentry flushes all events before process exits
    await sentryService.close();
  });
