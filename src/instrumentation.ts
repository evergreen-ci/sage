import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { BraintrustSpanProcessor } from 'braintrust';
import { config } from 'config';
import { SentrySpanProcessor } from './utils/sentry/otel-integration';

const braintrustSpanProcessor = new BraintrustSpanProcessor({
  apiKey: config.braintrust.apiKey,
  parent: config.braintrust.parent,
  filterAISpans: true,
});

const otlpExporter = new OTLPTraceExporter({
  url: config.otelCollectorURL,
  headers: {
    'x-honeycomb-team': config.honeycomb.apiKey,
  },
});

const sentrySpanProcessor = new SentrySpanProcessor();

const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
  spanProcessors: [
    braintrustSpanProcessor,
    new BatchSpanProcessor(otlpExporter),
    sentrySpanProcessor,
  ],
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'sage',
  }),
});

sdk.start();
