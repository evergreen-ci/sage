/**
 * Script to add or update a Cursor API key for a user in the local MongoDB collection.
 *
 * Usage:
 *   npx tsx scripts/upsert-api-key.ts -e <email> -k <api_key>
 *
 * Required Environment Variables:
 *   - MONGODB_URI: MongoDB connection string (default: mongodb://localhost:27017)
 *   - ENCRYPTION_KEY: 64-character hex string for AES-256 encryption
 *
 * Example:
 *   npx tsx scripts/upsert-api-key.ts -e user@mongodb.com -k cursor_api_key_12345
 */

import { db } from '@/db/connection';
import {
  ensureIndexes,
  upsertUserCredentials,
} from '@/db/repositories/userCredentialsRepository';
import logger from '@/utils/logger';

const parseArgs = (): { email: string; apiKey: string } => {
  const args = process.argv.slice(2);
  let email: string | undefined;
  let apiKey: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-e' || args[i] === '--email') {
      email = args[i + 1];
      i++;
    } else if (args[i] === '-k' || args[i] === '--key') {
      apiKey = args[i + 1];
      i++;
    }
  }

  if (!email || !apiKey) {
    console.error('Usage: npx tsx scripts/upsert-api-key.ts -e <email> -k <api_key>');
    console.error('  -e, --email: User email address');
    console.error('  -k, --key:   Cursor API key');
    process.exit(1);
  }

  return { email, apiKey };
};

const main = async () => {
  try {
    const { email, apiKey } = parseArgs();

    logger.info(`Connecting to MongoDB...`);
    await db.connect();

    logger.info(`Ensuring indexes...`);
    await ensureIndexes();

    logger.info(`Upserting API key for ${email}...`);
    const result = await upsertUserCredentials({
      email,
      cursorApiKey: apiKey,
    });

    logger.info(
      `Successfully stored API key for ${email} (last 4: ${result.keyLastFour})`
    );

    await db.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Error upserting API key:', error);
    await db.disconnect().catch(() => {
      // Ignore disconnect errors
    });
    process.exit(1);
  }
};

main();
