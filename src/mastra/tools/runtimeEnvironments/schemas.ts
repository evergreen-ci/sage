import { z } from 'zod';

/**
 * Base schema for tools that require an image identifier.
 * The GraphQL API takes image names directly (e.g., "ubuntu2204", "rhel8").
 */
export const imageIdSchema = z.object({
  imageId: z
    .string()
    .describe('Image name (e.g., "ubuntu2204", "rhel8", "amazon-linux-2")'),
});
