// Global type declarations for Node.js Fetch API types
// These types are needed for generated API clients (like @hey-api/openapi-ts)
// that use BodyInit, which @types/node doesn't expose globally despite
// exposing other fetch types (Request, Response, Headers, etc.)

import type { BodyInit as UndiciBodyInit } from 'undici-types';

declare global {
  type BodyInit = UndiciBodyInit;
}
