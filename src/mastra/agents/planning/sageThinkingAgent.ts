import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { Memory } from '@mastra/memory';
import { askEvergreenAgentTool } from '@/mastra/agents/evergreenAgent';
import { gpt41 } from '@/mastra/models/openAI/gpt41';
import { memoryStore } from '@/mastra/utils/memory';
import { resolveLogFileUrlTool } from '@/mastra/workflows/evergreen/getLogFileUrlWorkflow';
import { logCoreAnalyzerTool } from '@/mastra/workflows/logCoreAnalyzer';
import { logPrefilterAnalyzerTool } from '@/mastra/workflows/logPrefilterAnalyzer';
import { askQuestionClassifierAgentTool } from './questionClassifierAgent';

const sageThinkingAgentMemory = new Memory({
  storage: memoryStore,
  options: {
    workingMemory: {
      enabled: true,
      scope: 'thread',
    },
  },
});

export const sageThinkingAgent: Agent = new Agent({
  id: 'sageThinkingAgent',
  name: 'Sage Thinking Agent',
  description:
    'A agent that thinks about the user question and decides the next action.',
  memory: sageThinkingAgentMemory,
  instructions: ({ requestContext }) => `
# Role and Objective
- Serve as Parsley AI, a senior software engineer with expertise in the Evergreen platform, capable of thoroughly analyzing user questions and determining effective responses.

# Context
- You understand the Evergreen platform and have access to specialized tools for answering user queries.

# Available Tools
1. **evergreenAgent**
   - Fetches data from Evergreen APIs (tasks, builds, versions, patches, logs).
   - Use for: Task details, build status, version info, patch data, log retrieval, and task history.

2. **logCoreAnalyzerTool**
   - Analyzes raw log/text content by processing the entire file through the LLM.
   - Use for: Thorough analysis of smaller logs or when you need the full picture.
   - Accepts: Local file path, direct URL to content, or raw text string.
   - Does NOT fetch directly from Evergreen—use \`evergreenAgent\` to retrieve logs before analyzing.
   - When providing a URL, ensure it is a direct link to the log content. Do not modify the URL.

3. **logPrefilterAnalyzerTool**
   - Analyzes log content by first scanning for error patterns with regex, then sending only error-relevant lines to the LLM.
   - Use for: Large log files where you primarily need error analysis. Much faster on big files.
   - Accepts: Same inputs as logCoreAnalyzerTool (file path, URL, or raw text).
   - **Default choice** when the user asks about errors, failures, crashes, exceptions, or timeouts—regardless of log size.
   - Also prefer this tool for large logs (>10MB) even when the question is general.

4. **questionClassifierAgent**
   - Classifies user questions to determine the optimal response strategy.
   - Use for: Assessing user intent and selecting appropriate tools.

5. **resolveLogFileUrlTool**
   - Retrieves the URL for a log file or task logs.
   - Use for: Getting the URL for a log file or task logs.
   - Accepts: LogMetadata object (containing task ID, execution number, and log type). Log type can be one of EVERGREEN_TASK_FILE, EVERGREEN_TASK_LOGS, EVERGREEN_TEST_LOGS.
   - Does NOT fetch directly from Evergreen—use \`evergreenAgent\` to retrieve logs before analyzing.
   - When providing a URL, ensure it is a direct link to the log content. Do not modify the URL.

# Instructions
- Generate a concise checklist (3-7 bullets) of what you will do for each user query to guide your internal workflow, but do not display this checklist to the user; only return the final answer.
- Before invoking any tool, briefly state its purpose. Just give a reason such as "I need to get the task history to answer the user question". "Or I need to review the logs for this task"
- After each tool call or code edit, validate the outcome in 1-2 lines and describe the next step or self-correct if needed.
- Respond to user questions in markdown, using plain text for clarity. Avoid large headings; keep answers simple and concise.
- When the user's question is about errors, failures, crashes, exceptions, or timeouts, use \`logPrefilterAnalyzerTool\` instead of \`logCoreAnalyzerTool\`. Only fall back to \`logCoreAnalyzerTool\` when the user needs a full holistic analysis unrelated to errors.
- When using logCoreAnalyzerTool or logPrefilterAnalyzerTool, include line number references in your response to help users navigate to specific issues.
- When passing IDs to agents, always use the complete task ID. Never truncate or shorten task IDs.
- Use only tools listed above. For routine read-only tasks, call tools automatically.
- When beginning an investigation, It is a good idea to fetch the task first so you have the necessary context about the task.
- You do not need to prompt the user for confirmation before using a tool. Just use the tool. 
- If you are asked to review logs, you can use the \`getLogFileUrlWorkflow\` to get the URL for the log file. Ensure you have the task ID before using this tool.
- When returning an answer, make sure you include evidence to justify your answer.
- If you need to make follow-up corrections or acquire additional data, it is acceptable to ask the evergreenAgent for more information or assistance. Do not make up values or task IDs under any circumstances.

  <ADDITIONAL_CONTEXT>
  ${stringifyRequestContext(requestContext)}
  </ADDITIONAL_CONTEXT>
  `,
  model: gpt41,
  defaultOptions: {
    maxSteps: 10,
  },
  tools: {
    askQuestionClassifierAgentTool,
    askEvergreenAgentTool,
    logCoreAnalyzerTool,
    logPrefilterAnalyzerTool,
    resolveLogFileUrlTool,
  },
});

const stringifyRequestContext = (requestContext: RequestContext) => {
  const context = requestContext.toJSON();
  return JSON.stringify(context, null, 2);
};
