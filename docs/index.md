# Sage Documentation

Welcome to the Sage documentation.

## Architecture Overview

Sage is an AI agent orchestrator built on the [Mastra framework](https://mastra.ai/). It coordinates multiple specialized agents, tools, and workflows to power DevProd's AI features across the Evergreen ecosystem.

### How Sage Works

```
Client Request (HTTP)
    │
    ▼
Express.js Route ─── validates input, sets up request context
    │
    ▼
Orchestrator Agent ─── reasons about the request, plans steps
    ├── Sub-Agents (via agent-as-tool pattern)
    ├── Tools (data fetching, GraphQL queries)
    └── Workflows (multi-step processes via workflow-as-tool pattern)
    │
    ▼
Response (streamed or JSON)
```

The architecture follows a clean separation of concerns:

| Layer         | Responsibility                                              | Location                 |
| ------------- | ----------------------------------------------------------- | ------------------------ |
| **Routes**    | HTTP request/response handling, input validation, auth      | `src/api-server/routes/` |
| **Agents**    | Reasoning, decision-making, orchestration                   | `src/mastra/agents/`     |
| **Tools**     | Data fetching and specific actions (e.g., GraphQL queries)  | `src/mastra/tools/`      |
| **Workflows** | Multi-step processes with state management and control flow | `src/mastra/workflows/`  |

### Composition Patterns

Components compose together through two key patterns:

- **Agent-as-tool** — Sub-agents are wrapped as tools, allowing an orchestrator agent to invoke them as standard tool calls. This enables hierarchical agent design where a top-level agent delegates to specialized sub-agents.
- **Workflow-as-tool** — Multi-step workflows are exposed as tools, allowing agents to trigger entire workflows within a single tool call. This keeps complex logic (like chunked log analysis) encapsulated while remaining accessible to agents.

All agents and workflows are registered centrally in `src/mastra/index.ts` and share observability infrastructure (OpenTelemetry tracing, Braintrust experiment tracking, structured logging).

For implementation details, see [agents.md](../agents.md).

## Contents

- [Architecture](./architecture.md) - Full system architecture, component diagrams, and observability stack
- [Sage Bot](./sage-bot/index.md) - Automatically generate PRs from Jira tickets using AI
- [Parsley AI](./parsley/index.md) - Conversational AI for Evergreen task and log analysis
- [Memento](./memento/index.md) - Summarize Slack threads into structured Jira ticket data
- [Lumber](./lumber/index.md) - Route questions to the appropriate DevProd team
- [Release Notes](./release-notes/index.md) - Generate structured release notes from Jira issues
