/**
 * IcePanel API client
 */

import type { 
  ModelObjectsResponse, 
  ModelObjectResponse, 
  CatalogTechnologyResponse, 
  TeamsResponse, 
  ModelConnectionsResponse,
  CreateModelObjectRequest,
  UpdateModelObjectRequest,
  CreateTagRequest,
  UpdateTagRequest,
  TagResponse,
} from "./types.js";

// Base URL for the IcePanel API
// Use environment variable if set, otherwise default to production URL
const API_BASE_URL = process.env.ICEPANEL_API_BASE_URL || "https://api.icepanel.io/v1";

// Get the API key from environment variables
const API_KEY = process.env.API_KEY;

// Note: We don't check for API_KEY here as main.ts handles this

/**
 * Custom error class for IcePanel API errors with status code
 */
export class IcePanelApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: any
  ) {
    super(`IcePanel API error: ${status} ${statusText}`);
    this.name = 'IcePanelApiError';
  }
}

/**
 * Handle API errors with actionable messages per mcp-builder skill guidelines
 * 
 * @param error - The caught error
 * @returns A user-friendly error message with guidance
 */
export function handleApiError(error: unknown): string {
  if (error instanceof IcePanelApiError) {
    switch (error.status) {
      case 400:
        return "Error: Invalid request. Check that all required fields are provided and IDs are 20 characters. " + 
               (error.body?.message ? `Details: ${error.body.message}` : "");
      case 401:
        return "Error: Authentication failed. Verify your API_KEY is correct and has not expired.";
      case 403:
        return "Error: Permission denied. Your API key may only have read access. Generate a new key with write permissions.";
      case 404:
        return "Error: Resource not found. Verify the landscapeId and object IDs are correct. Use getModelObjects to find valid IDs.";
      case 409:
        return "Error: Conflict. The resource may have been modified by another user. Fetch the latest version and try again.";
      case 422:
        return "Error: Validation failed. " + (error.body?.message ? `Details: ${error.body.message}` : "Check input parameters.");
      case 429:
        return "Error: Rate limit exceeded. Wait a moment before retrying.";
      default:
        return `Error: API request failed (${error.status}). ${error.body?.message || error.statusText}`;
    }
  }
  return `Error: ${error instanceof Error ? error.message : String(error)}`;
}

/**
 * Make an authenticated request to the IcePanel API
 */
async function apiRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Authorization": `ApiKey ${API_KEY}`,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let body: any;
    try {
      body = await response.json();
    } catch {
      // Body not JSON, that's fine
    }
    throw new IcePanelApiError(response.status, response.statusText, body);
  }

  // Handle 204 No Content (for DELETE operations)
  if (response.status === 204) {
    return {} as T;
  }

  const data = await response.json();
  return data as T;
}

/**
 * Get all landscapes
 */
export async function getLandscapes(organizationId: string) {
  return apiRequest(`/organizations/${organizationId}/landscapes`);
}

/**
 * Get a specific landscape
 */
export async function getLandscape(organizationId: string, landscapeId: string) {
  return apiRequest(`/organizations/${organizationId}/landscapes/${landscapeId}`);
}

/**
 * Get a specific version
 */
export async function getVersion(landscapeId: string, versionId: string = "latest") {
  return apiRequest(`/landscapes/${landscapeId}/versions/${versionId}`);
}

/**
 * Get catalog technologies
 *
 * Retrieves a list of technologies from the IcePanel catalog
 *
 * @param options - Filter options for the catalog technologies
 * @param options.filter.provider - Filter by provider (aws, azure, gcp, etc.)
 * @param options.filter.type - Filter by technology type (data-storage, deployment, etc.)
 * @param options.filter.restrictions - Filter by restrictions (actor, app, component, etc.)
 * @param options.filter.status - Filter by status (approved, pending-review, rejected)
 * @returns Promise with catalog technologies response
 */
export async function getCatalogTechnologies(
  options: {
    filter?: {
      provider?: string | string[] | null,
      type?: string | string[] | null,
      restrictions?: string | string[],
      status?: string | string[]
    }
  } = {}
) {
  const params = new URLSearchParams();

  if (options.filter) {
    const filter = options.filter;

    // Convert filter object to query parameters
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          // Handle array values
          value.forEach(item => {
            params.append(`filter[${key}][]`, item);
          });
        } else if (value === null) {
          // Handle null values
          params.append(`filter[${key}]`, 'null');
        } else {
          // Handle simple values
          params.append(`filter[${key}]`, String(value));
        }
      }
    });
  }

  const queryString = params.toString();
  const url = `/catalog/technologies${queryString ? `?${queryString}` : ''}`;

  return apiRequest(url) as Promise<CatalogTechnologyResponse>;
}

