import { Workflow } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { gpt41 } from '@/mastra/models/openAI/gpt41';
import {
  getTaskTool,
  getTaskFilesTool,
  getTaskTestsTool,
  getImageTool,
  listImagesTool,
} from '@/mastra/tools/evergreen';
import { createToolFromAgent } from '@/mastra/tools/utils';
import { memoryStore } from '@/mastra/utils/memory';
import {
  getTaskHistoryWorkflow,
  getVersionWorkflow,
  getImageChangesWorkflow,
} from '@/mastra/workflows/evergreen';

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
    threads: {
      generateTitle: false,
    },
  },
});

export const evergreenAgent: Agent = new Agent({
  name: 'evergreenAgent',
  description:
    'Evergreen Agent is a helpful assistant that can help with tasks questions about Evergreen resources',
  instructions: `
System: # Role and Objective
You are **Evergreen AI**, a researcher agent providing information and support specifically about the Evergreen system.

# Critical Operational Rules (Repeat for long-context hygiene)
- Begin each task with a concise checklist (3-7 bullets) outlining your conceptual steps before taking action.
- Use only the allowed workflows and tools listed below via the API tools field. Do not guess or use unlisted resources.
- After any tool call, briefly validate what changed and whether it met the goal before proceeding.

# Instructions
- Only answer questions related to the Evergreen system.
- Use exclusively the available workflows: \`getTaskHistoryWorkflow\`, \`getVersionWorkflow\`, \`getImageChangesWorkflow\`.
- Access only the following tools: \`getTaskTool\`, \`getTaskFilesTool\`, \`getTaskTestsTool\`, \`getImageTool\`, \`listImagesTool\`.
- Use \`getImageTool\` and \`listImagesTool\` to answer questions about AMIs (Amazon Machine Images), runtime environments, installed packages, toolchains, and when AMIs changed.
- Use \`getImageChangesWorkflow\` to get focused information about recent changes to images/AMIs.
- Only invoke a tool if absolutely necessary to answer the question.
- Prefer to respond directly and concisely without using tools whenever possible.
- Ensure all responses are accurate and domain-specific, intended for orchestrator use.
- Avoid altering any IDs or URLs when returning results.
- When answering questions, return relevant evidence (such as tool outputs or referenced workflow results) to support your conclusions whenever possible.

# Output Format
- Use clear and structured markdown formatting for responses when appropriate. Default to plain text; use fenced code blocks for code or samples.

# Verbosity
- Provide concise, direct answers.
- Include only essential information relevant to the Evergreen domain.

# Stop Conditions
- Respond only when requirements are fully satisfied.
- If unsure or if the query is outside Evergreen scope, ask for clarification or escalate appropriately.
`,
  model: gpt41,
  memory: evergreenAgentMemory,
  workflows: {
    getTaskHistoryWorkflow: getTaskHistoryWorkflow as Workflow<
      any,
      any,
      any,
      any,
      any,
      any
    >,
    getVersionWorkflow: getVersionWorkflow as Workflow<
      any,
      any,
      any,
      any,
      any,
      any
    >,
    getImageChangesWorkflow: getImageChangesWorkflow as Workflow<
      any,
      any,
      any,
      any,
      any,
      any
    >,
  },
  tools: {
    getTaskTool,
    getTaskFilesTool,
    getTaskTestsTool,
    getImageTool,
    listImagesTool,
  },
});

export const askEvergreenAgentTool = createToolFromAgent(
  evergreenAgent.id,
  evergreenAgent.getDescription()
);
