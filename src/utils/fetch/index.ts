import { config } from '../../config';

/**
 * `AuthenticatedEvergreenFetch` is a function that fetches a URL with the Evergreen API user and key.
 * It only allows authenticated requests to the Evergreen API.
 * @param url - The URL to fetch
 * @param options - The options to pass to the fetch function
 * @returns The response from the fetch function
 */
const authenticatedEvergreenFetch = (url: string, options: RequestInit) => {
  if (!isValidEvergreenURL(url)) {
    throw new Error(
      'Invalid URL needs to start with the Evergreen API endpoint'
    );
  }
  const headers = new Headers(options.headers);
  headers.set('Accept', 'text/plain,application/json');
  headers.set('Api-User', config.evergreen.apiUser);
  headers.set('Api-Key', config.evergreen.apiKey);
  const response = fetch(url, {
    ...options,
    headers,
  });
  return response;
};

const isValidEvergreenURL = (url: string) => {
  if (process.env.MASTRA_DEV === 'true') {
    return true;
  }
  if (!url.startsWith(config.evergreen.evergreenURL)) {
    return false;
  }
  return true;
};

export { authenticatedEvergreenFetch };
