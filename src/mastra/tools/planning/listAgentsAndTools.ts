import { createTool } from '@mastra/core';
import { mastra } from '../../index';

const listAgentsAndTools = createTool({
  id: 'list-agents-and-tools',
  description:
    'This is a tool that lists all the agents and tools available for the network. You should call this tool to get the tools and agents available to you. This is helpful in discovering what you can do.',
  execute: async () => {
    const agents = Object.values(mastra.getAgents());
    const agentToToolMap = new Map<
      string,
      { toolId: string; toolDescription: string }[]
    >();
    for (const agent of agents) {
      const tools = agent.getTools();
      const toolIds = Object.keys(tools);
      for (const toolId of toolIds) {
        const tool = tools[toolId as keyof typeof tools];
        agentToToolMap.set(agent.id, [
          ...(agentToToolMap.get(agent.id) || []),
          {
            toolId,
            toolDescription: tool.description,
          },
        ]);
      }
    }
    return Array.from(agentToToolMap.entries());
  },
});

export default listAgentsAndTools;
