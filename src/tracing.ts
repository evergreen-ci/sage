import { NodeSDK } from '@opentelemetry/sdk-node';
import { BraintrustSpanProcessor } from 'braintrust';
import { config } from 'config';

// const braintrustSpanProcessor = new BraintrustSpanProcessor({
//   apiKey: config.braintrust.apiKey,
//   parent: config.braintrust.parent,
//   filterAISpans: true,
// });
//
// const otlpExporter = new OTLPTraceExporter({
//   url: config.otelCollectorURL,
//   headers: {
//     'x-honeycomb-team': config.honeycomb.apiKey,
//   },
// });
//
// const sentrySpanProcessor = new SentrySpanProcessor();
//
// const sdk = new NodeSDK({
//   instrumentations: [getNodeAutoInstrumentations()],
//   spanProcessors: [
//     braintrustSpanProcessor,
//     new BatchSpanProcessor(otlpExporter),
//     sentrySpanProcessor,
//   ],
//   resource: resourceFromAttributes({
//     [ATTR_SERVICE_NAME]: 'sage',
//   }),
// });

const spanProcessor = new BraintrustSpanProcessor({
  apiKey: config.braintrust.apiKey,
  parent: config.braintrust.parent,
  filterAISpans: true,
});

const sdk = new NodeSDK({
  serviceName: 'sage',
  spanProcessor,
});

sdk.start();
