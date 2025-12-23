#!/usr/bin/env node
/**
 * Entry point for the Jira polling cronjob
 * Run this file directly to poll Jira for sage-bot labeled tickets
 */

// Initialize Sentry BEFORE any other imports to ensure proper instrumentation
import '@/utils/sentry-instrument';

import { sentryService } from '@/utils/sentry';
import { runPollingJob } from '../jiraPollingService';

runPollingJob()
  .catch(error => {
    console.error('Polling job failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Ensure Sentry flushes all events before process exits
    await sentryService.close();
  });
