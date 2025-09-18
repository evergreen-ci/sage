import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK, logs } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { config } from 'config';
import { SentrySpanProcessor } from './utils/sentry/otel-integration';

const otlpExporter = new OTLPTraceExporter({
  url: config.honeycomb.otelCollectorURL,
  headers: {
    'x-honeycomb-team': config.honeycomb.apiKey,
  },
});

const otlpLogExporter = config.honeycomb.otelLogCollectorURL
  ? new OTLPLogExporter({
      url: config.honeycomb.otelLogCollectorURL,
      headers: {
        'x-honeycomb-team': config.honeycomb.apiKey,
      },
    })
  : undefined;

const sentrySpanProcessor = new SentrySpanProcessor();

const sdk = new NodeSDK({
  logRecordProcessors: otlpLogExporter
    ? [new logs.SimpleLogRecordProcessor(otlpLogExporter)]
    : [],
  instrumentations: [getNodeAutoInstrumentations()],
  spanProcessors: [new BatchSpanProcessor(otlpExporter), sentrySpanProcessor],
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'sage',
  }),
});

sdk.start();
