#!/usr/bin/env node
/**
 * Entry point for the Jira polling cronjob
 * Run this file directly to poll Jira for sage-bot labeled tickets
 */

// Initialize Sentry BEFORE any other imports to ensure proper instrumentation
import '@/sentry-instrument';

import { Sentry, sentryService } from '@/utils/sentry';
import { SageAutoPRBotJiraPollingService } from '../jiraPollingService/SageAutoPRBotJiraPollingService';

const monitorConfig = {
  schedule: {
    type: 'crontab' as const,
    value: '* * * * *',
  },
  checkinMargin: 1, // In minutes. Optional.
  maxRuntime: 1, // In minutes. Optional.
  timezone: 'America/New_York', // Optional.
};

const checkInId = Sentry.captureCheckIn(
  {
    monitorSlug: 'Sentry Jira Polling Job',
    status: 'in_progress',
  },
  monitorConfig
);

SageAutoPRBotJiraPollingService.runAsJob()
  .catch(error => {
    console.error('Polling job failed:', error);
    process.exitCode = 1;
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: 'Sentry Jira Polling Job',
      status: 'error',
    });
  })
  .finally(async () => {
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: 'Sentry Jira Polling Job',
      status: 'ok',
    });
    // Ensure Sentry flushes all events before process exits
    await sentryService.close();
  });
