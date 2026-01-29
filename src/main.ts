import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as icepanel from "./icepanel.js";
import { handleApiError } from "./icepanel.js";
import { formatCatalogTechnology, formatConnections, formatModelObjectItem, formatModelObjectListItem, formatTeam } from "./format.js";
import { startHttpServer } from "./http-server.js";
import Fuse from 'fuse.js';

// Get API key and organization ID from environment variables
const API_KEY = process.env.API_KEY;
const ORGANIZATION_ID = process.env.ORGANIZATION_ID;

if (!API_KEY) {
  console.error("API_KEY environment variable is not set");
  process.exit(1);
}

if (!ORGANIZATION_ID) {
  console.error("ORGANIZATION_ID environment variable is not set");
  process.exit(1);
}

// Create an MCP server
const server = new McpServer({
  name: "IcePanel MCP Server",
  version: "0.2.0",
});

// Get all landscapes
server.tool(
  "getLandscapes",
  "Get all your landscapes from IcePanel",
  {},
  async () => {
    try {
      const landscapes = await icepanel.getLandscapes(ORGANIZATION_ID!);
      return {
        content: [{ type: "text", text: JSON.stringify(landscapes, null, 2) }],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${error.message}` }],
      };
    }
  }
);

// Get a specific landscape
server.tool(
  "getLandscape",
  "Get a specific landscape from IcePanel",
  {
    landscapeId: z.string(),
  },
  async ({ landscapeId }) => {
    try {
      const landscape = await icepanel.getLandscape(ORGANIZATION_ID!, landscapeId);
      return {
        content: [{ type: "text", text: JSON.stringify(landscape, null, 2) }],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${error.message}` }],
      };
    }
  }
);

// Get model objects for a landscape version
server.tool(
  "getModelObjects",
`
Get all the model objects in an IcePanel landscape.
IcePanel is a C4 diagramming tool. C4 is a framework for visualizing the architecture of software systems.
To get the C1 level objects - query for 'system' type.
To get the C2 level objects - query for 'app' and 'store' component types.
To get the C3 level objects - query for the 'component' type.

The 'group' and 'actor' types can be used in any of the levels, and should generally by included in user queries.
- 'group' - is a type agnostic group which groups objects together
- 'actor' - is a actor in the system, typically a kind of user. Ex. 'our customer', 'admin user', etc.

Use this tool to filter / query against many model objects at once. It provides high level details such as; name, ID, type, status, and external.

Prefer filtering by Technology ID and Team ID when the query is asking things like:
- "What services does the Automations Team own?"
- "We need to upgrade our .NET applications - what is affected by this?"
`,
  {
    landscapeId: z.string().length(20),
    domainId: z.union([z.string().length(20), z.array(z.string().length(20))]).optional(),
    external: z.boolean().optional().default(false),
    name: z.string().optional(),
    parentId: z.string().nullable().optional(),
    status: z.union([
      z.enum(["deprecated", "future", "live", "removed"]),
      z.array(z.enum(["deprecated", "future", "live", "removed"]))
    ]).optional(),
    type: z.union([
      z.enum(["actor", "app", "component", "group", "root", "store", "system"]),
      z.array(z.enum(["actor", "app", "component", "group", "root", "store", "system"]))
    ]).optional(),
    technologyId: z.union([z.string().length(20), z.array(z.string().length(20))]).optional().describe("The technology UUID - useful to find all objects using a specific technology or technologies"),
    teamId: z.union([z.string().length(20), z.array(z.string().length(20))]).optional().describe("The team UUID - useful to find all objects owned by a specific team or teams"),
    search: z.string().optional().describe("Search by name")
  },
  async ({ landscapeId, ...filters }) => {
    try {
      const result = await icepanel.getModelObjects(landscapeId, "latest", { filter: filters });
      let modelObjects = result.modelObjects;
      if (filters.search) {
       const fuseInstance = new Fuse(modelObjects, {
         keys: ['name', 'description'],
         threshold: 0.3
       })
        modelObjects = fuseInstance.search(filters.search).map(result => result.item);
      }
      const content: any[] = modelObjects.map((o) => ({
        type: "text",
        text: formatModelObjectListItem(landscapeId, o)
      }))
      return {
        content,
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${error.message}` }],
      };
    }
  }
);

server.tool(
  'getModelObject',
  `
  Get detailed information about a model object in IcePanel.
  IcePanel is a C4 diagramming tool. C4 is a framework for visualizing the architecture of software systems.
  Use this tool to get detailed information about a model object, such as it's description, type, hierarchical information (i.e. parent and children objects), any teams associated with it, as well as the technologies it uses.
  `,
  {
    landscapeId: z.string().length(20),
    modelObjectId: z.string().length(20),
    includeHierarchicalInfo: z.boolean().default(false).describe('Include hierarchical information like parent and child objects. (Only use this when necessary as it is an expensive operation.)')
  },
  async ({ landscapeId, modelObjectId, includeHierarchicalInfo }) => {
    try {
      const result = await icepanel.getModelObject(landscapeId, modelObjectId);
      const teamResult = await icepanel.getTeams(ORGANIZATION_ID!);
      const modelObject = result.modelObject
      let parentObject;
      let childObjects;

      if (includeHierarchicalInfo) {
        const listResult = await icepanel.getModelObjects(landscapeId)
        const modelObjectList = listResult.modelObjects;
        parentObject = (modelObject.parentId && modelObject.parentId !== 'root') ? modelObjectList.find(o => o.id === modelObject.parentId) : undefined;
        childObjects = modelObject.childIds.length > 0 ? modelObjectList.filter(o => modelObject.childIds.includes(o.id)): undefined;
      }
      const content: any = {
        type: 'text',
        text: formatModelObjectItem(landscapeId, result.modelObject, teamResult.teams, parentObject, childObjects),
      }
      return {
        content: [content],
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${error.message}` }],
      };
    }
  }
)

