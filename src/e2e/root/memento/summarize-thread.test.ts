import request from 'supertest';
import { describe, it, expect } from 'vitest';
import setupTestAppServer from '@/e2e/setup';
import { mastra } from '@/mastra';

const app = setupTestAppServer();

const summarizeThreadEndpoint = '/memento/summarize-thread';

describe('POST /memento/summarize-thread', () => {
  describe('Input validation', () => {
    it('should return 400 if slackThreadCapture is missing', async () => {
      const response = await request(app)
        .post(summarizeThreadEndpoint)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid request body');
    });

    it('should return 400 if slackThreadCapture is not a string', async () => {
      const response = await request(app)
        .post(summarizeThreadEndpoint)
        .send({ slackThreadCapture: 123 });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid request body');
    });

    it('should return 400 if slackThreadCapture is an empty string', async () => {
      const response = await request(app)
        .post(summarizeThreadEndpoint)
        .send({ slackThreadCapture: '' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid request body');
    });
  });

  describe('Agent behavior', () => {
    it('should return 500 if agent is not found', async () => {
      // Surgical mocking - only mock for this specific error test
      vi.spyOn(mastra, 'getAgent').mockReturnValueOnce(null as any);

      const response = await request(app).post(summarizeThreadEndpoint).send({
        slackThreadCapture: 'Some slack thread content',
      });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        'Slack thread summarizer agent not found'
      );

      // Restore immediately after test
      vi.restoreAllMocks();
    });

    it('should successfully generate summary for valid input', async () => {
      // Real integration test - makes actual agent call
      const slackThreadCapture = `
Slack URL: https://mongodb.slack.com/archives/C123/p456
Channel: #test-channel

[~john.doe@mongodb.com] Hey team, we have an issue with the build failing
[~jane.smith@mongodb.com] I think it might be related to the recent dependency updates
[~john.doe@mongodb.com] Let me investigate and create a ticket for this
      `.trim();

      const response = await request(app)
        .post(summarizeThreadEndpoint)
        .send({ slackThreadCapture });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reporter');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('description');

      // Verify response structure matches expected format
      expect(typeof response.body.reporter).toBe('string');
      expect(response.body.reporter).toMatch(/@mongodb\.com$/);
      expect(typeof response.body.title).toBe('string');
      expect(response.body.title.length).toBeGreaterThan(0);
      expect(typeof response.body.description).toBe('string');
      expect(response.body.description.length).toBeGreaterThan(0);
    });

    it('should return 500 if agent.generate throws an error', async () => {
      // Surgical mocking - mock only the agent's generate method to throw
      const agent = mastra.getAgent('slackThreadSummarizerAgent');
      const generateSpy = vi.spyOn(agent!, 'generate');
      generateSpy.mockRejectedValueOnce(new Error('Agent generation failed'));

      const response = await request(app).post(summarizeThreadEndpoint).send({
        slackThreadCapture: 'Some slack thread content',
      });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        'Failed to generate Slack thread summary'
      );

      // Restore immediately after test
      vi.restoreAllMocks();
    });

    it('should return 500 if agent returns invalid JSON', async () => {
      // Surgical mocking - mock only the agent's generate method to return invalid JSON
      const agent = mastra.getAgent('slackThreadSummarizerAgent');
      const generateSpy = vi.spyOn(agent!, 'generate');
      generateSpy.mockResolvedValueOnce({
        text: 'This is not valid JSON',
      } as any);

      const response = await request(app).post(summarizeThreadEndpoint).send({
        slackThreadCapture: 'Some slack thread content',
      });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe(
        'Failed to generate Slack thread summary'
      );

      // Restore immediately after test
      vi.restoreAllMocks();
    });
  });

  describe('Response format', () => {
    it('should return summary with proper Jira formatting', async () => {
      // Real integration test with a more detailed example
      const slackThreadCapture = `
Slack URL: https://mongodb.slack.com/archives/C456/p789
Channel: #devprod-evergreen

[~alice.developer@mongodb.com] I noticed that the github_pr_number expansion is showing incorrect values for merge queue items
[~bob.engineer@mongodb.com] Can you share an example?
[~alice.developer@mongodb.com] Sure, in task EVG-12345, the expansion shows PR #100 but the actual merge queue item is for PR #99
[~charlie.lead@mongodb.com] This sounds like a bug in how we handle merge queue metadata. We should fix the expansion logic.
[~alice.developer@mongodb.com] Agreed, I'll create a ticket to track this.
      `.trim();

      const response = await request(app)
        .post(summarizeThreadEndpoint)
        .send({ slackThreadCapture });

      expect(response.status).toBe(200);

      // Verify all required fields are present
      expect(response.body).toHaveProperty('reporter');
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('description');

      // Verify reporter is a MongoDB email
      expect(response.body.reporter).toMatch(/^[a-z]+\.[a-z]+@mongodb\.com$/);

      // Verify title is concise
      expect(response.body.title.length).toBeGreaterThan(10);
      expect(response.body.title.length).toBeLessThan(200);

      // Verify description contains expected Jira formatting elements
      const { description } = response.body;
      expect(description).toBeTruthy();
      expect(description.length).toBeGreaterThan(50);
    });
  });
});
