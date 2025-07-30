import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  AlwaysOnSampler,
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import type { RequestOptions, ClientRequest, IncomingMessage } from 'http';
import https from 'https';
import { URL } from 'url';

// Patch https.request to log OTEL trace POSTs.
const originalRequest = https.request;
https.request = function (
  urlOrOptions: string | URL | RequestOptions,
  optionsOrCb?: RequestOptions | ((res: IncomingMessage) => void),
  cb?: (res: IncomingMessage) => void
): ClientRequest {
  let url: URL;
  let method: string | undefined;
  let actualCb: ((res: IncomingMessage) => void) | undefined;
  let actualOptions: RequestOptions | undefined;

  if (typeof urlOrOptions === 'string' || urlOrOptions instanceof URL) {
    url = new URL(urlOrOptions.toString());
    if (typeof optionsOrCb === 'function') {
      actualCb = optionsOrCb;
      actualOptions = undefined;
    } else {
      actualOptions = optionsOrCb;
      actualCb = cb;
    }
    method = actualOptions?.method;
  } else {
    actualOptions = urlOrOptions;
    url = new URL(
      `${actualOptions.protocol || 'https:'}//${actualOptions.hostname || actualOptions.host}${actualOptions.port ? `:${actualOptions.port}` : ''}${actualOptions.path || '/'}`
    );
    actualCb = typeof optionsOrCb === 'function' ? optionsOrCb : undefined;
    method = actualOptions.method;
  }

  const isOtel =
    url.hostname === 'otel-collector.staging.corp.mongodb.com' &&
    url.pathname === '/v1/traces' &&
    (method || '').toUpperCase() === 'POST';
  let req: ClientRequest;
  if (typeof urlOrOptions === 'string' || urlOrOptions instanceof URL) {
    if (actualOptions && Object.keys(actualOptions).length > 0) {
      req = actualCb
        ? originalRequest(
            urlOrOptions,
            actualOptions,
            function (res: IncomingMessage) {
              if (isOtel) {
                let responseData = '';
                res.on('data', (chunk: Buffer) => {
                  responseData += chunk.toString('utf8');
                });
                res.on('end', () => {
                  console.log(
                    '[OTEL DEBUG] Response from collector:',
                    res.statusCode,
                    res.statusMessage,
                    responseData
                  );
                });
              }
              actualCb(res);
            }
          )
        : originalRequest(urlOrOptions, actualOptions);
    } else if (actualCb) {
      req = originalRequest(urlOrOptions, function (res: IncomingMessage) {
        if (isOtel) {
          let responseData = '';
          res.on('data', (chunk: Buffer) => {
            responseData += chunk.toString('utf8');
          });
          res.on('end', () => {
            console.log(
              '[OTEL DEBUG] Response from collector:',
              res.statusCode,
              res.statusMessage,
              responseData
            );
          });
        }
        actualCb(res);
      });
    } else {
      req = originalRequest(urlOrOptions);
    }
  } else if (actualCb) {
    req = originalRequest(urlOrOptions, function (res: IncomingMessage) {
      if (isOtel) {
        let responseData = '';
        res.on('data', (chunk: Buffer) => {
          responseData += chunk.toString('utf8');
        });
        res.on('end', () => {
          console.log(
            '[OTEL DEBUG] Response from collector:',
            res.statusCode,
            res.statusMessage,
            responseData
          );
        });
      }
      actualCb(res);
    });
  } else {
    req = originalRequest(urlOrOptions);
  }
  if (isOtel) {
    const write = req.write.bind(req);
    let body = '';
    req.write = function (chunk: any, encoding?: any, cb?: any): boolean {
      if (typeof chunk === 'string' || chunk instanceof Buffer) {
        body += chunk instanceof Buffer ? chunk.toString('utf8') : chunk;
      }
      return write(chunk, encoding, cb);
    };
    req.on('finish', () => {
      console.log(
        '[OTEL DEBUG] Sending POST to collector:',
        url.href,
        '\nPayload:',
        body
      );
    });
  }
  return req;
};

const traceExporter = new OTLPTraceExporter({
  url: 'http://otel-collector.staging.corp.mongodb.com:443/v1/traces',
});

const consoleExporter = new ConsoleSpanExporter();

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: 'sage',
  }),
  traceExporter,
  instrumentations: [getNodeAutoInstrumentations()],
  sampler: new AlwaysOnSampler(),
  spanProcessor: new SimpleSpanProcessor(consoleExporter),
});

sdk.start();
