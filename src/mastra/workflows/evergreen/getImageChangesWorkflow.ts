import { createWorkflow, createStep } from '@mastra/core';
import { z } from 'zod';
import { getImageTool } from '@/mastra/tools/evergreen';

const getImageStep = createStep(getImageTool);

const getImageChangesStep = createStep({
  id: 'getImageChanges',
  description: 'Extract recent changes from image data',
  inputSchema: getImageStep.outputSchema,
  outputSchema: z.object({
    image: z.object({
      id: z.string(),
      ami: z.string(),
      lastDeployed: z.date(),
      recentChanges: z.array(
        z.object({
          timestamp: z.date(),
          amiAfter: z.string(),
          amiBefore: z.string().optional().nullable(),
          entries: z.array(
            z.object({
              type: z.string(),
              action: z.string(),
              name: z.string(),
              before: z.string(),
              after: z.string(),
            })
          ),
        })
      ),
    }),
  }),
  execute: async ({ inputData }) => {
    const { image } = inputData;

    if (!image) {
      throw new Error('Cannot extract changes: image data is missing');
    }

    // Return image with focus on changes
    return {
      image: {
        id: image.id,
        ami: image.ami,
        lastDeployed: image.lastDeployed,
        recentChanges: image.events.eventLogEntries,
      },
    };
  },
});

const getImageChangesWorkflow = createWorkflow({
  id: 'imageChanges',
  description:
    'Workflow to retrieve image/AMI information with focus on recent changes from Evergreen',
  inputSchema: getImageStep.inputSchema,
  outputSchema: getImageChangesStep.outputSchema,
})
  .then(getImageStep)
  .then(getImageChangesStep)
  .commit();

export default getImageChangesWorkflow;
