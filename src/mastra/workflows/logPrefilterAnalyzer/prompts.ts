import { z } from 'zod';
import { type LogScanResult } from './scanner';
import { LineReferenceSchema } from './schemas';

const MAX_FINAL_SUMMARY_TOKENS = 2048;

const LINE_NUMBER_GUIDANCE = `
IMPORTANT: The text includes line numbers in the format [L: <number>]. When referencing specific content:
- ONLY cite line numbers that actually appear in the text you're analyzing.
- When citing a line, include a brief quote of the actual content to prove it exists.
- If you're unsure about a line number, describe the issue WITHOUT citing a line. It's better to be vague than wrong.
- NEVER guess, approximate, or invent line numbers.
`;

const formatScanStats = (scanResult: LogScanResult): string => {
  const topTermsList = scanResult.topTerms
    .slice(0, 15)
    .map(
      ([term, count]) =>
        `  - "${term}": ${count} occurrence${count > 1 ? 's' : ''}`
    )
    .join('\n');

  return `PRE-SCAN STATISTICS:
- Total lines in original log: ${scanResult.totalLines.toLocaleString()}
- Lines matching error patterns: ${scanResult.matchedLineCount.toLocaleString()} (${((scanResult.matchedLineCount / Math.max(scanResult.totalLines, 1)) * 100).toFixed(1)}%)
- Top error patterns found:
${topTermsList}

NOTE: You are analyzing a PRE-FILTERED excerpt containing only error-relevant lines and their surrounding context (3 lines before/after each match). Gaps between sections are marked with "...". The line numbers ([L: NNNNNN]) correspond to the original log file positions.`;
};

export const PREFILTER_INITIAL_ANALYZER_INSTRUCTIONS = `You are a senior engineer analyzing pre-filtered error excerpts from technical logs.

${LINE_NUMBER_GUIDANCE}

You are NOT seeing the full log. A regex pre-scan has already extracted lines matching error patterns, along with a few lines of surrounding context. Your job is to:
- Interpret the error patterns and their relationships
- Identify root causes from the extracted evidence
- Note the chronological sequence of failures using line numbers
- Distinguish primary failures from cascading/secondary errors
- Determine whether the overall task succeeded or failed
- Create a strong factual foundation summary for further refinement`;

export const PREFILTER_REFINEMENT_INSTRUCTIONS = `You are a technical analyst updating existing summaries with new pre-filtered error information.
You always respond as compact JSON matching the provided schema.

${LINE_NUMBER_GUIDANCE}

- Merge new error findings into the existing summary efficiently.
- Collapse repeated error patterns; prefer timelines for events.
- If the new chunk adds nothing material, set "updated": false.
- Keep the summary concise while preserving all important details.
- Track whether new errors are primary failures or cascading effects.`;

export const PREFILTER_REPORT_FORMATTER_INSTRUCTIONS = `You are a senior engineer creating technical reports from pre-filtered error analysis.
You respond ONLY with the requested format - no JSON wrapper, no additional fields.
Focus on clarity, precision, and appropriate formatting for the requested output type.

${LINE_NUMBER_GUIDANCE}`;

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
- **Classification:** Primary failure / Cascading effect

## Error Pattern Summary
| Pattern | Count | Severity |
|---------|-------|----------|
| ... | ... | ... |

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

export const USER_INITIAL_PROMPT = (
  chunk: string,
  scanResult: LogScanResult,
  analysisContext?: string
) =>
  `Analyze this pre-filtered error excerpt from a log file.

${formatScanStats(scanResult)}
${analysisContext ? `\nAnalysis Context:\n${analysisContext}\nUse this context to guide your analysis, focusing on relevant aspects and answering any specific questions.\n` : ''}

${LINE_NUMBER_GUIDANCE}

Pre-filtered excerpt:
"""${chunk}"""

Return:
"<concise but comprehensive summary of errors found, with accurate line citations>"
Identify the root cause of failure, distinguish primary from cascading errors, and note the chronological sequence.`;

export const USER_REFINE = (
  existing: string,
  chunk: string,
  scanResult: LogScanResult,
  analysisContext?: string
) =>
  `Refine the existing error analysis with ONLY *material* additions or corrections from the new chunk.
If the chunk adds nothing substantive, return {"updated": false, "summary": "<unchanged>"}.

${formatScanStats(scanResult)}
${analysisContext ? `\nAnalysis Context:\n${analysisContext}\nKeep this context in mind while refining the summary.\n` : ''}

${LINE_NUMBER_GUIDANCE}

Existing summary:
"""${existing}"""

New pre-filtered chunk:
"""${chunk}"""

Return JSON:
{ 
  "updated": <bool>, 
  "summary": "<updated or unchanged>",
  "lineReferences": [
    { "line": <number>, "evidence": <direct quote from logs>, "description": <brief description of what this means> },
     ...
  ]
}`;

export const USER_MARKDOWN_PROMPT = (
  summary: string,
  scanResult: LogScanResult,
  analysisContext?: string
) =>
  `Rewrite the accumulated error analysis into a clean technical report formatted as Markdown.

${formatScanStats(scanResult)}
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

export const USER_LINE_REFERENCES_PROMPTS = (
  markdown: string,
  existingLineReferences: Array<z.infer<typeof LineReferenceSchema>>,
  analysisContext?: string
) =>
  `Analyze the following markdown report and extract specific line references mentioned in it. 
${analysisContext ? `\nAnalysis Context:\n${analysisContext}\n` : ''}

${
  existingLineReferences.length > 0
    ? `\nExisting line references from previous analysis steps: ${JSON.stringify(existingLineReferences, null, 2)}\nConsider these existing findings and generate a comprehensive, deduplicated final set of line references.`
    : ''
}

Return JSON array, no other text:
[
  {
    "line": <number>,
    "description": <brief description of what was found at this location>,
    "evidence": <quoted text corresponding to this line reference>
  }
  ...
]

Markdown to analyze:
"""${markdown}"""`;
