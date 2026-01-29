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

// Parse command line arguments
const args = process.argv.slice(2);
let transport = process.env.MCP_TRANSPORT || 'stdio';
let port = parseInt(process.env.MCP_PORT || '3000', 10);

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  // Handle --transport flag
  if (arg === '--transport' && args[i + 1]) {
    transport = args[i + 1];
    i++; // Skip next arg
    continue;
  }
  
  // Handle --port flag
  if (arg === '--port' && args[i + 1]) {
    port = parseInt(args[i + 1], 10);
    i++; // Skip next arg
    continue;
  }
  
  // Handle environment variables passed as arguments (KEY=value format)
  const match = arg.match(/^([^=]+)=(.*)$/);
  if (match) {
    const [, key, value] = match;
    process.env[key] = value.replace(/^["'](.*)["']$/, '$1'); // Remove quotes if present
  }
}

// Support legacy 'sse' transport name (map to 'http')
if (transport === 'sse') {
  console.warn("Warning: 'sse' transport is deprecated. Using 'http' (Streamable HTTP) instead.");
  transport = 'http';
}

// Validate transport
if (!['stdio', 'http'].includes(transport)) {
  console.error(`Invalid transport: ${transport}. Must be 'stdio' or 'http'.`);
  process.exit(1);
}

// Validate port
if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${port}. Must be a number between 1 and 65535.`);
  process.exit(1);
}

// Store config for main module
process.env._MCP_TRANSPORT = transport;
process.env._MCP_PORT = String(port);

import('../dist/main.js').catch(err => {
  console.error('Failed to start IcePanel MCP Server:', err);
  process.exit(1);
});
