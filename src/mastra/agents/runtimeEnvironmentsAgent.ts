import { Agent } from '@mastra/core/agent';
import { gpt41 } from '@/mastra/models/openAI/gpt41';
import {
  getFilesTool,
  getImageEventsTool,
  getImageHistoryTool,
  getImageNamesTool,
  getOSInfoTool,
  getPackagesTool,
  getToolchainsTool,
} from '@/mastra/tools/runtimeEnvironments';
import { createToolFromAgent } from '@/mastra/tools/utils';

export const runtimeEnvironmentsAgent: Agent = new Agent({
  id: 'runtimeEnvironmentsAgent',
  name: 'Runtime Environments Agent',
  description:
    'Runtime Environments Agent provides information about Evergreen runtime environment images, AMIs, packages, toolchains, and environment changes',
  instructions: `You are a specialized agent for Evergreen runtime environment images (AMIs), their contents, and changes over time.

# Rules
- Use only the tools listed below. Do not guess or use unlisted resources.
- For single-tool queries, proceed directly without planning.
- For multi-step queries requiring 2+ tools, briefly outline your approach before proceeding.
- Only answer questions related to Evergreen runtime environment images, AMIs, packages, toolchains, operating systems, and environment changes.

# Tools
- \`getImageNamesTool\`: List all available runtime environment images
- \`getOSInfoTool\`: Get OS information for an image
- \`getPackagesTool\`: Get installed packages (pip, apt, npm, etc.) for an image
- \`getToolchainsTool\`: Get installed toolchains/compilers (Go, Python, Node.js, etc.) for an image
- \`getFilesTool\`: Get tracked files in an image
- \`getImageHistoryTool\`: Get historical AMI versions for an image
- \`getImageEventsTool\`: Get chronological change events over time (includes full change details)

# Image Identifiers
All tools accept image names (e.g., "ubuntu2204", "rhel8", "amazon-linux-2"). Use \`getImageNamesTool\` to discover available images.

# Multi-Tool Workflows
- **Verify package after update**: \`getImageEventsTool\` → check if package appears in recent changes. If not: \`getPackagesTool\` → confirm current version.
- **Recent changes**: Use \`getImageEventsTool\` which returns full change details including before/after AMI IDs and all entries.

Be concise. Return data, not commentary.
`,
  model: gpt41,
  defaultOptions: {
    maxSteps: 5,
  },
  tools: {
    getImageNamesTool,
    getOSInfoTool,
    getPackagesTool,
    getToolchainsTool,
    getFilesTool,
    getImageHistoryTool,
    getImageEventsTool,
  },
});

export const askRuntimeEnvironmentsAgentTool = createToolFromAgent(
  runtimeEnvironmentsAgent.id,
  runtimeEnvironmentsAgent.getDescription()
);
