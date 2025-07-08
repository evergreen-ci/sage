import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface Config {
  port: number;
  nodeEnv: string;
}

/**
 * `getEnvVar` is a helper function to get an environment variable with a default value.
 * @param key - The environment variable key.
 * @param defaultValue - The default value to return if the environment variable is not set.
 * @returns The environment variable as a string.
 */
const getEnvVar = (key: string, defaultValue: string): string => {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  return value;
};

/**
 * `getEnvNumber` is a helper function to get an environment variable as a number with a default value.
 * @param key - The environment variable key.
 * @param defaultValue - The default value to return if the environment variable is not set.
 * @returns The environment variable as a number.
 */
const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(
      `Invalid number for ${key}: ${value}, using default: ${defaultValue}`
    );
    return defaultValue;
  }
  return parsed;
};

/**
 * `config` is the configuration object for the application.
 */
export const config: Config = {
  port: getEnvNumber('PORT', 3000),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
};

/**
 * `validateConfig` is a function to validate the required environment variables.
 */
export const validateConfig = (): void => {
  const requiredVars = ['NODE_ENV'];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      console.warn(`Warning: ${varName} environment variable is not set`);
    }
  }
};
