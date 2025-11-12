# Kubernetes Secret Middleware

This module provides utilities and middleware for accessing Kubernetes secrets in Mastra tools and workflows. It allows tools to securely retrieve and inject secrets from Kubernetes into their runtime context.

## Overview

The Kubernetes secret middleware enables tools to access secrets stored in Kubernetes without exposing them in tool inputs or agent prompts. Secrets are fetched from the cluster and injected into the tool's runtime context before execution.

## File Structure

```
kubernetes/
├── client.ts          # Kubernetes client initialization and namespace detection
├── getSecret.ts      # Secret retrieval function and middleware
├── getSecret.test.ts # Tests for secret functionality
├── index.ts          # Module exports
└── README.md         # This file
```

### File Naming

The current file names are reasonable and follow common conventions:
- **`getSecret.ts`**: Contains both `getK8sSecret()` function and `withK8sSecret()` middleware. The name reflects the primary function of retrieving secrets.
- **`client.ts`**: Clear and descriptive for Kubernetes client utilities.
- **`getSecret.test.ts`**: Standard test file naming convention.
- **`index.ts`**: Standard module export file.

Alternative naming could be `k8sSecret.ts` for more specificity, but `getSecret.ts` is clear and concise.

## Components

### `client.ts`

Provides Kubernetes client initialization and namespace detection:

- **`getK8sClient()`**: Returns a singleton Kubernetes CoreV1Api client instance
  - Automatically detects if running in-cluster (loads from service account)
  - Falls back to default kubeconfig for local development
  - Throws error if neither configuration can be loaded

- **`getNamespace()`**: Returns the current Kubernetes namespace
  - Reads from service account file when running in-cluster
  - Falls back to `KUBERNETES_NAMESPACE` or `NAMESPACE` environment variables
  - Defaults to `"default"` namespace for local development

### `getSecret.ts`

Contains the core secret retrieval functionality and middleware:

#### `getK8sSecret(secretName: string, key?: string): Promise<SecretData>`

Core function to retrieve a secret from Kubernetes.

**Parameters:**
- `secretName`: The name of the Kubernetes secret to retrieve
- `key` (optional): Specific key within the secret to retrieve. If omitted, returns all keys

**Returns:**
- `SecretData` object containing:
  - `secretName`: Name of the secret
  - `data`: All key-value pairs (when no specific key requested)
  - `key`: The requested key name (when specific key requested)
  - `value`: The value of the requested key (when specific key requested)

**Example:**
```typescript
import { getK8sSecret } from '@/mastra/utils/kubernetes';

// Get all keys from a secret
const allSecrets = await getK8sSecret('my-secret');
// Returns: { secretName: 'my-secret', data: { apiKey: '...', apiSecret: '...' } }

// Get a specific key
const apiKey = await getK8sSecret('my-secret', 'apiKey');
// Returns: { secretName: 'my-secret', key: 'apiKey', value: '...' }
```

#### `withK8sSecret(tool, config): Tool`

Middleware function that wraps a tool with secret access. The secret is fetched before the tool executes and injected into the runtime context.

**Parameters:**
- `tool`: The Mastra tool to wrap with secret access
- `config`: `SecretMiddlewareConfig` object:
  - `secretName`: Name of the Kubernetes secret to retrieve
  - `key` (optional): Specific key within the secret to retrieve
  - `contextKey` (optional): Key to inject secret into runtime context (default: `'secrets'`)

**Returns:**
- A new tool with the same interface that has access to the secret via runtime context

**Example:**
```typescript
import { createTool } from '@mastra/core';
import { withK8sSecret } from '@/mastra/utils/kubernetes';
import { z } from 'zod';

// Create a tool that needs API credentials
const myTool = createTool({
  id: 'my-tool',
  description: 'Tool that uses an API key',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  execute: async ({ context, runtimeContext }) => {
    // Access the secret from runtime context
    const apiKey = runtimeContext?.get('apiKey') as string;
    
    // Use the API key in your tool logic
    const response = await fetch('https://api.example.com', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    return { result: await response.text() };
  },
});

// Wrap the tool with secret middleware
const toolWithSecret = withK8sSecret(myTool, {
  secretName: 'api-secrets',
  key: 'apiKey',
  contextKey: 'apiKey', // Optional: defaults to 'secrets' if not specified
});
```

**Accessing All Secret Keys:**

If you don't specify a `key`, all secret data is injected as an object:

