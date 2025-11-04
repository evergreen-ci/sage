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

sdk.start();

export const shutdownOtel = async () => {
  await sdk.shutdown();
};
