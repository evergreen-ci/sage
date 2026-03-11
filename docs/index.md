# Sage

Sage is DevProd's agentic infrastructure platform. It provides a structured way to build, deploy, and observe AI agents — built on the [Mastra framework](https://mastra.ai/) and running on Express.js. Observability (distributed tracing, LLM call logging, error tracking) is wired in out of the box so you can focus on building agent logic rather than infrastructure.

## Platform

- **[Creating Agents](./platform/creating-agents.md)** — How to add a new agent, tool, workflow, or route to Sage. Covers the building blocks, registration, and key patterns.
- **[Observability](./platform/observability.md)** — How Honeycomb, Braintrust, and Sentry are configured and what they capture automatically.

For the full system architecture and component diagrams, see [ARCHITECTURE.md](../ARCHITECTURE.md). For exhaustive implementation reference (all patterns, examples, and Zod schemas), see [agents.md](../agents.md).

## Products

Each product is an agent or workflow exposed through a REST API. The source for each lives alongside its route handler.

| Product           | What it does                                                                                                                     | API Reference                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **Parsley AI**    | Conversational debugging of CI task failures and logs — classifies questions, fetches Evergreen metadata, and analyzes log files | [README](../src/api-server/routes/completions/parsley/README.md)      |
| **Memento**       | Converts Slack thread captures into structured Jira ticket data                                                                  | [README](../src/api-server/routes/completions/memento/README.md)      |
| **Lumber**        | Routes #ask-devprod questions to the right DevProd team                                                                          | [README](../src/api-server/routes/completions/lumber/README.md)       |
| **Release Notes** | Generates structured, citation-backed release notes from Jira issues                                                             | [README](../src/api-server/routes/completions/releaseNotes/README.md) |
| **Sage-Bot**      | Generates PRs from Jira tickets via Cursor Cloud Agents                                                                          | [docs/sage-bot/](./sage-bot/index.md)                                 |

## Getting Help

Reach out in [#ask-devprod](https://mongodb.enterprise.slack.com/archives/C69UXN1CP) on Slack.
