import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as icepanel from "./icepanel.js";
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
        content: [{ type: 'text', text: `Error: ${error.message}`}]
      }
    }
  }

)

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
