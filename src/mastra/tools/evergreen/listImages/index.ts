import { gql } from 'graphql-tag';
import { z } from 'zod';
import { createGraphQLTool } from '@/mastra/utils/graphql/createGraphQLTool';
import evergreenClient from '../graphql/evergreenClient';

const LIST_IMAGES = gql`
  query Images {
    images
  }
`;

const listImagesInputSchema = z.object({});

const listImagesOutputSchema = z.object({
  images: z.array(z.string()),
});

const listImagesTool = createGraphQLTool<
  { images: string[] },
  Record<string, never>
>({
  id: 'listImages',
  description:
    'List all available image IDs from Evergreen. Use this to discover what images exist before querying specific image details with getImageTool.',
  query: LIST_IMAGES,
  inputSchema: listImagesInputSchema,
  outputSchema: listImagesOutputSchema,
  client: evergreenClient,
});

export default listImagesTool;
