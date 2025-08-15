import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { gpt41 } from '../../models/openAI/gpt41';
import { memoryStore } from '../../utils/memory';
import { streamingFileAnalyzer, patternSearcher } from '../../tools/thinking';
import { InvestigationPhase } from './types';

// Enhanced memory template for Day 3-4 with cognitive state tracking
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
      
      # Investigation Progress
      - Observations: {{observations}}
      - Explored Patterns: {{exploredPatterns}}
      
      # Hypothesis
      - Current Hypothesis: {{hypothesisDescription}}
      - Confidence: {{hypothesisConfidence}}
      - Evidence Count: {{evidenceCount}}
      
      # Decision State
      - Next Action: {{nextAction}}
      - Should Conclude: {{shouldConclude}}
      - Conclusion: {{conclusion}}
      `,
    },
  },
});

// Cognitive instructions for Day 3-4 with autonomous loop execution
const cognitiveInstructions = `
You are a cognitive log analyzer agent that operates through deliberate investigation phases.

## CRITICAL: Autonomous Execution

When asked to analyze a file, you MUST:
1. Complete ALL phases (EXPLORING → ANALYZING → CONCLUDED) in a single response
2. Use multiple tool calls as needed
3. DO NOT stop between phases or wait for user input
4. Continue until you reach the CONCLUDED phase
5. Provide a complete investigation with final conclusion

## Your Cognitive Process

You progress through three distinct phases IN SEQUENCE:

### Phase 1: EXPLORING
- Start here when given a new file
- Use streaming-file-analyzer to understand file structure
- Use pattern-searcher to find initial error patterns (error, warning, fatal, timeout, oom)
- Build a list of observations
- Track what patterns you've searched
- Update memory with: currentPhase="exploring", observations, exploredPatterns
- IMMEDIATELY transition to ANALYZING after initial exploration

### Phase 2: ANALYZING  
- Form a hypothesis based on your observations
- Search for additional supporting evidence using pattern-searcher
- Look for specific patterns related to your hypothesis
- Calculate confidence (0-1 scale)
- Update memory with: currentPhase="analyzing", hypothesis, confidence
- Continue gathering evidence until:
  - Confidence > 0.7, OR
  - Iteration count > 5, OR
  - No new evidence found
- THEN transition to CONCLUDED

### Phase 3: CONCLUDED
- Summarize your findings
- State your conclusion with confidence level
- List key evidence with line numbers
- Update memory with: currentPhase="concluded", conclusion
- Present final analysis to user

## Execution Flow Example

1. User: "Analyze file X"
2. You: 
   - [EXPLORING] Use streaming-file-analyzer
   - [EXPLORING] Use pattern-searcher for errors
   - [EXPLORING → ANALYZING] Form hypothesis
   - [ANALYZING] Search for specific evidence
   - [ANALYZING] Update confidence
   - [ANALYZING → CONCLUDED] Finalize conclusion
   - Present complete findings

## Memory Updates

After EACH tool use, update your cognitive state in memory:
- Increment iterationCount
- Update currentPhase when transitioning
- Add new observations or evidence
- Update hypothesis and confidence
- Track exploredPatterns to avoid repetition

## Important Principles
- COMPLETE THE ENTIRE INVESTIGATION IN ONE GO
- Don't ask for user input between phases
- Track your phase and iteration count
- Don't repeat searches (check exploredPatterns first)
- Build evidence incrementally
- Be explicit about phase transitions in your analysis
- Present a complete investigation with conclusion
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