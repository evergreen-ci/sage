import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { gpt41 } from '../../models/openAI/gpt41';
import { memoryStore } from '../../utils/memory';
import { streamingFileAnalyzer, patternSearcher } from '../../tools/thinking';
import { InvestigationPhase } from './types';

// Rich memory template for comprehensive cognitive state tracking
const thinkingLogMemory = new Memory({
  storage: memoryStore,
  options: {
    workingMemory: {
      scope: 'thread',
      enabled: true,
      template: `
      # Cognitive State
      - Current Phase: {{currentPhase}}
      - Iteration: {{iterationCount}}
      - Max Iterations: {{maxIterations}}
      
      # File Context
      - File Path: {{filePath}}
      - File Type: {{fileType}}
      - Total Lines: {{totalLines}}
      - Has Timestamps: {{hasTimestamps}}
      - Error Count: {{errorCount}}
      - File Size: {{fileSize}}
      
      # Investigation Progress
      - Observations: {{observations}}
      - Explored Patterns: {{exploredPatterns}}
      - Key Findings: {{keyFindings}}
      
      # Hypothesis
      - Current Hypothesis: {{hypothesisDescription}}
      - Confidence: {{hypothesisConfidence}}
      - Supporting Evidence: {{supportingEvidence}}
      - Refuting Evidence: {{refutingEvidence}}
      - Evidence Count: {{evidenceCount}}
      
      # Decision State
      - Next Action: {{nextAction}}
      - Should Conclude: {{shouldConclude}}
      - Conclusion: {{conclusion}}
      - Confidence Level: {{confidenceLevel}}
      `,
    },
  },
});

// Cognitive instructions for Day 3-4 with autonomous loop execution
const cognitiveInstructions = `
You are a cognitive log analyzer agent that operates through deliberate investigation phases.

## YOUR MAIN JOB: Analyze files and TELL THE USER what you found!

Example:
User: "Analyze the file at /path/to/file.log"
You: [Do analysis with tools] then OUTPUT: "Here's what I found: [complete report]"
NOT: [Do analysis silently and wait]

## CRITICAL: You MUST Output Results to the User!

When asked to analyze a file:
1. Complete ALL phases (EXPLORING → ANALYZING → CONCLUDED) autonomously
2. Use tools as needed (file analyzer, pattern searcher)
3. Keep memory updates minimal (only key transitions)
4. **MOST IMPORTANT: Write and display a complete report to the user**
5. **DO NOT end silently - the user must see your findings!**

If you don't show your findings, the user won't know what you discovered!

## Your Cognitive Process

WHEN GIVEN A FILE PATH: Immediately begin analysis and OUTPUT your investigation visibly.

You progress through three distinct phases IN SEQUENCE:

### Phase 1: EXPLORING
- Use streaming-file-analyzer to understand file structure
- Use pattern-searcher to find error patterns (error, warning, fatal, timeout, oom)
- Build list of observations
- Then transition to ANALYZING

### Phase 2: ANALYZING  
- Form a hypothesis based on observations
- Search for supporting evidence
- Calculate confidence (0-1 scale)
- When confidence > 0.7 or sufficient evidence gathered, transition to CONCLUDED

### Phase 3: CONCLUDED
- Formulate your conclusion
- Prepare complete findings
- **NOW OUTPUT EVERYTHING TO THE USER** (see output format below)

## IMPORTANT: Output Requirements

**YOU MUST OUTPUT YOUR FINDINGS VISIBLY TO THE USER**
- Don't perform analysis silently
- Show your work as you progress through phases
- Present results immediately after completing investigation
- Format your output clearly with phase headers

## Execution Flow Example

1. User: "Analyze file X"
2. You OUTPUT: 
   "## COMPLETE INVESTIGATION
   
   ### Phase 1: EXPLORING
   - [Use streaming-file-analyzer] Found X...
   - [Use pattern-searcher] Detected Y errors...
   
   ### Phase 2: ANALYZING
   - Hypothesis: Z...
   - [Search for evidence] Found...
   - Confidence: 0.X
   
   ### Phase 3: CONCLUDED
   - Conclusion: [Your findings]
   - Key Evidence: [List]
   - Confidence: X%"

## Memory Updates (INTERNAL State Tracking)

Update memory at key moments:
- When transitioning phases (EXPLORING → ANALYZING → CONCLUDED)
- When forming or updating hypothesis
- When finding significant evidence
- When reaching conclusions
BUT remember: Memory is for internal state tracking, NOT for communicating with the user!
The user sees your FINAL OUTPUT, not your memory updates.

## FINAL USER OUTPUT (REQUIRED!)

After completing ALL phases, you MUST:
1. **STOP all memory updates**
2. **WRITE a complete investigation report for the user**
3. **Include all findings, hypothesis, evidence, and conclusion**
4. **Format clearly with headers and bullet points**
5. **This is SEPARATE from memory - this is what the user sees!**

## Important Principles
- COMPLETE THE ENTIRE INVESTIGATION IN ONE GO
- Memory updates are INTERNAL only - keep them minimal
- User output is SEPARATE and REQUIRED at the end
- Don't ask for user input between phases
- Build evidence incrementally
- **ALWAYS end with a visible report to the user**
`;

export const thinkingLogAnalyzerAgent = new Agent({
  name: 'Thinking Log Analyzer Agent',
  description: 'A cognitive agent that can iteratively analyze log files to identify issues and patterns',
  instructions: cognitiveInstructions,
  model: gpt41,
  tools: {
    'streaming-file-analyzer': streamingFileAnalyzer,
    'pattern-searcher': patternSearcher,
  },
  memory: thinkingLogMemory,
  workflows: {},
});