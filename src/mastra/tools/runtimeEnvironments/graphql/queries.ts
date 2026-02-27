import { gql } from 'graphql-tag';

export const GET_IMAGES = gql`
  query GetImages {
    images
  }
`;

export const GET_IMAGE_OS = gql`
  query GetImageOS($imageId: String!, $opts: OperatingSystemOpts!) {
    image(imageId: $imageId) {
      operatingSystem(opts: $opts) {
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

export const GET_IMAGE_PACKAGES = gql`
  query GetImagePackages($imageId: String!, $opts: PackageOpts!) {
    image(imageId: $imageId) {
      packages(opts: $opts) {
        data {
          name
          manager
          version
        }
        filteredCount
        totalCount
      }
    }
  }
`;

export const GET_IMAGE_TOOLCHAINS = gql`
  query GetImageToolchains($imageId: String!, $opts: ToolchainOpts!) {
    image(imageId: $imageId) {
      toolchains(opts: $opts) {
        data {
          name
          path
          version
        }
        filteredCount
        totalCount
      }
    }
  }
`;

export const GET_IMAGE_FILES = gql`
  query GetImageFiles($imageId: String!, $opts: ImageFileOpts!) {
    image(imageId: $imageId) {
      files(opts: $opts) {
        data {
          name
          path
          version
        }
        filteredCount
        totalCount
      }
    }
  }
`;

export const GET_IMAGE_EVENTS = gql`
  query GetImageEvents($imageId: String!, $limit: Int!, $page: Int!) {
    image(imageId: $imageId) {
      events(limit: $limit, page: $page) {
        count
        eventLogEntries {
          timestamp
          amiBefore
          amiAfter
          entries {
            name
            before
            after
            type
            action
          }
        }
      }
    }
  }
`;

export const GET_IMAGE_HISTORY = gql`
  query GetImageHistory($imageId: String!, $limit: Int!, $page: Int!) {
    image(imageId: $imageId) {
      events(limit: $limit, page: $page) {
        count
        eventLogEntries {
          timestamp
          amiBefore
          amiAfter
        }
      }
    }
  }
`;
