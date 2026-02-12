import request from 'supertest';
import setupTestAppServer from '@/e2e/setup';

const app = setupTestAppServer();

describe('Health check', () => {
  it('should return a 200 status code', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });
  it('should return a list of agents', async () => {
    const response = await request(app).get('/health');
    expect(response.body.agents.names).toEqual([
      'sageThinkingAgent',
      'evergreenAgent',
      'questionClassifierAgent',
      'questionOwnershipAgent',
      'releaseNotesAgent',
      'runtimeEnvironmentsAgent',
      'slackThreadSummarizerAgent',
    ]);
  });
});
