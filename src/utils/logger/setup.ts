/* eslint-disable camelcase */
import { trace } from '@opentelemetry/api';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';
import winston from 'winston';
import { config } from '../../config';

// Helper to attach OTEL trace context
const withTrace = winston.format(info => {
  const span = trace.getActiveSpan();
  const ctx = span?.spanContext?.();
  if (ctx) {
    info.trace_id = ctx.traceId;
    info.span_id = ctx.spanId;
  }
  return info;
});

const isProduction = config.nodeEnv === 'production';

const baseFormats = [
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  withTrace(),
];

// Production: JSON logs
const productionFormat = winston.format.combine(
  ...baseFormats,
  winston.format.printf(info => {
    const { level, message, span_id, stack, timestamp, trace_id, ...rest } =
      info;
    const entry: Record<string, unknown> = {
      timestamp,
      level,
      message,
      ...(typeof trace_id !== 'undefined' ? { trace_id } : {}),
      ...(typeof span_id !== 'undefined' ? { span_id } : {}),
      ...(typeof stack !== 'undefined' ? { stack } : {}),
      ...(Object.keys(rest).length ? rest : {}),
    };
    return JSON.stringify(entry);
  })
);

// Development: pretty color logs
const developmentFormat = winston.format.combine(
  ...baseFormats,
  winston.format.colorize({ all: true }),
  winston.format.printf(info => {
    const { level, message, span_id, stack, timestamp, trace_id, ...rest } =
      info;
    let out = `${timestamp} [${level}] ${message}`;
    if (trace_id || span_id) {
      out += ` (trace_id=${trace_id || '-'} span_id=${span_id || '-'})`;
    }
    if (Object.keys(rest).length) {
      out += `\n${JSON.stringify(rest, null, 2)}`;
    }
    if (stack) {
      out += `\n${stack}`;
    }
    return out;
  })
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProduction ? productionFormat : developmentFormat,
  }),
];

if (config.honeycomb.team) {
  transports.push(new OpenTelemetryTransportV3());
}

const loggerInstance = winston.createLogger({
  level: config.nodeEnv === 'test' ? 'warn' : config.logging.logLevel,
  transports,
  exitOnError: false,
});

export default loggerInstance;
