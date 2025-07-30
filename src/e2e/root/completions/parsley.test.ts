import request from 'supertest';
import setupTestAppServer from '../../setup';

const app = setupTestAppServer();

describe('completions/parsley', () => {
  it('should return a completion', async () => {
    const response = await request(app).post('/completions/parsley').send({
      message: 'Hello, world!',
    });
    expect(response.status).toBe(200);
    expect(response.body.message).not.toBeNull();
  });
  it('should return a 400 status code if the message is not provided', async () => {
    const response = await request(app).post('/completions/parsley').send({});
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid request body');
  });
});
