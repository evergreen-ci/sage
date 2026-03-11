# Observability

Sage orchestrates multiple LLM calls, workflows, and external API calls per request. Three complementary systems are wired up out of the box:

```
Sage Application
  ├── BraintrustExporter         ──► Braintrust  — LLM tracing, prompt management & evals
  ├── OpenTelemetry (OTLP/HTTP) ──► Honeycomb   — distributed tracing
  └── Sentry SDK                 ──► Sentry      — error & exception tracking
```

## Braintrust (LLM Tracing, Prompt Management & Evals)

Braintrust is the most important observability tool for engineers building on Sage. It gives you full visibility into LLM performance and provides the infrastructure to iterate on prompts and measure model quality over time.

**All LLM calls built with Sage are automatically instrumented** — every model call is traced with no extra setup required. In the `sage-prod` Braintrust project you can inspect each call's prompt, completion, token count, and latency. This makes it straightforward to understand what your agent is doing, diagnose unexpected outputs, and track how performance changes as you evolve the agent.

### Prompt Management

Some agents load their system prompts from Braintrust at runtime rather than hardcoding them in source. This means routing rules and agent instructions can be updated without going through a code change and deploy cycle — just edit the prompt in Braintrust, run an A/B comparison to measure the impact, and ship it. For new agents with prompts that need frequent iteration, this pattern is worth adopting early.

### Evals

Evals are structured test suites that score LLM outputs against known test cases. For AI-powered applications, evals play the same role as unit tests: they catch regressions when you change a prompt, swap a model, or modify a tool. Without evals, it's difficult to know whether a change improved or degraded behavior — LLM outputs are non-deterministic, so manual spot-checking doesn't scale.

Sage has an eval suite for every agent and workflow. Evals are stored in `src/evals/` and scored against datasets hosted in Braintrust.

**Running evals locally:**

```bash
pnpm eval src/evals/<eval_folder_name>
```

This runs with `--no-send-logs`, so results appear locally without being forwarded to Braintrust. For full guidance on writing new evals, see [src/evals/README.md](../../src/evals/README.md) and the [Creating Evals](../../agents.md#creating-evals) section in agents.md.

**CI integration:** Evals report JUnit XML to Evergreen CI, so model regressions surface as test failures in the same pipeline as code changes.

**Braintrust docs:** [braintrust.dev/docs](https://www.braintrust.dev/docs)

---

## Honeycomb (Distributed Tracing)

Honeycomb receives OpenTelemetry traces and lets you follow a single request across Express routes, agent calls, and MongoDB queries. Express routes, MongoDB operations, and async context propagation are all auto-instrumented via `src/instrumentation.ts`. To enable, set `HONEYCOMB_OTEL_COLLECTOR_URL` and `HONEYCOMB_API_KEY` in your environment — if `HONEYCOMB_OTEL_COLLECTOR_URL` is unset, no traces are exported.

## Sentry (Error Tracking)

Sentry captures unhandled exceptions, promise rejections, and Express errors with full stack traces. Express routes, HTTP client calls, MongoDB operations, and unhandled rejections are all captured automatically via `src/sentry-instrument.ts`. To enable, set `SENTRY_DSN` and `SENTRY_ENABLED=true` in your environment.

---

## Local Development

In local development, only Braintrust is active by default — LLM traces are always sent. Honeycomb and Sentry require their environment variables to be set before they initialize, so you can develop without them and traces/errors simply won't appear in those dashboards.
