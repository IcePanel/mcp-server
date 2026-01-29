# IcePanel MCP Server Dockerfile
# Multi-stage build for minimal production image

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/
COPY bin/ ./bin/

# Build TypeScript
RUN pnpm run build

# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and production dependencies only
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --prod

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/bin ./bin

# Environment variables (to be provided at runtime)
# Required:
#   API_KEY - Your IcePanel API key
#   ORGANIZATION_ID - Your IcePanel organization ID
# Optional:
#   ICEPANEL_API_BASE_URL - Override API base URL
#   MCP_TRANSPORT - Transport type: 'stdio' (default) or 'http'
#   MCP_PORT - HTTP port for Streamable HTTP transport (default: 3000)

# Default port for HTTP transport (can be overridden with --port flag)
EXPOSE 3000

# Run the MCP server
# Supports CLI flags: --transport <stdio|http> --port <number>
# Example: docker run -p 3000:3000 ... icepanel-mcp-server --transport http --port 3000
ENTRYPOINT ["node", "bin/icepanel-mcp-server.js"]
