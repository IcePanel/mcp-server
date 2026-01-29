#!/usr/bin/env node

/**
 * IcePanel MCP Server
 *
 * Environment variables:
 * - API_KEY: Your IcePanel API key (required)
 * - ORGANIZATION_ID: Your IcePanel organization ID (required)
 * - ICEPANEL_API_BASE_URL: (Optional) Override the API base URL for different environments
 * - MCP_TRANSPORT: Transport type: 'stdio' (default) or 'http'
 * - MCP_PORT: HTTP server port for HTTP transport (default: 3000)
 *
 * CLI flags:
 * - --transport <stdio|http>: Transport type (overrides MCP_TRANSPORT)
 * - --port <number>: HTTP port for HTTP transport (overrides MCP_PORT)
 */

import { parseCliConfig } from "../dist/cli/config.js";

// Parse command line arguments
const args = process.argv.slice(2);
const { transport, port, portRaw, updatedEnv, usedDeprecatedSse } = parseCliConfig(args, process.env);
Object.assign(process.env, updatedEnv);

// Support legacy 'sse' transport name (map to 'http')
if (usedDeprecatedSse) {
  console.warn("Warning: 'sse' transport is deprecated. Using 'http' (Streamable HTTP) instead.");
}

// Validate transport
if (!['stdio', 'http'].includes(transport)) {
  console.error(`Invalid transport: ${transport}. Must be 'stdio' or 'http'.`);
  process.exit(1);
}

// Validate port
if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${portRaw}. Must be a number between 1 and 65535.`);
  process.exit(1);
}

// Store config for main module
process.env._MCP_TRANSPORT = transport;
process.env._MCP_PORT = String(port);

import('../dist/index.js').catch(err => {
  console.error('Failed to start IcePanel MCP Server:', err);
  process.exit(1);
});
