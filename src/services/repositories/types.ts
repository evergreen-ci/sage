import { z } from 'zod';
import {
  parsedRepositorySchema,
  repositoriesConfigSchema,
  repositoryConfigEntrySchema,
} from './schemas';

export type RepositoryConfigEntry = z.infer<typeof repositoryConfigEntrySchema>;
export type RepositoriesConfig = z.infer<typeof repositoriesConfigSchema>;
export type ParsedRepository = z.infer<typeof parsedRepositorySchema>;

// Re-export schemas for convenience
export {
  parsedRepositorySchema,
  repositoriesConfigSchema,
  repositoryConfigEntrySchema,
} from './schemas';
