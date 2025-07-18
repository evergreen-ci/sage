import { Request, Response } from 'express';

const healthRoute = (req: Request, res: Response) => {
  // TODO: Add health check for the server
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
};

export default healthRoute;
