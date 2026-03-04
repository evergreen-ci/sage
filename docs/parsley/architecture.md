# Parsley AI Architecture

This document covers how Parsley AI is built — the architectural patterns and design decisions behind turning a user's question into a streamed, evidence-based answer. For product-level documentation (API endpoints, capabilities, classification details), see the [Parsley AI overview](./index.md).

## Architecture Overview

```
User Question
    |
    v
[Route] — validates request, pre-resolves log URL if metadata provided
    |
    v
[Orchestrator Agent] — reasons about the question, builds a plan
    |
    |-- [Question Classifier] (agent-as-tool)
    |       decides: metadata query? log analysis? both? general knowledge?
    |
    |-- [Evergreen Agent] (agent-as-tool)
    |       fetches task/test/version data via GraphQL
    |
    |-- [Log Analyzer] (workflow-as-tool)
    |       loads, chunks, and analyzes log content
    |
    |-- [Log URL Resolver] (workflow-as-tool)
    |       turns Evergreen metadata into a downloadable log URL
    |
    v
Streamed response
```

## Orchestration

The sageThinkingAgent is the central [orchestrator](https://mastra.ai/docs/agents/overview) with thread-scoped [working memory](https://mastra.ai/docs/memory/working-memory) so it can reference earlier messages in a conversation. When a message arrives, it builds an internal checklist, invokes specialists as needed, validates outcomes, and assembles a final answer.

The key insight is that the orchestrator doesn't contain domain logic itself — it delegates everything to specialists and focuses purely on reasoning about _which_ specialist to call and _how_ to combine their results.

## Composition Patterns

### Agent-as-Tool

Sub-agents (Question Classifier, Evergreen Agent) are wrapped as [tools](https://mastra.ai/docs/agents/using-tools) so the orchestrator invokes them through the standard tool-calling interface. This means adding a new specialist doesn't require changing the orchestrator's code — just register a new tool.

### Workflow-as-Tool

Multi-step [workflows](https://mastra.ai/docs/workflows/overview) (Log Analyzer, Log URL Resolver) are also exposed as tools. From the orchestrator's perspective, running a multi-step log analysis pipeline looks the same as calling any other tool. The workflow's internal complexity is fully encapsulated.

> **Why wrap everything as tools?** The orchestrator model already knows how to reason about tool calls — when to call them, how to interpret results, and when to combine results from multiple calls. By presenting sub-agents and workflows as tools, we get this reasoning for free instead of building custom orchestration logic.

### Tiered Model Strategy

Evergreen logs can be tens of megabytes. The Log Analyzer workflow handles this by splitting files into token-aware chunks and using a tiered model strategy:

1. **First chunk** — analyzed by the full-power model to establish a thorough baseline
2. **Subsequent chunks** — processed by a smaller, cheaper model that merges new findings into the running analysis
3. **Final report** — formatted by the full-power model into user-facing markdown

> **Why use a cheaper model for refinement?** Once the initial analysis establishes the structure and key findings, subsequent chunks mostly need to identify new occurrences of known patterns or flag genuinely new issues. The smaller model handles this well at a fraction of the cost, which matters when a large log file produces dozens of chunks.

### Request Context

Every request carries context that flows through agents, tools, and workflow steps. Mastra's [RequestContext](https://mastra.ai/docs/server/request-context) carries user ID, log metadata, and pre-resolved log URLs, while AsyncLocalStorage maintains request-scoped IDs across async boundaries for logging and tracing.

### Streaming

Agent responses are streamed to the client via SSE so users see partial answers as they're generated rather than waiting for the full response.

### Observability

All operations are instrumented so any request can be traced end-to-end through OpenTelemetry (Honeycomb), Braintrust (LLM-specific tracing), and structured logging with request IDs.
