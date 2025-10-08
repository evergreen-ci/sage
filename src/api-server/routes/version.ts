import { Request, Response } from 'express';

const versionRoute = (_req: Request, res: Response) => {
  try {
    const gitHash = process.env.GIT_HASH;
    res.type('text/plain').send(gitHash);
  } catch (error) {
    res.status(500).type('text/plain').send('Unable to retrieve git hash');
  }
};

export default versionRoute;
