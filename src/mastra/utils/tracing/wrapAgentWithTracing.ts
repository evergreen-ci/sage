import { Agent } from '@mastra/core/agent';
import { wrapTraced } from 'braintrust';

/**
 * This function wraps the generateVNext and streamVNext methods of an agent with tracing.
 * @param agent - The agent to wrap with tracing.
 * @returns The agent with the wrapped methods.
 */
const wrapAgentWithTracing = (agent: Agent) => {
  agent.generateVNext = wrapTraced(agent.generateVNext.bind(agent), {
    name: agent.name,
  });
  agent.streamVNext = wrapTraced(agent.streamVNext.bind(agent), {
    name: agent.name,
  });
  return agent;
};

export default wrapAgentWithTracing;
