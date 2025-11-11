import { getKubernetesClient, getKubernetesSecret } from '@/utils/k8s/client';

/**
 * Test script to verify Kubernetes secrets access works locally.
 *
 * Usage:
 *   yarn test-k8s-secrets [secret-name] [key]
 *
 * Examples:
 *   yarn test-k8s-secrets parsley-ai-secrets
 *   yarn test-k8s-secrets parsley-ai-secrets AZURE_OPENAI_API_KEY
 */
async function testKubernetesSecrets() {
  const secretName = process.argv[2];
  const key = process.argv[3];

  if (!secretName) {
    console.log('Usage: yarn test-k8s-secrets <secret-name> [key]');
    console.log('Example: yarn test-k8s-secrets parsley-ai-secrets');
    console.log(
      'Example: yarn test-k8s-secrets parsley-ai-secrets AZURE_OPENAI_API_KEY'
    );
    process.exit(1);
  }

  try {
    console.log('🔍 Testing Kubernetes secrets access...\n');

    // Test client initialization
    const client = getKubernetesClient();
    const namespace = client.getNamespace();
    console.log(`✅ Kubernetes client initialized`);
    console.log(`   Namespace: ${namespace}\n`);

    // Test secret retrieval
    console.log(`📦 Fetching secret: ${secretName}`);
    if (key) {
      console.log(`   Key: ${key}`);
    }
    console.log('');

    const result = await getKubernetesSecret(secretName, key);

    if (key) {
      // Single key - mask the value for security
      const value = result as string;
      const masked =
        value.length > 20
          ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
          : '***';
      console.log(`✅ Successfully retrieved secret key`);
      console.log(`   Value (masked): ${masked}`);
      console.log(`   Length: ${value.length} characters`);
    } else {
      // All keys - show key names but mask values
      const allKeys = result as Record<string, string>;
      console.log(`✅ Successfully retrieved secret`);
      console.log(`   Keys found: ${Object.keys(allKeys).join(', ')}`);
      console.log(`   Total keys: ${Object.keys(allKeys).length}`);
      console.log('\n   Key values (masked):');
      for (const [k, v] of Object.entries(allKeys)) {
        const masked =
          v.length > 20
            ? `${v.substring(0, 10)}...${v.substring(v.length - 4)}`
            : '***';
        console.log(`     ${k}: ${masked} (${v.length} chars)`);
      }
    }

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      if (error.stack) {
        console.error('\n   Stack trace:');
        console.error(error.stack);
      }
    } else {
      console.error(`   ${String(error)}`);
    }
    process.exit(1);
  }
}

testKubernetesSecrets();
