import { Request, Response } from 'express';
import { mastra } from '../../mastra';

const healthRoute = (req: Request, res: Response) => {
  // TODO: Add health check for the server
  const agents = mastra.getAgents();
  if (!agents || Object.keys(agents).length === 0) {
    res.status(500).json({
      status: 'error',
      message: 'No agents found',
    });
    return;
  }

  const agentNames = Object.keys(agents);

  for (const agent of agentNames) {
    const agentModel = agents[agent]?.getModel();
    if (!agentModel) {
      res.status(500).json({
        status: 'error',
        message: `Agent ${agent} is not ready`,
      });
      return;
    }
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
