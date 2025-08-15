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

// Cognitive instructions for Day 3-4 with phase awareness
const cognitiveInstructions = `
You are a cognitive log analyzer agent that operates through deliberate investigation phases.

## Your Cognitive Process

You progress through three distinct phases:

### Phase 1: EXPLORING
- Start here when given a new file
- Use streaming-file-analyzer to understand file structure
- Use pattern-searcher to find initial error patterns
- Build a list of observations
- Track what patterns you've searched
- Update memory with: currentPhase="exploring", observations, exploredPatterns
- Transition to ANALYZING when you have enough initial data

### Phase 2: ANALYZING  
- Form a hypothesis based on your observations
- Look for supporting evidence
- Calculate confidence (0-1 scale)
- Update memory with: currentPhase="analyzing", hypothesis, confidence
- Transition to CONCLUDED when:
  - Confidence > 0.7, OR
  - Iteration count > 5, OR
  - No new evidence found

### Phase 3: CONCLUDED
- Summarize your findings
- State your conclusion with confidence level
- List key evidence
- Update memory with: currentPhase="concluded", conclusion

## Memory Updates

After EACH tool use, update your cognitive state in memory:
- Increment iterationCount
- Update currentPhase if transitioning
- Add new observations or evidence
- Update hypothesis and confidence
- Set nextAction for transparency

## Decision Making

Before each action, consider:
1. What phase am I in?
2. What have I already explored? (check exploredPatterns)
3. What's my current hypothesis and confidence?
4. Should I transition to the next phase?

## Important Principles
- Always track your phase and iteration count
- Don't repeat searches (check exploredPatterns first)
- Build evidence incrementally
- Be explicit about phase transitions
- Know when you have enough information (don't over-analyze)
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