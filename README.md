# IcePanel MCP Server

## ⚠️ Beta Notice

IcePanel MCP Server is currently in beta. We appreciate your feedback and patience as we continue to improve the MCP Server.

Please use MCP Servers with caution; only install tools you trust.

## Overview

IcePanel MCP Server exposes IcePanel architecture data (C4 model objects, connections, technologies, tags, domains) to MCP clients so assistants can read and update your architecture inventory.

## 🚀 Quick Start

1. Get your IcePanel Organization ID from the IcePanel app.
2. Generate an API key (read permissions recommended unless you plan to write).
3. Configure your MCP client:

```json
{
  "mcpServers": {
    "@icepanel/icepanel": {
      "command": "npx",
      "args": ["-y", "@icepanel/mcp-server@latest", "API_KEY=\"your-api-key\"", "ORGANIZATION_ID=\"your-org-id\""]
    }
  }
}
```

## How to Configure Your MCP Client

### stdio (default)

Use `command` + `args` to launch the server locally (shown above).

### Streamable HTTP

For MCP clients that support HTTP transport:

```json
{
  "mcpServers": {
    "@icepanel/icepanel": {
      "url": "http://localhost:9846/mcp"
    }
  }
}
```

## Reference: Tool Capabilities (v0.3.0)

All tools follow the `icepanel_*` naming convention and return structured output in `structuredContent`. Read tools support:

- `response_format`: `markdown` (default) or `json`
- Pagination (`limit`, `offset`) where applicable
- Pagination metadata: `total`, `count`, `has_more`, `next_offset`

### Read Tools

- `icepanel_list_landscapes`
- `icepanel_get_landscape`
- `icepanel_list_model_objects`
- `icepanel_get_model_object`
- `icepanel_get_model_object_connections`
- `icepanel_list_technologies`

### Write Tools

- `icepanel_create_model_object`
- `icepanel_update_model_object`
- `icepanel_delete_model_object`
- `icepanel_create_connection`
- `icepanel_update_connection`
- `icepanel_delete_connection`
- `icepanel_create_tag`
- `icepanel_update_tag`
- `icepanel_delete_tag`
- `icepanel_create_domain`
- `icepanel_update_domain`
- `icepanel_delete_domain`

## Reference: Environment Variables

- `API_KEY`: IcePanel API key (required)
- `ORGANIZATION_ID`: IcePanel organization ID (required)
- `ICEPANEL_API_BASE_URL`: Override API base URL (optional)
- `ICEPANEL_API_ALLOW_INSECURE`: Allow http base URLs for testing (optional, default: false)
- `ICEPANEL_API_TIMEOUT_MS`: API request timeout in ms (optional, default: 30000)
- `ICEPANEL_API_MAX_RETRIES`: Max retries for GET/HEAD requests (optional, default: 2)
- `ICEPANEL_API_RETRY_BASE_DELAY_MS`: Base backoff delay in ms (optional, default: 300)
- `MCP_TRANSPORT`: `stdio` (default) or `http`
- `MCP_PORT`: HTTP port for Streamable HTTP transport (default: 3000)

## How to Run Integration Tests

Use this guide to run the live integration tests against your IcePanel org.

### Prerequisites

- A valid IcePanel API key
- A landscape in your org (for example, `Alex's landscape`)

### Steps

1. Export your test credentials:

```bash
export ICEPANEL_MCP_API_KEY="your-api-key" \
ICEPANEL_MCP_ORGANIZATION_ID="your-org-id"
```

2. Point the tests at a specific landscape (by name or ID):

```bash
export ICEPANEL_MCP_TEST_LANDSCAPE_NAME="your-landscape-name"
# or
export ICEPANEL_MCP_TEST_LANDSCAPE_ID="your-landscape-id"
```

3. For tag write tests, provide a tag group id:

```bash
export ICEPANEL_MCP_TAG_GROUP_ID="your-tag-group-id"
```

4. Run the suite:

```bash
pnpm test
```

### Notes

- Read tests run when `ICEPANEL_MCP_API_KEY` is set.
- Write tests run automatically when the API key has write scope.
- Tag write tests require `ICEPANEL_MCP_TAG_GROUP_ID`.

## Reference: Test Environment Variables

- `ICEPANEL_MCP_API_KEY`: API key for integration tests (read or write)
- `ICEPANEL_MCP_ORGANIZATION_ID`: Organization ID for tests
- `ICEPANEL_MCP_TEST_LANDSCAPE_NAME`: Landscape name to target
- `ICEPANEL_MCP_TEST_LANDSCAPE_ID`: Landscape ID to target (overrides name)
- `ICEPANEL_MCP_TAG_GROUP_ID`: Tag group id used for tag write tests

## Reference: CLI Flags

- `--transport <stdio|http>`: Transport type (overrides `MCP_TRANSPORT`)
- `--port <number>`: HTTP port for HTTP transport (overrides `MCP_PORT`)

## How to Run with Docker

### Prerequisites

- Node.js (minimum v18+, Latest LTS version recommended)
- One of the supported MCP Clients:
  - Claude Desktop
  - Cursor
  - Windsurf

### Build the Docker Image

```bash
docker build -t icepanel-mcp-server .
```

### Run with Docker

```bash
docker run -i --rm \
  -e API_KEY="your-api-key" \
  -e ORGANIZATION_ID="your-org-id" \
  icepanel-mcp-server
```

### Configure MCP Client for Docker (stdio)

Add this to your MCP Clients' MCP config file:

```json
{
  "mcpServers": {
    "@icepanel/icepanel": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-e", "API_KEY=your-api-key",
        "-e", "ORGANIZATION_ID=your-org-id",
        "icepanel-mcp-server"
      ]
    }
  }
}
```

### Run with Streamable HTTP Transport

For standalone HTTP server mode, use the `--transport http` flag:

```bash
docker run -d -p 9846:9846 \
  -e API_KEY="your-api-key" \
  -e ORGANIZATION_ID="your-org-id" \
  icepanel-mcp-server --transport http --port 9846
```

The server exposes:
- `GET/POST/DELETE /mcp` - Main MCP endpoint (Streamable HTTP)
- `GET /health` - Health check endpoint

## Reference: Transport Options

This server supports two transport mechanisms:

### stdio (default)
- Standard input/output transport
- Used when MCP client spawns the server process directly
- Best for: Local development, npx usage, per-user deployments

### Streamable HTTP
- Single endpoint HTTP transport (`/mcp`)
- Supports both request/response and streaming modes
- Best for: Docker deployments, shared servers, enterprise environments
- Replaces the deprecated SSE transport (MCP spec 2025-03-26)

## v0.3.0 Breaking Changes

Tool names have been updated to follow MCP best practices and use snake_case with an `icepanel_` prefix. Update any clients or prompts that refer to the old tool names:

- `getLandscapes` → `icepanel_list_landscapes`
- `getLandscape` → `icepanel_get_landscape`
- `getModelObjects` → `icepanel_list_model_objects`
- `getModelObject` → `icepanel_get_model_object`
- `getModelObjectRelationships` → `icepanel_get_model_object_connections`
- `getTechnologyCatalog` → `icepanel_list_technologies`

Read tools now accept `response_format` (`markdown` or `json`) plus `limit`/`offset` pagination parameters where applicable.

## ✉️ Support

- Reach out to [Support](mailto:support@icepanel.io) if you experience any issues.

## 📝 License

MIT License

## 🙏 Acknowledgments

- Thanks to our beta testers and community members
