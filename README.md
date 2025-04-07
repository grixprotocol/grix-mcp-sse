# grix-mcp-sse

## Description

A server-sent events (SSE) implementation for Grix MCP.

## Installation

```bash
pnpm install
```

## Configuration

Create a configuration file with your SSE settings:

```json
{
	"GRIX-MCP": {
		"url": "http://localhost:3000/sse?apiKey=YOUR_API_KEY",
		"disabled": false,
		"autoApprove": []
	}
}
```

## Usage

Start the server:

```bash
pnpm start
```
