import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  SEMRESATTRS_SERVICE_NAME
} from "@opentelemetry/semantic-conventions/build/src/resource/SemanticResourceAttributes";

const traceExporter = new OTLPTraceExporter({
  url: 'https://otel-collector.staging.corp.mongodb.com:443/v1/traces',
});

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SEMRESATTRS_SERVICE_NAME]: 'sage',
  }),
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start(); 