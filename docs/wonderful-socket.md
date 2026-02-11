# Connecting to Wonderful Agent Chat via WebSocket

## Overview

Wonderful exposes a WebSocket endpoint to chat with AI agents in real time. This guide covers authentication, connection, message formats, and the full session lifecycle.

---

## 1. Authentication — Getting an Access Token

Wonderful uses **Access Tokens** (API keys) for programmatic access.

### Create an Access Token

```http
POST https://<wonderful-api-host>/api/v1/tenants/{tenantId}/access-tokens
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{
  "name": "my-integration",
  "entity_type": "user",
  "entity_id": "<user-uuid>"
}
```

**Response:**
```json
{
  "id": "<token-id>",
  "name": "my-integration",
  "entity_type": "user",
  "entity_id": "<user-uuid>",
  "value": "<ACCESS_TOKEN>"   // ← save this, it's shown only once
}
```

The `value` field is your access token. Store it securely — it cannot be retrieved again.

### Alternative: Use a JWT

If you already have a Wonderful JWT (e.g. from Cognito login), you can use that directly.

---

## 2. WebSocket Connection

### Endpoint

```
wss://<wonderful-api-host>/api/v1/agents/{agentId}/chat?commType=chat
```

### Query Parameters

| Parameter           | Required | Default  | Description |
|---------------------|----------|----------|-------------|
| `commType`          | No       | `"chat"` | `"chat"`, `"voice"`, or `"email"` |
| `synthetic`         | No       | `false`  | Set to `"true"` for test/preview mode |
| `syntheticCommType` | No       | —        | Override comm type in synthetic mode |

### Authentication via Sec-WebSocket-Protocol Header

Tokens are passed in the `Sec-WebSocket-Protocol` header (not URL params, for security):

**Option A — Access Token:**
```javascript
const ws = new WebSocket(
  'wss://api.example.com/api/v1/agents/<agentId>/chat?commType=chat',
  ['token', '<ACCESS_TOKEN>']
);
```

**Option B — API Key:**
```javascript
const ws = new WebSocket(
  'wss://api.example.com/api/v1/agents/<agentId>/chat?commType=chat',
  ['apikey', '<API_KEY>']
);
```

The second element of the subprotocol array is your credential.

**Option C — Authorization Header (non-browser clients):**
If your WebSocket library supports custom headers:
```
Authorization: Bearer <JWT>
```
or
```
X-API-Key: <ACCESS_TOKEN>
```

---

## 3. Session Lifecycle

```
Client                              Server
  │                                    │
  ├─ WebSocket upgrade + token ──────►│
  │                                    │
  │◄── 101 Switching Protocols ────────┤
  │                                    │
  │◄── {"type":"start", ...} ──────────┤  (connection confirmed)
  │                                    │
  │  (optional) send init message ────►│
  │                                    │
  │◄── transcript (initial message) ───┤  (agent greeting)
  │                                    │
  │── user message ──────────────────►│
  │                                    │
  │◄── transcript (agent response) ────┤  (may be multiple)
  │◄── {"type":"turn_ended"} ──────────┤  (agent done, your turn)
  │                                    │
  │  ... repeat ...                    │
  │                                    │
  │◄── {"type":"communication_ended"} ─┤  (session over)
  │                                    │
  └─ close WebSocket ─────────────────►│
```

---

## 4. Message Formats

### Client → Server

All messages are JSON strings.

#### a) Send a chat message

```json
{
  "type": "message",
  "text": "Hello, I need help with my order"
}
```

#### b) Send initialization metadata (optional, send once after connect)

```json
{
  "type": "init",
  "metadata": {
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "session_id": "abc-123",
    "custom_field": "any value"
  }
}
```

This metadata is stored on the communication record and can be used by the agent.

#### c) Plain text fallback

Any non-JSON string or JSON without a `type` field is treated as a plain text user message:
```
Hello, I need help
```

### Server → Client

#### a) `start` — Connection established

```json
{
  "type": "start",
  "communication_id": "550e8400-e29b-41d4-a716-446655440000",
  "event": "start"
}
```

Save `communication_id` — it identifies this chat session.

#### b) `transcript` — Message from agent or echo of user message

```json
{
  "type": "transcript",
  "data": {
    "id": "message-uuid",
    "communication_id": "session-uuid",
    "speaker": "agent",
    "text": "Hi! How can I help you today?",
    "created_at": 1706612345000,
    "start_time": 1706612345000,
    "end_time": 1706612345500,
    "tool_details": null,
    "is_eot": false
  }
}
```

