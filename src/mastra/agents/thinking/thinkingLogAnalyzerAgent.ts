import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { gpt41 } from '../../models/openAI/gpt41';
import { memoryStore } from '../../utils/memory';
import { streamingFileAnalyzer, patternSearcher } from '../../tools/thinking';

// Minimal memory template for Day 1-2
const thinkingLogMemory = new Memory({
  storage: memoryStore,
  options: {
    workingMemory: {
      scope: 'thread',
      enabled: true,
      template: `
      # File Context
      - File Path: {{filePath}}
      - File Type: {{fileType}}
      - File Structure: {{fileStructure}}
      
      # Observations
      - Key Patterns Found: {{keyPatterns}}
      - Anomalies Detected: {{anomalies}}
      - Areas Investigated: {{areasInvestigated}}
      
      # Analysis Progress
      - Current Focus: {{currentFocus}}
      - Findings Summary: {{findingsSummary}}
      `,
    },
  },
});

// Minimal instructions for Day 1-2 - just basic analysis capability
const minimalInstructions = `
You are a thinking log analyzer agent with the ability to analyze log files iteratively.

## Your Task
Analyze the provided log file to understand its structure, identify patterns, and find any issues or anomalies.

## Your Process (Minimal Version)

1. **File Analysis**: 
   - Use the streaming-file-analyzer to understand the file structure
   - Identify the log format, timestamp patterns, and general structure
   - Note any obvious issues or patterns

2. **Pattern Search**:
   - Use the pattern-searcher to find specific patterns or errors
   - Search for common error keywords: error, exception, failed, fatal, warning
   - Look for any unusual patterns or anomalies

3. **Summary**:
   - Provide a clear summary of what you found
   - Highlight any critical issues
   - Suggest areas that might need deeper investigation

## Important Principles
- Be efficient with file reading (use streaming tools)
- Focus on finding actionable insights
- Be explicit about what you found and what you're uncertain about
`;

export const thinkingLogAnalyzerAgent = new Agent({
  name: 'Thinking Log Analyzer Agent',
  description: 'A cognitive agent that can iteratively analyze log files to identify issues and patterns',
  instructions: minimalInstructions,
  model: gpt41,
  tools: {
    'streaming-file-analyzer': streamingFileAnalyzer,
    'pattern-searcher': patternSearcher,
  },
  memory: thinkingLogMemory,
  workflows: {},
});