/**
 * How to use
 * ----------
 * This script reads a CSV and creates Braintrust dataset rows. It can either:
 *   1) Upload files as the "input" (when your input column is "file_name"), or
 *   2) Use a text column as the "input" (any other column name).
 *
 * Requirements
 * - Env var: BRAINTRUST_API_KEY=<your_api_key>
 * - Dependencies: braintrust, csv-parse (and whatever this file imports)
 *
 * Usage
 *   BRAINTRUST_API_KEY=your_api_key pnpm load-dataset-into-braintrust [--dry-run] <csv-file-path> <path-to-dataset-folder> <dataset-name> <project-name> <input_column_name> <expected_column_name>
 *
 * Args
 *   [--dry-run]              Optional flag to simulate dataset insertion without actually inserting
 *   <csv-file-path>          Path to the CSV with a header row
 *   <path-to-dataset-folder> Folder that contains any files referenced by the CSV (used when input is files)
 *   <dataset-name>           Target dataset name in Braintrust
 *   <project-name>           Target project name in Braintrust
 *   <input_column_name>      Column to use as the model "input" (use "file_name" for file uploads)
 *   <expected_column_name>   Column with the expected/ground-truth output
 *
 * CSV expectations
 * - Must include a header row.
 * - If <input_column_name> is "file_name", each row's "file_name" must exist under <path-to-dataset-folder>.
 * - All columns except the chosen input column, the expected column, and "file_name" are copied into metadata.
 *
 * Example (file input)
 *   CSV (data.csv):
 *     file_name,expected,case_id
 *     sample1.txt,OK,case-001
 *     sample2.txt,FAIL,case-002
 *
 *   Folder:
 *     <path-to-dataset-folder>/sample1.txt
 *     <path-to-dataset-folder>/sample2.txt
 *
 *   Command:
 *     vite-node dataset.ts data.csv ./dataset-files my-dataset my-project file_name expected
 *
 * Example (text input with dry run)
 *   CSV (data.csv):
 *     prompt,expected,tag
 *     "Sort numbers","[1,2,3]","baseline"
 *     "Say hi","hello","greeting"
 *
 *   Command:
 *     vite-node dataset.ts --dry-run data.csv ./dataset-files my-dataset my-project prompt expected
 *
 * What it does
 * - Validates required columns and file existence (when using file inputs).
 * - Builds rows with:
 *     input: either { file: Attachment } (for "file_name") or string (for text inputs)
 *     expected: value from <expected_column_name>
 *     metadata: all other columns
 * - Initializes the Braintrust dataset and (when wired) inserts rows.
 * - With --dry-run, simulates dataset insertion without actually inserting rows.
 *
 * Troubleshooting
 * - "Usage" error: verify you passed all 6 arguments in the correct order.
 * - Missing files: check that file names in the CSV match files in <path-to-dataset-folder>.
 * - Auth errors: ensure BRAINTRUST_API_KEY is set in your environment.
 *
 * Notes
 * - The special file-input column name is "file_name" (see FILE_NAME_COLUMN).
 * - If you prefer text-only datasets, set <input_column_name> to any text column.
 * - Use --dry-run to preview dataset insertion without making actual changes.
 */

import fs from 'fs';
import path from 'path';
import { Attachment, initDataset } from 'braintrust';
import { parse } from 'csv-parse';

const FILE_NAME_COLUMN = 'file_name';
const MAX_ERROR_DISPLAY = 10;

const args = process.argv.slice(2);
let isDryRun = false;

// Check for --dry-run flag
const dryRunIndex = args.findIndex(arg => arg === '--dry-run');
if (dryRunIndex !== -1) {
  isDryRun = true;
  args.splice(dryRunIndex, 1);
}

if (args.length < 6) {
  console.error(
    'Usage: vite-node braintrust-dataset-loader.ts [--dry-run] <csv-file-path> <path-to-dataset-folder> <dataset-name> <project-name> <input_column_name> <expected_column_name>'
  );
  process.exit(1);
}

const [
  csvFilePath,
  pathToDatasetFolder,
  datasetName,
  projectName,
  inputColumnName,
  expectedColumnName,
] = args as [string, string, string, string, string, string];

if (!fs.existsSync(csvFilePath)) {
  console.error(`CSV not found: ${csvFilePath}`);
  process.exit(1);
}
if (!fs.existsSync(pathToDatasetFolder)) {
  console.error(`Dataset folder not found: ${pathToDatasetFolder}`);
  process.exit(1);
}

const readCSV = (filePath: string): Promise<Record<string, string>[]> =>
  new Promise((resolve, reject) => {
    const records: Record<string, string>[] = [];
    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, delimiter: ',', trim: true }))
      .on('data', row => records.push(row))
      .on('end', () => resolve(records))
      .on('error', err => reject(err));
  });

type InputValue = { file: Attachment } | string;
type BadRow = {
  index: number;
  error: string;
};

type OutputRow = {
  input: InputValue;
  expected: string;
  metadata: Record<string, string>;
};

/**
 * This script is used to load a CSV file into a Braintrust dataset
 */
const main = async () => {
  try {
    const rows = await readCSV(csvFilePath);

    const bad: BadRow[] = [];
    const good: OutputRow[] = [];

    rows.forEach((row, index) => {
      try {
        const expected = row[expectedColumnName];
        const inputVal = row[inputColumnName];

        if (!expected)
          throw new Error(`Missing expected column "${expectedColumnName}"`);
        if (!inputVal)
          throw new Error(`Missing input column "${inputColumnName}"`);

        let input: InputValue;

        if (inputColumnName === FILE_NAME_COLUMN) {
          const absPath = path.resolve(pathToDatasetFolder, inputVal);
          if (!fs.existsSync(absPath)) {
            throw new Error(`File not found: ${absPath}`);
          }
          input = {
            file: new Attachment({
              data: absPath, // file path on disk
              filename: path.basename(absPath), // display name in Braintrust
              contentType: 'text/plain',
            }),
          };
        } else {
          input = inputVal;
        }

        // exclude input/expected/file_name from metadata
        const {
          [FILE_NAME_COLUMN]: _f,
          [expectedColumnName]: _e,
          [inputColumnName]: _i,
          ...metadata
        } = row;

        good.push({
          input,
          expected,
          metadata,
        });
      } catch (e: unknown) {
        bad.push({
          index,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    });

    if (bad.length) {
      console.warn(`Skipping ${bad.length} invalid row(s):`);
      for (const b of bad.slice(0, MAX_ERROR_DISPLAY))
        console.warn(`  #${b.index}: ${b.error}`);
      if (bad.length > MAX_ERROR_DISPLAY)
        console.warn(`  ...and ${bad.length - MAX_ERROR_DISPLAY} more`);
    }

    if (isDryRun) {
      console.log(
        `Dry run mode: Would insert ${good.length} record(s) into dataset "${datasetName}" in project "${projectName}".`
      );
      return;
    }

    const dataset = initDataset({ project: projectName, dataset: datasetName });
    for (const r of good) {
      dataset.insert(r);
    }
    await dataset.flush();

    console.log(
      `Inserted ${good.length} record(s) into dataset "${datasetName}" in project "${projectName}".`
    );
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

main();
