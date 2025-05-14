# IcePanel MCP Server

## ⚠️ Beta Notice

IcePanel MCP Server is currently in beta. We appreciate your feedback and patience as we continue to improve the MCP Server.

Please use MCP Servers with caution; only install tools you trust.

## 🚀 Getting Started

### Prerequisites

- Node.js (Latest LTS version recommended)
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

#### Environment Variables

- `API_KEY`: Your IcePanel API key (required)
- `ORGANIZATION_ID`: Your IcePanel organization ID (required)
- `ICEPANEL_API_BASE_URL`: (Optional) Override the API base URL for different environments

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

## ✉️ Support

- Reach out to [Support](mailto:support@icepanel.io) if you experience any issues.

## 📝 License

MIT License

## 🙏 Acknowledgments

- Thanks to our beta testers and community members
