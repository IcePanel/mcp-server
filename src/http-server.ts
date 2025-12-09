/**
 * HTTP/SSE Server for IcePanel MCP
 * 
 * Provides HTTP transport using Server-Sent Events (SSE) for the MCP server,
 * following conventions from mcp-atlassian.
 */

import express, { type Request, type Response } from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Store active SSE transports by session ID
const transports = new Map<string, SSEServerTransport>();

/**
 * Create and start an HTTP server with SSE transport for the MCP server
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
    res.json({ status: "ok", transport: "sse" });
  });

  // SSE endpoint - establishes the SSE connection
  app.get("/sse", async (req: Request, res: Response) => {
    console.log("SSE connection requested");
    
    // Create a new SSE transport for this connection
    // The endpoint tells the client where to POST messages
    const transport = new SSEServerTransport("/messages", res);
    
    // Store the transport by session ID for routing POST requests
    transports.set(transport.sessionId, transport);
    
    // Clean up when connection closes
    transport.onclose = () => {
      console.log(`SSE connection closed: ${transport.sessionId}`);
      transports.delete(transport.sessionId);
    };

    transport.onerror = (error) => {
      console.error(`SSE transport error: ${error.message}`);
    };

    // Connect the MCP server to this transport
    await server.connect(transport);
    
    console.log(`SSE connection established: ${transport.sessionId}`);
  });

  // Messages endpoint - receives POST requests from clients
  app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    
    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId query parameter" });
      return;
    }

    const transport = transports.get(sessionId);
    
    if (!transport) {
      res.status(404).json({ error: "Session not found. SSE connection may have been closed." });
      return;
    }

    try {
      // Handle the incoming message
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error(`Error handling message for session ${sessionId}:`, error);
      // Response already sent by handlePostMessage
    }
  });

  // Start the server
  const httpServer = app.listen(port, () => {
    console.log(`IcePanel MCP Server (SSE) listening on http://localhost:${port}`);
    console.log(`  SSE endpoint: http://localhost:${port}/sse`);
    console.log(`  Health check: http://localhost:${port}/health`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("\nShutting down HTTP server...");
    
    // Close all active transports
    for (const [sessionId, transport] of transports) {
      console.log(`Closing session: ${sessionId}`);
      transport.close();
    }
    transports.clear();
    
    httpServer.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

