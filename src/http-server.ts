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
import { randomUUID } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Store active transports by session ID for stateful mode
const sessions = new Map<string, StreamableHTTPServerTransport>();

/**
 * Create and start an HTTP server with Streamable HTTP transport for the MCP server
 * 
 * @param server - The configured McpServer instance
 * @param port - Port to listen on (default: 3000)
 */
export async function startHttpServer(server: McpServer, port: number = 3000): Promise<void> {
  const app = express();
  
  // Enable CORS for all origins (MCP clients may be on different ports)
  app.use(cors());
  
  // Parse JSON bodies for POST requests
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ 
      status: "ok", 
      transport: "streamable-http",
      activeSessions: sessions.size,
      version: "0.2.0"
    });
  });

  // Main MCP endpoint - handles all MCP communication
  // Supports GET (SSE stream), POST (requests), DELETE (session termination)
  app.all("/mcp", async (req: Request, res: Response) => {
    // Check for existing session
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    
    let transport: StreamableHTTPServerTransport;
    
    if (sessionId && sessions.has(sessionId)) {
      // Reuse existing session
      transport = sessions.get(sessionId)!;
    } else if (req.method === "GET" || !sessionId) {
      // New session - create transport with session ID generator
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      
      // Connect the MCP server to this transport
      await server.connect(transport);
      
      // Store session for reuse
      if (transport.sessionId) {
        sessions.set(transport.sessionId, transport);
        console.log(`New MCP session: ${transport.sessionId}`);
      }
      
      // Clean up when transport closes
      transport.onclose = () => {
        if (transport.sessionId) {
          console.log(`MCP session closed: ${transport.sessionId}`);
          sessions.delete(transport.sessionId);
        }
      };

      transport.onerror = (error) => {
        console.error(`MCP transport error: ${error.message}`);
      };
    } else {
      // Session ID provided but not found
      res.status(404).json({ 
        error: "Session not found",
        message: "The specified session ID does not exist. It may have expired or been terminated."
      });
      return;
    }

    try {
      // Handle the request using the transport
      await transport.handleRequest(req, res);
    } catch (error: any) {
      console.error(`Error handling MCP request:`, error);
      // Only send error if response hasn't been sent
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "Internal server error",
          message: error.message 
        });
      }
    }
  });

  // Legacy SSE endpoint - redirect to new endpoint with helpful message
  app.get("/sse", (_req: Request, res: Response) => {
    res.status(410).json({
      error: "Endpoint deprecated",
      message: "The /sse endpoint has been replaced by /mcp. Please update your MCP client configuration.",
      newEndpoint: "/mcp"
    });
  });

  // Start the server
  const httpServer = app.listen(port, () => {
    console.log(`IcePanel MCP Server (Streamable HTTP) listening on http://localhost:${port}`);
    console.log(`  MCP endpoint: http://localhost:${port}/mcp`);
    console.log(`  Health check: http://localhost:${port}/health`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\nShutting down HTTP server...");
    
    // Close all active sessions
    for (const [sessionId, transport] of sessions) {
      console.log(`Closing session: ${sessionId}`);
      transport.close();
    }
    sessions.clear();
    
    httpServer.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