/**
 * Get organization technologies
 *
 * Retrieves a list of technologies from an organization
 *
 * @param organizationId - The ID of the organization
 * @param options - Filter options for the organization technologies
 * @param options.filter.provider - Filter by provider (aws, azure, gcp, etc.)
 * @param options.filter.type - Filter by technology type (data-storage, deployment, etc.)
 * @param options.filter.restrictions - Filter by restrictions (actor, app, component, etc.)
 * @param options.filter.status - Filter by status (approved, pending-review, rejected)
 * @returns Promise with catalog technologies response
 */
export async function getOrganizationTechnologies(
  organizationId: string,
  options: {
    filter?: {
      provider?: string | string[] | null,
      type?: string | string[] | null,
      restrictions?: string | string[],
      status?: string | string[]
    }
  } = {}
) {
  const params = new URLSearchParams();

  if (options.filter) {
    const filter = options.filter;

    // Convert filter object to query parameters
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          // Handle array values
          value.forEach(item => {
            params.append(`filter[${key}][]`, item);
          });
        } else if (value === null) {
          // Handle null values
          params.append(`filter[${key}]`, 'null');
        } else {
          // Handle simple values
          params.append(`filter[${key}]`, String(value));
        }
      }
    });
  }

  const queryString = params.toString();
  const url = `/organizations/${organizationId}/technologies${queryString ? `?${queryString}` : ''}`;

  return apiRequest(url) as Promise<CatalogTechnologyResponse>;
}

/**
 * Get teams for an organization
 *
 * Retrieves a list of teams from an organization
 *
 * @param organizationId - The ID of the organization
 * @returns Promise with teams response
 */
export async function getTeams(organizationId: string) {
  return apiRequest(`/organizations/${organizationId}/teams`) as Promise<TeamsResponse>;
}

/**
 * Get all model objects for a landscape version
 */
export async function getModelObjects(
  landscapeId: string,
  versionId: string = "latest",
  options: { filter?: {
    domainId?: string | string[],
    external?: boolean,
    handleId?: string | string[],
    labels?: Record<string, string>,
    name?: string,
    parentId?: string | null,
    status?: string | string[],
    type?: string | string[]
  }} = {}
): Promise<ModelObjectsResponse> {
  const params = new URLSearchParams();

  if (options.filter) {
    const filter = options.filter;

    // Convert filter object to query parameters
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'labels' && typeof value === 'object') {
          // Handle labels object
          Object.entries(value as Record<string, string>).forEach(([labelKey, labelValue]) => {
            params.append(`filter[labels][${labelKey}]`, labelValue);
          });
        } else if (Array.isArray(value)) {
          // Handle array values
          value.forEach(item => {
            params.append(`filter[${key}][]`, item);
          });
        } else if (value === null) {
          // Handle null values
          params.append(`filter[${key}]`, 'null');
        } else {
          // Handle simple values
          params.append(`filter[${key}]`, String(value));
        }
      }
    });
  }

  const queryString = params.toString();
  const url = `/landscapes/${landscapeId}/versions/${versionId}/model/objects${queryString ? `?${queryString}` : ''}`;

  return apiRequest(url) as Promise<ModelObjectsResponse>;
}

/**
 * Get a specific model object
 */
export async function getModelObject(landscapeId: string, modelObjectId: string, versionId: string = "latest") {
  return apiRequest(`/landscapes/${landscapeId}/versions/${versionId}/model/objects/${modelObjectId}`) as Promise<ModelObjectResponse>;
}

/**
 * Get all model connections
 *
 * Retrieves a list of connections between model objects
 *
 * @param landscapeId - The ID of the landscape
 * @param versionId - The ID of the version (defaults to "latest")
 * @param options - Filter options for the model connections
 * @param options.filter.direction - Filter by connection direction (outgoing, bidirectional)
 * @param options.filter.handleId - Filter by handle ID
 * @param options.filter.labels - Filter by labels
 * @param options.filter.name - Filter by name
 * @param options.filter.originId - Filter by origin ID
 * @param options.filter.status - Filter by status (deprecated, future, live, removed)
 * @param options.filter.targetId - Filter by target ID
 * @returns Promise with model connections response
 */
