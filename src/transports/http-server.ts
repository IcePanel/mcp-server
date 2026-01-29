/**
 * HTTP Server for IcePanel MCP
 *
 * Provides Streamable HTTP transport for the MCP server.
 * This is the new standard transport, replacing the deprecated SSE transport.
 *
 * Single endpoint architecture:
 * - GET/POST/DELETE /mcp - Main MCP endpoint (handles all communication)
 * - GET /health - Health check endpoint
 */

import express, { type Request, type Response } from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Create and start an HTTP server with Streamable HTTP transport for the MCP server
 *
 * @param server - The configured McpServer instance
 * @param port - Port to listen on (default: 3000)
 */
export async function startHttpServer(
  server: McpServer,
  port: number = 3000,
  options: { enableShutdownHandlers?: boolean } = {}
): Promise<{ server: Server; port: number; close: () => Promise<void> }> {
  const app = express();
  const enableShutdownHandlers = options.enableShutdownHandlers ?? true;

  // Enable CORS for all origins (MCP clients may be on different ports)
  app.use(cors());

  // Parse JSON bodies for health endpoint only
  app.use("/health", express.json());

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
  } catch (error: any) {
    console.error("Failed to connect MCP server to HTTP transport:", error?.message || error);
    throw error;
  }

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      transport: "streamable-http",
      version: "0.3.0",
    });
  });

  // Main MCP endpoint - handles all MCP communication
  app.all("/mcp", async (req: Request, res: Response) => {
    try {
      await transport.handleRequest(req, res);
    } catch (error: any) {
      // Only send error if response hasn't been sent
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal server error",
          message: error.message,
        });
      }
    }
  });

  // Legacy SSE endpoint - redirect to new endpoint with helpful message
  app.get("/sse", (_req: Request, res: Response) => {
    res.status(410).json({
      error: "Endpoint deprecated",
      message: "The /sse endpoint has been replaced by /mcp. Please update your MCP client configuration.",
      newEndpoint: "/mcp",
    });
  });

  // Start the server
  const httpServer: Server = await new Promise((resolve, reject) => {
    const serverInstance = app.listen(port, () => resolve(serverInstance));
    serverInstance.on("error", reject);
  });

  const address = httpServer.address();
  const actualPort = typeof address === "object" && address ? (address as AddressInfo).port : port;

  console.log(`IcePanel MCP Server (Streamable HTTP) listening on http://localhost:${actualPort}`);
  console.log(`  MCP endpoint: http://localhost:${actualPort}/mcp`);
  console.log(`  Health check: http://localhost:${actualPort}/health`);

  // Graceful shutdown
  const shutdown = () => {
    console.log("\nShutting down HTTP server...");
    transport.close();
    httpServer.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
  };

  if (enableShutdownHandlers) {
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  const close = (): Promise<void> =>
    new Promise((resolve, reject) => {
      transport.close();
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

  return { server: httpServer, port: actualPort, close };
}
