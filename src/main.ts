import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as icepanel from "./icepanel.js";

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

// Get all models
server.tool(
  "getModels",
  "Get all models from IcePanel",
  {},
  async () => {
    try {
      const models = await icepanel.getModels(ORGANIZATION_ID!);
      return {
        content: [{ type: "text", text: JSON.stringify(models, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
      };
    }
  }
);

// Get a specific model
server.tool(
  "getModel",
  "Get a specific model from IcePanel",
  {
    modelId: z.string(),
  },
  async ({ modelId }) => {
    try {
      const model = await icepanel.getModel(ORGANIZATION_ID!, modelId);
      return {
        content: [{ type: "text", text: JSON.stringify(model, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
      };
    }
  }
);

// Get all connections
server.tool(
  "getConnections",
  "Get all connections for a landscape version",
  {
    landscapeId: z.string(),
    versionId: z.string(),
  },
  async ({ landscapeId, versionId }) => {
    try {
      const connections = await icepanel.getConnections(landscapeId, versionId);
      return {
        content: [{ type: "text", text: JSON.stringify(connections, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
      };
    }
  }
);

// Get a specific connection
server.tool(
  "getConnection",
  "Get a specific connection for a landscape version",
  {
    landscapeId: z.string(),
    versionId: z.string(),
    connectionId: z.string(),
  },
  async ({ landscapeId, versionId, connectionId }) => {
    try {
      const connection = await icepanel.getConnection(landscapeId, versionId, connectionId);
      return {
        content: [{ type: "text", text: JSON.stringify(connection, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
      };
    }
  }
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
