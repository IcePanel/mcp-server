import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerConnectionTools } from "./connections.js";
import { registerDomainTools } from "./domains.js";
import { registerLandscapeTools } from "./landscapes.js";
import { registerModelObjectTools } from "./model-objects.js";
import { registerTagTools } from "./tags.js";
import { registerTechnologyTools } from "./technologies.js";

export function registerAllTools(server: McpServer, organizationId: string) {
  registerLandscapeTools(server, organizationId);
  registerModelObjectTools(server, organizationId);
  registerConnectionTools(server);
  registerTechnologyTools(server, organizationId);
  registerTagTools(server);
  registerDomainTools(server);
}
