/**
 * IcePanel API client
 */

import type {
  ModelObjectsResponse,
  ModelObjectResponse,
  CatalogTechnologyResponse,
  ModelConnectionsResponse,
  ModelConnectionResponse,
  CreateModelObjectRequest,
  UpdateModelObjectRequest,
  CreateConnectionRequest,
  UpdateConnectionRequest,
  CreateTagRequest,
  UpdateTagRequest,
  TagResponse,
  CreateDomainRequest,
  UpdateDomainRequest,
  DomainResponse,
} from "../types.js";

const DEFAULT_API_BASE_URL = "https://api.icepanel.io/v1";
const DEFAULT_API_TIMEOUT_MS = 30000;
const DEFAULT_API_MAX_RETRIES = 2;
const DEFAULT_API_RETRY_BASE_DELAY_MS = 300;
const MAX_API_RETRIES = 5;
const MAX_API_RETRY_BASE_DELAY_MS = 5000;

function parseEnvInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, min), max);
}

function isTruthyEnv(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "TRUE" || value === "yes" || value === "YES";
}

function getValidatedApiBaseUrl(): string {
  const raw = process.env.ICEPANEL_API_BASE_URL || DEFAULT_API_BASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("ICEPANEL_API_BASE_URL must be a valid URL");
  }

  const isInsecureAllowed = isTruthyEnv(process.env.ICEPANEL_API_ALLOW_INSECURE);
  if (parsed.protocol === "http:" && !isInsecureAllowed) {
    throw new Error("ICEPANEL_API_BASE_URL must use https unless ICEPANEL_API_ALLOW_INSECURE is true");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("ICEPANEL_API_BASE_URL must use http or https");
  }

  return parsed.toString().replace(/\/$/, "");
}

// Base URL for the IcePanel API
// Use environment variable if set, otherwise default to production URL
const API_BASE_URL = getValidatedApiBaseUrl();

function getApiKey(): string {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY environment variable is not set");
  }
  return apiKey;
}

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
    this.name = "IcePanelApiError";
  }
}

const API_TIMEOUT_MS = parseEnvInt("ICEPANEL_API_TIMEOUT_MS", DEFAULT_API_TIMEOUT_MS, 1000, 120000);
const API_MAX_RETRIES = parseEnvInt("ICEPANEL_API_MAX_RETRIES", DEFAULT_API_MAX_RETRIES, 0, MAX_API_RETRIES);
const API_RETRY_BASE_DELAY_MS = parseEnvInt(
  "ICEPANEL_API_RETRY_BASE_DELAY_MS",
  DEFAULT_API_RETRY_BASE_DELAY_MS,
  50,
  MAX_API_RETRY_BASE_DELAY_MS
);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isRetryableError(error: unknown, externalAbort: boolean): boolean {
  if (externalAbort) {
    return false;
  }
  if (error instanceof IcePanelApiError) {
    return isRetryableStatus(error.status);
  }
  if (error instanceof Error) {
    return error.name === "AbortError" || error instanceof TypeError;
  }
  return false;
}

function getRetryDelay(attempt: number): number {
  const delay = API_RETRY_BASE_DELAY_MS * Math.pow(2, attempt);
  return Math.min(delay, MAX_API_RETRY_BASE_DELAY_MS);
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
        return "Error: Resource not found. Verify the landscapeId and object IDs are correct. Use icepanel_list_model_objects to find valid IDs.";
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
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `ApiKey ${getApiKey()}`,
    ...options.headers,
  };

  const method = (options.method || "GET").toUpperCase();
  const canRetry = method === "GET" || method === "HEAD";

  for (let attempt = 0; attempt <= API_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const abortListener = () => controller.abort();

    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort();
      } else {
        options.signal.addEventListener("abort", abortListener, { once: true });
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const rawText = await response.text();
        let body: any;
        try {
          body = JSON.parse(rawText);
        } catch {
          body = rawText || undefined;
        }

        const apiError = new IcePanelApiError(response.status, response.statusText, body);
        if (canRetry && attempt < API_MAX_RETRIES && isRetryableStatus(response.status)) {
          await sleep(getRetryDelay(attempt));
          continue;
        }
        throw apiError;
      }

      // Handle 204 No Content (for DELETE operations)
      if (response.status === 204) {
        return {} as T;
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (canRetry && attempt < API_MAX_RETRIES && isRetryableError(error, options.signal?.aborted ?? false)) {
        await sleep(getRetryDelay(attempt));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (options.signal) {
        options.signal.removeEventListener("abort", abortListener);
      }
    }
  }

  throw new Error("Unexpected error in apiRequest");
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

    if (key === "labels" && typeof value === "object" && value !== null) {
      // Handle labels object
      Object.entries(value as Record<string, string>).forEach(([labelKey, labelValue]) => {
        params.append(`filter[labels][${labelKey}]`, labelValue);
      });
    } else if (Array.isArray(value)) {
      // Handle array values
      value.forEach((item) => {
        params.append(`filter[${key}][]`, String(item));
      });
    } else if (value === null) {
      // Handle null values
      params.append(`filter[${key}]`, "null");
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
      provider?: string | string[] | null;
      type?: string | string[] | null;
      restrictions?: string | string[];
      status?: string | string[];
    };
  } = {}
) {
  const params = options.filter ? buildFilterParams(options.filter) : new URLSearchParams();
  const queryString = params.toString();
  const url = `/catalog/technologies${queryString ? `?${queryString}` : ""}`;

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
      provider?: string | string[] | null;
      type?: string | string[] | null;
      restrictions?: string | string[];
      status?: string | string[];
    };
  } = {}
) {
  const params = options.filter ? buildFilterParams(options.filter) : new URLSearchParams();
  const queryString = params.toString();
  const url = `/organizations/${organizationId}/technologies${queryString ? `?${queryString}` : ""}`;

  return apiRequest(url) as Promise<CatalogTechnologyResponse>;
}

