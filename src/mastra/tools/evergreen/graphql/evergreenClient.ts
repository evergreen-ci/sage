import { config } from '../../../../config';
import { GraphQLClient } from '../../../../utils/graphql/client';

export const createEvergreenClient = (apiUser?: string, apiKey?: string) =>
  new GraphQLClient(
    config.evergreen.graphqlEndpoint,
    config.evergreen.userIDHeader,
    {
      ...(apiUser && { 'Api-User': apiUser }),
      ...(apiKey && { 'Api-Key': apiKey }),
    }
  );

const evergreenClient = createEvergreenClient(
  config.evergreen.apiUser,
  config.evergreen.apiKey
);

export default evergreenClient;
