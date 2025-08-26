interface StepInfo {
  payload?: any;
  startedAt?: number;
  endedAt?: number;
  status?: string;
  output?: any;
}

interface WorkflowSteps {
  [stepName: string]: StepInfo | StepInfo[];
}

interface StepAnalysis {
  name: string;
  status: string;
  duration: number;
  durationFormatted: string;
  hasOutput: boolean;
  outputPreview?: string;
  executionCount?: number;
  totalDuration?: number;
  avgDuration?: number;
  minDuration?: number;
  maxDuration?: number;
}

interface WorkflowAnalysis {
  totalSteps: number;
  totalExecutions: number;
  successfulSteps: number;
  failedSteps: number;
  totalDuration: number;
  totalDurationFormatted: string;
  stepDetails: StepAnalysis[];
  timeline: string[];
  performanceBottlenecks: string[];
  keyOutputs: Record<string, any>;
  repeatedSteps: string[];
}

/**
 *
 * @param steps
 */
export function analyzeWorkflowSteps(steps: WorkflowSteps): WorkflowAnalysis {
  const stepNames = Object.keys(steps);
  const stepDetails: StepAnalysis[] = [];
  const timeline: string[] = [];
  const performanceBottlenecks: string[] = [];
  const keyOutputs: Record<string, any> = {};
  const repeatedSteps: string[] = [];

  let earliestStart = Infinity;
  let latestEnd = 0;
  let successfulSteps = 0;
  let failedSteps = 0;
  let totalExecutions = 0;

  // Analyze each step
  for (const stepName of stepNames) {
    const stepData = steps[stepName];

    // Skip if step is undefined
    if (!stepData) {
      continue;
    }

    // Handle both single steps and arrays of steps
    const stepArray = Array.isArray(stepData) ? stepData : [stepData];
    const isRepeated = stepArray.length > 1;

    if (isRepeated) {
      repeatedSteps.push(stepName);
    }

    // Track metrics for repeated steps
    const durations: number[] = [];
    let lastStatus = 'unknown';
    let hasAnyOutput = false;
    let lastOutput: any = null;

    // Process each execution of this step
    stepArray.forEach((step, index) => {
      if (!step) return;

      totalExecutions++;

      // Calculate duration
      const duration =
        step.startedAt && step.endedAt ? step.endedAt - step.startedAt : 0;
      durations.push(duration);

      // Track overall timeline
      if (step.startedAt && step.startedAt < earliestStart) {
        earliestStart = step.startedAt;
      }
      if (step.endedAt && step.endedAt > latestEnd) {
        latestEnd = step.endedAt;
      }

      // Count status (for last execution)
      if (index === stepArray.length - 1) {
        lastStatus = step.status || 'unknown';
        if (step.status === 'success') {
          successfulSteps++;
        } else if (step.status === 'failed' || step.status === 'error') {
          failedSteps++;
        }
      }

      // Track outputs
      if (step.output) {
        hasAnyOutput = true;
        lastOutput = step.output;
      }

      // Add to timeline
      const executionLabel = isRepeated
        ? `${stepName}[${index + 1}]`
        : stepName;
      if (step.startedAt) {
        timeline.push(
          `[${new Date(step.startedAt).toISOString()}] ${executionLabel} started`
        );
      }
      if (step.endedAt) {
        const dur = formatDuration(duration);
        timeline.push(
          `[${new Date(step.endedAt).toISOString()}] ${executionLabel} completed (${dur})`
        );
      }
    });

    // Calculate aggregated metrics
    const totalDur = durations.reduce((a, b) => a + b, 0);
    const avgDur = durations.length > 0 ? totalDur / durations.length : 0;
    const minDur = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDur = durations.length > 0 ? Math.max(...durations) : 0;

    // Create step analysis
    const analysis: StepAnalysis = {
      name: stepName,
      status: lastStatus,
      duration: isRepeated ? avgDur : durations[0] || 0,
      durationFormatted: isRepeated
        ? `avg: ${formatDuration(avgDur)}`
        : formatDuration(durations[0] || 0),
      hasOutput: hasAnyOutput,
    };

    // Add repeated step statistics
    if (isRepeated) {
      analysis.executionCount = stepArray.length;
      analysis.totalDuration = totalDur;
      analysis.avgDuration = avgDur;
      analysis.minDuration = minDur;
      analysis.maxDuration = maxDur;
    }

    // Add output preview for key steps
    if (lastOutput) {
      if (stepName === 'finalize' && lastOutput.markdown) {
        analysis.outputPreview = 'Generated markdown report';
        keyOutputs.reportMarkdown = lastOutput.markdown;
      } else if (stepName === 'save-report' && lastOutput.filePath) {
        analysis.outputPreview = `Saved to: ${lastOutput.filePath}`;
        keyOutputs.reportPath = lastOutput.filePath;
      } else if (stepName === 'initial-summary' && lastOutput.summary) {
        analysis.outputPreview = `${lastOutput.summary.slice(0, 100)}...`;
        keyOutputs.summary = lastOutput.summary;
      } else if (stepName === 'refine-summary' && lastOutput.summary) {
        analysis.outputPreview = `${lastOutput.summary.slice(0, 100)}...`;
        keyOutputs.refinedSummary = lastOutput.summary;
      }
    }

    stepDetails.push(analysis);

    // Identify bottlenecks (steps taking more than 2 seconds on average)
    if (analysis.duration > 2000) {
      performanceBottlenecks.push(`${stepName}: ${analysis.durationFormatted}`);
    }
  }

  // Calculate total duration
  const totalDuration =
    earliestStart !== Infinity && latestEnd !== 0
      ? latestEnd - earliestStart
      : 0;

  return {
    totalSteps: stepNames.length,
    totalExecutions,
    successfulSteps,
    failedSteps,
    totalDuration,
    totalDurationFormatted: formatDuration(totalDuration),
    stepDetails,
    timeline: timeline.sort(),
    performanceBottlenecks,
    keyOutputs,
    repeatedSteps,
  };
}

