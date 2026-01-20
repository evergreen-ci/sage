#!/usr/bin/env node
/**
 * Entry point for the Cursor agent status polling cronjob
 * Run this file directly to poll Cursor API for agent status updates
 */

// Initialize Sentry BEFORE any other imports to ensure proper instrumentation
import '@/sentry-instrument';

import logger from '@/utils/logger';
import { Sentry, sentryService } from '@/utils/sentry';
import { cursorAgentStatusPollingService } from '../cursorAgentStatusPollingService';

const monitorConfig = {
  schedule: {
    type: 'crontab' as const,
    value: '* * * * *',
  },
  checkinMargin: 1, // In minutes. Optional.
  maxRuntime: 5, // In minutes. Allow time for multiple API calls.
  timezone: 'America/New_York', // Optional.
};

const checkInId = Sentry.captureCheckIn(
  {
    monitorSlug: 'cursor-agent-status-polling-job',
    status: 'in_progress',
  },
  monitorConfig
);

let hasError = false;

cursorAgentStatusPollingService
  .runAsJob()
  .catch(error => {
    logger.error('Cursor agent status polling job failed', { error });
    hasError = true;
    process.exitCode = 1;
  })
  .finally(async () => {
    Sentry.captureCheckIn({
      checkInId,
      monitorSlug: 'cursor-agent-status-polling-job',
      status: hasError ? 'error' : 'ok',
    });
    // Ensure Sentry flushes all events before process exits
    await sentryService.close();
  });