```typescript
const toolWithAllSecrets = withK8sSecret(myTool, {
  secretName: 'api-secrets',
  // No key specified - all keys will be available
});

// In the tool's execute function:
const secrets = runtimeContext?.get('secrets') as Record<string, string>;
const apiKey = secrets?.apiKey;
const apiSecret = secrets?.apiSecret;
```

## Usage Patterns

### Pattern 1: Single Secret Key

When your tool needs a single secret value:

```typescript
const tool = withK8sSecret(myTool, {
  secretName: 'database-credentials',
  key: 'password',
  contextKey: 'dbPassword', // Custom context key name
});
```

### Pattern 2: Multiple Secret Keys

When your tool needs multiple keys from the same secret:

```typescript
const tool = withK8sSecret(myTool, {
  secretName: 'api-credentials',
  // No key specified - injects all keys as an object
});

// Access in tool:
const credentials = runtimeContext?.get('secrets') as Record<string, string>;
const apiKey = credentials?.apiKey;
const apiSecret = credentials?.apiSecret;
```

### Pattern 3: Multiple Secrets

If you need secrets from different Kubernetes secrets, you can chain middleware or use multiple context keys:

```typescript
// Option 1: Chain middleware (if supported)
const tool = withK8sSecret(
  withK8sSecret(myTool, {
    secretName: 'api-secrets',
    key: 'apiKey',
    contextKey: 'apiKey',
  }),
  {
    secretName: 'db-secrets',
    key: 'dbPassword',
    contextKey: 'dbPassword',
  }
);

// Option 2: Use getK8sSecret directly in tool
const myTool = createTool({
  // ...
  execute: async ({ runtimeContext }) => {
    const apiKey = await getK8sSecret('api-secrets', 'apiKey');
    const dbPassword = await getK8sSecret('db-secrets', 'dbPassword');
    // Use secrets...
  },
});
```

## Error Handling

The middleware and functions handle various error scenarios:

- **Secret not found**: Throws error with namespace information
- **Key not found**: Lists available keys in error message
- **Empty secret**: Throws error if secret exists but has no data
- **Decoding errors**: Logs warning and includes raw value if base64 decoding fails
- **Kubernetes API errors**: Propagates errors with context

## Security Considerations

1. **Namespace Isolation**: Secrets are automatically retrieved from the namespace the application is running in
2. **No Secret Exposure**: Secrets are never included in tool inputs, outputs, or agent prompts
3. **Runtime Context Only**: Secrets are only available in the tool's runtime context during execution
4. **Base64 Decoding**: Secret values are automatically decoded from base64 format

## Local Development

For local development:

1. Ensure you have a valid `~/.kube/config` file configured
2. The namespace defaults to `"default"` if not detected
3. You can override the namespace using `KUBERNETES_NAMESPACE` or `NAMESPACE` environment variables

## Testing

Tests are located in `getSecret.test.ts` and cover:

- Secret retrieval (all keys and specific keys)
- Error handling (not found, empty secrets, API errors)
- Namespace handling
- Middleware functionality (context injection)
- Edge cases (decoding errors, missing execute functions)

Run tests with:
```bash
yarn test src/mastra/utils/kubernetes/getSecret.test.ts
```

## Type Definitions

### `SecretData`

```typescript
type SecretData = {
  secretName: string;
  data?: Record<string, string>;  // All keys (when no specific key requested)
  key?: string;                    // Requested key name
  value?: string;                  // Requested key value
};
```

### `SecretMiddlewareConfig`

```typescript
interface SecretMiddlewareConfig {
  secretName: string;
  key?: string;                    // Optional: specific key to retrieve
  contextKey?: string;              // Optional: context key name (default: 'secrets')
}
```

## Migration from Tool Pattern

If you were previously using `getK8sSecretTool` (now deprecated), migrate to the middleware pattern:

**Before:**
```typescript
// Tool would call getK8sSecretTool internally
const result = await agent.generate(message, { tools: [getK8sSecretTool] });
```

**After:**
```typescript
// Wrap your tools with middleware
const myToolWithSecret = withK8sSecret(myTool, {
  secretName: 'my-secret',
  key: 'myKey',
});
```

## Related Documentation

- [Mastra Tools Documentation](https://mastra.ai/en/docs/tools-mcp/overview)
- [Mastra Runtime Context](https://mastra.ai/en/docs/core-concepts/runtime-context)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)

