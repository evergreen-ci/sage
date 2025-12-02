/**
 * Resolves the row ID from Braintrust logs by a given trace ID.
 * @param traceId - The trace ID to search for.
 * @param projectId - The Braintrust project ID.
 * @param [apiKey] - Optional API key to use. Falls back to BRAINTRUST_API_KEY env variable.
 * @param [apiUrl] - Optional API URL. Falls back to BRAINTRUST_API_URL or the Braintrust default.
 * @returns The corresponding row ID if found, otherwise undefined.
 * @throws {Error} If the API key is missing or the request fails.
 */
// Prevent BTQL injection by escaping backslashes and single quotes.
const escapeForBtql = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export const resolveRowIdByTraceId = async (
  traceId: string,
  projectId: string,
  apiKey?: string,
  apiUrl?: string
): Promise<string | undefined> => {
  const baseUrl =
    apiUrl ?? process.env.BRAINTRUST_API_URL ?? 'https://api.braintrust.dev';
  const authKey = apiKey ?? process.env.BRAINTRUST_API_KEY;

  if (!authKey) {
    throw new Error('BRAINTRUST_API_KEY is required to query BTQL');
  }

  const safeProjectId = escapeForBtql(projectId);
  const safeTraceId = escapeForBtql(traceId);

  const query = `
from: project_logs('${safeProjectId}')
select: id
filter: (root_span_id = '${safeTraceId}' AND span_parents = ['${safeTraceId}']) or root_span_id = '${safeTraceId}'
sort: created desc
limit: 1
`;

  const response = await fetch(`${baseUrl}/btql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: query }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`BTQL query failed: ${response.status} ${text}`);
  }

  const data = (await response.json().catch(() => undefined)) as unknown as
    | { data?: Array<{ id?: string }> }
    | undefined;
  const spanId = data?.data?.[0]?.id;
  return spanId;
};
