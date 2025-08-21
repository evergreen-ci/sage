#!/usr/bin/env ts-node

import { mastra } from "../../mastra";
import path from "node:path";
import { analyzeAndPrint } from "./analyze-workflow-steps";
import fs from "node:fs";

async function runTest(filePath: string, quiet: boolean = false) {
  const absolutePath = path.resolve(filePath);
  if (!quiet) console.log(`\n📄 Testing: ${path.basename(absolutePath)}`);

  const startTime = Date.now();

  const run = await mastra.getWorkflow("logCoreAnalyzer").createRunAsync();

  if (!quiet) {
    run.watch((event) => {
      console.log(event);
    });
  }
  
  const result = await run.start({
    inputData: {
      path: absolutePath
    }
  });

  const duration = Date.now() - startTime;
  
  if (!quiet) {
    console.log(`✓ Analysis complete in ${(duration / 1000).toFixed(1)}s`);
    const successResult = result.status === "success" ? result.result : null;
    console.log(`Report saved to: ${successResult ? successResult.filePath : "N/A"}`);
    
    // Show executive summary if available
    if (successResult?.summary) {
      console.log(`\n📋 Executive Summary:\n${successResult.summary}\n`);
    }
    
    // Analyze workflow steps
    if (result.steps) {
      analyzeAndPrint(result.steps);
    }
  }

  return {
    file: path.basename(absolutePath),
    status: result.status,
    duration,
    steps: result.steps
  };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error("Usage: yarn run-analyzer <file-path> [file-path2...]");
    console.error("   or: yarn run-analyzer --batch <directory>");
    process.exit(1);
  }

  const results = [];
  const startTime = Date.now();

  try {
    // Batch mode: test all files in a directory
    if (args[0] === '--batch' && args[1]) {
      const dir = path.resolve(args[1]);
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt') || f.endsWith('.log'));
      
      console.log(`🔬 Running batch tests on ${files.length} files...\n`);
      
      for (const file of files) {
        const result = await runTest(path.join(dir, file), true);
        results.push(result);
        console.log(`  ${result.status === 'success' ? '✅' : '❌'} ${file}: ${(result.duration/1000).toFixed(1)}s`);
      }
    } 
    // Single or multiple file mode
    else {
      for (const filePath of args) {
        console.log(`🔬 Running test on ${filePath}...\n`);
        const result = await runTest(filePath, args.length > 1);
        results.push(result);
      }
    }

    // Print summary
    const totalDuration = Date.now() - startTime;
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    
    const passed = results.filter(r => r.status === 'success').length;
    console.log(`✅ Passed: ${passed}/${results.length}`);
    console.log(`⏱️  Total time: ${(totalDuration/1000).toFixed(1)}s`);
    
    if (results.length > 1) {
      const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const slowest = results.reduce((max, r) => r.duration > max.duration ? r : max);
      const fastest = results.reduce((min, r) => r.duration < min.duration ? r : min);
      
      console.log(`📈 Average: ${(avgTime/1000).toFixed(1)}s`);
      console.log(`🐢 Slowest: ${slowest.file} (${(slowest.duration/1000).toFixed(1)}s)`);
      console.log(`🚀 Fastest: ${fastest.file} (${(fastest.duration/1000).toFixed(1)}s)`);
    }

    // Save results to JSON for comparison
    if (results.length > 0) {
      const timestamp = new Date().toISOString().split('T')[0];
      const outputFile = `test-results-${timestamp}.json`;
      fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
      console.log(`\n💾 Results saved to: ${outputFile}`);
    }

    // Exit with proper code
    process.exit(passed === results.length ? 0 : 1);

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();