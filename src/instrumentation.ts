import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { WinstonInstrumentation } from '@opentelemetry/instrumentation-winston';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK, logs } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { BraintrustSpanProcessor } from 'braintrust';
import { config } from 'config';
import { SentrySpanProcessor } from './utils/sentry/otel-integration';

const braintrustSpanProcessor = new BraintrustSpanProcessor({
  apiKey: config.braintrust.apiKey,
  parent: config.braintrust.parent,
  filterAISpans: false,
});

const otlpExporter = new OTLPTraceExporter({
  url: config.otelCollectorURL,
  headers: {
    'x-honeycomb-team': config.honeycomb.apiKey,
  },
});

const otlpLogExporter = new OTLPLogExporter({
  url: config.otelLogCollectorURL,
  headers: {
    'x-honeycomb-team': config.honeycomb.apiKey,
  },
});

const sentrySpanProcessor = new SentrySpanProcessor();

const sdk = new NodeSDK({
  instrumentations: [
    new WinstonInstrumentation(),
    getNodeAutoInstrumentations(),
    new ExpressInstrumentation(),
  ],
  spanProcessors: [
    braintrustSpanProcessor,
    new BatchSpanProcessor(otlpExporter),
    sentrySpanProcessor,
  ],
  logRecordProcessors: [new logs.SimpleLogRecordProcessor(otlpLogExporter)],
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'sage',
  }),
});

sdk.start();
