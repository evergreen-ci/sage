import dotenvFlow from 'dotenv-flow';

dotenvFlow.config({
  node_env: process.env.DEPLOYMENT_ENV || 'local',
});

export interface Config {
  port: number;
  nodeEnv: string;
  deploymentEnv: string;
  logging: {
    logLevel: string;
    logToFile: boolean;
  };
  db: {
    mongodbUri: string;
    dbName: string;
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
  honeycomb: {
    team: string;
    apiKey: string;
  };
  braintrust: {
    apiKey: string;
    parent: string;
  };
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
  db: {
    mongodbUri: getEnvVar('MONGODB_URI', 'mongodb://localhost:27017'),
    dbName:
      getEnvVar('NODE_ENV', 'development') === 'test'
        ? 'sage-test'
        : getEnvVar('DB_NAME', 'sage'),
  },
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
        apiVersion: 'preview',
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
  honeycomb: {
    team: getEnvVar('HONEYCOMB_TEAM', ''),
    apiKey: getEnvVar('HONEYCOMB_API_KEY', ''),
  },
  braintrust: {
    apiKey: getEnvVar('BRAINTRUST_API_KEY', ''),
    parent: getEnvVar('BRAINTRUST_PARENT', 'project_name:dev-prod-team'),
  },
};

/**
 * `validateConfig` is a function to validate the required environment variables.
 * @returns An array of error messages if any of the required environment variables are not set, otherwise undefined.
 */
export const validateConfig = (): string[] | undefined => {
  if (
    process.env.DEPLOYMENT_ENV !== 'test' &&
    process.env.DEPLOYMENT_ENV !== 'local'
  ) {
    const warningMsg = `
================================================================================
  ⚠️  WARNING: Running against "${process.env.DEPLOYMENT_ENV}" environment! BE CAREFUL! ⚠️
================================================================================
`;
    console.warn(warningMsg);
  }

  const requiredVars = [
    'NODE_ENV',
    'AZURE_OPENAI_API_KEY',
    'AZURE_OPENAI_ENDPOINT',
    'EVERGREEN_GRAPHQL_ENDPOINT',
    'EVERGREEN_API_USER',
    'EVERGREEN_API_KEY',
  ];

  const errors: string[] = [];
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      errors.push(`Warning: ${varName} environment variable is not set`);
    }
  }
  return errors.length > 0 ? errors : undefined;
};

export { getEnvVar };
