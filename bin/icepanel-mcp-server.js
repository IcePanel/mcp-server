#!/usr/bin/env node

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
