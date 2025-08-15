import { createTool, ToolAction } from '@mastra/core/tools';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as readline from 'node:readline';

interface PatternMatch {
  pattern: string;
  line: number;
  content: string;
  context: string[];
}

interface SearchResult {
  matches: PatternMatch[];
  totalMatches: number;
  searchCompleted: boolean;
  patternsFound: string[];
  summary: string;
}

async function searchPatternsStreaming(
  filePath: string,
  patterns: string[],
  maxMatches: number = 100,
  contextLines: number = 2
): Promise<SearchResult> {
  const matches: PatternMatch[] = [];
  const patternsFound: Set<string> = new Set();
  let totalMatches = 0;
  let lineNumber = 0;
  let searchCompleted = true;
  
  // Convert patterns to RegExp objects, handling both regex and literal strings
  const regexPatterns = patterns.map(pattern => {
    try {
      // Check if pattern looks like a regex (starts and ends with /)
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        const regexBody = pattern.slice(1, -1);
        return { original: pattern, regex: new RegExp(regexBody, 'gi') };
      }
      // Otherwise treat as literal string and escape special regex characters
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return { original: pattern, regex: new RegExp(escaped, 'gi') };
    } catch (e) {
      // If regex is invalid, treat as literal
      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return { original: pattern, regex: new RegExp(escaped, 'gi') };
    }
  });

  // Buffer to store context lines
  const contextBuffer: string[] = [];
  const maxBufferSize = contextLines * 2 + 1;
  
  // Map to store pending matches that need context
  const pendingMatches: Map<number, PatternMatch[]> = new Map();

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Create readline interface for streaming
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      lineNumber++;
      
      // Update context buffer
      contextBuffer.push(line);
      if (contextBuffer.length > maxBufferSize) {
        contextBuffer.shift();
      }
      
      // Check each pattern against the current line
      for (const { original, regex } of regexPatterns) {
        regex.lastIndex = 0; // Reset regex state
        if (regex.test(line)) {
          totalMatches++;
          patternsFound.add(original);
          
          // Only store detailed match if under the limit
          if (matches.length < maxMatches) {
            // Calculate context
            const contextStart = Math.max(0, contextBuffer.length - contextLines - 1);
            const contextEnd = contextBuffer.length - 1;
            const beforeContext = contextBuffer.slice(contextStart, contextEnd);
            
            const match: PatternMatch = {
              pattern: original,
              line: lineNumber,
              content: line.trim(),
              context: [...beforeContext],
            };
            
            // Store match to add after context
            if (!pendingMatches.has(lineNumber)) {
              pendingMatches.set(lineNumber, []);
            }
            pendingMatches.get(lineNumber)!.push(match);
          }
          
          // Check if we've hit the total match limit
          if (totalMatches >= maxMatches * 2) {
            searchCompleted = false;
            rl.close();
            break;
          }
        }
      }
      
      // Add completed matches with after context
      const lineToComplete = lineNumber - contextLines;
      if (pendingMatches.has(lineToComplete)) {
        const matchesToComplete = pendingMatches.get(lineToComplete)!;
        for (const match of matchesToComplete) {
          // Add after context
          const afterContextStart = contextBuffer.length - contextLines;
          const afterContext = contextBuffer.slice(afterContextStart);
          match.context.push(...afterContext.slice(1)); // Skip the match line itself
          matches.push(match);
        }
        pendingMatches.delete(lineToComplete);
      }
    }
    
    // Handle remaining pending matches at end of file
    for (const [matchLine, matchList] of pendingMatches.entries()) {
      for (const match of matchList) {
        // Add whatever after context is available
        const matchIndexInBuffer = contextBuffer.length - (lineNumber - matchLine) - 1;
        if (matchIndexInBuffer >= 0 && matchIndexInBuffer < contextBuffer.length) {
          const afterContext = contextBuffer.slice(matchIndexInBuffer + 1);
          match.context.push(...afterContext);
        }
        matches.push(match);
      }
    }

  } catch (error: any) {
    throw new Error(`Error searching file: ${error.message}`);
  }

  // Generate summary
  let summary = '';
  if (totalMatches === 0) {
    summary = 'No matches found for any of the provided patterns.';
  } else if (totalMatches === 1) {
    summary = `Found 1 match for pattern "${patternsFound.values().next().value}".`;
  } else {
    const patternList = Array.from(patternsFound).join(', ');
    if (searchCompleted) {
      summary = `Found ${totalMatches} total matches across patterns: ${patternList}`;
    } else {
      summary = `Found at least ${totalMatches} matches (search truncated) across patterns: ${patternList}`;
    }
  }

  return {
    matches: matches.slice(0, maxMatches), // Ensure we don't exceed max
    totalMatches,
    searchCompleted,
    patternsFound: Array.from(patternsFound),
    summary,
  };
}

const inputSchema = z.object({
  filePath: z.string().describe('The path to the log file to search'),
  patterns: z.array(z.string()).describe('Array of patterns to search for (can be literals or regex patterns like /error.*/i)'),
  maxMatches: z.number().optional().default(100).describe('Maximum number of detailed matches to return'),
  contextLines: z.number().optional().default(2).describe('Number of lines to include before and after each match'),
});

export const patternSearcher = createTool({
  id: 'pattern-searcher',
  description: 'Searches for multiple patterns in a file using streaming. Returns matches with context. Supports both literal strings and regex patterns.',
  inputSchema,
  execute: async ({ context }) => {
    const { filePath, patterns, maxMatches, contextLines } = context;
    return await searchPatternsStreaming(filePath, patterns, maxMatches, contextLines);
  },
}) as ToolAction<typeof inputSchema, undefined, any>;