server.tool(
  'getModelObjectRelationships',
  `
  Get information about the relationships a model object has in IcePanel.
  IcePanel is a C4 diagramming tool. C4 is a framework for visualizing the architecture of software systems.

  Use this tool when you want to know about what objects are related to the current object. It provides a succinct list of related items.
  `,
  {
    landscapeId: z.string().length(20),
    modelObjectId: z.string().length(20),
  },
  async({ landscapeId, modelObjectId }) => {
    try {
      const modelObjectResult = await icepanel.getModelObject(landscapeId, modelObjectId)
      const modelObjectsResult = await icepanel.getModelObjects(landscapeId)
      const outgoingConnectionsResult = await icepanel.getModelConnections(landscapeId, "latest", {
        filter: {
          originId: modelObjectId
        }
      })
      const incomingConnectionsResult = await icepanel.getModelConnections(landscapeId, "latest", {
        filter: {
          targetId: modelObjectId,
        }
      })
      const formattedText = formatConnections(
        modelObjectResult.modelObject,
        incomingConnectionsResult.modelConnections,
        outgoingConnectionsResult.modelConnections,
        modelObjectsResult.modelObjects,
      )

      return {
        content: [{
          type: 'text',
          text: formattedText
        }]
      }
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${error.message}` }],
      };
    }
  }
)

server.tool(
  'getTechnologyCatalog',
  `
  Get the technology catalog in IcePanel.
  IcePanel is a C4 diagramming tool. C4 is a framework for visualizing the architecture of software systems.
  Use this tool to get the technology catalog, which is a list of all the technologies available in the system.
  `,
  {
    provider: z.union([z.enum(["aws", "azure", "gcp", "microsoft", "salesforce", "atlassian", "apache", "supabase"]), z.array(z.enum(["aws", "azure", "gcp", "microsoft", "salesforce", "atlassian", "apache", "supabase"]))]).nullable().optional(),
    type: z.union([z.enum(["data-storage", "deployment", "framework-library", "gateway", "other", "language", "message-broker", "network", "protocol", "runtime", "service-tool"]), z.array(z.enum(["data-storage", "deployment", "framework-library", "gateway", "other", "language", "message-broker", "network", "protocol", "runtime", "service-tool"]))]).nullable().optional(),
    restrictions: z.union([z.enum(["actor", "app", "component", "connection", "group", "store", "system"]), z.array(z.enum(["actor", "app", "component", "connection", "group", "store", "system"]))]).optional(),
    search: z.string().describe('Search by name and description')
  },
  async ({ provider, type, restrictions, search }) => {
    try {
      const result = await icepanel.getCatalogTechnologies({ filter: { provider, type, restrictions, status: "approved" } });
      const organizationResult = await icepanel.getOrganizationTechnologies(ORGANIZATION_ID!, { filter: { provider, type, restrictions } });
      let combinedTechnologies = result.catalogTechnologies.concat(organizationResult.catalogTechnologies);

      if (search) {
        const fuse = new Fuse(combinedTechnologies, {
          keys: ['name', 'description'],
          threshold: 0.3,
        });
        combinedTechnologies = fuse.search(search).map(result => result.item);
      }

      const content: any = combinedTechnologies.map(t => ({
        type: 'text',
        text: formatCatalogTechnology(t)
      }));
      return {
        content,
      };
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${error.message}` }],
      };
    }
  }
)

