// Prompts for log files analysis

const MAX_FINAL_SUMMARY_TOKENS = 2048;

const LINE_NUMBER_GUIDANCE = `
IMPORTANT: The text includes line numbers in the format [L: <number>]. When referencing specific content:
- ONLY cite line numbers that actually appear in the text you're analyzing.
- When citing a line, include a brief quote of the actual content to prove it exists.
- If you're unsure about a line number, describe the issue WITHOUT citing a line. It's better to be vague than wrong.
- NEVER guess, approximate, or invent line numbers.
`;

// Agent Instructions
export const INITIAL_ANALYZER_INSTRUCTIONS = `You are a senior engineer performing initial analysis of technical text (logs, code, configs, telemetry, build output).

${LINE_NUMBER_GUIDANCE}

Focus on:
- Understanding the overall structure and format of the content
- Detecting and emphasizing **failures, error codes, and abnormal terminations** (with accurate line citations when available)
- Identifying key patterns, sections, and data types
- Establishing context and technical domain
- Preserving critical facts, identifiers, timestamps, and error codes
- Always determine whether the task succeeded or failed and summarize the **root cause of any failure**
- Creating a strong factual foundation summary for further refinement`;

export const REFINEMENT_AGENT_INSTRUCTIONS = `You are a technical analyst updating existing summaries with new information.
You always respond as compact JSON matching the provided schema.

${LINE_NUMBER_GUIDANCE}

- Merge new facts into the existing summary efficiently.
- Collapse repeated patterns; prefer timelines for events.
- If the new chunk adds nothing material, set "updated": false.
- Keep the summary concise while preserving all important details.
- If a new chunk includes failure indicators (non-zero exit code, error, exception, abort),
  update the summary to reflect that failure and its cause.`;

export const REPORT_FORMATTER_INSTRUCTIONS = `You are a senior engineer creating technical reports and summaries.
You respond ONLY with the requested format - no JSON wrapper, no additional fields.
Focus on clarity, precision, and appropriate formatting for the requested output type.

${LINE_NUMBER_GUIDANCE}`;

// Formatting Requirements
const CONCISE_SUMMARY_REQUIREMENTS = `- 3-4 lines maximum
- Focus on: what happened, key impacts/metrics, critical actions needed
- Plain text only, no markdown formatting
- Be direct and factual
- Keep it under ${MAX_FINAL_SUMMARY_TOKENS} while preserving facts.`;

const MARKDOWN_REPORT_FORMAT = `Use the following structure with proper Markdown headers:

# Technical Analysis Report

## Overview
(Concise summary of the situation)

## Key Entities/Modules
- Use bullet points
- Include identifiers and technical names

## Timeline / Key Events
(Chronological list with clear sequence)

## Anomalies / Errors
### Error 1 Title
- **Location:** Line X (only if line number was explicitly cited in source material)
- **Description:** ...
- **Evidence:** ... (include brief quote if referencing a specific line)
- **Likely Cause:** ...

## Metrics / Counts
| Metric | Value |
|--------|-------|
| ... | ... |

## Open Questions / Next Actions
- [ ] Action item 1
- [ ] Action item 2

When referencing specific lines:
- Only include line numbers that were explicitly mentioned in the source material
- Format as "Line X" or "Lines X-Y"
- Include a brief quote from the actual line content when citing

Format with proper Markdown: use **bold** for emphasis, \`code\` for technical terms, and tables where appropriate.`;

// Prompt Functions
export const USER_INITIAL_PROMPT = (chunk: string, analysisContext?: string) =>
  `Analyze this first chunk to understand the document structure and create an initial technical summary.
Identify the type of content (logs, code, config, telemetry, etc.) and key patterns.
${analysisContext ? `\nAnalysis Context:\n${analysisContext}\nUse this context to guide your analysis, focusing on relevant aspects and answering any specific questions.\n` : ''}

${LINE_NUMBER_GUIDANCE}

Chunk:
"""${chunk}"""

Return:
"<concise but comprehensive summary, with accurate line citations when available>"
If this appears to be a build/test log, state clearly whether it succeeded or failed and summarize the root cause of failure with line numbers if identifiable.`;

export const USER_REFINE = (
  existing: string,
  chunk: string,
  analysisContext?: string
) =>
  `Refine the existing summary with ONLY *material* additions or corrections from the new chunk.
If the chunk adds nothing substantive, return {"updated": false, "summary": "<unchanged>"}.
${analysisContext ? `\nAnalysis Context:\n${analysisContext}\nKeep this context in mind while refining the summary.\n` : ''}

${LINE_NUMBER_GUIDANCE}

Existing summary:
"""${existing}"""

New chunk:
"""${chunk}"""

Return JSON:
{ 
  "updated": <bool>, 
  "summary": "<updated or unchanged>",
  "lineReferences": [
    { "line": <number>, "context": "Error occurred", "type": "error" },
    { "line": <number>, "context": "Configuration block", "type": "info" }
  ]
}`;

export const USER_MARKDOWN_PROMPT = (
  summary: string,
  analysisContext?: string
) =>
  `Rewrite the accumulated summary into a clean technical report formatted as Markdown.
${analysisContext ? `\nAnalysis Context:\n${analysisContext}\nEnsure the report addresses any specific questions or focus areas mentioned in the context.\n` : ''}

${MARKDOWN_REPORT_FORMAT}

Source material:
"""${summary}"""`;

export const USER_CONCISE_SUMMARY_PROMPT = (
  markdown: string,
  analysisContext?: string
) =>
  `Create a concise summary from this technical report.
${analysisContext ? `\nAnalysis Context:\n${analysisContext}\nHighlight findings relevant to this context in the summary.\n` : ''}

Requirements:
${CONCISE_SUMMARY_REQUIREMENTS}

Source report:
"""${markdown}"""`;
