import { gql } from 'graphql-tag';
import { z } from 'zod';
import { createGraphQLTool } from '@/mastra/utils/graphql/createGraphQLTool';
import {
  Arch,
  DistroQuery,
  DistroQueryVariables,
  Provider,
} from '../../../gql/generated/types';
import evergreenClient from './graphql/evergreenClient';

const GET_DISTRO = gql`
  query Distro($distroId: String!) {
    distro(distroId: $distroId) {
      name
      imageId
      arch
      provider
      disabled
    }
  }
`;

const getDistroInputSchema = z.object({
  distroId: z.string(),
});

const getDistroOutputSchema = z.object({
  distro: z
    .object({
      name: z.string(),
      imageId: z.string(),
      arch: z.enum(Arch),
      provider: z.enum(Provider),
      disabled: z.boolean(),
    })
    .nullable(),
});

const getDistroTool = createGraphQLTool<DistroQuery, DistroQueryVariables>({
  id: 'getDistro',
  description:
    'Get distro information from Evergreen including the associated imageId. Use this to find the image ID for a given distro ID. Requires a distroId (string) which is the unique identifier for a distro in Evergreen.',
  query: GET_DISTRO,
  inputSchema: getDistroInputSchema,
  outputSchema: getDistroOutputSchema,
  client: evergreenClient,
});

export default getDistroTool;
