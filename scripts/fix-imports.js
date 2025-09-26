#!/usr/bin/env node

import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distDir = join(__dirname, '..', 'dist');

/**
 * Fix ES module imports in a JavaScript file by adding .js extensions
 * @param filePath - Path to the file to process
 */
async function fixImportsInFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');

    let processedContent = content;
    const importMatches = content.matchAll(/from\s+['"](\.[^'"]*?)['"];?/g);

    for (const match of importMatches) {
      const [fullMatch, importPath] = match;
      if (importPath.endsWith('.js') || importPath.endsWith('.mjs')) {
        continue;
      }

      const fullPath = join(dirname(filePath), importPath);
      try {
        const stats = await stat(fullPath);
        if (stats.isDirectory()) {
          processedContent = processedContent.replace(
            fullMatch,
            fullMatch.replace(importPath, `${importPath}/index.js`)
          );
        } else {
          processedContent = processedContent.replace(
            fullMatch,
            fullMatch.replace(importPath, `${importPath}.js`)
          );
        }
      } catch {
        processedContent = processedContent.replace(
          fullMatch,
          fullMatch.replace(importPath, `${importPath}.js`)
        );
      }
    }

    const sideEffectMatches = processedContent.matchAll(
      /import\s+['"](\.[^'"]*?)['"];?/g
    );
    for (const match of sideEffectMatches) {
      const [fullMatch, importPath] = match;
      if (importPath.endsWith('.js') || importPath.endsWith('.mjs')) {
        continue;
      }

      const fullPath = join(dirname(filePath), importPath);
      try {
        const stats = await stat(fullPath);
        if (stats.isDirectory()) {
          processedContent = processedContent.replace(
            fullMatch,
            fullMatch.replace(importPath, `${importPath}/index.js`)
          );
        } else {
          processedContent = processedContent.replace(
            fullMatch,
            fullMatch.replace(importPath, `${importPath}.js`)
          );
        }
      } catch {
        processedContent = processedContent.replace(
          fullMatch,
          fullMatch.replace(importPath, `${importPath}.js`)
        );
      }
    }

    if (content !== processedContent) {
      await writeFile(filePath, processedContent, 'utf8');
      console.log(`Fixed imports in: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

/**
 * Process all JavaScript files in a directory recursively
 * @param dir - Directory path to process
 */
async function processDirectory(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await processDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        await fixImportsInFile(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${dir}:`, error.message);
  }
}

console.log('Fixing ES module imports...');
await processDirectory(distDir);
console.log('Done fixing imports!');
