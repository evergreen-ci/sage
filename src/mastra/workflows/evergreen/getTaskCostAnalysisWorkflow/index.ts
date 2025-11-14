import { createWorkflow, createStep } from '@mastra/core';
import { z } from 'zod';
import { TaskHistoryDirection } from '@/gql/generated/types';
import { getTaskTool, getTaskHistoryTool } from '@/mastra/tools/evergreen';
import {
  isMainlineRequester,
  Requester,
} from '../getTaskHistoryWorkflow/utils';

const getTaskStep = createStep(getTaskTool);

const getTaskWithCostHistoryStep = createStep({
  id: 'get-task-with-cost-history',
  description:
    'Get task history with cost data, filtered by version requester for fair comparison',
  inputSchema: getTaskStep.outputSchema,
  outputSchema: z.object({
    currentTask: z.object({
      id: z.string(),
      displayName: z.string(),
      execution: z.number(),
      requester: z.string(),
      buildVariant: z.string(),
      projectIdentifier: z.string().optional().nullable(),
      baseTask: z.object({ id: z.string() }).optional().nullable(),
      cost: z
        .object({
          onDemandCost: z.number(),
          adjustedCost: z.number(),
        })
        .optional()
        .nullable(),
    }),
    historicalTasks: z.array(
      z.object({
        id: z.string(),
        displayName: z.string(),
        execution: z.number(),
        requester: z.string(),
        cost: z
          .object({
            onDemandCost: z.number(),
            adjustedCost: z.number(),
          })
          .optional()
          .nullable(),
        versionMetadata: z.object({
          id: z.string(),
          author: z.string(),
          message: z.string(),
        }),
      })
    ),
  }),
  execute: async ({ inputData, runtimeContext, tracingContext }) => {
    const { task } = inputData;
    if (!task) {
      throw new Error('Previous get-task step did not return a task');
    }

    const taskId = task.id;
    const {
      baseTask,
      buildVariant,
      displayName,
      projectIdentifier,
      requester,
    } = task;

    if (
      !taskId ||
      !displayName ||
      !buildVariant ||
      !projectIdentifier ||
      !requester
    ) {
      throw new Error(
        `Cannot fetch history: missing required fields (id: ${taskId}, displayName: ${displayName}, buildVariant: ${buildVariant}, projectIdentifier: ${projectIdentifier}, requester: ${requester})`
      );
    }

    let cursorId = taskId;
    if (!isMainlineRequester(requester as Requester)) {
      if (!baseTask) {
        throw new Error('Base task not found for non-mainline requester');
      }
      cursorId = baseTask.id;
    }
    const cursorParams = {
      cursorId,
      direction: TaskHistoryDirection.Before,
      includeCursor: false, // Don't include the current task in history
    };

    const historyResult = await getTaskHistoryTool.execute({
      context: {
        options: {
          taskName: displayName,
          buildVariant: buildVariant,
          projectIdentifier: projectIdentifier,
          cursorParams,
          limit: 50, // Fetch more history for cost analysis
        },
      },
      tracingContext,
      runtimeContext,
    });

    // Filter historical tasks to match the requester type
    // Note: We use type assertion here because the GraphQL codegen types may not be up to date
    const taskWithFields = task as typeof task & {
      requester: string;
      cost?: { onDemandCost: number; adjustedCost: number } | null;
    };
    const filteredTasks = historyResult.taskHistory.tasks.filter(
      historicalTask => {
        const htWithFields = historicalTask as typeof historicalTask & {
          requester: string;
        };
        // For gitter_requester, only compare with other gitter_requester tasks
        // For mainline requesters, compare with mainline tasks
        return htWithFields.requester === requester;
      }
    );

    return {
      currentTask: {
        id: taskWithFields.id,
        displayName: taskWithFields.displayName,
        execution: taskWithFields.execution,
        requester: taskWithFields.requester,
        buildVariant: taskWithFields.buildVariant,
        projectIdentifier: taskWithFields.projectIdentifier,
        baseTask: taskWithFields.baseTask,
        cost: taskWithFields.cost,
      },
      historicalTasks: filteredTasks.map(ht => {
        const htWithFields = ht as typeof ht & {
          requester: string;
          cost?: { onDemandCost: number; adjustedCost: number } | null;
        };
        return {
          id: htWithFields.id,
          displayName: htWithFields.displayName,
          execution: htWithFields.execution,
          requester: htWithFields.requester,
          cost: htWithFields.cost,
          versionMetadata: htWithFields.versionMetadata,
        };
      }),
    };
  },
});