/**
 * Get all model objects for a landscape version
 */
export async function getModelObjects(
  landscapeId: string,
  versionId: string = "latest",
  options: {
    filter?: {
      domainId?: string | string[];
      external?: boolean;
      handleId?: string | string[];
      labels?: Record<string, string>;
      name?: string;
      parentId?: string | null;
      status?: string | string[];
      type?: string | string[];
    };
  } = {}
): Promise<ModelObjectsResponse> {
  const params = options.filter ? buildFilterParams(options.filter) : new URLSearchParams();
  const queryString = params.toString();
  const url = `/landscapes/${landscapeId}/versions/${versionId}/model/objects${queryString ? `?${queryString}` : ""}`;

  return apiRequest(url) as Promise<ModelObjectsResponse>;
}

/**
 * Get a specific model object
 */
export async function getModelObject(
  landscapeId: string,
  modelObjectId: string,
  versionId: string = "latest"
) {
  return apiRequest(
    `/landscapes/${landscapeId}/versions/${versionId}/model/objects/${modelObjectId}`
  ) as Promise<ModelObjectResponse>;
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
      direction?: "outgoing" | "bidirectional" | null;
      handleId?: string | string[];
      labels?: Record<string, string>;
      name?: string;
      originId?: string | string[];
      status?: ("deprecated" | "future" | "live" | "removed") | ("deprecated" | "future" | "live" | "removed")[];
      targetId?: string | string[];
    };
  } = {}
): Promise<ModelConnectionsResponse> {
  const params = options.filter ? buildFilterParams(options.filter) : new URLSearchParams();
  const queryString = params.toString();
  const url = `/landscapes/${landscapeId}/versions/${versionId}/model/connections${queryString ? `?${queryString}` : ""}`;

  return apiRequest(url) as Promise<ModelConnectionsResponse>;
}

/**
 * Get a specific connection
 */
export async function getConnection(
  landscapeId: string,
  versionId: string,
  connectionId: string
): Promise<ModelConnectionResponse> {
  return apiRequest(
    `/landscapes/${landscapeId}/versions/${versionId}/model/connections/${connectionId}`
  ) as Promise<ModelConnectionResponse>;
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
// Connection Write Operations
// ============================================================================

export async function createConnection(
  landscapeId: string,
  data: CreateConnectionRequest,
  versionId: string = "latest"
): Promise<ModelConnectionResponse> {
  return apiRequest<ModelConnectionResponse>(
    `/landscapes/${landscapeId}/versions/${versionId}/model/connections`,
    { method: "POST", body: JSON.stringify(data) }
  );
}

export async function updateConnection(
  landscapeId: string,
  connectionId: string,
  data: UpdateConnectionRequest,
  versionId: string = "latest"
): Promise<ModelConnectionResponse> {
  return apiRequest<ModelConnectionResponse>(
    `/landscapes/${landscapeId}/versions/${versionId}/model/connections/${connectionId}`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

export async function deleteConnection(
  landscapeId: string,
  connectionId: string,
  versionId: string = "latest"
): Promise<void> {
  await apiRequest(
    `/landscapes/${landscapeId}/versions/${versionId}/model/connections/${connectionId}`,
    { method: "DELETE" }
  );
}

// ============================================================================
// Tag Write Operations
// ============================================================================

export async function createTag(
  landscapeId: string,
  data: CreateTagRequest,
  versionId: string = "latest"
): Promise<TagResponse> {
  return apiRequest<TagResponse>(
    `/landscapes/${landscapeId}/versions/${versionId}/tags`,
    { method: "POST", body: JSON.stringify(data) }
  );
}

export async function updateTag(
  landscapeId: string,
  tagId: string,
  data: UpdateTagRequest,
  versionId: string = "latest"
): Promise<TagResponse> {
  return apiRequest<TagResponse>(
    `/landscapes/${landscapeId}/versions/${versionId}/tags/${tagId}`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

export async function deleteTag(
  landscapeId: string,
  tagId: string,
  versionId: string = "latest"
): Promise<void> {
  await apiRequest(
    `/landscapes/${landscapeId}/versions/${versionId}/tags/${tagId}`,
    { method: "DELETE" }
  );
}

// ============================================================================
// Domain Write Operations
// ============================================================================

export async function createDomain(
  landscapeId: string,
  data: CreateDomainRequest,
  versionId: string = "latest"
): Promise<DomainResponse> {
  return apiRequest<DomainResponse>(
    `/landscapes/${landscapeId}/versions/${versionId}/domains`,
    { method: "POST", body: JSON.stringify(data) }
  );
}

export async function updateDomain(
  landscapeId: string,
  domainId: string,
  data: UpdateDomainRequest,
  versionId: string = "latest"
): Promise<DomainResponse> {
  return apiRequest<DomainResponse>(
    `/landscapes/${landscapeId}/versions/${versionId}/domains/${domainId}`,
    { method: "PATCH", body: JSON.stringify(data) }
  );
}

export async function deleteDomain(
  landscapeId: string,
  domainId: string,
  versionId: string = "latest"
): Promise<void> {
  await apiRequest(
    `/landscapes/${landscapeId}/versions/${versionId}/domains/${domainId}`,
    { method: "DELETE" }
  );
}
