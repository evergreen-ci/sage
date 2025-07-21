import { Request, Response } from 'express';
import { mastra } from 'mastra';
import { logger } from 'utils/logger';

const parsleyCompletionsRoute = async (req: Request, res: Response) => {
  logger.info('Parsley completions request received', {
    requestId: req.requestId,
    body: req.body,
  });

  // TODO: Add some input validation here
  const { message } = req.body;

  try {
    const agent = mastra.getAgent('parsleyAgent');
    const result = await agent.generate(`What can you do?: ${message}`);
    res.json({
      message: result.text,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      completionUsage: result.usage,
    });
  } catch (error) {
    logger.error('Error in parsley completions route', {
      error,
      requestId: req.requestId,
    });
    res.status(500).json({
      message: 'Error in parsley completions route',
    });
  }
};

export default parsleyCompletionsRoute;
