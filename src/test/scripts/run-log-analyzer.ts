#!/usr/bin/env ts-node

import fs from 'node:fs';
import path from 'node:path';
import { mastra } from '../../mastra';
import { analyzeWorkflowSteps } from './analyze-workflow-steps';

// Helper script for local development, run log analyzer workflow on one or more log files. Display benchmark data
// such as file size, processing time, and success/failure status. Saves test data and reports to the file system.
// Usage:
// yarn run-analyzer <file-path> [file-path2...]
// yarn run-analyzer --batch <directory>
// yarn run-analyzer --context "specific analysis instructions" <file-path>
// yarn run-analyzer --batch <directory> --context "what to look for"

// Configuration for report output
const REPORTS_DIR = 'tmp/reports';
const REPORT_PREFIX = 'report';

/**
 *
 * @param filePath
 * @param index
 * @param total
 * @param analysisContext
 */
async function runTest(
  filePath: string,
  index: number,
  total: number,
  analysisContext?: string
) {
  const absolutePath = path.resolve(filePath);
  const stats = fs.statSync(absolutePath);
  const fileSize = stats.size;
  const fileName = path.basename(absolutePath);

  // Show file info at start
  console.log(`\n[${index}/${total}] Processing: ${fileName}`);
  console.log(`      Path: ${absolutePath}`);
  console.log(`      Size: ${formatFileSize(fileSize)}`);
  process.stdout.write(`      Status: Analyzing...`);

  const startTime = Date.now();

  const run = await mastra
    .getWorkflow('logCoreAnalyzerWorkflow')
    .createRunAsync();

  const result = await run.start({
    inputData: {
      path: absolutePath,
      ...(analysisContext && { analysisContext }),
    },
  });

  const duration = Date.now() - startTime;
  const successResult = result.status === 'success' ? result.result : null;

  // Analyze workflow steps (for JSON output only)
  const stepAnalysis = result.steps ? analyzeWorkflowSteps(result.steps) : null;

  // Save markdown report if successful
  let reportPath: string | undefined;
  if (successResult?.markdown) {
    // Create reports directory if it doesn't exist
    const reportsDir = path.join(process.cwd(), REPORTS_DIR);
    try {
      fs.mkdirSync(reportsDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, that's okay
    }

    // Generate timestamp for filename
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, -5);
    const filename = `${REPORT_PREFIX}-${timestamp}.md`;
    reportPath = path.join(reportsDir, filename);

    // Save markdown file
    fs.writeFileSync(reportPath, successResult.markdown, 'utf8');
  }

  // Update status line with result
  process.stdout.write(
    `\r      Status: ${result.status === 'success' ? '✅ Complete' : '❌ Failed'} (${(duration / 1000).toFixed(1)}s)\n`
  );

  // Show executive summary
  if (successResult?.summary) {
    console.log(
      `      Summary: ${successResult.summary.replace(/\n/g, ' ').slice(0, 200)}`
    );
  }

  // Show report path if saved
  if (reportPath) {
    console.log(`      Report: ${reportPath}`);
  }

  return {
    file: fileName,
    path: absolutePath,
    fileSize,
    status: result.status,
    duration,
    summary: successResult?.summary,
    reportPath,
    steps: result.steps,
    stepAnalysis,
    analysisContext,
  };
}

