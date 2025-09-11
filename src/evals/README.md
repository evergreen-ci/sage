# About Evals


Evals are a way to test the quality of an AI agent's responses.


## How to Run Evals


To run the eval tests, do `yarn eval src/evals/<eval_folder_name>` from the root Sage directory. Note that this will only run the tests locally on your computer as it uses the `--no-send-logs` flag, which prevents forwarding any results to Braintrust.


Additional requirements:
- Make sure your Azure and Braintrust API keys are correctly populated in your `.env.<NODE_ENV>.local` files.
- If you're running an agent that needs to query the Evergreen GraphQL server, then you must run Evergreen in another terminal (via `make local-evergreen`).


## Scoring


Agent responses are evaluated using scorers. There are many scorers already available to you via Braintrust's `autoevals` package. You can choose from any of the existing scorers [here](https://github.com/braintrustdata/autoevals/blob/main/js/manifest.ts).


Additionally, you can write custom scorers. For example, `ToolUsage` is a custom scorer that checks that our agents are calling the correct tools. Refer to [official documentation](https://www.braintrust.dev/docs/guides/experiments/write#define-your-own-scorers) to learn more about custom scorers.


## Reporting


Braintrust also allows you to customize how you report results. We define our own reporting functions since we have additional requirements to surface the results in Evergreen CI. Refer to [official documentation](https://www.braintrust.dev/docs/guides/experiments/write#custom-reporters) to learn more about customizing reporting functions.