server.tool(
  'getTeams',
  `
  Get the teams in IcePanel.
  IcePanel is a C4 diagramming tool. C4 is a framework for visualizing the architecture of software systems.
  Use this tool to get the teams in IcePanel, teams are assigned as owners to different Model Objects within IcePanel.
  `,
  {
    search: z.string().optional().describe('Search by name')
  },
  async ({ search }) => {
    try {
      const teamResult = await icepanel.getTeams(ORGANIZATION_ID!)
      let teams = teamResult.teams
      if (search) {
        const fuse = new Fuse(teams, {
          keys: ['name'],
          threshold: 0.3,
        });
        teams = fuse.search(search).map(result => result.item);
      }

      const teamContent: any[] = teams.map(team => ({
        type: 'text',
        text: formatTeam(team)
      }))
      return {
        content: teamContent
      }
    } catch (error: any) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error: ${error.message}`}]
      }
    }
  }

)

// ============================================================================
// Model Object Write Tools
// ============================================================================

server.tool(
  'icepanel_create_model_object',
  `Create a new model object (system, app, component, etc.) in IcePanel.

This tool CREATES a new C4 architecture element in your landscape.

Args:
  - landscapeId (string): The landscape ID (20 characters)
  - name (string): Display name for the object (1-255 characters)
  - type (enum): One of: actor, app, component, group, store, system
  - parentId (string): Parent object ID (use getModelObjects with type='root' to find root)
  - description (string, optional): Markdown description
  - status (enum, optional): deprecated, future, live, removed (default: live)
  - external (boolean, optional): Whether this is an external system (default: false)
  - teamIds (string[], optional): Team IDs that own this object
  - technologyIds (string[], optional): Technology IDs used by this object
  - caption (string, optional): Short summary shown as display description

Returns:
  The created model object with its new ID.

C4 Level Mapping:
  - 'system' = C1 System Context
  - 'app'/'store' = C2 Container
  - 'component' = C3 Component
  - 'actor' = Person/External Actor
  - 'group' = Logical grouping (any level)

Examples:
  - Create a backend system: type="system", name="Order Service"
  - Create a database: type="store", name="Orders DB", parentId="<system-id>"
  - Create an API component: type="component", name="REST API", parentId="<app-id>"

Error Handling:
  - Returns error if parentId doesn't exist
  - Returns error if API key lacks write permission`,
  {
    landscapeId: z.string().length(20).describe("The landscape ID"),
    name: z.string().min(1).max(255).describe("Display name for the object"),
    type: z.enum(["actor", "app", "component", "group", "store", "system"]).describe("C4 object type"),
    parentId: z.string().length(20).describe("Parent object ID (use getModelObjects with type='root' to find root)"),
    description: z.string().optional().describe("Markdown description"),
    status: z.enum(["deprecated", "future", "live", "removed"]).default("live").describe("Object status"),
    external: z.boolean().default(false).describe("Whether this is external to your system"),
    teamIds: z.array(z.string().length(20)).optional().describe("Owning team IDs"),
    technologyIds: z.array(z.string().length(20)).optional().describe("Technology IDs"),
    caption: z.string().optional().describe("Short summary shown as display description"),
  },
  async (params) => {
    try {
      const { landscapeId, ...data } = params;
      const result = await icepanel.createModelObject(landscapeId, data);
      const teamResult = await icepanel.getTeams(ORGANIZATION_ID!);
      return {
        content: [{ 
          type: "text", 
          text: `# Model Object Created Successfully\n\n${formatModelObjectItem(landscapeId, result.modelObject, teamResult.teams)}` 
        }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: handleApiError(error) }],
      };
    }
  }
);