/**
 *
 * @param bytes
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

/**
 *
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: yarn run-analyzer <file-path> [file-path2...]');
    console.error('   or: yarn run-analyzer --batch <directory>');
    console.error('   or: yarn run-analyzer --context "analysis instructions" <file-path>');
    console.error('   or: yarn run-analyzer --batch <directory> --context "what to look for"');
    process.exit(1);
  }

  const results = [];
  const startTime = Date.now();

  // Parse arguments for context flag
  let analysisContext: string | undefined;
  let filteredArgs = [...args];
  
  const contextIndex = filteredArgs.indexOf('--context');
  if (contextIndex !== -1 && contextIndex < filteredArgs.length - 1) {
    analysisContext = filteredArgs[contextIndex + 1];
    // Remove --context and its value from args
    filteredArgs.splice(contextIndex, 2);
    console.log(`📝 Using analysis context: "${analysisContext}"\n`);
  }

  try {
    let filesToProcess: string[] = [];

    // Batch mode: test all files in a directory
    if (filteredArgs[0] === '--batch' && filteredArgs[1]) {
      const dir = path.resolve(filteredArgs[1]);
      const files = fs
        .readdirSync(dir)
        .filter(f => {
          const fullPath = path.join(dir, f);
          return fs.statSync(fullPath).isFile(); // Accept all files, not just specific extensions
        })
        .map(f => path.join(dir, f));
      filesToProcess = files;
    }
    // Single or multiple file mode
    else {
      filesToProcess = filteredArgs;
    }

    console.log(
      `\n🔬 Analyzing ${filesToProcess.length} file${filesToProcess.length > 1 ? 's' : ''}\n`
    );
    console.log('─'.repeat(80));

    let i = 0;
    for (const filePath of filesToProcess) {
      i++;
      const result = await runTest(
        filePath,
        i,
        filesToProcess.length,
        analysisContext
      );
      results.push(result);
    }

    // Print summary
    const totalDuration = Date.now() - startTime;
    console.log(`\n${'═'.repeat(80)}`);
    console.log('📊 ANALYSIS SUMMARY');
    console.log('─'.repeat(80));

    const passed = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status !== 'success').length;
    const totalSize = results.reduce((sum, r) => sum + r.fileSize, 0);

    console.log(`\n📈 Overall Statistics:`);
    console.log(`   • Files processed: ${results.length}`);
    console.log(`   • Total size: ${formatFileSize(totalSize)}`);
    console.log(
      `   • Success rate: ${passed}/${results.length} (${((passed / results.length) * 100).toFixed(1)}%)`
    );
    if (failed > 0) {
      console.log(`   • Failed: ${failed} files`);
    }
    console.log(`   • Total time: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(
      `   • Processing speed: ${formatFileSize(totalSize / (totalDuration / 1000))}/s`
    );

    if (results.length > 1) {
      const avgTime =
        results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const avgSize = totalSize / results.length;
      const slowest = results.reduce((max, r) =>
        r.duration > max.duration ? r : max
      );
      const fastest = results.reduce((min, r) =>
        r.duration < min.duration ? r : min
      );
      const largest = results.reduce((max, r) =>
        r.fileSize > max.fileSize ? r : max
      );

      console.log(`\n⏱️  Performance Metrics:`);
      console.log(`   • Average time: ${(avgTime / 1000).toFixed(1)}s`);
      console.log(`   • Average size: ${formatFileSize(avgSize)}`);
      console.log(
        `   • Slowest: ${slowest.file} (${(slowest.duration / 1000).toFixed(1)}s, ${formatFileSize(slowest.fileSize)})`
      );
      console.log(
        `   • Fastest: ${fastest.file} (${(fastest.duration / 1000).toFixed(1)}s, ${formatFileSize(fastest.fileSize)})`
      );
      console.log(
        `   • Largest: ${largest.file} (${formatFileSize(largest.fileSize)})`
      );

      // Show any failed files
      const failedFiles = results.filter(r => r.status !== 'success');
      if (failedFiles.length > 0) {
        console.log(`\n❌ Failed Files:`);
        failedFiles.forEach(f => {
          console.log(`   • ${f.file}`);
        });
      }

      // Performance bottlenecks across all runs
      const allBottlenecks = results
        .filter(
          r =>
            r.stepAnalysis?.performanceBottlenecks &&
            r.stepAnalysis.performanceBottlenecks.length > 0
        )
        .map(r => ({
          file: r.file,
          bottlenecks: r.stepAnalysis!.performanceBottlenecks,
        }));

      if (allBottlenecks.length > 0) {
        console.log(`\n⚠️  Common Bottlenecks:`);
        const bottleneckCounts = new Map<string, number>();
        allBottlenecks.forEach(({ bottlenecks }) => {
          bottlenecks.forEach((b: string) => {
            const stepName = b.split(':')[0];
            if (stepName) {
              bottleneckCounts.set(
                stepName,
                (bottleneckCounts.get(stepName) || 0) + 1
              );
            }
          });
        });
        Array.from(bottleneckCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .forEach(([step, count]) => {
            console.log(`   • ${step}: appeared in ${count} files`);
          });
      }
    }

    // Save detailed results to JSON
    if (results.length > 0) {
      // Create tmp directory if it doesn't exist
      const tmpDir = path.join(process.cwd(), 'tmp');
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
      } catch (err) {
        // Directory might already exist, that's okay
      }

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, -5);
      const outputFile = path.join(tmpDir, `test-results-${timestamp}.json`);

      const detailedResults = {
        metadata: {
          timestamp: new Date().toISOString(),
          totalFiles: results.length,
          totalSize,
          totalDuration,
          successRate: passed / results.length,
          ...(analysisContext && { analysisContext }),
        },
        results,
      };

      fs.writeFileSync(outputFile, JSON.stringify(detailedResults, null, 2));
      console.log(`\n💾 Detailed results saved to: ${path.relative(process.cwd(), outputFile)}`);
    }

    // Display results table
    console.log('\n📋 Results Table:');
    console.log('─'.repeat(80));
    console.log(
      `${'File'.padEnd(65)} ${'Size'.padEnd(10)} ${'Time'.padEnd(8)} Summary`
    );
    console.log('─'.repeat(80));

    results.forEach(r => {
      const fileName =
        r.file.length > 60 ? `${r.file.slice(0, 60)}...` : r.file;
      const statusIcon = r.status === 'success' ? '✅' : '❌';
      const summary =
        r.status === 'success' && r.summary
          ? r.summary.replace(/\n/g, ' ').slice(0, 400) +
            (r.summary.length > 400 ? '...' : '')
          : r.status === 'success'
            ? 'No summary available'
            : 'Failed';

      console.log(
        `${statusIcon} ${fileName.padEnd(28)} ${formatFileSize(r.fileSize).padEnd(10)} ${(r.duration / 1000).toFixed(1)}s`.padEnd(
          50
        )
      );
      if (r.status === 'success' && r.summary) {
        console.log(`   ${summary}`);
      }
    });

    console.log('═'.repeat(80));

    // Exit with proper code
    process.exit(passed === results.length ? 0 : 1);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
