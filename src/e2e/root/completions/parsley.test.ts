import request from 'supertest';
import sageServer from '../../../api-server';

const app = sageServer.getApp();

describe('completions/parsley', () => {
  it('should return a completion', async () => {
    const response = await request(app).post('/completions/parsley').send({
      message: 'Hello, world!',
    });
    expect(response.status).toBe(200);
    expect(response.body.message).not.toBeNull();
  });
});
