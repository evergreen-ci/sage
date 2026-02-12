import { z } from 'zod';

/**
 * Base schema for tools that accept either an image name or AMI ID.
 */
export const imageIdentifierSchema = z
  .object({
    name: z.string().optional().describe('Image name (e.g., "ubuntu2204")'),
    id: z.string().optional().describe('AMI ID (e.g., "ami-12345678")'),
  })
  .refine(data => data.name || data.id, {
    message: 'Either name or id must be provided',
  })
  .refine(data => !(data.name && data.id), {
    message: 'Cannot provide both name and id',
  });

/**
 * Resolves the image identifier from tool input into the client filter shape.
 * @param input - Tool input containing either name or id.
 * @param input.name - Optional image name.
 * @param input.id - Optional AMI ID.
 * @returns Object with either { name } or { id }.
 */
export const resolveImageIdentifier = (input: {
  name?: string;
  id?: string;
}): { name: string } | { id: string } =>
  input.name ? { name: input.name } : { id: input.id! };
