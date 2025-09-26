import request from 'supertest';
import { execSync } from 'child_process';
import setupTestAppServer from '../setup';

const app = setupTestAppServer();

describe('Version route', () => {
  it('should return a 200 status code', async () => {
    const response = await request(app).get('/version');
    expect(response.status).toBe(200);
  });

  it('should return the current git commit hash', async () => {
    const response = await request(app).get('/version');
    const expectedHash = execSync('git rev-parse HEAD', {
      encoding: 'utf-8',
    }).trim();
    expect(response.text).toBe(expectedHash);
  });

  it('should return plain text content type', async () => {
    const response = await request(app).get('/version');
    expect(response.type).toBe('text/plain');
  });
});
