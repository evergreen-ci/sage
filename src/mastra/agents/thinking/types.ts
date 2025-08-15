/**
 * Types for the Thinking Log Analyzer Agent
 * Defines the cognitive state and investigation phases
 */

/**
 * Investigation phases for the cognitive loop
 * Using a 3-phase system for iterative analysis
 */
export enum InvestigationPhase {
  EXPLORING = 'exploring',        // Initial reconnaissance and data gathering
  ANALYZING = 'analyzing',        // Forming and testing hypothesis
  CONCLUDED = 'concluded',        // Reached conclusion or iteration limit
}

/**
 * Evidence structure for tracking findings
 */
export interface Evidence {
  description: string;
  location: string;              // Line numbers or section reference
  strength: number;               // 0-1 scale of evidence strength
  phase: InvestigationPhase;      // When this was discovered
}

/**
 * Hypothesis structure for tracking investigation theories
 */
export interface Hypothesis {
  description: string;
  confidence: number;             // 0-1 scale
  evidence: Evidence[];
  formulated_in_phase: InvestigationPhase;
}

/**
 * Cognitive state structure for memory tracking
 * Tracks the agent's investigation progress and findings
 */
export interface CognitiveState {
  // Core State
  currentPhase: InvestigationPhase;
  iterationCount: number;
  maxIterations: number;
  
  // Investigation Progress
  observations: string[];         // Key findings during exploration
  hypothesis: Hypothesis | null;  // Current working hypothesis
  exploredPatterns: string[];     // Patterns already searched
  
  // File Context
  fileInfo: {
    path: string;
    type: string;                // File type from analyzer
    totalLines: number;
    hasTimestamps: boolean;
    errorCount?: number;          // From pattern search totals
  };
  
  // Decision Tracking
  nextAction: string | null;      // What the agent plans to do next
  shouldConclude: boolean;        // Whether to end investigation
  conclusion: string | null;      // Final determination
}

/**
 * Phase transition rules
 */
export const PHASE_TRANSITIONS = {
  [InvestigationPhase.EXPLORING]: {
    next: InvestigationPhase.ANALYZING,
    condition: 'After initial file analysis and pattern search',
  },
  [InvestigationPhase.ANALYZING]: {
    next: InvestigationPhase.CONCLUDED,
    condition: 'When hypothesis confidence > 0.7 or max iterations reached',
  },
  [InvestigationPhase.CONCLUDED]: {
    next: null,
    condition: 'Terminal state',
  },
};