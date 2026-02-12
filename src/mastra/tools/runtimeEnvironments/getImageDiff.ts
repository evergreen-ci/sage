import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import runtimeEnvironmentsClient from '@/utils/runtimeEnvironments/client';

const inputSchema = z.object({
  before_ami_id: z.string().describe('Starting AMI ID (e.g., "ami-11111111")'),
  after_ami_id: z.string().describe('Ending AMI ID (e.g., "ami-22222222")'),
});

const outputSchema = z.object({
  changes: z.array(
    z.object({
      name: z.string(),
      before_version: z.string(),
      after_version: z.string(),
      manager: z.string(),
      type: z.enum(['OS', 'Packages', 'Toolchains', 'Files']),
    })
  ),
  summary: z.object({
    total_changes: z.number(),
    os_changes: z.number(),
    package_changes: z.number(),
    toolchain_changes: z.number(),
    file_changes: z.number(),
  }),
  description: z.string(),
});

/**
 * Tool to compare two AMI versions and see what changed
 */
export const getImageDiffTool = createTool({
  id: 'getImageDiff',
  description: `Compare two AMI versions to see all changes in packages, toolchains, OS, and files.

  Use this tool when the user asks about:
  - What changed between two specific AMI IDs
  - Differences in runtime environments
  - Package updates or toolchain changes
  - Investigating environment-related failures

  IMPORTANT: This tool requires actual AMI IDs (e.g., "ami-12345678"), not image names.
  If the user provides image names, first use getImageHistoryTool to get the corresponding AMI IDs.

  Example: "What changed between ami-12345 and ami-67890?"
  Example: "Compare ami-old vs ami-new"

  Returns detailed changes showing before/after versions for OS, packages, toolchains, and files.
  Helps identify what might have caused build or test failures after an environment update.`,

  inputSchema,
  outputSchema,

  execute: async inputData => {
    const changes = await runtimeEnvironmentsClient.getImageDiff(
      inputData.before_ami_id,
      inputData.after_ami_id
    );

    const summary = {
      total_changes: changes.length,
      os_changes: changes.filter(c => c.type === 'OS').length,
      package_changes: changes.filter(c => c.type === 'Packages').length,
      toolchain_changes: changes.filter(c => c.type === 'Toolchains').length,
      file_changes: changes.filter(c => c.type === 'Files').length,
    };

    const description = `Found ${summary.total_changes} total changes: ${summary.os_changes} OS changes, ${summary.package_changes} package changes, ${summary.toolchain_changes} toolchain changes, and ${summary.file_changes} file changes.`;

    return {
      changes,
      summary,
      description,
    };
  },
});
