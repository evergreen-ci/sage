import { TestResult } from './types';

/**
 * Deterministic scorer that checks whether all citations in the output
 * correspond to valid Jira keys from the input.
 *
 * Score = fraction of output citations that are valid input keys.
 * Returns 1.0 when every citation is valid (or when there are no citations).
 * @param args - Arguments for citation accuracy evaluation
 * @param args.outputCitations - All citation strings found in the generated output
 * @param args.inputKeys - All valid Jira keys from the input
 * @returns Score result with metadata
 */
export const CitationAccuracy = (args: {
  outputCitations: string[];
  inputKeys: string[];
}) => {
  const inputKeySet = new Set(args.inputKeys);
  const validCitations = args.outputCitations.filter(c => inputKeySet.has(c));
  const invalidCitations = args.outputCitations.filter(
    c => !inputKeySet.has(c)
  );
  const uncitedKeys = args.inputKeys.filter(
    k => !args.outputCitations.includes(k)
  );

  const score =
    args.outputCitations.length === 0
      ? 1
      : validCitations.length / args.outputCitations.length;

  return {
    name: 'CitationAccuracy',
    score,
    metadata: {
      validCitations,
      invalidCitations,
      uncitedKeys,
      totalOutputCitations: args.outputCitations.length,
      totalInputKeys: args.inputKeys.length,
    },
  };
};

/**
 * Extracts all citations from the release notes output structure.
 * Traverses sections → items → citations and subitems → citations.
 * @param output - The release notes output
 * @returns Deduplicated array of citation strings
 */
export const extractAllCitations = (output: TestResult): string[] => {
  const citations = new Set<string>();
  for (const section of output.sections ?? []) {
    for (const item of section.items ?? []) {
      if (item.citations) {
        for (const c of item.citations) citations.add(c);
      }
      if (item.subitems) {
        for (const subitem of item.subitems) {
          if (subitem.citations) {
            for (const c of subitem.citations) citations.add(c);
          }
        }
      }
    }
  }
  return [...citations];
};
