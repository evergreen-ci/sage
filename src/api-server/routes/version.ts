import { Request, Response } from 'express';
import { execSync } from 'child_process';

const versionRoute = (_req: Request, res: Response) => {
  try {
    const gitHash = execSync('git rev-parse HEAD', {
      encoding: 'utf-8',
    }).trim();
    res.type('text/plain').send(gitHash);
  } catch (error) {
    res.status(500).type('text/plain').send('Unable to retrieve git hash');
  }
};

export default versionRoute;
