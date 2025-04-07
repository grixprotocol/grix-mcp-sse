#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { GrixSDK } from "@grixprotocol/sdk";

dotenv.config();

const server = new Server(
	{
		name: "GRIX MCP",
		version: "1.1.0",
	},
	{
		capabilities: {
			tools: {},
		},
	}
);

// Create a map to store SDK instances per API key
const sdkInstances: Map<string, GrixSDK> = new Map();

// Function to get or create SDK instance
async function getSDKInstance(apiKey: string) {
	if (!sdkInstances.has(apiKey)) {
		const sdk = await GrixSDK.initialize({
			apiKey: apiKey,
		});
		sdkInstances.set(apiKey, sdk);
	}
	return sdkInstances.get(apiKey)!;
}

// Set up Express app and transport lookup
const app = express();
const transports: { [sessionId: string]: SSEServerTransport } = {};

// Handle SSE connections
app.get("/sse", async (req: Request, res: Response) => {
	const apiKey = req.query.apiKey as string;
	console.log("apiKey-query", apiKey);
	if (!apiKey) {
		res.status(400).send("API key is required");
		return;
	}

	try {
		// Get or create SDK instance for this API key
		const grixSDK = await getSDKInstance(apiKey);
		const { schemas, handleOperation } = grixSDK.mcp;
		const allSchemas = schemas.map((schema) => schema.schema);

		// Update the server handlers with this SDK instance
		server.setRequestHandler(ListToolsRequestSchema, async () => {
			return {
				tools: allSchemas,
			};
		});

		server.setRequestHandler(CallToolRequestSchema, async (request) => {
			const { name, arguments: args } = request.params;
			return await handleOperation(name, args);
		});

		console.error(`📡 New SSE connection request received at ${new Date().toISOString()}`);
		const transport = new SSEServerTransport("/messages", res);
		transports[transport.sessionId] = transport;

		console.error(`✅ SSE connection established - Session ID: ${transport.sessionId}`);

		res.on("close", () => {
			console.error(`🔌 SSE connection closed - Session ID: ${transport.sessionId}`);
			delete transports[transport.sessionId];
			console.error(`📊 Active SSE connections: ${Object.keys(transports).length}`);
		});

		await server.connect(transport);
	} catch (error) {
		console.error("Error establishing SSE connection:", error);
		res.status(500).send("Failed to initialize connection");
	}
});

// Handle messages
app.post("/messages", async (req: Request, res: Response) => {
	const sessionId = req.query.sessionId as string;
	const transport = transports[sessionId];

	if (transport) {
		await transport.handlePostMessage(req, res);
	} else {
		res.status(400).send("No transport found for sessionId");
	}
});

// Start the server with Express
async function main() {
	try {
		console.error("Initializing Grix MCP Server...");
		const PORT = process.env.PORT || 3000;
		app.listen(PORT, () => {
			console.error(`Grix MCP Server running on http://localhost:${PORT}`);
		});
	} catch (error) {
		console.error("Fatal error in main():", error);
		if (error instanceof Error) {
			console.error("Error details:", error.message);
			console.error("Stack trace:", error.stack);
		}
		process.exit(1);
	}
}

process.on("unhandledRejection", (error: unknown) => {
	console.error("Unhandled rejection:", error);
	process.exit(1);
});

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
