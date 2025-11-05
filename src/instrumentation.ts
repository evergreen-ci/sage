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
import { config } from '@/config';

// Global type declaration for hot reload persistence
declare global {
  var __OTEL_SDK_STARTED__: boolean | undefined;
}

const otlpExporter = config.honeycomb.otelCollectorURL
  ? new OTLPTraceExporter({
      url: config.honeycomb.otelCollectorURL,
      headers: {
        'x-honeycomb-team': config.honeycomb.apiKey,
      },
    })
  : undefined;

const otlpLogExporter = config.honeycomb.otelLogCollectorURL
  ? new OTLPLogExporter({
      url: config.honeycomb.otelLogCollectorURL,
      headers: {
        'x-honeycomb-team': config.honeycomb.apiKey,
      },
    })
  : undefined;

const spanProcessors: SpanProcessor[] = [];
if (otlpExporter) {
  spanProcessors.push(new BatchSpanProcessor(otlpExporter));
}

const logRecordProcessors: logs.LogRecordProcessor[] = [];
if (otlpLogExporter) {
  logRecordProcessors.push(new logs.SimpleLogRecordProcessor(otlpLogExporter));
}

const sdk = new NodeSDK({
  logRecordProcessors,
  instrumentations: [getNodeAutoInstrumentations()],
  spanProcessors,
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'sage',
  }),
});

// Guard against multiple initializations during hot reload
// This prevents EventEmitter memory leaks from accumulated child process listeners
// Use globalThis to persist flag across module reloads
if (!globalThis.__OTEL_SDK_STARTED__) {
  sdk.start();
  globalThis.__OTEL_SDK_STARTED__ = true;
}

export const shutdownOtel = async () => {
  await sdk.shutdown();
};
