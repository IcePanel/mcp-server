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
  status: 'deprecated';
  tagIds: string[];
  teamIds: string[];
  teamOnlyEditing: boolean;
  technologyIds: string[];
  type: 'actor';
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

export interface ModelObjectsResponse {
  modelObjects: ModelObject[];
}

export interface ModelObjectResponse {
  modelObject: ModelObject;
}