server.tool(
  'icepanel_update_model_object',
  `Update an existing model object in IcePanel.

This tool MODIFIES an existing C4 architecture element. Only provided fields will be updated.

Args:
  - landscapeId (string): The landscape ID (20 characters)
  - modelObjectId (string): The model object ID to update (20 characters)
  - name (string, optional): New display name
  - description (string, optional): New markdown description
  - status (enum, optional): New status: deprecated, future, live, removed
  - external (boolean, optional): Whether this is external
  - parentId (string, optional): Move to a new parent object
  - type (enum, optional): Change type (actor, app, component, group, store, system)
  - teamIds (string[], optional): Replace owning team IDs
  - technologyIds (string[], optional): Replace technology IDs
  - caption (string, optional): Short summary shown as display description

Returns:
  The updated model object.

Examples:
  - Update description: modelObjectId="...", description="New description"
  - Change status: modelObjectId="...", status="deprecated"
  - Move to new parent: modelObjectId="...", parentId="<new-parent-id>"

Error Handling:
  - Returns error if modelObjectId doesn't exist
  - Returns error if parentId (when provided) doesn't exist
  - Returns error if API key lacks write permission`,
  {
    landscapeId: z.string().length(20).describe("The landscape ID"),
    modelObjectId: z.string().length(20).describe("The model object ID to update"),
    name: z.string().min(1).max(255).optional().describe("New display name"),
    description: z.string().optional().describe("New markdown description"),
    status: z.enum(["deprecated", "future", "live", "removed"]).optional().describe("New status"),
    external: z.boolean().optional().describe("Whether this is external"),
    parentId: z.string().length(20).optional().describe("New parent object ID"),
    type: z.enum(["actor", "app", "component", "group", "store", "system"]).optional().describe("New object type"),
    teamIds: z.array(z.string().length(20)).optional().describe("Replace owning team IDs"),
    technologyIds: z.array(z.string().length(20)).optional().describe("Replace technology IDs"),
    caption: z.string().optional().describe("Short summary shown as display description"),
  },
  async (params) => {
    try {
      const { landscapeId, modelObjectId, ...data } = params;
      // Filter out undefined values
      const updateData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
      );
      const result = await icepanel.updateModelObject(landscapeId, modelObjectId, updateData);
      const teamResult = await icepanel.getTeams(ORGANIZATION_ID!);
      return {
        content: [{ 
          type: "text", 
          text: `# Model Object Updated Successfully\n\n${formatModelObjectItem(landscapeId, result.modelObject, teamResult.teams)}` 
        }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: handleApiError(error) }],
      };
    }
  }
);

server.tool(
  'icepanel_delete_model_object',
  `Delete a model object from IcePanel.

⚠️ WARNING: This action PERMANENTLY DELETES the model object and cannot be undone.

This tool removes a C4 architecture element from your landscape. Child objects may become orphaned or be deleted depending on the object type.

Args:
  - landscapeId (string): The landscape ID (20 characters)
  - modelObjectId (string): The model object ID to delete (20 characters)

Returns:
  Confirmation message on successful deletion.

Considerations:
  - Deleting a parent object may affect child objects
  - Connections to/from this object will be removed
  - This action cannot be undone - verify the ID before proceeding

Error Handling:
  - Returns error if modelObjectId doesn't exist
  - Returns error if API key lacks write permission`,
  {
    landscapeId: z.string().length(20).describe("The landscape ID"),
    modelObjectId: z.string().length(20).describe("The model object ID to delete"),
  },
  async ({ landscapeId, modelObjectId }) => {
    try {
      // First get the object name for confirmation message
      const existing = await icepanel.getModelObject(landscapeId, modelObjectId);
      const objectName = existing.modelObject.name;
      
      await icepanel.deleteModelObject(landscapeId, modelObjectId);
      return {
        content: [{ 
          type: "text", 
          text: `# Model Object Deleted\n\nSuccessfully deleted model object "${objectName}" (ID: ${modelObjectId}).` 
        }],
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: handleApiError(error) }],
      };
    }
  }
);

