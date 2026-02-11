import { z } from 'zod';

const ERROR_KEYWORDS = [
  // Universal high-signal error indicators
  'error',
  'errors',
  'fatal',
  'panic',
  'crash',
  'crashed',
  'exception',
  'unhandled',
  'uncaught',
  'abort',
  'aborted',
  'fail',
  'failed',
  'failure',
  'critical',
  'severe',
  'emergency',
  'assert',
  'assertion',
  'corrupt',
  'corruption',
  'invariant',
  'violation',

  // Traces / crashes
  'stack trace',
  'stacktrace',
  'traceback',
  'call stack',
  'segmentation fault',
  'segfault',
  'core dumped',
  'bus error',
  'illegal instruction',
  'SIGSEGV',
  'SIGABRT',
  'SIGILL',
  'SIGFPE',
  'SIGKILL',
  'SIGTERM',
  'goroutine',

  // Python
  'Traceback (most recent call last)',
  'RuntimeError',
  'ValueError',
  'TypeError',
  'KeyError',
  'IndexError',
  'AttributeError',
  'ImportError',
  'ModuleNotFoundError',
  'ZeroDivisionError',
  'AssertionError',
  'SyntaxError',
  'IndentationError',

  // Java/JVM
  'Exception in thread',
  'Caused by',
  'NullPointerException',
  'ClassNotFoundException',
  'NoClassDefFoundError',
  'IllegalArgumentException',
  'IllegalStateException',
  'IndexOutOfBoundsException',
  'ConcurrentModificationException',
  'OutOfMemoryError',
  'StackOverflowError',
  'LinkageError',
  'VerifyError',

  // Go
  'panic:',
  'fatal error:',
  'runtime error',
  'nil pointer dereference',
  'index out of range',
  'deadlock',
  'all goroutines are asleep',
  'concurrent map read and map write',
  'panic recovered',
  'runtime.gopanic',
  'runtime.throw',

  // Node / JS
  'UnhandledPromiseRejection',
  'UnhandledPromiseRejectionWarning',
  'TypeError:',
  'ReferenceError:',
  'RangeError:',
  'SyntaxError:',
  'ERR_',
  'ECONNREFUSED',
  'ECONNRESET',
  'EADDRINUSE',
  'EPIPE',
  'ENOMEM',
  'ENOSPC',
  'MODULE_NOT_FOUND',

  // Network
  'connection refused',
  'connection reset',
  'connection timeout',
  'timed out',
  'read timeout',
  'write timeout',
  'TLS handshake failed',
  'SSL error',
  'certificate verify failed',
  'x509',
  'broken pipe',
  'no route to host',
  'host unreachable',
  'network unreachable',
  'dns error',
  'NXDOMAIN',
  'SERVFAIL',

  // Auth
  'unauthorized',
  'forbidden',
  'access denied',
  'permission denied',
  'not authorized',
  'auth failed',
  'authentication failed',
  'authorization failed',
  'invalid token',
  'expired token',
  'token expired',
  'missing token',
  'invalid credentials',
  'bad credentials',
  'invalid signature',
  'jwt expired',
  'jwt invalid',
  'oidc error',
  'oauth error',
  'invalid grant',
  'invalid scope',
  'invalid client',

  // DB / storage / FS
  'SQLSTATE',
  'constraint violation',
  'unique constraint',
  'foreign key constraint',
  'deadlock detected',
  'lock wait timeout',
  'serialization failure',
  'duplicate key',
  'relation does not exist',
  'table not found',
  'column not found',
  'invalid input syntax',
  'too many connections',
  'connection pool exhausted',
  'no space left on device',
  'disk full',
  'read-only file system',
  'file not found',
  'directory not found',
  'too many open files',
  'EMFILE',

  // K8s / containers
  'OOMKilled',
  'out of memory',
  'killed process',
  'signal: killed',
  'CrashLoopBackOff',
  'ImagePullBackOff',
  'ErrImagePull',
  'FailedScheduling',
  'NodeNotReady',
  'Readiness probe failed',
  'Liveness probe failed',
  'Pod evicted',
  'Back-off restarting',

  // MongoDB-specific
  'fassert',
  'invariant failure',
  'tripwire',
];

