import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as icepanel from "./icepanel.js";
import { formatCatalogTechnology, formatModelObjectItem, formatModelObjectListItem } from "./format.js";
import Fuse from 'fuse.js';

// Get organization ID from environment variables
const ORGANIZATION_ID = process.env.ICEPANEL_ORGANIZATION_ID;

if (!ORGANIZATION_ID) {
  console.error("ICEPANEL_ORGANIZATION_ID environment variable is not set");
}

// Create an MCP server
const server = new McpServer({
  name: "IcePanel MCP Server",
  version: "1.0.0",
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
IcePanel is a C4 diagramming tool. C4 is a model for visualizing the architecture of software systems.
To get the C1 level objects - query for 'system' type.
To get the C2 level objects - query for 'app' and 'store' component types.
To get the C3 level objects - query for the 'component' type.

The 'group' and 'actor' types can be used in any of the levels, and should generally by included in user queries.
- 'group' - is a type agnostic group which groups objects together
- 'actor' - is a actor in the system, typically a kind of user. Ex. 'our customer', 'admin user', etc.
`,
  {
    landscapeId: z.string(),
    versionId: z.string().default('latest'),
    domainId: z.union([z.string(), z.array(z.string())]).optional(),
    external: z.boolean().optional().default(false),
    handleId: z.union([z.string(), z.array(z.string())]).optional(),
    labels: z.record(z.string()).optional(),
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
    technologyId: z.union([z.string(), z.array(z.string())]).optional(),
    teamId: z.union([z.string(), z.array(z.string())]).optional(),
    search: z.string().optional()
  },
  async ({ landscapeId, versionId, ...filters }) => {
    try {
      const result = await icepanel.getModelObjects(landscapeId, versionId, { filter: filters });
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
  'getDetailedModelObject',
  `
  Get detailed information about a model object in IcePanel.
  IcePanel is a C4 diagramming tool. C4 is a model for visualizing the architecture of software systems.
  Use this tool to get detailed information about a model object, such as it's description, type, what it depends on, and it's dependencies as well as the technologies it uses.
  `,
  {
    landscapeId: z.string(),
    modelObjectId: z.string(),
  },
  async ({ landscapeId, modelObjectId }) => {
    try {
      const result = await icepanel.getModelObject(landscapeId, modelObjectId);
      const content: any = {
        type: 'text',
        text: formatModelObjectItem(landscapeId, result.modelObject),
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
  'getTechnologyCatalog',
  `
  Get the technology catalog in IcePanel.
  IcePanel is a C4 diagramming tool. C4 is a model for visualizing the architecture of software systems.
  Use this tool to get the technology catalog, which is a list of all the technologies available in the system.
  `,
  {
    provider: z.union([z.enum(["aws", "azure", "gcp", "microsoft", "salesforce", "atlassian", "apache", "supabase"]), z.array(z.enum(["aws", "azure", "gcp", "microsoft", "salesforce", "atlassian", "apache", "supabase"]))]).nullable().optional(),
    type: z.union([z.enum(["data-storage", "deployment", "framework-library", "gateway", "other", "language", "message-broker", "network", "protocol", "runtime", "service-tool"]), z.array(z.enum(["data-storage", "deployment", "framework-library", "gateway", "other", "language", "message-broker", "network", "protocol", "runtime", "service-tool"]))]).nullable().optional(),
    restrictions: z.union([z.enum(["actor", "app", "component", "connection", "group", "store", "system"]), z.array(z.enum(["actor", "app", "component", "connection", "group", "store", "system"]))]).optional(),
    search: z.string().optional()
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

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