export async function getModelConnections(
  landscapeId: string,
  versionId: string = "latest",
  options: {
    filter?: {
      direction?: 'outgoing' | 'bidirectional' | null,
      handleId?: string | string[],
      labels?: Record<string, string>,
      name?: string,
      originId?: string | string[],
      status?: ('deprecated' | 'future' | 'live' | 'removed') | ('deprecated' | 'future' | 'live' | 'removed')[],
      targetId?: string | string[]
    }
  } = {}
): Promise<ModelConnectionsResponse> {
  const params = new URLSearchParams();

  if (options.filter) {
    const filter = options.filter;

    // Convert filter object to query parameters
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'labels' && typeof value === 'object') {
          // Handle labels object
          Object.entries(value as Record<string, string>).forEach(([labelKey, labelValue]) => {
            params.append(`filter[labels][${labelKey}]`, labelValue);
          });
        } else if (Array.isArray(value)) {
          // Handle array values
          value.forEach(item => {
            params.append(`filter[${key}][]`, item);
          });
        } else if (value === null) {
          // Handle null values
          params.append(`filter[${key}]`, 'null');
        } else {
          // Handle simple values
          params.append(`filter[${key}]`, String(value));
        }
      }
    });
  }

  const queryString = params.toString();
  const url = `/landscapes/${landscapeId}/versions/${versionId}/model/connections${queryString ? `?${queryString}` : ''}`;

  return apiRequest(url) as Promise<ModelConnectionsResponse>;
}

/**
 * Get a specific connection
 */
export async function getConnection(landscapeId: string, versionId: string, connectionId: string) {
  return apiRequest(`/landscapes/${landscapeId}/versions/${versionId}/model/connections/${connectionId}`);
}

// ============================================================================
// Model Object Write Operations
// ============================================================================

/**
 * Create a new model object
 * 
 * @param landscapeId - The landscape ID
 * @param data - The model object data to create
 * @param versionId - The version ID (defaults to "latest")
 * @returns Promise with the created model object
 */
export async function createModelObject(
  landscapeId: string,
  data: CreateModelObjectRequest,
  versionId: string = "latest"
): Promise<ModelObjectResponse> {
  return apiRequest<ModelObjectResponse>(
    `/landscapes/${landscapeId}/versions/${versionId}/model/objects`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

/**
 * Update an existing model object
 * 
 * @param landscapeId - The landscape ID
 * @param modelObjectId - The model object ID to update
 * @param data - The fields to update
 * @param versionId - The version ID (defaults to "latest")
 * @returns Promise with the updated model object
 */
export async function updateModelObject(
  landscapeId: string,
  modelObjectId: string,
  data: UpdateModelObjectRequest,
  versionId: string = "latest"
): Promise<ModelObjectResponse> {
  return apiRequest<ModelObjectResponse>(
    `/landscapes/${landscapeId}/versions/${versionId}/model/objects/${modelObjectId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

/**
 * Delete a model object
 * 
 * @param landscapeId - The landscape ID
 * @param modelObjectId - The model object ID to delete
 * @param versionId - The version ID (defaults to "latest")
 * @returns Promise that resolves when deletion is complete
 */
export async function deleteModelObject(
  landscapeId: string,
  modelObjectId: string,
  versionId: string = "latest"
): Promise<void> {
  await apiRequest(
    `/landscapes/${landscapeId}/versions/${versionId}/model/objects/${modelObjectId}`,
    {
      method: "DELETE",
    }
  );
}

// ============================================================================
// Tag Write Operations
// ============================================================================

/**
 * Create a new tag
 * 
 * @param landscapeId - The landscape ID
 * @param data - The tag data to create
 * @param versionId - The version ID (defaults to "latest")
 * @returns Promise with the created tag
 */
export async function createTag(
  landscapeId: string,
  data: CreateTagRequest,
  versionId: string = "latest"
): Promise<TagResponse> {
  return apiRequest<TagResponse>(
    `/landscapes/${landscapeId}/versions/${versionId}/tags`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

/**
 * Update an existing tag
 * 
 * @param landscapeId - The landscape ID
 * @param tagId - The tag ID to update
 * @param data - The fields to update
 * @param versionId - The version ID (defaults to "latest")
 * @returns Promise with the updated tag
 */
export async function updateTag(
  landscapeId: string,
  tagId: string,
  data: UpdateTagRequest,
  versionId: string = "latest"
): Promise<TagResponse> {
  return apiRequest<TagResponse>(
    `/landscapes/${landscapeId}/versions/${versionId}/tags/${tagId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    }
  );
}

/**
 * Delete a tag
 * 
 * @param landscapeId - The landscape ID
 * @param tagId - The tag ID to delete
 * @param versionId - The version ID (defaults to "latest")
 * @returns Promise that resolves when deletion is complete
 */
export async function deleteTag(
  landscapeId: string,
  tagId: string,
  versionId: string = "latest"
): Promise<void> {
  await apiRequest(
    `/landscapes/${landscapeId}/versions/${versionId}/tags/${tagId}`,
    {
      method: "DELETE",
    }
  );
}
