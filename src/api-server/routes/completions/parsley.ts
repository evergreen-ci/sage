import { Request, Response } from 'express';
import z from 'zod';
import { mastra } from 'mastra';
import { logger } from 'utils/logger';

const parsleyCompletionsSchema = z.object({
  message: z.string().min(1),
});

const parsleyCompletionsRoute = async (req: Request, res: Response) => {
  logger.info('Parsley completions request received', {
    requestId: req.requestId,
    body: req.body,
  });

  const { data, success } = parsleyCompletionsSchema.safeParse(req.body);
  if (!success) {
    logger.error('Invalid request body', {
      requestId: req.requestId,
      body: req.body,
    });
    res.status(400).json({ message: 'Invalid request body' });
    return;
  }
  try {
    const agent = mastra.getAgent('parsleyAgent');
    const result = await agent.generate(`What can you do?: ${data.message}`);
    const mastraLogger = mastra.getLogger();
    mastraLogger.info("info log", { agent: agent });
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