const analyzeCostTrendStep = createStep({
  id: 'analyze-cost-trend',
  description:
    'Analyze cost trends by comparing current task cost against historical average',
  inputSchema: getTaskWithCostHistoryStep.outputSchema,
  outputSchema: z.object({
    currentTask: z.object({
      id: z.string(),
      displayName: z.string(),
      execution: z.number(),
      requester: z.string(),
      onDemandCost: z.number().nullable(),
      adjustedCost: z.number().nullable(),
    }),
    costAnalysis: z.object({
      hasHistoricalData: z.boolean(),
      historicalTaskCount: z.number(),
      historicalAverageOnDemandCost: z.number().nullable(),
      historicalAverageAdjustedCost: z.number().nullable(),
      historicalMedianOnDemandCost: z.number().nullable(),
      historicalMedianAdjustedCost: z.number().nullable(),
      onDemandCostPercentageChange: z.number().nullable(),
      adjustedCostPercentageChange: z.number().nullable(),
      isCostUp: z.boolean().nullable(),
      summary: z.string(),
    }),
  }),
  execute: async ({ inputData }) => {
    const { currentTask, historicalTasks } = inputData;

    const currentOnDemandCost = currentTask.cost?.onDemandCost ?? null;
    const currentAdjustedCost = currentTask.cost?.adjustedCost ?? null;

    // Filter historical tasks that have cost data
    const tasksWithCost = historicalTasks.filter(
      task => task.cost !== null && task.cost !== undefined
    );

    if (tasksWithCost.length === 0) {
      return {
        currentTask: {
          id: currentTask.id,
          displayName: currentTask.displayName,
          execution: currentTask.execution,
          requester: currentTask.requester,
          onDemandCost: currentOnDemandCost,
          adjustedCost: currentAdjustedCost,
        },
        costAnalysis: {
          hasHistoricalData: false,
          historicalTaskCount: 0,
          historicalAverageOnDemandCost: null,
          historicalAverageAdjustedCost: null,
          historicalMedianOnDemandCost: null,
          historicalMedianAdjustedCost: null,
          onDemandCostPercentageChange: null,
          adjustedCostPercentageChange: null,
          isCostUp: null,
          summary:
            'No historical cost data available for comparison. This may be the first execution with cost tracking.',
        },
      };
    }

    // Calculate averages
    const onDemandCosts = tasksWithCost
      .map(t => t.cost!.onDemandCost)
      .filter(c => c !== null && c !== undefined);
    const adjustedCosts = tasksWithCost
      .map(t => t.cost!.adjustedCost)
      .filter(c => c !== null && c !== undefined);

    const avgOnDemand =
      onDemandCosts.length > 0
        ? onDemandCosts.reduce((a, b) => a + b, 0) / onDemandCosts.length
        : null;
    const avgAdjusted =
      adjustedCosts.length > 0
        ? adjustedCosts.reduce((a, b) => a + b, 0) / adjustedCosts.length
        : null;

    // Calculate medians
    const medianOnDemand =
      onDemandCosts.length > 0
        ? onDemandCosts.sort((a, b) => a - b)[
            Math.floor(onDemandCosts.length / 2)
          ]
        : null;
    const medianAdjusted =
      adjustedCosts.length > 0
        ? adjustedCosts.sort((a, b) => a - b)[
            Math.floor(adjustedCosts.length / 2)
          ]
        : null;

    // Calculate percentage changes
    const onDemandChange =
      currentOnDemandCost !== null && avgOnDemand !== null
        ? ((currentOnDemandCost - avgOnDemand) / avgOnDemand) * 100
        : null;
    const adjustedChange =
      currentAdjustedCost !== null && avgAdjusted !== null
        ? ((currentAdjustedCost - avgAdjusted) / avgAdjusted) * 100
        : null;

    // Determine if cost is up (using adjusted cost as primary metric)
    let isCostUp: boolean | null = null;
    if (adjustedChange !== null) {
      isCostUp = adjustedChange > 5; // Consider >5% as "cost is up"
    } else if (onDemandChange !== null) {
      isCostUp = onDemandChange > 5;
    }

    // Generate summary
    let summary = '';
    if (isCostUp === true) {
      summary = `Cost is UP. Current task costs ${Math.abs(adjustedChange ?? onDemandChange ?? 0).toFixed(1)}% more than the historical average (based on ${tasksWithCost.length} previous ${currentTask.requester} tasks).`;
    } else if (isCostUp === false) {
      summary = `Cost is DOWN or STABLE. Current task costs ${Math.abs(adjustedChange ?? onDemandChange ?? 0).toFixed(1)}% ${(adjustedChange ?? onDemandChange ?? 0) < 0 ? 'less' : 'more'} than the historical average (based on ${tasksWithCost.length} previous ${currentTask.requester} tasks).`;
    } else {
      summary = `Unable to determine cost trend due to missing cost data.`;
    }

    return {
      currentTask: {
        id: currentTask.id,
        displayName: currentTask.displayName,
        execution: currentTask.execution,
        requester: currentTask.requester,
        onDemandCost: currentOnDemandCost,
        adjustedCost: currentAdjustedCost,
      },
      costAnalysis: {
        hasHistoricalData: true,
        historicalTaskCount: tasksWithCost.length,
        historicalAverageOnDemandCost: avgOnDemand,
        historicalAverageAdjustedCost: avgAdjusted,
        historicalMedianOnDemandCost: medianOnDemand,
        historicalMedianAdjustedCost: medianAdjusted,
        onDemandCostPercentageChange: onDemandChange,
        adjustedCostPercentageChange: adjustedChange,
        isCostUp,
        summary,
      },
    };
  },
});

export const getTaskCostAnalysisWorkflow = createWorkflow({
  id: 'task-cost-analysis-workflow',
  description:
    'Workflow to analyze task cost trends by comparing current task against historical data, filtered by version requester',
  inputSchema: getTaskStep.inputSchema,
  outputSchema: analyzeCostTrendStep.outputSchema,
})
  .then(getTaskStep)
  .then(getTaskWithCostHistoryStep)
  .then(analyzeCostTrendStep)
  .commit();

export default getTaskCostAnalysisWorkflow;
