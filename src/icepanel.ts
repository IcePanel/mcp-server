/**
 * IcePanel API client
 */

import type { ModelObjectsResponse, ModelObjectResponse, CatalogTechnologyResponse, TeamsResponse, ModelConnectionsResponse } from "./types.js";

// Base URL for the IcePanel API
// Use environment variable if set, otherwise default to production URL
const API_BASE_URL = process.env.ICEPANEL_API_BASE_URL || "https://api.icepanel.io/v1";

// Get the API key from environment variables
const API_KEY = process.env.API_KEY;

// Note: We don't check for API_KEY here as main.ts handles this

/**
 * Make an authenticated request to the IcePanel API
 */
async function apiRequest(path: string, options: RequestInit = {}) {
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
    throw new Error(`IcePanel API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Build URLSearchParams from a filter object
 *
 * Converts a filter object to query parameters in the format expected by the IcePanel API.
 * Handles arrays, null values, labels objects, and simple values.
 *
 * @param filter - The filter object to convert
 * @returns URLSearchParams ready to be appended to a URL
 */
function buildFilterParams(filter: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();

  Object.entries(filter).forEach(([key, value]) => {
    if (value === undefined) return;

    if (key === 'labels' && typeof value === 'object' && value !== null) {
      // Handle labels object
      Object.entries(value as Record<string, string>).forEach(([labelKey, labelValue]) => {
        params.append(`filter[labels][${labelKey}]`, labelValue);
      });
    } else if (Array.isArray(value)) {
      // Handle array values
      value.forEach(item => {
        params.append(`filter[${key}][]`, String(item));
      });
    } else if (value === null) {
      // Handle null values
      params.append(`filter[${key}]`, 'null');
    } else {
      // Handle simple values
      params.append(`filter[${key}]`, String(value));
    }
  });

  return params;
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
  const params = options.filter ? buildFilterParams(options.filter) : new URLSearchParams();
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
  const params = options.filter ? buildFilterParams(options.filter) : new URLSearchParams();
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
  const params = options.filter ? buildFilterParams(options.filter) : new URLSearchParams();
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
  const params = options.filter ? buildFilterParams(options.filter) : new URLSearchParams();
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
