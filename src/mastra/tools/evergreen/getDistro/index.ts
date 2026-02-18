import { gql } from 'graphql-tag';
import { z } from 'zod';
import { createGraphQLTool } from '@/mastra/utils/graphql/createGraphQLTool';
import {
  Arch,
  DistroQuery,
  DistroQueryVariables,
  Provider,
} from '../../../../gql/generated/types';
import evergreenClient from '../graphql/evergreenClient';

const GET_DISTRO = gql`
  query Distro($distroId: String!) {
    distro(distroId: $distroId) {
      name
      imageId
      arch
      provider
      disabled
      costData {
        onDemandPrice
        spotPrice
      }
      userSpawnAllowed
      adminOnly
      warningNote
      workDir
      hostAllocatorSettings {
        maximumHosts
      }
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
      costData: z
        .object({
          onDemandPrice: z.number(),
          spotPrice: z.number(),
        })
        .nullable(),
      userSpawnAllowed: z.boolean(),
      adminOnly: z.boolean(),
      warningNote: z.string().nullable(),
      workDir: z.string(),
      hostAllocatorSettings: z.object({
        maximumHosts: z.number(),
      }),
    })
    .nullable(),
});

const getDistroTool = createGraphQLTool<DistroQuery, DistroQueryVariables>({
  id: 'getDistro',
  description:
    'Get distro information from Evergreen. Requires a distroId (string) which is the unique identifier for a distro in Evergreen.',
  query: GET_DISTRO,
  inputSchema: getDistroInputSchema,
  outputSchema: getDistroOutputSchema,
  client: evergreenClient,
});

export default getDistroTool;
