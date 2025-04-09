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
 * Get all versions for a landscape
 */
export async function getVersions(landscapeId: string) {
  return apiRequest(`/landscapes/${landscapeId}/versions`);
}

/**
 * Get a specific version
 */
export async function getVersion(landscapeId: string, versionId: string) {
  return apiRequest(`/landscapes/${landscapeId}/versions/${versionId}`);
}

/**
 * Get all model objects for a landscape version
 */
export async function getModelObjects(landscapeId: string, versionId: string) {
  return apiRequest(`/landscapes/${landscapeId}/versions/${versionId}/model/objects`);
}

/**
 * Get a specific model object
 */
export async function getModelObject(landscapeId: string, versionId: string, modelObjectId: string) {
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
