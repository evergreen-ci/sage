import { gql } from 'graphql-tag';
import { z } from 'zod';
import { createGraphQLTool } from '@/mastra/utils/graphql/createGraphQLTool';
import {
  Arch,
  ImageEventEntryAction,
  ImageEventType,
  ImageQuery,
  ImageQueryVariables,
} from '../../../../gql/generated/types';
import evergreenClient from '../graphql/evergreenClient';

const GET_IMAGE = gql`
  query Image(
    $imageId: String!
    $packageOpts: PackageOpts
    $toolchainOpts: ToolchainOpts
    $operatingSystemOpts: OperatingSystemOpts
  ) {
    image(imageId: $imageId) {
      id
      ami
      lastDeployed
      distros {
        name
        arch
      }
      events(limit: 10, page: 0) {
        count
        eventLogEntries {
          timestamp
          amiAfter
          amiBefore
          entries {
            type
            action
            name
            before
            after
          }
        }
      }
      packages(opts: $packageOpts) {
        data {
          name
          manager
          version
        }
        filteredCount
        totalCount
      }
      toolchains(opts: $toolchainOpts) {
        data {
          name
          path
          version
        }
        filteredCount
        totalCount
      }
      operatingSystem(opts: $operatingSystemOpts) {
        data {
          name
          version
        }
        filteredCount
        totalCount
      }
    }
  }
`;

const getImageInputSchema = z.object({
  imageId: z.string(),
  packageOpts: z
    .object({
      limit: z.number().optional(),
      manager: z.string().optional(),
      name: z.string().optional(),
      page: z.number().optional(),
    })
    .optional(),
  toolchainOpts: z
    .object({
      limit: z.number().optional(),
      name: z.string().optional(),
      page: z.number().optional(),
    })
    .optional(),
  operatingSystemOpts: z
    .object({
      limit: z.number().optional(),
      name: z.string().optional(),
      page: z.number().optional(),
    })
    .optional(),
});

const getImageOutputSchema = z.object({
  image: z.object({
    id: z.string(),
    ami: z.string(),
    lastDeployed: z.date(),
    distros: z.array(
      z.object({
        name: z.string(),
        arch: z.enum(Arch),
      })
    ),
    events: z.object({
      count: z.number(),
      eventLogEntries: z.array(
        z.object({
          timestamp: z.date(),
          amiAfter: z.string(),
          amiBefore: z.string().optional().nullable(),
          entries: z.array(
            z.object({
              type: z.enum(ImageEventType),
              action: z.enum(ImageEventEntryAction),
              name: z.string(),
              before: z.string(),
              after: z.string(),
            })
          ),
        })
      ),
    }),
    packages: z.object({
      data: z.array(
        z.object({
          name: z.string(),
          manager: z.string(),
          version: z.string(),
        })
      ),
      filteredCount: z.number(),
      totalCount: z.number(),
    }),
    toolchains: z.object({
      data: z.array(
        z.object({
          name: z.string(),
          path: z.string(),
          version: z.string(),
        })
      ),
      filteredCount: z.number(),
      totalCount: z.number(),
    }),
    operatingSystem: z.object({
      data: z.array(
        z.object({
          name: z.string(),
          version: z.string(),
        })
      ),
      filteredCount: z.number(),
      totalCount: z.number(),
    }),
  }),
});

const getImageTool = createGraphQLTool<ImageQuery, ImageQueryVariables>({
  id: 'getImage',
  description:
    'Get image/AMI information from Evergreen including installed packages, toolchains, operating system details, and change history. Use this to answer questions about what is installed on AMIs and when they changed. Requires an imageId (string) which is the unique identifier for an image in Evergreen.',
  query: GET_IMAGE,
  inputSchema: getImageInputSchema,
  outputSchema: getImageOutputSchema,
  client: evergreenClient,
});

export default getImageTool;
