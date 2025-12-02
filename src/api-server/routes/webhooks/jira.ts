import express, { type Request, type Response } from 'express';
import { jiraIssueQueue } from '@/queues/jiraIssueQueue';
import { logger } from '@/utils/logger';

type JiraIssue = {
  id?: string;
  key?: string;
  fields?: Record<string, unknown>;
};

type JiraWebhookPayload = {
  issue?: JiraIssue;
  issueKey?: string;
  issue_key?: string;
  webhookEvent?: string;
  [key: string]: unknown;
};

const jiraWebhookRouter = express.Router();

const extractIssueKey = (payload?: JiraWebhookPayload): string | undefined => {
  if (!payload) {
    return undefined;
  }
  const possibleKeys = [
    payload.issue?.key,
    payload.issueKey,
    payload.issue_key,
  ].filter((value): value is string => typeof value === 'string');

  const normalized = possibleKeys[0]?.trim();
  return normalized || undefined;
};

jiraWebhookRouter.post(
  '/',
  async (
    req: Request<unknown, unknown, JiraWebhookPayload>,
    res: Response
  ) => {
    const issueKey = extractIssueKey(req.body);
    if (!issueKey) {
      logger.warn('Jira webhook payload missing issue key', {
        bodyKeys: Object.keys(req.body ?? {}),
      });
      return res.status(400).json({
        error: 'issue.key is required in the webhook payload',
      });
    }

    try {
      await jiraIssueQueue.enqueue(issueKey);

      logger.info('Queued Jira issue for processing', {
        issueKey,
        webhookEvent: req.body?.webhookEvent,
      });

      return res.status(202).json({
        status: 'queued',
        issueKey,
      });
    } catch (error) {
      logger.error('Failed to enqueue Jira issue key', error, {
        issueKey,
      });
      return res.status(503).json({
        error: 'Unable to enqueue Jira issue for processing',
      });
    }
  }
);

export default jiraWebhookRouter;
