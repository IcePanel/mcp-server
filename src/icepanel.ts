/**
 * IcePanel API client
 */

// Base URL for the IcePanel API
const API_BASE_URL = "https://api.icepanel.io/v1";

// Get the API key from environment variables
const API_KEY = process.env.ICEPANEL_API_KEY;

if (!API_KEY) {
  console.error("ICEPANEL_API_KEY environment variable is not set");
}

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
) {
  const params = new URLSearchParams();
  
  if (options.filter) {
    const filter = options.filter;
    
    // Convert filter object to query parameters
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'labels' && typeof value === 'object') {
          // Handle labels object
          Object.entries(value).forEach(([labelKey, labelValue]) => {
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
  
  return apiRequest(url);
}

/**
 * Get a specific model object
 */
export async function getModelObject(landscapeId: string, modelObjectId: string, versionId: string = "latest") {
  return apiRequest(`/landscapes/${landscapeId}/versions/${versionId}/model/objects/${modelObjectId}`);
}

/**
 * Get all connections
 */
export async function getConnections(landscapeId: string, versionId: string) {
  return apiRequest(`/landscapes/${landscapeId}/versions/${versionId}/model/connections`);
}

/**
 * Get a specific connection
 */
export async function getConnection(landscapeId: string, versionId: string, connectionId: string) {
  return apiRequest(`/landscapes/${landscapeId}/versions/${versionId}/model/connections/${connectionId}`);
}
