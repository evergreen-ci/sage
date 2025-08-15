import { config } from '../../../../config';
import { GraphQLClient } from '../../../../utils/graphql/client';

const evergreenClient = new GraphQLClient(
  config.evergreen.graphqlEndpoint,
  config.evergreen.userIDHeader
);

export default evergreenClient;
