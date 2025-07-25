import { RuntimeContext } from '@mastra/core/runtime-context';
import { Request, Response } from 'express';
import { mastra } from 'mastra';
import { logger } from 'utils/logger';
import { validateParsleyURLRequest } from './utils';

const parsleyCompletionsRoute = async (req: Request, res: Response) => {
  logger.info('Parsley completions request received', {
    requestId: req.requestId,
    body: req.body,
  });

  const { data, error } = validateParsleyURLRequest(req.body);
  if (error) {
    logger.error('Invalid request body', {
      requestId: req.requestId,
      error: error.message,
    });
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }

  const runtimeContext = new RuntimeContext();
  runtimeContext.set('taskID', data.taskID);
  runtimeContext.set('execution', data.execution);
  runtimeContext.set('sessionID', data.sessionID);
  runtimeContext.set('userID', req.headers['x-user-id'] as string);
  try {
    const agent = mastra.getAgent('parsleyAgent');
    const result = await agent.generate(data.message, {
      runtimeContext,
    });
    res.json({
      message: result.text,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      completionUsage: result.usage,
    });
  } catch (e) {
    logger.error('Error in parsley completions route', {
      error: e,
      requestId: req.requestId,
    });
    res.status(500).json({
      message: 'Error in parsley completions route',
    });
  }
};

export default parsleyCompletionsRoute;
