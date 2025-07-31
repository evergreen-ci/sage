import { Request, Response } from 'express';
import { validateConfig } from 'config';
import { mastra } from 'mastra';

const healthRoute = (req: Request, res: Response) => {
  const configErrors = validateConfig();
  if (configErrors) {
    res.status(500).json({
      status: 'error',
      message: 'Some config variables are not set',
      errors: configErrors,
    });
    return;
  }

  const agents = mastra.getAgents();
  if (!agents || Object.keys(agents).length === 0) {
    res.status(500).json({
      status: 'error',
      message: 'No agents found',
    });
    return;
  }

  const agentNames = Object.keys(agents);
  const errors: string[] = [];
  for (const agent of agentNames) {
    const agentModel = agents[agent]?.getModel();
    if (!agentModel) {
      errors.push(`Agent ${agent} is not ready`);
    }
  }

  if (errors.length > 0) {
    res.status(500).json({
      status: 'error',
      message: 'Some agents are not ready',
      errors: errors,
    });
    return;
  }

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    agents: {
      count: agentNames.length,
      names: agentNames,
    },
  });
};

export default healthRoute;
