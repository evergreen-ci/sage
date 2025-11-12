import { config } from '@/config';
import logger from '@/utils/logger';

/** Client error for Runtime Environments API issues */
export class RuntimeEnvironmentsClientError extends Error {
  readonly statusCode?: number;
  readonly responseBody?: unknown;
  override readonly cause?: unknown;

  constructor(
    msg: string,
    opts?: {
      statusCode?: number;
      responseBody?: unknown;
      cause?: unknown;
    }
  ) {
    super(msg);
    this.name = 'RuntimeEnvironmentsClientError';
    if (opts?.statusCode !== undefined) {
      this.statusCode = opts.statusCode;
    }
    this.responseBody = opts?.responseBody;
    this.cause = opts?.cause;
  }
}

/** Base response structure with pagination */
interface PaginatedResponse<T> {
  data: T[];
  filtered_count: number;
  total_count: number;
}

/** Operating System information */
export interface OSInfo {
  name: string;
  version: string;
}

/** Package information */
export interface Package {
  name: string;
  version: string;
  manager: string;
}

/** Toolchain information */
export interface Toolchain {
  name: string;
  version: string;
  manager: string;
}

/** File information */
export interface FileInfo {
  name: string;
  version: string; // SHA-256 hash
  manager: string; // File path
}

/** Image difference change */
export interface ImageDiffChange {
  name: string;
  before_version: string;
  after_version: string;
  manager: string;
  type: 'OS' | 'Packages' | 'Toolchains' | 'Files';
}

/** Image history information */
export interface ImageHistoryInfo {
  ami_id: string;
  created_date: number; // Unix timestamp
}

/** Distro image basic information */
export interface DistroImage {
  id: string;
  ami: string;
  last_deployed: string; // ISO 8601 timestamp
}

/** Image event entry action types */
export type ImageEventEntryAction = 'ADDED' | 'UPDATED' | 'DELETED';

/** Image event types */
export type ImageEventType = 'OS' | 'Packages' | 'Toolchains' | 'Files';

/** Image event entry */
export interface ImageEventEntry {
  name: string;
  before: string;
  after: string;
  type: ImageEventType;
  action: ImageEventEntryAction;
}

/** Image event */
export interface ImageEvent {
  entries: ImageEventEntry[];
  timestamp: Date;
  ami_before: string;
  ami_after: string;
}

/** Filter options for OS info */
export interface OSInfoFilterOptions {
  /** Image name (e.g., "ubuntu2204") - mutually exclusive with id */
  name?: string;
  /** AMI ID (e.g., "ami-12345678") - mutually exclusive with name */
  id?: string;
  /** Filter by OS name (e.g., "Ubuntu") */
  osName?: string;
  page?: number;
  limit?: number;
}

/** Filter options for packages */
export interface PackageFilterOptions {
  /** Image name (e.g., "ubuntu2204") - mutually exclusive with id */
  name?: string;
  /** AMI ID (e.g., "ami-12345678") - mutually exclusive with name */
  id?: string;
  /** Filter by package name (e.g., "python", "numpy") */
  packageName?: string;
  /** Filter by package manager (e.g., "pip", "apt", "npm") */
  manager?: string;
  page?: number;
  limit?: number;
}

/** Filter options for toolchains */
export interface ToolchainFilterOptions {
  /** Image name (e.g., "ubuntu2204") - mutually exclusive with id */
  name?: string;
  /** AMI ID (e.g., "ami-12345678") - mutually exclusive with name */
  id?: string;
  /** Filter by toolchain name (e.g., "golang", "python") */
  toolchainName?: string;
  /** Filter by toolchain version (e.g., "1.20.0") */
  version?: string;
  page?: number;
  limit?: number;
}

/** Filter options for files */
export interface FileFilterOptions {
  /** Image name (e.g., "ubuntu2204") - mutually exclusive with id */
  name?: string;
  /** AMI ID (e.g., "ami-12345678") - mutually exclusive with name */
  id?: string;
  /** Filter by file name (e.g., "certificate.pem") */
  fileName?: string;
  page?: number;
  limit?: number;
}

/** Filter options for image events */
export interface EventHistoryOptions {
  image: string;
  page?: number;
  limit: number;
}

