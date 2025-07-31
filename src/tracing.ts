import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { AlwaysOnSampler } from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { getEnvVar } from 'config';

const traceExporter = new OTLPTraceExporter({
  url: getEnvVar('OTEL_COLLECTOR_URL', 'http://otel-collector-web-app.devprod-platform.svc.cluster.local:4318/v1/traces'),
});

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'sage',
    ['environment']: getEnvVar('DEPLOYMENT_ENV', 'staging'),
  }),
  traceExporter: traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
  sampler: new AlwaysOnSampler(),
});

sdk.start();
