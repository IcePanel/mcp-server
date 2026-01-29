import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./tools/index.js";
import { startHttpServer } from "./transports/http-server.js";

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
  name: "icepanel-mcp-server",
  version: "0.3.0",
});

registerAllTools(server, ORGANIZATION_ID);

// Get transport configuration from CLI (set by bin/icepanel-mcp-server.js)
const transportType = process.env._MCP_TRANSPORT || "stdio";
const portRaw = process.env._MCP_PORT || "3000";
const port = Number.parseInt(portRaw, 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${portRaw}. Must be a number between 1 and 65535.`);
  process.exit(1);
}

// Start the server with the appropriate transport
try {
  if (transportType === "http") {
    // Start HTTP server with Streamable HTTP transport
    await startHttpServer(server, port);
  } else {
    // Default: Start with stdio transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
} catch (error: any) {
  console.error("Failed to start IcePanel MCP Server:", error?.message || error);
  process.exit(1);
}
