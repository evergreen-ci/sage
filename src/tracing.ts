import {NodeSDK} from '@mastra/core/telemetry/otel-vendor';
import {BraintrustSpanProcessor} from "braintrust";
import {config} from 'config';

// const traceExporter = new OTLPTraceExporter({
//   url: config.otelCollectorURL,
// });

const spanProcessor = new BraintrustSpanProcessor({
    apiKey: config.braintrust.apiKey,
    parent: config.braintrust.parent,
    filterAISpans: true,
});

const sdk = new NodeSDK({
    serviceName: "sage",
    spanProcessor,
});


sdk.start();
