import dotenvFlow from 'dotenv-flow';
import path from 'path';

const cwd = process.cwd();
const isMastraOutput =
  path.basename(cwd) === 'output' &&
  path.basename(path.dirname(cwd)) === '.mastra';

dotenvFlow.config({
  path: isMastraOutput ? path.resolve(cwd, '..', '..') : cwd,
  node_env: process.env.NODE_ENV || 'development',
});

export interface Config {
  /** PORT */
  port: number;
  /** NODE_ENV */
  nodeEnv: string;
  logging: {
    /** LOG_LEVEL */
    logLevel: string;
  };
  db: {
    /** MONGODB_URI */
    mongodbUri: string;
    /** DB_NAME */
    dbName: string;
  };
  aiModels: {
    azure: {
      openai: {
        /** AZURE_OPENAI_API_KEY */
        apiKey: string;
        /** AZURE_OPENAI_ENDPOINT */
        endpoint: string;
        /** AZURE_OPENAI_API_VERSION */
        apiVersion: string;
        /** AZURE_OPENAI_DEFAULT_DEPLOYMENT */
        defaultDeployment: string;
      };
    };
  };
  evergreen: {
    /** EVERGREEN_GRAPHQL_ENDPOINT */
    graphqlEndpoint: string;
    /** EVERGREEN_API_USER */
    apiUser: string;
    /** EVERGREEN_API_URL */
    apiURL: string;
    /** EVERGREEN_API_KEY */
    apiKey: string;
    /** EVERGREEN_URL */
    evergreenURL: string;
  };
  /** OTEL_COLLECTOR_URL */
  otelCollectorURL: string;
  honeycomb: {
    /** HONEYCOMB_API_KEY */
    apiKey: string;
    /** OTEL_LOG_COLLECTOR_URL */
    otelLogCollectorURL: string;
  };
  braintrust: {
    /** BRAINTRUST_API_KEY */
    apiKey: string;
    /** BRAINTRUST_PARENT */
    parent: string;
  };
  sentry: {
    /** SENTRY_DSN */
    dsn: string;
    /** SENTRY_SAMPLE_RATE */
    sampleRate: number;
    /** SENTRY_TRACES_SAMPLE_RATE */
    tracesSampleRate: number;
    /** SENTRY_ENABLED */
    enabled: boolean;
    /** SENTRY_DEBUG */
    debug: boolean;
    /** SENTRY_ATTACH_STACKTRACE */
    attachStacktrace: boolean;
    /** SENTRY_CAPTURE_CONSOLE */
    captureConsole: boolean;
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
  port: getEnvNumber('PORT', 8080),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  db: {
    mongodbUri: getEnvVar('MONGODB_URI', 'mongodb://localhost:27017'),
    dbName: getEnvVar('DB_NAME', ''),
  },
  logging: {
    logLevel: getEnvVar('LOG_LEVEL', 'info'),
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
    apiURL: getEnvVar('EVERGREEN_API_URL', ''),
    apiKey: getEnvVar('EVERGREEN_API_KEY', ''),
    evergreenURL: getEnvVar('EVERGREEN_URL', ''),
  },
  otelCollectorURL: getEnvVar(
    'OTEL_COLLECTOR_URL',
    'http://otel-collector-web-app.devprod-platform.svc.cluster.local:4318/v1/traces'
  ),
  honeycomb: {
    apiKey: getEnvVar('HONEYCOMB_API_KEY', ''),
    otelLogCollectorURL: getEnvVar(
      'OTEL_LOG_COLLECTOR_URL',
      'http://otel-collector-web-app.devprod-platform.svc.cluster.local:4318/v1/logs'
    ),
  },
  braintrust: {
    apiKey: getEnvVar('BRAINTRUST_API_KEY', ''),
    parent: getEnvVar('BRAINTRUST_PARENT', 'project_name:sage-staging'),
  },
  sentry: {
    dsn: getEnvVar('SENTRY_DSN', ''),
    sampleRate: parseFloat(getEnvVar('SENTRY_SAMPLE_RATE', '1.0')),
    tracesSampleRate: parseFloat(getEnvVar('SENTRY_TRACES_SAMPLE_RATE', '0.1')),
    enabled: getEnvVar('SENTRY_ENABLED', 'true') === 'true',
    debug: getEnvVar('SENTRY_DEBUG', 'false') === 'true',
    attachStacktrace: getEnvVar('SENTRY_ATTACH_STACKTRACE', 'true') === 'true',
    captureConsole: getEnvVar('SENTRY_CAPTURE_CONSOLE', 'false') === 'true',
  },
};

/**
 * `validateConfig` is a function to validate the required environment variables.
 * @returns An array of error messages if any of the required environment variables are not set, otherwise undefined.
 */
export const validateConfig = (): string[] | undefined => {
  if (
    process.env.NODE_ENV !== 'test' &&
    process.env.NODE_ENV !== 'development'
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
