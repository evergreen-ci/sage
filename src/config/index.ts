import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
dotenv.config({ path: resolve(process.cwd(), '.env') });

export interface Config {
  port: number;
  nodeEnv: string;
  deploymentEnv: string;
  logging: {
    logLevel: string;
    logToFile: boolean;
  };
  aiModels: {
    azure: {
      openai: {
        apiKey: string;
        endpoint: string;
        apiVersion: string;
        defaultDeployment: string;
      };
    };
  };
  evergreen: {
    graphqlEndpoint: string;
    apiUser: string;
    apiKey: string;
    userIDHeader: string;
  };
  otelCollectorURL: string;
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
  deploymentEnv: getEnvVar('DEPLOYMENT_ENV', 'staging'),
  logging: {
    logLevel: getEnvVar('LOG_LEVEL', 'info'),
    logToFile: getEnvVar('LOG_TO_FILE', 'true') === 'true',
  },
  aiModels: {
    azure: {
      openai: {
        apiKey: getEnvVar('AZURE_OPENAI_API_KEY', ''),
        endpoint: getEnvVar('AZURE_OPENAI_ENDPOINT', ''),
        apiVersion: getEnvVar('AZURE_OPENAI_API_VERSION', ''),
        defaultDeployment: getEnvVar('AZURE_OPENAI_DEFAULT_DEPLOYMENT', ''),
      },
    },
  },
  evergreen: {
    graphqlEndpoint: getEnvVar('EVERGREEN_GRAPHQL_ENDPOINT', ''),
    apiUser: getEnvVar('EVERGREEN_API_USER', ''),
    apiKey: getEnvVar('EVERGREEN_API_KEY', ''),
    userIDHeader: getEnvVar('END_USER_HEADER_ID', 'end-user-header-id'),
  },
  otelCollectorURL: getEnvVar(
    'OTEL_COLLECTOR_URL',
    'http://otel-collector-web-app.devprod-platform.svc.cluster.local:4318/v1/traces'
  ),
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

export { getEnvVar };
