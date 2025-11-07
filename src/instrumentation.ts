import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { config } from '@/config';

// Global type declaration for hot reload persistence
declare global {
  var __OTEL_SDK_STARTED__: boolean | undefined;
}

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'sage',
  }),
  // Use traceExporter instead of spanProcessors for cleaner setup
  traceExporter: config.honeycomb.otelCollectorURL
    ? new OTLPTraceExporter({
        url: config.honeycomb.otelCollectorURL,
        headers: {
          'x-honeycomb-team': config.honeycomb.apiKey,
        },
      })
    : undefined,
  // Ensure async context propagation works correctly
  contextManager: new AsyncLocalStorageContextManager(),
  // Use W3C trace context for proper header propagation
  textMapPropagator: new W3CTraceContextPropagator(),
  // Single source of instrumentations with proper configuration
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        enabled: false,
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
        // Ensure HTTP server span names use the route pattern
        spanNameHook: info => {
          const { request, route } = info;
          const req = request as any; // eslint-disable-line @typescript-eslint/no-explicit-any
          const base =
            route || req?.route?.path || req?.originalUrl || req?.url || '/';
          return `${(req?.method || 'GET').toUpperCase()} ${base}`;
        },
      },
      '@opentelemetry/instrumentation-mongodb': {
        enabled: true,
      },
    }),
  ],
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