**`speaker` values:**
- `"agent"` — AI agent response
- `"customer"` — Echo of user's message
- `"system"` — System-generated message
- `"human_agent"` — Human agent (after handoff)

**`tool_details`** (when agent calls a tool):
```json
{
  "tool_details": {
    "function_name": "get_order_status",
    "description": "Checked order status",
    "output": "Order #123 is shipped",
    "params": {"order_id": "123"}
  }
}
```

#### c) `turn_ended` — Agent finished responding

```json
{
  "type": "turn_ended"
}
```

All transcript events for the current turn are guaranteed to arrive BEFORE this event.

#### d) `communication_ended` — Session terminated

```json
{
  "type": "communication_ended"
}
```

The chat is over. Close the WebSocket connection.

---

## 5. Minimal Working Example (JavaScript/TypeScript)

```typescript
const WONDERFUL_API = 'wss://your-domain.api.wonderful.ai';
const AGENT_ID = '3159277f-66b9-484f-947b-5b96586f8031';
const ACCESS_TOKEN = '<your-access-token>';

function connectToAgent() {
  const url = `${WONDERFUL_API}/api/v1/agents/${AGENT_ID}/chat?commType=chat`;
  const ws = new WebSocket(url, ['token', ACCESS_TOKEN]);

  let communicationId: string | null = null;

  ws.onopen = () => {
    console.log('Connected to agent');

    // Optional: send init metadata
    ws.send(JSON.stringify({
      type: 'init',
      metadata: { user_name: 'Test User' }
    }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
      case 'start':
        communicationId = msg.communication_id;
        console.log('Session started:', communicationId);
        break;

      case 'transcript':
        const { speaker, text, tool_details } = msg.data;
        if (speaker === 'agent') {
          console.log(`Agent: ${text}`);
          if (tool_details) {
            console.log(`  [Tool: ${tool_details.function_name}]`);
          }
        }
        break;

      case 'turn_ended':
        console.log('--- Agent finished, waiting for your input ---');
        break;

      case 'communication_ended':
        console.log('Session ended');
        ws.close();
        break;
    }
  };

  ws.onclose = (event) => {
    console.log('Disconnected', event.code, event.reason);
    // Reconnect logic: if code !== 1000, reconnect after 2s
    if (event.code !== 1000) {
      setTimeout(connectToAgent, 2000);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  // Send a message
  function sendMessage(text: string) {
    ws.send(JSON.stringify({ type: 'message', text }));
  }

  return { ws, sendMessage };
}
```

## 6. Python Example

```python
import asyncio
import json
import websockets

WONDERFUL_API = "wss://your-domain.api.wonderful.ai"
AGENT_ID = "3159277f-66b9-484f-947b-5b96586f8031"
ACCESS_TOKEN = "<your-access-token>"

async def chat():
    url = f"{WONDERFUL_API}/api/v1/agents/{AGENT_ID}/chat?commType=chat"
    async with websockets.connect(
        url,
        subprotocols=["token", ACCESS_TOKEN]
    ) as ws:
        # Optional: send init metadata
        await ws.send(json.dumps({
            "type": "init",
            "metadata": {"user_name": "Test User"}
        }))

        async for raw in ws:
            msg = json.loads(raw)

            if msg["type"] == "start":
                print(f"Session: {msg['communication_id']}")

            elif msg["type"] == "transcript":
                data = msg["data"]
                if data["speaker"] == "agent":
                    print(f"Agent: {data['text']}")

            elif msg["type"] == "turn_ended":
                # Send next message
                user_input = input("You: ")
                if user_input.lower() == "quit":
                    break
                await ws.send(json.dumps({
                    "type": "message",
                    "text": user_input
                }))

            elif msg["type"] == "communication_ended":
                print("Session ended")
                break

asyncio.run(chat())
```

---

## 7. Important Notes

- **Keep-alive**: Server sends WebSocket ping frames every 5 seconds. Most clients handle this automatically.
- **Reconnection**: On unexpected disconnect, wait 2 seconds and reconnect. Refresh your access token if using JWT.
- **Intentional close** (code 1000) means the session ended normally — don't reconnect.
- **Ordering guarantee**: All `transcript` events for an agent turn arrive before `turn_ended`.
- **XSS protection**: All metadata is sanitized server-side.
- **Synthetic mode**: Add `&synthetic=true` to the URL for testing without affecting analytics.
