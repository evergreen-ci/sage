#!/usr/bin/env node
/**
 * Entry point for the Jira polling cronjob
 * Run this file directly to poll Jira for sage-bot labeled tickets
 */

// Initialize Sentry BEFORE any other imports to ensure proper instrumentation
import '@/sentry-instrument';

import { sentryService } from '@/utils/sentry';
import { jiraClient } from '../jiraClient';
import { SageAutoPRBotJiraPollingService } from '../jiraPollingService/SageAutoPRBotJiraPollingService';

const service = new SageAutoPRBotJiraPollingService(jiraClient);

service
  .runAsJob()
  .catch(error => {
    console.error('Polling job failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Ensure Sentry flushes all events before process exits
    await sentryService.close();
  });
