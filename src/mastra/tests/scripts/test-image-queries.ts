#!/usr/bin/env node

/**
 * Test script to verify GraphQL image queries work against Evergreen API
 *
 * Usage:
 *   yarn tsx test-image-queries.ts
 *   or
 *   node --loader tsx test-image-queries.ts
 *
 * Requires environment variables:
 *   - EVERGREEN_GRAPHQL_ENDPOINT
 *   - EVERGREEN_API_USER
 *   - EVERGREEN_API_KEY
 */

import { gql } from 'graphql-tag';
import { config } from './src/config';
import { GraphQLClient } from './src/utils/graphql/client';

const LIST_IMAGES_QUERY = gql`
  query Images {
    images
  }
`;

const GET_IMAGE_QUERY = gql`
  query Image($imageId: String!) {
    image(imageId: $imageId) {
      id
      ami
      lastDeployed
      distros {
        name
        arch
      }
      events(limit: 10, page: 0) {
        count
        eventLogEntries {
          timestamp
          amiAfter
          amiBefore
          entries {
            type
            action
            name
            before
            after
          }
        }
      }
      packages(opts: {}) {
        data {
          name
          manager
          version
        }
        filteredCount
        totalCount
      }
      toolchains(opts: {}) {
        data {
          name
          path
          version
        }
        filteredCount
        totalCount
      }
      operatingSystem(opts: {}) {
        data {
          name
          version
        }
        filteredCount
        totalCount
      }
    }
  }
`;

/**
 *
 */
async function testQueries() {
  console.log('Testing GraphQL Image Queries against Evergreen API\n');
  console.log('═'.repeat(60));

  // Check environment variables
  const requiredVars = [
    'EVERGREEN_GRAPHQL_ENDPOINT',
    'EVERGREEN_API_USER',
    'EVERGREEN_API_KEY',
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    console.error('\nPlease set these environment variables and try again.');
    process.exit(1);
  }

  console.log('✓ Environment variables configured');
  console.log(`  Endpoint: ${config.evergreen.graphqlEndpoint}`);
  console.log(`  API User: ${config.evergreen.apiUser}`);
  console.log(
    `  API Key: ${config.evergreen.apiKey ? `***${config.evergreen.apiKey.slice(-4)}` : 'NOT SET'}\n`
  );

  const client = new GraphQLClient(config.evergreen.graphqlEndpoint, {
    'Api-User': config.evergreen.apiUser,
    'Api-Key': config.evergreen.apiKey,
  });

  try {
    // Test 1: List images query
    console.log('Test 1: Querying images list...');
    console.log('─'.repeat(60));

    const imagesResult = await client.executeQuery<{ images: string[] }>(
      LIST_IMAGES_QUERY,
      {},
      { userID: config.evergreen.apiUser }
    );

    console.log('✓ Successfully queried images list');
    console.log(`  Found ${imagesResult.images.length} images`);

    if (imagesResult.images.length > 0) {
      console.log(
        `  Sample image IDs: ${imagesResult.images.slice(0, 3).join(', ')}`
      );

      // Test 2: Get specific image details
      const testImageId = imagesResult.images[0];
      console.log(`\nTest 2: Querying image details for: ${testImageId}`);
      console.log('─'.repeat(60));

      const imageResult = await client.executeQuery<{
        image: {
          id: string;
          ami: string;
          lastDeployed: Date;
          distros: Array<{ name: string; arch: string }>;
          events: {
            count: number;
            eventLogEntries: Array<{
              timestamp: Date;
              amiAfter: string;
              amiBefore?: string | null;
              entries: Array<{
                type: string;
                action: string;
                name: string;
                before: string;
                after: string;
              }>;
            }>;
          };
          packages: {
            data: Array<{ name: string; manager: string; version: string }>;
            filteredCount: number;
            totalCount: number;
          };
          toolchains: {
            data: Array<{ name: string; path: string; version: string }>;
            filteredCount: number;
            totalCount: number;
          };
          operatingSystem: {
            data: Array<{ name: string; version: string }>;
            filteredCount: number;
            totalCount: number;
          };
        } | null;
      }>(
        GET_IMAGE_QUERY,
        { imageId: testImageId },
        { userID: config.evergreen.apiUser }
      );

      if (imageResult.image) {
        console.log('✓ Successfully queried image details');
        console.log(`  Image ID: ${imageResult.image.id}`);
        console.log(`  AMI: ${imageResult.image.ami}`);
        console.log(`  Last Deployed: ${imageResult.image.lastDeployed}`);
        console.log(`  Distros: ${imageResult.image.distros.length}`);
        console.log(
          `  Packages: ${imageResult.image.packages.totalCount} total`
        );
        console.log(
          `  Toolchains: ${imageResult.image.toolchains.totalCount} total`
        );
        console.log(
          `  OS Info: ${imageResult.image.operatingSystem.totalCount} entries`
        );
        console.log(`  Events: ${imageResult.image.events.count} total`);

        if (imageResult.image.events.eventLogEntries.length > 0) {
          const latestEvent = imageResult.image.events.eventLogEntries[0];
          console.log(
            `  Latest Event: ${latestEvent.timestamp} (${latestEvent.entries.length} changes)`
          );
        }
      } else {
        console.log('⚠ Image query returned null (image may not exist)');
      }
    } else {
      console.log('⚠ No images found, skipping image details test');
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('✅ All queries executed successfully!');
    console.log('The GraphQL queries are working correctly.\n');
  } catch (error: any) {
    console.error(`\n${'═'.repeat(60)}`);
    console.error('❌ Error executing queries:');
    console.error('─'.repeat(60));

    if (error instanceof Error) {
      console.error(`Error Type: ${error.constructor.name}`);
      console.error(`Message: ${error.message}`);

      if ('statusCode' in error) {
        console.error(`HTTP Status: ${(error as any).statusCode}`);
      }

      if ('errors' in error) {
        console.error('GraphQL Errors:');
        (error as any).errors?.forEach((err: any, idx: number) => {
          console.error(`  ${idx + 1}. ${err.message}`);
          if (err.path) {
            console.error(`     Path: ${JSON.stringify(err.path)}`);
          }
        });
      }

      if ('responseBody' in error) {
        console.error('\nResponse Body:');
        console.error(JSON.stringify((error as any).responseBody, null, 2));
      }
    } else {
      console.error('Unknown error:', error);
    }

    console.error('\n');
    process.exit(1);
  }
}

testQueries().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
