import { z } from 'zod';

/**
 * Schema for a single repository configuration entry
 */
export const repositoryConfigEntrySchema = z.object({
  defaultBranch: z.string(),
});

/**
 * Schema for the full repositories configuration file
 */
export const repositoriesConfigSchema = z.object({
  repositories: z.record(z.string(), repositoryConfigEntrySchema),
});

/**
 * Schema for parsed repository info from a Jira label
 * Supports formats like:
 * - repo:<org>/<repo>
 * - repo:<org>/<repo>@<ref>
 */
export const parsedRepositorySchema = z.object({
  /** Full repository path (org/repo) */
  repository: z.string(),
  /** Branch/ref to use (either from inline \@ref or from config) */
  ref: z.string().nullable(),
});
