# IcePanel MCP Server

## ⚠️ Beta Notice

IcePanel MCP Server is currently in beta. We appreciate your feedback and patience as we continue to improve the MCP Server.

Please use MCP Servers with caution; only install tools you trust.

## 🚀 Getting Started

### Prerequisites

- Node.js (minimum v18+, Latest LTS version recommended)
- One of the supported MCP Clients:
  - Claude Desktop
  - Cursor
  - Windsurf

### Installation

1. **Get your organization's ID**
   - Visit [IcePanel](https://app.icepanel.io/)
   - Head to your Organization's Settings:
    - Click on your landscape in the top left to open the dropdown
    - Beside your org name, click the gear icon
  - Keep your "Organization Identifier" handy!


2. **Generate API Key**
   - Visit [IcePanel](https://app.icepanel.io/)
   - Head to your Organization's Settings:
    - Click on your landscape in the top left to open the dropdown
    - Beside your org name, click the gear icon
    - Click on the 🔑 API keys link in the sidebar
   - Generate a new API key
    - Read permissions recommended

3. **Install**
  - Add the configuration to your MCP Client's MCP config file. (See below)

#### Environment Variables

- `API_KEY`: Your IcePanel API key (required)
- `ORGANIZATION_ID`: Your IcePanel organization ID (required)
- `ICEPANEL_API_BASE_URL`: (Optional) Override the API base URL for different environments
- `MCP_TRANSPORT`: (Optional) Transport type: `stdio` (default) or `sse`
- `MCP_PORT`: (Optional) HTTP port for SSE transport (default: 3000)

#### CLI Flags

When running directly or via Docker, you can use these flags:

- `--transport <stdio|sse>`: Transport type (overrides `MCP_TRANSPORT`)
- `--port <number>`: HTTP port for SSE transport (overrides `MCP_PORT`)

#### Configure your MCP Client

Add this to your MCP Clients' MCP config file:

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

## 🐳 Docker

You can also run the IcePanel MCP Server as a Docker container.

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

### Run with HTTP/SSE Transport

For standalone HTTP server mode, use the `--transport sse` flag:

```bash
docker run -d -p 9846:9846 \
  -e API_KEY="your-api-key" \
  -e ORGANIZATION_ID="your-org-id" \
  icepanel-mcp-server --transport sse --port 9846
```

The server exposes:
- `GET /sse` - SSE endpoint for establishing connection
- `POST /messages` - Endpoint for client messages
- `GET /health` - Health check endpoint

### Configure MCP Client for HTTP/SSE

For MCP clients that support HTTP/SSE transport:

```json
{
  "mcpServers": {
    "@icepanel/icepanel": {
      "url": "http://localhost:9846/sse"
    }
  }
}
```

## ✉️ Support

- Reach out to [Support](mailto:support@icepanel.io) if you experience any issues.

## 📝 License

MIT License

## 🙏 Acknowledgments

- Thanks to our beta testers and community members
