import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK, logs } from '@opentelemetry/sdk-node';
import {
  BatchSpanProcessor,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { config } from 'config';
import { SentrySpanProcessor } from './utils/sentry/otel-integration';

const sentrySpanProcessor = new SentrySpanProcessor();

const hasOtelConfig =
  config.honeycomb.otelCollectorURL && config.honeycomb.apiKey;

const otlpExporter = hasOtelConfig
  ? new OTLPTraceExporter({
      url: config.honeycomb.otelCollectorURL,
      headers: {
        'x-honeycomb-team': config.honeycomb.apiKey,
      },
    })
  : undefined;

const otlpLogExporter =
  config.honeycomb.otelLogCollectorURL && config.honeycomb.apiKey
    ? new OTLPLogExporter({
        url: config.honeycomb.otelLogCollectorURL,
        headers: {
          'x-honeycomb-team': config.honeycomb.apiKey,
        },
      })
    : undefined;

const spanProcessors: SpanProcessor[] = [sentrySpanProcessor];
if (otlpExporter) {
  spanProcessors.push(new BatchSpanProcessor(otlpExporter));
}

const sdk = new NodeSDK({
  logRecordProcessors: otlpLogExporter
    ? [new logs.SimpleLogRecordProcessor(otlpLogExporter)]
    : [],
  instrumentations: [getNodeAutoInstrumentations()],
  spanProcessors,
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'sage',
  }),
});

if (!hasOtelConfig) {
  console.warn(
    'OpenTelemetry configuration missing (OTEL_COLLECTOR_URL or HONEYCOMB_API_KEY), running without telemetry'
  );
}

sdk.start();
