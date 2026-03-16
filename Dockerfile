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
# API_KEY - Your IcePanel API key (required)
# ORGANIZATION_ID - Your IcePanel organization ID (required)
# ICEPANEL_API_BASE_URL - Optional API base URL override

# Run the MCP server via stdio transport
ENTRYPOINT ["node", "bin/icepanel-mcp-server.js"]

