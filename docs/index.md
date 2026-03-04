# Sage Documentation

Sage is DevProd's AI platform. It coordinates multiple specialized agents, tools, and workflows — built on the [Mastra framework](https://mastra.ai/) — to automate common tasks across the Evergreen ecosystem: debugging task failures, triaging Slack questions, generating release notes, and more.

If you're new here, the [Architecture](./architecture.md) page is the best place to start — it explains how the pieces fit together and includes system diagrams. If you're looking to build something new (a new agent, tool, workflow, or API route), see the [Agent Development Guide](../agents.md) for implementation patterns and code examples.

## Products

Each product solves a specific problem for DevProd teams:

- **[Parsley AI](./parsley/index.md)** — Conversational AI for Evergreen task and log analysis. Ask questions about task failures, test results, and log contents in natural language.
- **[Sage Bot](./sage-bot/index.md)** — Automatically generate PRs from Jira tickets. Describe the work in a ticket, add a label, and get a PR back.
- **[Memento](./memento/index.md)** — Turn Slack threads into structured Jira ticket data. Captures the reporter, issue summary, and proposed solution.
- **[Lumber](./lumber/index.md)** — Route #ask-devprod questions to the right team. Classifies questions and explains its routing reasoning.
- **[Release Notes](./release-notes/index.md)** — Generate structured, citation-backed release notes from Jira issues.

## Infrastructure

- [Architecture](./architecture.md) — System architecture, component diagrams, observability stack, and data layer
- [Mastra Framework Docs](https://mastra.ai/docs) — Reference documentation for the underlying agent framework (agents, tools, workflows, memory)
