import { z } from 'zod';
// Full validation of parts is handled by ai-sdk's validateUIMessage
export const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(z.any()),
});
