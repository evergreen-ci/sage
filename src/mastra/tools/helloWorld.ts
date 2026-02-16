import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const helloWorldInputSchema = z.object({});

const helloWorldOutputSchema = z.object({
  message: z.string(),
});

const helloWorldTool = createTool({
  id: 'helloWorldTool',
  description: 'A simple tool that returns "Hello, World!".',
  inputSchema: helloWorldInputSchema,
  outputSchema: helloWorldOutputSchema,
  execute: async () => ({ message: 'Hello, World!' }),
});

export default helloWorldTool;
