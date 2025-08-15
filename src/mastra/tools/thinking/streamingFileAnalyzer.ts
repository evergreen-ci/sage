import { createTool, ToolAction } from '@mastra/core/tools';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as readline from 'node:readline';

interface FileAnalysis {
  fileType: string;
  structure: string;
  observations: string[];
  metadata: {
    totalLines: number;
    sampleSize: number;
    hasTimestamps: boolean;
    timestampFormat?: string;
    errorPatterns: string[];
    lineLength: { min: number; max: number; avg: number };
  };
}

async function analyzeFileStreaming(filePath: string, sampleSize: number = 1000): Promise<FileAnalysis> {
  const observations: string[] = [];
  const errorPatterns: string[] = [];
  let totalLines = 0;
  let hasTimestamps = false;
  let timestampFormat: string | undefined;
  let fileType = 'unknown';
  let structure = 'unstructured';
  
  const lines: string[] = [];
  let minLineLength = Infinity;
  let maxLineLength = 0;
  let totalLineLength = 0;

  try {
    // Check if file exists
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    observations.push(`File size: ${fileSizeMB.toFixed(2)} MB`);

    // Create readline interface for streaming
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    // Analyze first sampleSize lines
    for await (const line of rl) {
      totalLines++;
      
      // Collect sample lines for analysis
      if (lines.length < sampleSize) {
        lines.push(line);
        
        // Track line lengths
        const lineLength = line.length;
        minLineLength = Math.min(minLineLength, lineLength);
        maxLineLength = Math.max(maxLineLength, lineLength);
        totalLineLength += lineLength;
        
        // Detect patterns in first few lines
        if (totalLines <= 10) {
          // Check for JSON
          if (line.trim().startsWith('{') || line.trim().startsWith('[')) {
            fileType = 'json-lines';
            structure = 'JSON Lines format';
          }
          
          // Check for CSV
          if (totalLines === 1 && line.includes(',') && !line.includes('{')) {
            fileType = 'csv';
            structure = 'CSV format';
          }
          
          // Check for timestamps
          const timestampPatterns = [
            /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/, // ISO format
            /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/, // MM/DD/YYYY HH:MM:SS
            /\[\d+\.\d+\]/, // Unix timestamp in brackets
            /^\d{10,13}/, // Unix timestamp at start
          ];
          
          for (const pattern of timestampPatterns) {
            if (pattern.test(line)) {
              hasTimestamps = true;
              timestampFormat = pattern.source;
              observations.push('Timestamps detected in log entries');
              break;
            }
          }
        }
        
        // Check for error patterns
        const errorKeywords = [
          'ERROR', 'FATAL', 'EXCEPTION', 'Failed', 'Failure',
          'error', 'fatal', 'exception', 'failed', 'failure',
          'WARN', 'WARNING', 'warn', 'warning',
          'panic', 'crash', 'timeout', 'refused',
        ];
        
        for (const keyword of errorKeywords) {
          if (line.includes(keyword)) {
            if (!errorPatterns.includes(keyword)) {
              errorPatterns.push(keyword);
            }
          }
        }
      }
      
      // Stop if we've read enough for initial analysis
      if (totalLines >= sampleSize * 2) {
        rl.close();
        break;
      }
    }

    // Determine file type if not already identified
    if (fileType === 'unknown') {
      if (hasTimestamps && errorPatterns.length > 0) {
        fileType = 'application-log';
        structure = 'Application log file';
      } else if (hasTimestamps) {
        fileType = 'system-log';
        structure = 'System log file';
      } else {
        fileType = 'text';
        structure = 'Plain text file';
      }
    }

    // Add observations based on analysis
    observations.push(`Analyzed ${Math.min(totalLines, sampleSize)} lines out of approximately ${totalLines} total lines`);
    
    if (errorPatterns.length > 0) {
      observations.push(`Found error indicators: ${errorPatterns.slice(0, 5).join(', ')}`);
    }
    
    if (hasTimestamps) {
      observations.push('File appears to have chronological entries');
    }
    
    const avgLineLength = lines.length > 0 ? Math.round(totalLineLength / lines.length) : 0;
    if (maxLineLength > 1000) {
      observations.push('File contains very long lines (possible stack traces or data dumps)');
    }
    
    // Check for patterns in line structure
    const jsonLineCount = lines.filter(l => l.trim().startsWith('{') || l.trim().startsWith('[')).length;
    if (jsonLineCount > lines.length * 0.8) {
      observations.push('Majority of lines appear to be JSON formatted');
    }
    
    // Check for stack traces
    const stackTraceIndicators = lines.filter(l => 
      l.includes('\tat ') || l.includes('  at ') || l.includes('Traceback') || l.includes('goroutine')
    ).length;
    if (stackTraceIndicators > 0) {
      observations.push('Stack traces detected in file');
    }

    const metadata: FileAnalysis['metadata'] = {
      totalLines,
      sampleSize: Math.min(lines.length, sampleSize),
      hasTimestamps,
      errorPatterns: errorPatterns.slice(0, 10),
      lineLength: {
        min: minLineLength === Infinity ? 0 : minLineLength,
        max: maxLineLength,
        avg: avgLineLength,
      },
    };
    
    if (timestampFormat !== undefined) {
      metadata.timestampFormat = timestampFormat;
    }

    return {
      fileType,
      structure,
      observations,
      metadata,
    };
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    throw new Error(`Error analyzing file: ${error.message}`);
  }
}

const inputSchema = z.object({
  filePath: z.string().describe('The path to the log file to analyze'),
  sampleSize: z.number().optional().default(1000).describe('Number of lines to sample for analysis'),
});

export const streamingFileAnalyzer = createTool({
  id: 'streaming-file-analyzer',
  description: 'Analyzes a file structure and content using streaming to avoid memory issues. Returns file type, structure, and initial observations.',
  inputSchema,
  execute: async ({ context }) => {
    const { filePath, sampleSize } = context;
    return await analyzeFileStreaming(filePath, sampleSize);
  },
}) as ToolAction<typeof inputSchema, undefined, any>;