/**
 * Client for interacting with the Evergreen Runtime Environments Image Visibility API
 */
export class RuntimeEnvironmentsClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Build query string from parameters
   * @param params - Key-value pairs of query parameters
   * @returns Query string starting with '?', or empty string if no params
   */
  private buildQueryString(params: Record<string, string | number>): string {
    const filteredParams = Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    );
    if (filteredParams.length === 0) return '';
    const searchParams = new URLSearchParams(
      filteredParams.map(
        ([key, value]) => [key, String(value)] as [string, string]
      )
    );
    return `?${searchParams.toString()}`;
  }

  /**
   * Execute HTTP GET request to the API
   * @param path - API endpoint path
   * @param params - Optional query parameters
   * @returns Parsed JSON response of type T
   * @throws {RuntimeEnvironmentsClientError} on HTTP or network errors
   */
  private async get<T>(
    path: string,
    params?: Record<string, string | number>
  ): Promise<T> {
    const queryString = params ? this.buildQueryString(params) : '';
    const url = `${this.baseUrl}/rest/api/v1/ami${path}${queryString}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error('Runtime Environments API error', {
          statusCode: response.status,
          statusText: response.statusText,
          body: errorBody,
          path,
        });
        throw new RuntimeEnvironmentsClientError(
          `HTTP ${response.status}: ${errorBody || response.statusText}`,
          {
            statusCode: response.status,
            responseBody: errorBody,
          }
        );
      }

      const data = await response.json();
      return data as T;
    } catch (err) {
      if (err instanceof RuntimeEnvironmentsClientError) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new RuntimeEnvironmentsClientError(`Network error: ${msg}`, {
        cause: err,
      });
    }
  }

  /**
   * Get all available AMI image names
   * @returns List of image names
   */
  async getImageNames(): Promise<string[]> {
    return this.get<string[]>('/list');
  }

  /**
   * Get operating system information for a specific AMI or image
   * @param options - Filter options
   * @returns Paginated response of OSInfo
   */
  async getOSInfo(
    options: OSInfoFilterOptions
  ): Promise<PaginatedResponse<OSInfo>> {
    const params: Record<string, string | number> = {};

    // Add either name or id (mutually exclusive)
    if (options.name) {
      params.name = options.name;
    } else if (options.id) {
      params.id = options.id;
    }

    if (options.osName) params.data_name = options.osName;
    if (options.page !== undefined) params.page = options.page;
    if (options.limit !== undefined) params.limit = options.limit;

    return this.get<PaginatedResponse<OSInfo>>('/os', params);
  }

  /**
   * Get installed packages for a specific AMI or image
   * @param options - Filter options
   * @returns Paginated response of Packages
   */
  async getPackages(
    options: PackageFilterOptions
  ): Promise<PaginatedResponse<Package>> {
    const params: Record<string, string | number> = {};

    // Add either name or id (mutually exclusive)
    if (options.name) {
      params.name = options.name;
    } else if (options.id) {
      params.id = options.id;
    }

    if (options.packageName) params.data_name = options.packageName;
    if (options.manager) params.data_manager = options.manager;
    if (options.page !== undefined) params.page = options.page;
    if (options.limit !== undefined) params.limit = options.limit;

    return this.get<PaginatedResponse<Package>>('/packages', params);
  }

  /**
   * Get installed toolchains for a specific AMI or image
   * @param options - Filter options
   * @returns Paginated response of Toolchains
   */
  async getToolchains(
    options: ToolchainFilterOptions
  ): Promise<PaginatedResponse<Toolchain>> {
    const params: Record<string, string | number> = {};

    // Add either name or id (mutually exclusive)
    if (options.name) {
      params.name = options.name;
    } else if (options.id) {
      params.id = options.id;
    }

    if (options.toolchainName) params.data_name = options.toolchainName;
    if (options.version) params.data_version = options.version;
    if (options.page !== undefined) params.page = options.page;
    if (options.limit !== undefined) params.limit = options.limit;

    return this.get<PaginatedResponse<Toolchain>>('/toolchains', params);
  }

  /**
   * Get files present in a specific AMI or image
   * @param options - Filter options
   * @returns Paginated response of FileInfo
   */
  async getFiles(
    options: FileFilterOptions
  ): Promise<PaginatedResponse<FileInfo>> {
    const params: Record<string, string | number> = {};

    // Add either name or id (mutually exclusive)
    if (options.name) {
      params.name = options.name;
    } else if (options.id) {
      params.id = options.id;
    }

    if (options.fileName) params.data_name = options.fileName;
    if (options.page !== undefined) params.page = options.page;
    if (options.limit !== undefined) params.limit = options.limit;

    return this.get<PaginatedResponse<FileInfo>>('/files', params);
  }

  /**
   * Compare two AMI versions to see changes
   * @param beforeAmiId - AMI ID before changes (e.g., "ami-12345678")
   * @param afterAmiId - AMI ID after changes (e.g., "ami-87654321")
   * @returns List of ImageDiffChange
   */
  async getImageDiff(
    beforeAmiId: string,
    afterAmiId: string
  ): Promise<ImageDiffChange[]> {
    const params = {
      before_id: beforeAmiId,
      after_id: afterAmiId,
      limit: 1000000000, // Get all changes
    };

    const response = await this.get<PaginatedResponse<ImageDiffChange>>(
      '/diff',
      params
    );
    return response.data;
  }

  /**
   * Get historical AMI versions for an image
   * @param imageId - Image identifier
   * @param page - Optional page number
   * @param limit - Optional number of results per page
   * @returns Paginated response of ImageHistoryInfo
   */
  async getImageHistory(
    imageId: string,
    page?: number,
    limit?: number
  ): Promise<PaginatedResponse<ImageHistoryInfo>> {
    const params: Record<string, string | number> = {
      name: imageId,
    };
    if (page !== undefined) params.page = page;
    if (limit !== undefined) params.limit = limit;

    return this.get<PaginatedResponse<ImageHistoryInfo>>('/history', params);
  }

  /**
   * Get basic image information (current AMI and last deployed time)
   * @param imageId - Image identifier
   * @returns DistroImage or null if not found
   */
  async getImageInfo(imageId: string): Promise<DistroImage | null> {
    try {
      const history = await this.getImageHistory(imageId, 0, 1);
      if (history.data.length === 0) {
        return null;
      }

      const latest = history.data[0];
      return {
        id: imageId,
        ami: latest.ami_id,
        last_deployed: new Date(latest.created_date * 1000).toISOString(),
      };
    } catch (err) {
      logger.error('Failed to get image info', { imageId, error: err });
      return null;
    }
  }

  /**
   * Get chronological change events between AMI versions
   * @param options - Event history options
   * @returns List of ImageEvent
   */
  async getEvents(options: EventHistoryOptions): Promise<ImageEvent[]> {
    const history = await this.getImageHistory(
      options.image,
      options.page,
      options.limit + 1 // Get one extra to compare
    );

    if (history.data.length < 2) {
      return [];
    }

    const events: ImageEvent[] = [];

    // Compare consecutive AMI versions
    for (let i = 0; i < history.data.length - 1; i++) {
      const after = history.data[i];
      const before = history.data[i + 1];

      // eslint-disable-next-line no-await-in-loop
      const changes = await this.getImageDiff(before.ami_id, after.ami_id);
      const entries = this.convertDiffToEventEntries(changes);

      events.push({
        entries,
        timestamp: new Date(after.created_date * 1000),
        ami_before: before.ami_id,
        ami_after: after.ami_id,
      });
    }

    return events;
  }

  /**
   * Convert diff changes to event entries with actions
   * @param changes - List of ImageDiffChange
   * @returns List of ImageEventEntry
   */
  private convertDiffToEventEntries(
    changes: ImageDiffChange[]
  ): ImageEventEntry[] {
    return changes.map(change => {
      let action: ImageEventEntryAction;
      if (!change.before_version || change.before_version === '') {
        action = 'ADDED';
      } else if (!change.after_version || change.after_version === '') {
        action = 'DELETED';
      } else {
        action = 'UPDATED';
      }

      return {
        name: change.name,
        before: change.before_version,
        after: change.after_version,
        type: change.type,
        action,
      };
    });
  }
}

/** Singleton instance using config */
const runtimeEnvironmentsClient = new RuntimeEnvironmentsClient(
  config.runtimeEnvironments.apiURL
);

export default runtimeEnvironmentsClient;
