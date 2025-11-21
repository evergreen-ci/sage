import { Request, Response } from 'express';
import sageServer from '@/api-server';
import { config, validateConfig } from '@/config';
import { db } from '@/db/connection';
import { mastra } from '@/mastra';
import { sentryService } from '@/utils/sentry';

const healthRoute = async (req: Request, res: Response) => {
  const configErrors = validateConfig();
  if (configErrors) {
    res.status(500).json({
      status: 'error',
      message: 'Some config variables are not set',
      errors: configErrors,
    });
    return;
  }

  const agents = mastra.listAgents();
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

  const dbHealth = await db.ping();
  if (!dbHealth) {
    res.status(500).json({
      status: 'error',
      message: 'Database is not healthy',
    });
    return;
  }

  const dbStats = await db.dbStats();
  const uptimeSeconds = sageServer.getUptimeSeconds();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    version: config.version,
    downstreamEvergreen: config.evergreen.graphqlEndpoint,
    agents: {
      count: agentNames.length,
      names: agentNames,
    },
    database: {
      status: dbStats.ok === 1 ? 'healthy' : 'unhealthy',
    },
    sentry: {
      enabled: sentryService.isInitialized(),
    },
    otelConfig: {
      logCollectorURL: config.honeycomb.otelLogCollectorURL,
      traceCollectorURL: config.honeycomb.otelCollectorURL,
    },
  });
};

export default healthRoute;
