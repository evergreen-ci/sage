import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
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

const spanProcessors: SpanProcessor[] = [];
if (otlpExporter) {
  spanProcessors.push(new BatchSpanProcessor(otlpExporter));
}

const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
  spanProcessors,
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'sage',
  }),
});

console.log('Starting OpenTelemetry SDK');
sdk.start();
console.log(config.honeycomb.otelCollectorURL, 'otelCollectorURL');
console.log(config.honeycomb.apiKey, 'apiKey');
console.log(config.honeycomb.otelLogCollectorURL, 'otelLogCollectorURL');
console.log(config.honeycomb.apiKey, 'apiKey');

/**
 * Gracefully shuts down the OpenTelemetry SDK
 */
export const shutdownOtel = async (): Promise<void> => {
  try {
    await sdk.shutdown();
    console.log('OpenTelemetry SDK shut down successfully');
  } catch (error) {
    console.error('Error shutting down OpenTelemetry SDK:', error);
  }
};