// ============================================================================
// Connection Write Tools
// ============================================================================

server.tool(
  'icepanel_create_connection',
  `Create a new connection between model objects in IcePanel.

Args:
  - landscapeId (string): The landscape ID (20 characters)
  - name (string): Connection label (e.g., "REST API", "publishes events")
  - originId (string): Source model object ID (20 characters)
  - targetId (string): Destination model object ID (20 characters)
  - direction (enum): 'outgoing', 'bidirectional', or null
  - description (string, optional): Markdown description
  - status (enum, optional): deprecated, future, live, removed (default: live)`,
  {
    landscapeId: z.string().length(20),
    name: z.string().min(1).max(255),
    originId: z.string().length(20),
    targetId: z.string().length(20),
    direction: z.enum(["outgoing", "bidirectional"]).nullable(),
    description: z.string().optional(),
    status: z.enum(["deprecated", "future", "live", "removed"]).default("live"),
  },
  async (params) => {
    try {
      const { landscapeId, ...data } = params;
      const result = await icepanel.createConnection(landscapeId, data);
      const conn = result.modelConnection;
      return {
        content: [{ type: "text", text: `# Connection Created\n\n- **ID**: ${conn.id}\n- **Name**: ${conn.name}\n- **Status**: ${conn.status}` }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

server.tool(
  'icepanel_update_connection',
  `Update an existing connection in IcePanel. Only provided fields will be updated.`,
  {
    landscapeId: z.string().length(20),
    connectionId: z.string().length(20),
    name: z.string().min(1).max(255).optional(),
    direction: z.enum(["outgoing", "bidirectional"]).nullable().optional(),
    description: z.string().optional(),
    status: z.enum(["deprecated", "future", "live", "removed"]).optional(),
  },
  async (params) => {
    try {
      const { landscapeId, connectionId, ...data } = params;
      const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      const result = await icepanel.updateConnection(landscapeId, connectionId, updateData);
      return {
        content: [{ type: "text", text: `# Connection Updated\n\n- **ID**: ${result.modelConnection.id}\n- **Name**: ${result.modelConnection.name}` }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

server.tool(
  'icepanel_delete_connection',
  `Delete a connection from IcePanel. WARNING: This action cannot be undone.`,
  {
    landscapeId: z.string().length(20),
    connectionId: z.string().length(20),
  },
  async ({ landscapeId, connectionId }) => {
    try {
      const existing = await icepanel.getConnection(landscapeId, "latest", connectionId);
      await icepanel.deleteConnection(landscapeId, connectionId);
      return {
        content: [{ type: "text", text: `# Connection Deleted\n\nDeleted "${existing.modelConnection.name}" (ID: ${connectionId}).` }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

// ============================================================================
// Team Write Tools
// ============================================================================

server.tool(
  'icepanel_create_team',
  `Create a new team in IcePanel organization.`,
  {
    name: z.string().min(1).max(255),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  },
  async (params) => {
    try {
      const result = await icepanel.createTeam(ORGANIZATION_ID!, params);
      return {
        content: [{ type: "text", text: `# Team Created\n\n- **ID**: ${result.team.id}\n- **Name**: ${result.team.name}` }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

server.tool(
  'icepanel_update_team',
  `Update an existing team in IcePanel.`,
  {
    teamId: z.string().length(20),
    name: z.string().min(1).max(255).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  },
  async (params) => {
    try {
      const { teamId, ...data } = params;
      const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      const result = await icepanel.updateTeam(ORGANIZATION_ID!, teamId, updateData);
      return {
        content: [{ type: "text", text: `# Team Updated\n\n- **ID**: ${result.team.id}\n- **Name**: ${result.team.name}` }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

server.tool(
  'icepanel_delete_team',
  `Delete a team from IcePanel. WARNING: This action cannot be undone.`,
  {
    teamId: z.string().length(20),
  },
  async ({ teamId }) => {
    try {
      const teamsResult = await icepanel.getTeams(ORGANIZATION_ID!);
      const team = teamsResult.teams.find(t => t.id === teamId);
      await icepanel.deleteTeam(ORGANIZATION_ID!, teamId);
      return {
        content: [{ type: "text", text: `# Team Deleted\n\nDeleted "${team?.name || 'Unknown'}" (ID: ${teamId}).` }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

// ============================================================================
// Tag Write Tools
// ============================================================================

server.tool(
  'icepanel_create_tag',
  `Create a new tag in IcePanel landscape.`,
  {
    landscapeId: z.string().length(20),
    name: z.string().min(1).max(255),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  },
  async (params) => {
    try {
      const { landscapeId, ...data } = params;
      const result = await icepanel.createTag(landscapeId, data);
      return {
        content: [{ type: "text", text: `# Tag Created\n\n- **ID**: ${result.tag.id}\n- **Name**: ${result.tag.name}` }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

server.tool(
  'icepanel_update_tag',
  `Update an existing tag in IcePanel.`,
  {
    landscapeId: z.string().length(20),
    tagId: z.string().length(20),
    name: z.string().min(1).max(255).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  },
  async (params) => {
    try {
      const { landscapeId, tagId, ...data } = params;
      const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      const result = await icepanel.updateTag(landscapeId, tagId, updateData);
      return {
        content: [{ type: "text", text: `# Tag Updated\n\n- **ID**: ${result.tag.id}\n- **Name**: ${result.tag.name}` }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

server.tool(
  'icepanel_delete_tag',
  `Delete a tag from IcePanel. WARNING: This action cannot be undone.`,
  {
    landscapeId: z.string().length(20),
    tagId: z.string().length(20),
  },
  async ({ landscapeId, tagId }) => {
    try {
      await icepanel.deleteTag(landscapeId, tagId);
      return {
        content: [{ type: "text", text: `# Tag Deleted\n\nDeleted tag (ID: ${tagId}).` }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

// ============================================================================
// Domain Write Tools
// ============================================================================

server.tool(
  'icepanel_create_domain',
  `Create a new domain in IcePanel landscape. Domains organize model objects into logical groupings.`,
  {
    landscapeId: z.string().length(20),
    name: z.string().min(1).max(255),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  },
  async (params) => {
    try {
      const { landscapeId, ...data } = params;
      const result = await icepanel.createDomain(landscapeId, data);
      return {
        content: [{ type: "text", text: `# Domain Created\n\n- **ID**: ${result.domain.id}\n- **Name**: ${result.domain.name}` }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

server.tool(
  'icepanel_update_domain',
  `Update an existing domain in IcePanel.`,
  {
    landscapeId: z.string().length(20),
    domainId: z.string().length(20),
    name: z.string().min(1).max(255).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  },
  async (params) => {
    try {
      const { landscapeId, domainId, ...data } = params;
      const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      const result = await icepanel.updateDomain(landscapeId, domainId, updateData);
      return {
        content: [{ type: "text", text: `# Domain Updated\n\n- **ID**: ${result.domain.id}\n- **Name**: ${result.domain.name}` }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

server.tool(
  'icepanel_delete_domain',
  `Delete a domain from IcePanel. WARNING: This action cannot be undone.`,
  {
    landscapeId: z.string().length(20),
    domainId: z.string().length(20),
  },
  async ({ landscapeId, domainId }) => {
    try {
      await icepanel.deleteDomain(landscapeId, domainId);
      return {
        content: [{ type: "text", text: `# Domain Deleted\n\nDeleted domain (ID: ${domainId}).` }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: handleApiError(error) }] };
    }
  }
);

// Get transport configuration from CLI (set by bin/icepanel-mcp-server.js)
const transportType = process.env._MCP_TRANSPORT || 'stdio';
const port = parseInt(process.env._MCP_PORT || '3000', 10);

// Start the server with the appropriate transport
if (transportType === 'http') {
  // Start HTTP server with Streamable HTTP transport
  await startHttpServer(server, port);
} else {
  // Default: Start with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
