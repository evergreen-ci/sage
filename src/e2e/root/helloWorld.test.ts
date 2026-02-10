import request from 'supertest';
import setupTestAppServer from '@/e2e/setup';

const app = setupTestAppServer();

describe('Hello World', () => {
  it('should return a 200 status code', async () => {
    const response = await request(app).get('/hello-world');
    expect(response.status).toBe(200);
  });

  it('should return "hello, world" message', async () => {
    const response = await request(app).get('/hello-world');
    expect(response.body).toEqual({ message: 'hello, world' });
  });
});
