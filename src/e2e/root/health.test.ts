import request from 'supertest';
import sageServer from '../../api-server';

const app = sageServer.getApp();

describe('Health check', () => {
  it('should return a 200 status code', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });
  it('should return a list of agents', async () => {
    const response = await request(app).get('/health');
    expect(response.body.agents.names).toEqual(['parsleyAgent']);
  });
});
