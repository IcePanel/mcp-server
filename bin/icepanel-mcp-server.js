#!/usr/bin/env node

/**
 * IcePanel MCP Server
 *
 * Environment variables:
 * - API_KEY: Your IcePanel API key
 * - ORGANIZATION_ID: Your IcePanel organization ID
 * - ICEPANEL_API_BASE_URL: (Optional) Override the API base URL for different environments
 */

// Parse any environment variables passed as arguments
process.argv.slice(2).forEach(arg => {
  const match = arg.match(/^([^=]+)=(.*)$/);
  if (match) {
    const [, key, value] = match;
    process.env[key] = value.replace(/^["'](.*)["']$/, '$1'); // Remove quotes if present
  }
});

import('../dist/main.js').catch(err => {
  console.error('Failed to start IcePanel MCP Server:', err);
  process.exit(1);
});
