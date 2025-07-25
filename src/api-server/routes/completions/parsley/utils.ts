import { Request } from 'express';
import { z } from 'zod';

const parsleyCompletionsSchema = z.object({
  message: z.string().min(1),
  taskID: z.string(),
  execution: z.number().optional().default(0),
  sessionID: z.string().optional(),
});

const validateSchema = <T extends z.ZodTypeAny>(schema: T, body: unknown) =>
  schema.safeParse(body);

export const validateParsleyURLRequest = (body: Request['body']) =>
  validateSchema(parsleyCompletionsSchema, body);
