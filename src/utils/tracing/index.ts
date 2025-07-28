import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { config } from '../../config';
import { logger } from '../logger';

/**
 * Configure and initialize OpenTelemetry
 *
 * This module configures and sets up OpenTelemetry instrumentation for the application.
 * It automatically instruments Node.js core modules and common libraries including Express.
 */
class TracingService {
  private sdk: NodeSDK | null = null;

  /**
   * Initialize OpenTelemetry with default configuration
   */
  public init(): void {
    // Skip initialization if tracing is disabled
    if (!config.tracing.enabled) {
      logger.info('OpenTelemetry tracing is disabled');
      return;
    }

    try {
      // Create a resource to identify this service
      const attributes = {
        [SemanticResourceAttributes.SERVICE_NAME]: config.tracing.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]:
          process.env.npm_package_version || '1.0.0',
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.nodeEnv,
      };

      const resource = defaultResource().merge(
        resourceFromAttributes(attributes)
      );

      // Create a trace exporter
      const traceExporter = new OTLPTraceExporter({
        url: config.tracing.endpoint,
      });
      
      // Console log for debugging
      console.log('OpenTelemetry exporter configured with URL:', config.tracing.endpoint);

      // Create a new SDK instance
      this.sdk = new NodeSDK({
        resource,
        traceExporter,
        instrumentations: [
          getNodeAutoInstrumentations({
            // Enable all instrumentations by default
            '@opentelemetry/instrumentation-fs': {
              enabled: true,
            },
            '@opentelemetry/instrumentation-http': {
              enabled: true,
              ignoreOutgoingRequestHook: request =>
                // Ignore health check requests to avoid excessive noise
                request.path === '/health',
            },
            '@opentelemetry/instrumentation-express': {
              enabled: true,
              ignoreLayers: [
                // Don't trace the health endpoint to reduce noise
                name => name === 'healthRoute',
                // Ignore the request ID middleware for cleaner traces
                name => name === 'requestIdMiddleware',
              ],
            },
            '@opentelemetry/instrumentation-mongodb': {
              enabled: true,
            },
          }),
        ],
      });

      // Start the SDK
      this.sdk.start();
      logger.info('OpenTelemetry initialized successfully', {
        serviceName: config.tracing.serviceName,
        endpoint: config.tracing.endpoint,
        enabled: config.tracing.enabled
      });
    } catch (error) {
      logger.error('Failed to initialize OpenTelemetry', error);
    }
  }

  /**
   * Gracefully shut down the OpenTelemetry SDK
   */
  public async shutdown(): Promise<void> {
    if (this.sdk) {
      try {
        await this.sdk.shutdown();
        logger.info('OpenTelemetry shut down successfully');
      } catch (error) {
        logger.error('Error shutting down OpenTelemetry', error);
      }
    }
  }
}

export const tracing = new TracingService();