/**
 *
 * @param ms
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

/**
 *
 * @param analysis
 */
export function printWorkflowAnalysis(analysis: WorkflowAnalysis): void {
  console.log('\n=== Workflow Analysis ===\n');

  console.log('📊 Summary:');
  console.log(`  Total Steps: ${analysis.totalSteps}`);
  if (analysis.totalExecutions > analysis.totalSteps) {
    console.log(
      `  Total Executions: ${analysis.totalExecutions} (some steps repeated)`
    );
  }
  console.log(`  Successful: ${analysis.successfulSteps}`);
  console.log(`  Failed: ${analysis.failedSteps}`);
  console.log(`  Total Duration: ${analysis.totalDurationFormatted}`);

  if (analysis.repeatedSteps.length > 0) {
    console.log('\n🔄 Repeated Steps:');
    analysis.repeatedSteps.forEach(stepName => {
      const step = analysis.stepDetails.find(s => s.name === stepName);
      if (step && step.executionCount) {
        console.log(`  ${stepName}: ${step.executionCount} executions`);
        console.log(`    ├─ Total: ${formatDuration(step.totalDuration || 0)}`);
        console.log(`    ├─ Average: ${formatDuration(step.avgDuration || 0)}`);
        console.log(`    ├─ Min: ${formatDuration(step.minDuration || 0)}`);
        console.log(`    └─ Max: ${formatDuration(step.maxDuration || 0)}`);
      }
    });
  }

  console.log('\n⏱️  Step Performance:');
  analysis.stepDetails.forEach(step => {
    const statusIcon = step.status === 'success' ? '✓' : '✗';
    const countSuffix =
      step.executionCount && step.executionCount > 1
        ? ` (${step.executionCount}x)`
        : '';
    console.log(
      `  ${statusIcon} ${step.name}${countSuffix}: ${step.durationFormatted}`
    );
    if (step.outputPreview) {
      console.log(`    └─ ${step.outputPreview}`);
    }
  });

  if (analysis.performanceBottlenecks.length > 0) {
    console.log('\n⚠️  Performance Bottlenecks:');
    analysis.performanceBottlenecks.forEach(bottleneck => {
      console.log(`  - ${bottleneck}`);
    });
  }

  console.log('\n📍 Key Outputs:');
  if (analysis.keyOutputs.reportPath) {
    console.log(`  Report saved to: ${analysis.keyOutputs.reportPath}`);
  }
  if (analysis.keyOutputs.summary) {
    console.log(`  Summary: ${analysis.keyOutputs.summary.slice(0, 150)}...`);
  }
  if (
    analysis.keyOutputs.refinedSummary &&
    analysis.keyOutputs.refinedSummary !== analysis.keyOutputs.summary
  ) {
    console.log(
      `  Refined Summary: ${analysis.keyOutputs.refinedSummary.slice(0, 150)}...`
    );
  }

  console.log('\n');
}

// Example usage function
/**
 *
 * @param steps
 */
export function analyzeAndPrint(steps: WorkflowSteps): WorkflowAnalysis {
  const analysis = analyzeWorkflowSteps(steps);
  printWorkflowAnalysis(analysis);
  return analysis;
}
