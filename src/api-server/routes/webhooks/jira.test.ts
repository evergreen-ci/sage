import express from 'express';
import request from 'supertest';

const mockedQueue = vi.hoisted(() => ({
  enqueue: vi.fn(),
  shutdown: vi.fn(),
}));

vi.mock('@/queues/jiraIssueQueue', () => ({
  jiraIssueQueue: mockedQueue,
}));

import jiraWebhookRouter from './jira';
import { jiraIssueQueue } from '@/queues/jiraIssueQueue';

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/', jiraWebhookRouter);
  return app;
};

const enqueueSpy = jiraIssueQueue.enqueue as ReturnType<typeof vi.fn>;

describe('Jira webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues an issue key and responds with 202', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/')
      .send({ issue: { key: 'EVG-123' }, webhookEvent: 'jira:issue_updated' });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ status: 'queued', issueKey: 'EVG-123' });
    expect(enqueueSpy).toHaveBeenCalledWith('EVG-123');
  });

  it('returns 400 when the payload lacks an issue key', async () => {
    const app = buildApp();
    const response = await request(app).post('/').send({ foo: 'bar' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('issue.key');
    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it('returns 503 when enqueueing fails', async () => {
    enqueueSpy.mockRejectedValueOnce(new Error('redis down'));
    const app = buildApp();

    const response = await request(app)
      .post('/')
      .send({ issue: { key: 'EVG-999' } });

    expect(response.status).toBe(503);
    expect(response.body.error).toContain('Unable to enqueue');
    expect(enqueueSpy).toHaveBeenCalledWith('EVG-999');
  });
});
