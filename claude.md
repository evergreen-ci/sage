# Claude Development Guide

When working on the Sage codebase and you need to implement or modify agents, tools, workflows, evals, or REST routes, consult [agents.md](agents.md) for comprehensive implementation guidance.

## What's in agents.md

The [agents.md](agents.md) file contains:

- **Creating Agents**: How to build agents using Mastra's Agent class, including examples with structured output, tools, workflows, and memory
- **Creating Tools**: Patterns for creating tools, including GraphQL tools and agent-as-tool patterns with real examples from the codebase
- **Creating Workflows**: How to build multi-step workflows with createWorkflow() and createStep(), including control flow and state management
- **Creating REST Routes**: Patterns for Express routes that use agents (with streaming) and workflows, including runtime context and memory setup
- **Creating Evals**: How to build evaluations for agents and workflows using Braintrust, including test cases, scorers, reporters, and helper utilities
- **Key Patterns**: Essential patterns like Zod schemas, RuntimeContext, tracing, memory, and composition strategies

## Architecture Overview

Sage uses the Mastra framework for building agentic systems. The architecture follows a clean separation:

- **Routes** (Express.js) handle HTTP requests and responses
- **Agents** handle reasoning and decision-making
- **Tools** fetch data or perform specific actions
- **Workflows** coordinate multi-step processes

Components are composed together: routes orchestrate agents/workflows, agents use tools and workflows, workflows call agents in their steps, and agents can invoke other agents as tools.

## Quick Reference

- All agents are registered in [src/mastra/index.ts](src/mastra/index.ts)
- All workflows are registered in [src/mastra/index.ts](src/mastra/index.ts)
- All routes are registered in [src/api-server/index.ts](src/api-server/index.ts)
- All eval reporters are registered in [src/evals/constants.ts](src/evals/constants.ts)
- Agent implementations: [src/mastra/agents/](src/mastra/agents/)
- Tool implementations: [src/mastra/tools/](src/mastra/tools/)
- Workflow implementations: [src/mastra/workflows/](src/mastra/workflows/)
- Route implementations: [src/api-server/routes/](src/api-server/routes/)
- Eval implementations: [src/evals/](src/evals/)

For detailed implementation instructions, code examples, and patterns, see [agents.md](agents.md).
