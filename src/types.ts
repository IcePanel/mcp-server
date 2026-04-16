export interface Icon {
  catalogTechnologyId: string;
  name: string;
  url: string;
  urlDark: string[];
  urlLight: string[];
}

export interface ModelObject {
  caption: string;
  commit: number;
  description: string;
  external: boolean;
  groupIds: string[];
  icon: Icon;
  labels: Record<string, any>;
  links: Record<string, any>;
  name: string;
  parentId: string;
  status: 'deprecated' | 'future' | 'live' | 'removed';
  tagIds: string[];
  teamIds: string[];
  teamOnlyEditing: boolean;
  technologyIds: string[];
  type: 'actor' | 'app' | 'component' | 'group' | 'root' | 'store' | 'system';
  domainId: string;
  handleId: string;
  childDiagramIds: string[];
  childIds: string[];
  createdAt: string;
  createdBy: string;
  createdById: string;
  deletedAt: string;
  deletedBy: string;
  deletedById: string;
  diagrams: Record<string, any>;
  flows: Record<string, any>;
  id: string;
  landscapeId: string;
  parentIds: string[];
  technologies: Record<string, any>;
  updatedAt: string;
  updatedBy: string;
  updatedById: string;
  version: number;
  versionId: string;
}

export interface CatalogTechnology {
  category: string;
  color: string;
  deprecatedAt: string;
  description: string;
  docsUrl: string;
  iconUrlDark: string[];
  iconUrlLight: string[];
  name: string;
  nameShort: string;
  provider: string;
  rejectionMessage: string;
  rejectionReason: string;
  restrictions: string[];
  status: string;
  type: string;
  updatesUrl: string;
  websiteUrl: string;
  awsXmlSelector: string;
  azureUpdatesKeyword: string;
  createdAt: string;
  createdBy: string;
  createdById: string;
  defaultSlug: string;
  deletedAt: string;
  deletedBy: string;
  deletedById: string;
  disabled: boolean;
  iconUrl: string;
  id: string;
  organizationId: string;
  slugs: string[];
  updatedAt: string;
  updatedBy: string;
  updatedById: string;
  updatesXmlUrl: string;
}

export interface ModelObjectsResponse {
  modelObjects: ModelObject[];
}

export interface ModelObjectResponse {
  modelObject: ModelObject;
}

export interface CatalogTechnologyResponse {
  catalogTechnologies: CatalogTechnology[];
}

export interface Team {
  color: string;
  name: string;
  userIds: string[];
  createdAt: string;
  createdBy: string;
  createdById: string;
  id: string;
  modelObjectHandleIds: string[];
  organizationId: string;
  updatedAt: string;
  updatedBy: string;
  updatedById: string;
}

export interface TeamsResponse {
  teams: Team[];
}

export interface ModelConnectionDirection {
  direction: 'outgoing' | 'bidirectional' | null;
}

export interface ModelConnectionDiagram {
  connectionId: string;
  id: string;
  originModelId: string;
  targetModelId: string;
}

export interface ModelConnectionFlow {
  id: string;
  stepId: string;
}

export interface ModelConnection {
  commit: number;
  description?: string;
  direction: 'outgoing' | 'bidirectional' | null;
  labels: Record<string, string>;
  name: string;
  originId: string;
  status: 'deprecated' | 'future' | 'live' | 'removed';
  tagIds: string[];
  targetId: string;
  technologyIds: string[];
  handleId: string;
  createdAt: string;
  createdBy: 'user' | 'api-key' | 'notification-key' | 'service';
  createdById: string;
  deletedAt?: string;
  deletedBy?: 'user' | 'api-key' | 'notification-key' | 'service';
  deletedById?: string;
  diagrams: Record<string, ModelConnectionDiagram>;
  flows: Record<string, ModelConnectionFlow>;
  id: string;
  landscapeId: string;
  updatedAt: string;
  updatedBy: 'user' | 'api-key' | 'notification-key' | 'service';
  updatedById: string;
  version: number;
  versionId: string;
}

export interface ModelConnectionsResponse {
  modelConnections: ModelConnection[];
}

export interface ModelConnectionResponse {
  modelConnection: ModelConnection;
}

// ============================================================================
// Write Operation Types
// ============================================================================

/**
 * Request body for creating a model object
 */
export interface CreateModelObjectRequest {
  name: string;
  parentId: string;
  type: 'actor' | 'app' | 'component' | 'group' | 'store' | 'system';
  caption?: string;
  description?: string;
  external?: boolean;
  status?: 'deprecated' | 'future' | 'live' | 'removed';
  groupIds?: string[];
  labels?: Record<string, string>;
  links?: Record<string, { name: string; url: string }>;
  tagIds?: string[];
  teamIds?: string[];
  teamOnlyEditing?: boolean;
  technologyIds?: string[];
  domainId?: string;
  handleId?: string;
}

/**
 * Request body for updating a model object (all fields optional)
 */
export interface UpdateModelObjectRequest {
  name?: string;
  parentId?: string | null;
  type?: 'actor' | 'app' | 'component' | 'group' | 'store' | 'system';
  caption?: string;
  description?: string;
  external?: boolean;
  status?: 'deprecated' | 'future' | 'live' | 'removed';
  groupIds?: string[];
  labels?: Record<string, string>;
  links?: Record<string, { name: string; url: string }>;
  tagIds?: string[];
  teamIds?: string[];
  teamOnlyEditing?: boolean;
  technologyIds?: string[];
}

/**
 * Request body for creating a model connection
 */
export interface CreateConnectionRequest {
  name: string;
  originId: string;
  targetId: string;
  direction: 'outgoing' | 'bidirectional' | null;
  description?: string;
  status?: 'deprecated' | 'future' | 'live' | 'removed';
  labels?: Record<string, string>;
  tagIds?: string[];
  technologyIds?: string[];
}

/**
 * Request body for updating a model connection
 */
export interface UpdateConnectionRequest {
  name?: string;
  direction?: 'outgoing' | 'bidirectional' | null;
  description?: string;
  status?: 'deprecated' | 'future' | 'live' | 'removed';
  labels?: Record<string, string>;
  tagIds?: string[];
  technologyIds?: string[];
}

/**
 * Request body for creating a team
 */
export interface CreateTeamRequest {
  name: string;
  color?: string;
}

/**
 * Request body for updating a team
 */
export interface UpdateTeamRequest {
  name?: string;
  color?: string;
}

/**
 * Response for single team
 */
export interface TeamResponse {
  team: Team;
}

/**
 * Tag entity
 */
export interface Tag {
  id: string;
  name: string;
  color?: string;
  landscapeId: string;
  tagGroupId?: string;
}

/**
 * Request body for creating a tag
 */
export interface CreateTagRequest {
  name: string;
  color?: string;
  tagGroupId?: string;
}

/**
 * Request body for updating a tag
 */
export interface UpdateTagRequest {
  name?: string;
  color?: string;
}

/**
 * Response for single tag
 */
export interface TagResponse {
  tag: Tag;
}

/**
 * Domain entity
 */
export interface Domain {
  id: string;
  name: string;
  color?: string;
  landscapeId: string;
}

/**
 * Request body for creating a domain
 */
export interface CreateDomainRequest {
  name: string;
  color?: string;
}

/**
 * Request body for updating a domain
 */
export interface UpdateDomainRequest {
  name?: string;
  color?: string;
}

/**
 * Response for single domain
 */
export interface DomainResponse {
  domain: Domain;
}
