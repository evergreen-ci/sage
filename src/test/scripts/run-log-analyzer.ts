#!/usr/bin/env ts-node

import { mastra } from "../../mastra";
import path from "node:path";
import { analyzeAndPrint } from "./analyze-workflow-steps";

async function main() {
  const filePath = process.argv[2];
  
  if (!filePath) {
    console.error("Usage: yarn run-analyzer <file-path>");
    process.exit(1);
  }

  const absolutePath = path.resolve(filePath);
  console.log(`Analyzing: ${absolutePath}\n`);

  try {
    const startTime = Date.now();

    const run = await mastra.getWorkflow("logCoreAnalyzer").createRunAsync();

    run.watch((event) => {
      console.log(event);
    });
    
    const result = await run.start({
      inputData: {
        path: absolutePath
      }
    });

    const duration = Date.now() - startTime;
    
    console.log(`✓ Analysis complete in ${(duration / 1000).toFixed(1)}s`);
    const successResult = result.status === "success" ? result.result : null;
    console.log(`Report saved to: ${successResult ? successResult.filePath : "N/A"}`);
    console.log(`\n--- Report Preview ---\n`);
    console.log(successResult ? successResult.markdown.slice(0, 500) + "..." : "N/A");

    // Analyze workflow steps
    if (result.steps) {
      analyzeAndPrint(result.steps);
    }

  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();