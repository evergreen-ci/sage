import { Request, Response } from 'express';
import { logInfo } from 'utils/logger';

const parsleyCompletionsRoute = (req: Request, res: Response) => {
  logInfo('Parsley completions request received', {
    requestId: req.requestId,
    body: req.body,
  });

  res.json({
    message: 'Parsley completions endpoint',
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  });
};

export default parsleyCompletionsRoute;
