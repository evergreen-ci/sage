#!/usr/bin/env node
/**
 * Entry point for the Jira polling cronjob
 * Run this file directly to poll Jira for sage-bot labeled tickets
 */

import { runPollingJob } from './jiraPollingService';

runPollingJob().catch(error => {
  console.error('Polling job failed:', error);
  process.exit(1);
});
