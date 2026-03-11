# Creating Agents on Sage

Sage is built on the [Mastra framework](https://mastra.ai/). New capabilities are added by composing four building blocks: **agents**, **tools**, **workflows**, and **routes**. This guide covers the essentials for each. For exhaustive examples and patterns, see [agents.md](../../agents.md).

## How the Pieces Fit Together

```
Route
  └── calls Agent or Workflow
        Agent
          └── calls Tools (including other agents or workflows)
        Workflow
          └── Step 1 → Step 2 → Step 3 (each step can call agents)
```

Routes are the HTTP entry points. Agents reason and decide which tools to call. Tools are focused functions that fetch data or perform actions. Workflows coordinate multi-step processes with deterministic control flow.

## Creating an Agent

Agents are defined with the Mastra `Agent` class and registered in `src/mastra/index.ts`.

```typescript
// src/mastra/agents/myFeature/myAgent.ts
import { Agent } from '@mastra/core/agent';
import { gpt41 } from '@/mastra/models/openAI/gpt41';

export const myAgent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  description: 'What this agent does in one sentence',
  instructions: `
    Detailed system prompt. Define the agent's role, rules, and behavior here.
  `,
  model: gpt41,
});
```

For structured JSON output, pass an `outputSchema`:

```typescript
import { z } from 'zod';

const outputSchema = z.object({
  result: z.string(),
  confidence: z.number().min(0).max(1),
});

export const myAgent = new Agent({
  // ...
  outputSchema,
});
```

**Register** the agent by adding it to the `agents` object in `src/mastra/index.ts`.

## Creating a Tool

Tools are functions agents can call. Keep each tool focused on a single responsibility.

```typescript
// src/mastra/tools/myTool/myTool.ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const myTool = createTool({
  id: 'my-tool',
  description:
    'What this tool does — the agent reads this to decide when to call it',
  inputSchema: z.object({
    query: z.string().describe('The query to look up'),
  }),
  outputSchema: z.object({
    result: z.string(),
  }),
  execute: async ({ context }) => {
    const data = await fetchSomething(context.query);
    return { result: data };
  },
});
```

Pass tools to agents via the `tools` field:

```typescript
export const myAgent = new Agent({
  // ...
  tools: { myTool },
});
```

**Agent-as-tool:** Sub-agents can be wrapped as tools so an orchestrator agent can invoke them through the standard tool interface. See [agents.md — Agent-as-Tool](../../agents.md#agent-as-tool) for the pattern.

## Creating a Workflow

Workflows coordinate multi-step processes with explicit control flow. Each step receives the previous step's output via the context.

```typescript
// src/mastra/workflows/myWorkflow/myWorkflow.ts
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

const step1 = createStep({
  id: 'step-1',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ intermediate: z.string() }),
  execute: async ({ inputData }) => {
    return { intermediate: `processed: ${inputData.input}` };
  },
});

const step2 = createStep({
  id: 'step-2',
  inputSchema: z.object({ intermediate: z.string() }),
  outputSchema: z.object({ final: z.string() }),
  execute: async ({ inputData }) => {
    return { final: `done: ${inputData.intermediate}` };
  },
});

export const myWorkflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({ input: z.string() }),
  outputSchema: z.object({ final: z.string() }),
})
  .then(step1)
  .then(step2)
  .commit();
```

**Register** the workflow by adding it to the `workflows` object in `src/mastra/index.ts`.

## Creating a Route

Routes are Express handlers in `src/api-server/routes/`. They validate input, set up context, and call an agent or workflow.

**Agent route (streaming):**

[Example](https://github.com/evergreen-ci/sage/blob/main/src/api-server/routes/completions/parsley/chat.ts)

**Workflow route (JSON response):**

[Example](https://github.com/evergreen-ci/sage/blob/main/src/api-server/routes/completions/releaseNotes/generate.ts)

**Register** the router in `src/api-server/index.ts`.

## Registration Checklist

When adding a new agent or workflow, update these files:

| What     | Where                                             |
| -------- | ------------------------------------------------- |
| Agent    | `src/mastra/index.ts` — add to `agents` object    |
| Workflow | `src/mastra/index.ts` — add to `workflows` object |
| Route    | `src/api-server/index.ts` — mount the router      |

## Key Patterns

**Zod schemas everywhere** — define input/output schemas for agents, tools, workflows, and routes. Never use plain TypeScript interfaces; infer types from Zod schemas with `z.infer<typeof schema>`.

**RequestContext** — use Mastra's RuntimeContext to pass request-scoped data (user ID, pre-resolved URLs, etc.) through agents, tools, and workflow steps without threading it through every function argument.

**Streaming** — agent responses stream via [SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events). Set `Content-Type: text/event-stream` and write chunks as they arrive so users see partial answers immediately.

**Prompt management** — system prompts for some agents (e.g., Lumber's QuestionOwnershipAgent) are loaded from Braintrust at runtime, allowing prompt iteration without code deploys.

For complete examples including memory setup, tracing, and composition patterns, see [agents.md](../../agents.md).
