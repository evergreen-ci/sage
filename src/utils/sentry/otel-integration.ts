import { Span } from '@opentelemetry/api';
import { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import * as Sentry from '@sentry/node';
import { config } from '../../config';

export class SentrySpanProcessor implements SpanProcessor {
  private readonly enabled: boolean;

  constructor() {
    this.enabled = config.sentry.enabled && !!config.sentry.dsn;
  }

  onStart(span: Span): void {
    if (!this.enabled) return;

    const spanContext = span.spanContext();
    const attributes = (span as any).attributes || {};

    Sentry.addBreadcrumb({
      category: 'otel.span',
      message: `Span started: ${(span as any).name}`,
      level: 'debug',
      data: {
        spanId: spanContext.spanId,
        traceId: spanContext.traceId,
        attributes,
      },
    });
  }

  onEnd(): void {}

  async forceFlush(): Promise<void> {
    if (!this.enabled) return;
    await Sentry.flush();
  }

  async shutdown(): Promise<void> {
    if (!this.enabled) return;
    await Sentry.close();
  }
}