const escapeRegex = (str: string): string =>
  str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildErrorRegex = (keywords: string[]): RegExp => {
  const escaped: string[] = [];
  for (const kw of keywords) {
    if (kw === 'ERR_') {
      escaped.push('ERR_[A-Z0-9_]+');
    } else {
      escaped.push(escapeRegex(kw));
    }
  }

  const extras = [
    '\\bERROR\\b',
    '\\bFATAL\\b',
    '\\bPANIC\\b',
    '\\bCRITICAL\\b',
    '\\bSEVERE\\b',
  ];

  const pattern = `(${[...extras, ...escaped].join('|')})`;
  return new RegExp(pattern, 'gi');
};

const ERROR_REGEX = buildErrorRegex(ERROR_KEYWORDS);

export const LogScanResultSchema = z.object({
  totalLines: z.number(),
  matchedLineCount: z.number(),
  topTerms: z.array(z.tuple([z.string(), z.number()])),
  matchedExcerpt: z.string(),
});

export type LogScanResult = z.infer<typeof LogScanResultSchema>;

/**
 * Merge overlapping or adjacent line ranges into a sorted, non-overlapping set.
 * Each range is [start, end] inclusive.
 * @param ranges - array of [start, end] inclusive line ranges to merge
 * @returns merged array of non-overlapping [start, end] ranges sorted by start
 */
const mergeRanges = (
  ranges: Array<[number, number]>
): Array<[number, number]> => {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (current[0] <= last[1] + 1) {
      last[1] = Math.max(last[1], current[1]);
    } else {
      merged.push(current);
    }
  }
  return merged;
};

export const scanLogForErrors = (
  logText: string,
  options?: {
    contextLinesBefore?: number;
    contextLinesAfter?: number;
    maxTopTerms?: number;
  }
): LogScanResult => {
  const contextBefore = options?.contextLinesBefore ?? 3;
  const contextAfter = options?.contextLinesAfter ?? 3;
  const maxTopTerms = options?.maxTopTerms ?? 30;

  if (!logText) {
    return {
      totalLines: 0,
      matchedLineCount: 0,
      topTerms: [],
      matchedExcerpt: '',
    };
  }

  const lines = logText.split('\n');
  const totalLines = lines.length;

  // Track which lines matched
  const matchedLineIndices: number[] = [];
  const counter = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Reset lastIndex since we use 'g' flag
    ERROR_REGEX.lastIndex = 0;
    let match = ERROR_REGEX.exec(line);
    if (!match) continue;

    matchedLineIndices.push(i);

    // Count all occurrences in this line
    while (match) {
      const term = match[0].toLowerCase();
      counter.set(term, (counter.get(term) ?? 0) + 1);
      match = ERROR_REGEX.exec(line);
    }
  }

  // Build context ranges around each matched line
  const ranges: Array<[number, number]> = matchedLineIndices.map(idx => [
    Math.max(0, idx - contextBefore),
    Math.min(totalLines - 1, idx + contextAfter),
  ]);

  const merged = mergeRanges(ranges);

  // Extract the excerpt from merged ranges, with separators between non-adjacent ranges
  const excerptParts: string[] = [];
  for (const [start, end] of merged) {
    const rangeLines = lines.slice(start, end + 1);
    excerptParts.push(rangeLines.join('\n'));
  }
  const matchedExcerpt = excerptParts.join('\n...\n');

  // Sort terms by frequency descending
  const topTerms: Array<[string, number]> = Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTopTerms);

  return {
    totalLines,
    matchedLineCount: matchedLineIndices.length,
    topTerms,
    matchedExcerpt,
  };
};
