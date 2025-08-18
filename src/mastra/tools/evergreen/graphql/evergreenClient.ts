import { config } from '../../../../config';
import { GraphQLClient } from '../../../../utils/graphql/client';

const evergreenClient = new GraphQLClient(
  config.evergreen.graphqlEndpoint,
  config.evergreen.userIDHeader,
  {
    // Include Evergreen API credentials if configured
    ...(config.evergreen.apiUser && { 'Api-User': config.evergreen.apiUser }),
    ...(config.evergreen.apiKey && { 'Api-Key': config.evergreen.apiKey }),
  }
);

export default evergreenClient;
