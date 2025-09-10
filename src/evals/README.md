# Evals

We use **evals** to measure model performance. All evals are run and reported through the [Braintrust platform](https://www.braintrust.dev/docs/start/eval-sdk).

Evals are stored in the `src/evals` folder.

## How to Run Evals

To run the eval tests, do `yarn eval src/evals/<eval_folder_name>` from the root Sage directory. Note that this will only run the tests locally on your computer as it uses the `--no-send-logs` flag, which prevents forwarding any results to Braintrust.

Additional requirements:

- Make sure your Azure and Braintrust API keys are correctly populated in your `.env.<NODE_ENV>.local` files.
- If you're running an agent that needs to query the Evergreen GraphQL server, then you must run Evergreen in another terminal (via `make local-evergreen`).

## Datasets

To reduce repository size, we store datasets remotely on Braintrust and keep only the eval code in this repo.
You can learn more about datasets [here](https://www.braintrust.dev/docs/guides/datasets).

Datasets can be created directly in Braintrust or by using the `load-dataset-into-braintrust` script.

### Loading a CSV into a Braintrust dataset

For large datasets, you can load a CSV file into Braintrust with the following command:

```bash
yarn load-dataset-into-braintrust <csv-file-path> <path-to-dataset-folder> <dataset-name> <project-name> <input_column_name> <expected_column_name>
```

This script reads a CSV of arbitrary format and creates (or updates) a Braintrust dataset.

Braintrust requires the following columns:

- **input** – The model input (can be text or a file).
- **expected** – The expected model output (typically text).
- **metadata** – Any additional columns you want to include.

The script validates the CSV columns and maps them as follows:

- `input` → Set to `<input_column_name>`.
- `expected` → Set to `<expected_column_name>`.
- `metadata` → A JSON object containing all other columns.

If `<input_column_name>` is `file_name`, the script checks that each file exists in `<path-to-dataset-folder>` and uploads them to Braintrust as dataset inputs.

## Scoring

Agent responses are evaluated using scorers. There are many scorers already available to you via Braintrust's `autoevals` package. You can choose from any of the existing scorers [here](https://github.com/braintrustdata/autoevals/blob/main/js/manifest.ts).

Additionally, you can write custom scorers. For example, `ToolUsage` is a custom scorer that checks that our agents are calling the correct tools. Refer to [official documentation](https://www.braintrust.dev/docs/guides/experiments/write#define-your-own-scorers) to learn more about custom scorers.

## Reporting

Braintrust also allows you to customize how you report results. We define our own reporting functions since we have additional requirements to surface the results in Evergreen CI. Refer to [official documentation](https://www.braintrust.dev/docs/guides/experiments/write#custom-reporters) to learn more about customizing reporting functions.
