import { config } from '@/config';
import { GraphQLClient } from '@/utils/graphql/client';

const evergreenClient = new GraphQLClient(config.evergreen.graphqlEndpoint, {
  'Api-User': config.evergreen.apiUser,
  'Api-Key': config.evergreen.apiKey,
});

export default evergreenClient;
