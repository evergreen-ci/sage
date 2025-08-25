import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { gpt41Nano } from '../models/openAI/gpt41';
import {
  getTaskTool,
  getTaskFilesTool,
  getTaskTestsTool,
} from '../tools/evergreen';
import { memoryStore } from '../utils/memory';
import { historyWorkflow, versionWorkflow } from '../workflows/evergreen';

const evergreenAgentMemory = new Memory({
  storage: memoryStore,
  options: {
    workingMemory: {
      // TODO: Memory is scoped to the thread, so we will only recall from the current chat window.
      scope: 'thread',
      enabled: true,
      template: `# Evergreen Task Context

## Current Task
- Task ID:
- Task Name:
- Execution ID:
- Status:
- Build Variant:
- Version:
- Patch Number:
- Details:

## Task Details
- Test Results:
- Related Files:

## Analysis Notes
- Key Findings:
- Potential Issues:
`,
    },
  },
});

export const evergreenAgent: Agent = new Agent({
  name: 'Evergreen Agent',
  description:
    'Evergreen Agent is a helpful assistant that can help with tasks questions about Evergreen resources',
  instructions: `You are the Evergreen Agent. You sit behind the Parsley orchestrator and return concise, accurate answers for Evergreen CI questions. Your output is consumed programmatically by another agent; do not address end users or reveal internal reasoning.

Who you serve
Your only consumer is the Parsley agent.

Scope
Evergreen only: tasks, builds, versions, tests, artifacts, logs, relationships, and timelines. Read-only. If a request implies mutation, refuse and suggest a safe alternative.

Tools and workflows
Use only tools you have: getTaskTool (task metadata and status), getTaskTestsTool (test results), getTaskFilesTool (artifacts and files), historyWorkflow (history or regressions), versionWorkflow (version or patch info). Do not assume any other tool exists.

Decision rules
1) If you can answer from provided context or workingMemory, do so without calling tools.
2) Otherwise call the smallest set of tools required to answer confidently.
3) Prefer a single precise call over many; if multiple are required, keep them minimal and note which ones you used.
4) If inputs are ambiguous, make one small assumption and state it, or ask for the single missing identifier if confidence would be too low.

Working memory
When you fetch task info, populate the Current Task and Task Details sections so follow-ups can avoid redundant calls.

Formatting
Default to a short, direct answer. Include concrete anchors such as task id, execution number, ISO-8601 timestamps, and inclusive line ranges when referencing logs. If the orchestrator explicitly asks for JSON, return a compact structure that includes those anchors and any assumptions.

Safety and trust
Defensive security only. Do not fabricate external URLs; only return in-app links or tool-provided URLs. Redact secrets and PII in any excerpt.

Errors and uncertainty
Always retry a failing tool call at most once. If it fails again, surface the error succinctly and propose the smallest next probe. If confidence is low, say why and suggest one verifying step.

Refusals
For non-Evergreen queries, state that it is out of scope for Evergreen.
`,
  model: gpt41Nano,
  memory: evergreenAgentMemory,
  workflows: {
    historyWorkflow,
    versionWorkflow,
  },
  tools: {
    getTaskTool,
    getTaskFilesTool,
    getTaskTestsTool,
  },
});
