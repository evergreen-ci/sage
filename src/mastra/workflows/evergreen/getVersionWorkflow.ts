import { createWorkflow, createStep } from '@mastra/core';
import { getTaskTool, getVersionTool } from '../../tools/evergreen';

const getTaskStep = createStep(getTaskTool);

const getVersionStep = createStep({
  id: 'get-version',
  description: 'Get version information from Evergreen using task data',
  inputSchema: getTaskTool.outputSchema,
  outputSchema: getVersionTool.outputSchema,
  execute: async ({ inputData, runtimeContext, suspend, tracingContext }) => {
    const { task } = inputData;

    if (!task) {
      throw new Error('Cannot fetch version: task data is missing');
    }

    const versionId = task.versionMetadata?.id;

    if (!versionId) {
      throw new Error(
        'Cannot fetch version: versionMetadata.id is missing from task'
      );
    }

    const versionResult = await getVersionTool.execute({
      context: {
        id: versionId,
      },
      tracingContext,
      runtimeContext,
      suspend,
    });

    return versionResult;
  },
});

const getVersionWorkflow = createWorkflow({
  id: 'version-workflow',
  description: 'Workflow to retrieve task version information from Evergreen',
  inputSchema: getTaskStep.inputSchema,
  outputSchema: getVersionStep.outputSchema,
})
  .then(getTaskStep)
  .then(getVersionStep)
  .commit();

export default getVersionWorkflow;
