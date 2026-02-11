# Wonderful Voice Agent - WebSocket Integration Guide

This guide explains how to connect to a Wonderful voice agent via WebSocket for real-time bidirectional voice communication from a browser or any WebSocket client.

## Endpoint

```
wss://<host>/telephony/websocket/call?agent_id=<agent_id>
```

**Example:**
```
wss://o2-slovakia.api.demo.wonderful.ai/telephony/websocket/call?agent_id=6bab2049-52b3-4c1d-87e1-e4c05f471cd2&from=Wonderful+CS&synthetic=true
```

## Authentication

Authentication is performed via the `Sec-WebSocket-Protocol` header during the WebSocket handshake. Two schemes are supported:

### API Key (recommended for server-to-server or external integrations)

Pass the API key as a WebSocket subprotocol:

```javascript
const ws = new WebSocket(url, ["apikey", "your-api-key-here"]);
```

This sends the header: `Sec-WebSocket-Protocol: apikey, your-api-key-here`

### Bearer Token (for browser apps with user auth)

```javascript
const ws = new WebSocket(url, ["token", accessToken]);
```

This sends the header: `Sec-WebSocket-Protocol: token, <jwt-access-token>`

### Alternative: X-API-Key Header

If your WebSocket client supports custom headers on upgrade (most non-browser clients do), you can also pass:

```
X-API-Key: your-api-key-here
```

> **Note:** Browser `WebSocket` API does not support custom headers. Use the `Sec-WebSocket-Protocol` method from a browser.

## Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `agent_id` | **Yes** | UUID of the agent to call (max 100 chars) |
| `from` | No | Caller identifier, e.g. phone number or name (max 100 chars) |
| `to` | No | Recipient identifier; defaults to the agent's name (max 100 chars) |
| `direction` | No | `"incoming"` (default) or `"outgoing"` |
| `metadata` | No | Base64url-encoded JSON object (see below, max 10KB) |
| `synthetic` | No | Set to `"true"` for test/preview calls (won't count as real interactions) |
| `draft_agent_id` | No | Draft agent ID for preview mode (max 100 chars) |

### Metadata Encoding

Metadata is a `map[string]string` (flat key-value pairs, string values only), encoded as **base64url without padding** (`base64.RawURLEncoding` in Go, also known as RFC 4648 base64url with no `=` padding):

```javascript
const metadata = { user_name: "John", session_id: "abc-123" };
const json = JSON.stringify(metadata);

// base64url encode without padding
const encoded = btoa(json)
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

// Append to URL
const url = `wss://host/telephony/websocket/call?agent_id=...&metadata=${encoded}`;
```

The server automatically adds `"source": "websocket"` to the metadata.

## Audio Format

All audio is streamed as **mu-law (G.711 u-law) encoded, 8 kHz, mono, 8-bit**.

| Property | Value |
|----------|-------|
| Codec | mu-law (u-law, G.711) |
| Sample rate | 8000 Hz |
| Channels | 1 (mono) |
| Bit depth | 8 bits per sample (after mu-law compression) |
| Transport encoding | Base64 (standard, with padding) |

### Audio Pipeline: Microphone to Server

```
Browser mic (e.g. 48kHz float32)
  → Resample to 8000 Hz
  → Convert float32 → int16
  → mu-law encode → uint8 (1 byte per sample)
  → Base64 encode → string
  → Send as JSON: { "event": "audio", "payload": "<base64>" }
```

### Audio Pipeline: Server to Speaker

```
Receive JSON: { "event": "audio", "payload": "<base64>" }
  → Base64 decode → uint8 array
  → mu-law decode → int16 array
  → Convert int16 → float32
  → Play at 8000 Hz sample rate
```

## Message Protocol

All messages are JSON text frames. There are no binary frames.

### Client → Server Messages

#### 1. Start (initiate the call after connection)

```json
{ "event": "start" }
```

Send this immediately after the WebSocket connection opens. The server uses this to confirm the call has started.

#### 2. Audio (stream microphone audio)

```json
{
  "event": "audio",
  "payload": "<base64-encoded-mulaw-bytes>"
}
```

Send continuously as you capture audio from the microphone. Typical chunk size is ~20ms worth of audio (~160 samples = 160 bytes of mu-law = ~216 chars base64).

#### 3. DTMF (send a keypad digit)

```json
{
  "event": "dtmf",
  "dtmf": "1"
}
```

Valid digits: `0`-`9`, `*`, `#`.

#### 4. Mark (audio position tracking)

```json
{
  "event": "mark",
  "mark": "<mark-id>"
}
```

Sent to inform the server that a specific audio mark position was reached during playback.

#### 5. Stop (end the call)

```json
{ "event": "stop" }
```

Send this to gracefully end the call. You can also simply close the WebSocket.

### Server → Client Messages

#### 1. Start (connection confirmed)

```json
{
  "event": "start",
  "communication_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Sent once after the connection is established. Save the `communication_id` -- it identifies this call for transcript retrieval, logging, etc.

#### 2. Audio (agent speech)

```json
{
  "event": "audio",
  "payload": "<base64-encoded-mulaw-bytes>"
}
```

Decode and play through the speaker. The audio is mu-law encoded at 8 kHz.

#### 3. Mark (audio position marker)

```json
{
  "event": "mark",
  "mark": "<mark-id>"
}
```

Track this mark and send it back to the server when playback reaches this position.

#### 4. Clear (barge-in / flush playback buffer)

```json
{ "event": "clear" }
```

Stop playing any buffered audio immediately. This is sent when the user starts speaking (barge-in), indicating the agent has stopped its current utterance.

#### 5. Stop (call ended by server)

```json
{ "event": "stop" }
```

The call has been terminated by the agent or server. Close the WebSocket connection.

## Connection Lifecycle

```
Client                                     Server
  │                                           │
  ├─── WebSocket upgrade ───────────────────► │  (with auth in Sec-WebSocket-Protocol)
  │                                           │
  │ ◄──── 101 Switching Protocols ─────────── │
  │                                           │
  ├─── { "event": "start" } ────────────────► │  (client signals ready)
  │                                           │
  │ ◄──── { "event": "start",  ────────────── │  (server confirms, sends communication_id)
  │         "communication_id": "..." }       │
  │                                           │
  │ ◄──── { "event": "audio", ... } ───────── │  (agent greeting)
  │                                           │
  │ ─── { "event": "audio", ... } ──────────► │  (user speech)
  │                                           │
  │ ◄──── { "event": "clear" } ─────────────  │  (barge-in: stop playback)
  │                                           │
  │ ◄──── { "event": "audio", ... } ───────── │  (agent response)
  │                                           │
  │ ◄──── { "event": "mark", ... } ────────── │  (mark for position tracking)
  │                                           │
  │     ... bidirectional audio streaming ...  │
  │                                           │
  │ ─── { "event": "stop" } ────────────────► │  (client hangs up)
  │                                           │  OR
  │ ◄──── { "event": "stop" } ──────────────  │  (server ends call)
  │                                           │
  └─── WebSocket close ─────────────────────► │
```

### Keep-Alive

The server sends WebSocket **ping** frames every 5 seconds. Standard WebSocket clients (including browsers) respond with pong frames automatically. No action needed on your end.

### Disconnection

- **Normal close**: Send `{ "event": "stop" }` then close the WebSocket with code `1000`.
- **Server-initiated**: You'll receive `{ "event": "stop" }` followed by the WebSocket closing.
- **Unexpected disconnect**: If the WebSocket closes with a code other than `1000`, the call was interrupted.

## Complete Browser Example

```html
<!DOCTYPE html>
<html>
<head><title>Wonderful Voice Agent Call</title></head>
<body>
  <button id="callBtn">Start Call</button>
  <button id="hangupBtn" disabled>Hang Up</button>
  <div id="status">Idle</div>

  <!-- mu-law codec: https://www.npmjs.com/package/alawmulaw -->
  <script src="https://cdn.jsdelivr.net/npm/alawmulaw@2.0.3/dist/alawmulaw.min.js"></script>

  <script>
    const AGENT_ID = "YOUR_AGENT_ID";
    const API_KEY = "YOUR_API_KEY";
    const HOST = "o2-slovakia.api.demo.wonderful.ai";

    let ws = null;
    let micStream = null;
    let micContext = null;
    let playbackContext = null;
    let scriptProcessorNode = null;
    let communicationId = null;

    // ── Audio helpers ──────────────────────────────────────────────

    function float32ToInt16(float32Array) {
      const int16 = new Int16Array(float32Array.length);
      for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return int16;
    }

    function int16ToFloat32(int16Array) {
      const float32 = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32[i] = int16Array[i] / 0x8000;
      }
      return float32;
    }

    function resample(input, fromRate, toRate) {
      if (fromRate === toRate) return input;
      const ratio = fromRate / toRate;
      const outputLength = Math.ceil(input.length / ratio);
      const output = new Float32Array(outputLength);
      for (let i = 0; i < outputLength; i++) {
        const srcIdx = i * ratio;
        const floor = Math.floor(srcIdx);
        const ceil = Math.min(floor + 1, input.length - 1);
        const t = srcIdx - floor;
        output[i] = input[floor] * (1 - t) + input[ceil] * t;
      }
      return output;
    }

    function encodeBase64(uint8Array) {
      let binary = "";
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      return btoa(binary);
    }

    function decodeBase64(b64) {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }

    // ── Playback queue ─────────────────────────────────────────────

    let playbackQueue = [];
    let isPlaying = false;

    function queuePlayback(float32Samples) {
      playbackQueue.push(float32Samples);
      if (!isPlaying) drainPlaybackQueue();
    }

    function drainPlaybackQueue() {
      if (playbackQueue.length === 0 || !playbackContext) {
        isPlaying = false;
        return;
      }
      isPlaying = true;
      const samples = playbackQueue.shift();
      const buffer = playbackContext.createBuffer(1, samples.length, 8000);
      buffer.copyToChannel(samples, 0);
      const source = playbackContext.createBufferSource();
      source.buffer = buffer;
      source.connect(playbackContext.destination);
      source.onended = () => drainPlaybackQueue();
      source.start();
    }

    function clearPlayback() {
      playbackQueue = [];
      // Note: currently playing buffer will finish, but queue is flushed
    }

    // ── WebSocket handling ─────────────────────────────────────────

    function handleServerMessage(data) {
      const msg = JSON.parse(data);

      switch (msg.event) {
        case "start":
          communicationId = msg.communication_id;
          document.getElementById("status").textContent =
            "Connected (comm: " + communicationId + ")";
          break;

        case "audio":
          // Decode: base64 → mu-law bytes → int16 → float32
          const bytes = decodeBase64(msg.payload);
          const int16 = alawmulaw.mulaw.decode(bytes);
          const float32 = int16ToFloat32(int16);
          queuePlayback(float32);
          break;

        case "clear":
          clearPlayback();
          break;

        case "mark":
          // When playback reaches this mark, send it back to the server
          // (simplified: send immediately; production should track playback position)
          ws.send(JSON.stringify({ event: "mark", mark: msg.mark }));
          break;

        case "stop":
          document.getElementById("status").textContent = "Call ended by agent";
          cleanup();
          break;
      }
    }

    // ── Start call ─────────────────────────────────────────────────

    document.getElementById("callBtn").onclick = async function() {
      try {
        document.getElementById("status").textContent = "Connecting...";

        // 1. Get microphone access
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        });

        // 2. Create audio contexts
        //    - Mic context at browser's native sample rate
        //    - Playback context at 8kHz (browser upsamples to hardware)
        micContext = new AudioContext();
        playbackContext = new AudioContext({ sampleRate: 8000 });

        // 3. Connect WebSocket with API key auth
        const params = new URLSearchParams({
          agent_id: AGENT_ID,
          from: "Integration Test",
          synthetic: "true",
        });
        const url = `wss://${HOST}/telephony/websocket/call?${params}`;
        ws = new WebSocket(url, ["apikey", API_KEY]);

        ws.onopen = () => {
          // Signal ready to the server
          ws.send(JSON.stringify({ event: "start" }));
          document.getElementById("callBtn").disabled = true;
          document.getElementById("hangupBtn").disabled = false;
        };

        ws.onmessage = (event) => handleServerMessage(event.data);

        ws.onclose = (event) => {
          document.getElementById("status").textContent =
            `Disconnected (code: ${event.code})`;
          cleanup();
        };

        ws.onerror = () => {
          document.getElementById("status").textContent = "Connection error";
        };

        // 4. Set up microphone capture → mu-law encoding → send to server
        //    Using ScriptProcessorNode for simplicity (deprecated but widely supported).
        //    Production apps should use AudioWorklet.
        const source = micContext.createMediaStreamSource(micStream);
        scriptProcessorNode = micContext.createScriptProcessor(4096, 1, 1);

        scriptProcessorNode.onaudioprocess = (e) => {
          if (!ws || ws.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);

          // Resample from native rate to 8kHz
          const resampled = resample(inputData, micContext.sampleRate, 8000);

          // float32 → int16 → mu-law → base64
          const int16 = float32ToInt16(resampled);
          const encoded = alawmulaw.mulaw.encode(int16);
          const b64 = encodeBase64(encoded);

          ws.send(JSON.stringify({ event: "audio", payload: b64 }));
        };

        source.connect(scriptProcessorNode);
        scriptProcessorNode.connect(micContext.destination);

      } catch (err) {
        document.getElementById("status").textContent = "Error: " + err.message;
        cleanup();
      }
    };

    // ── Hang up ────────────────────────────────────────────────────

    document.getElementById("hangupBtn").onclick = function() {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: "stop" }));
      }
      cleanup();
      document.getElementById("status").textContent = "Call ended";
    };

    function cleanup() {
      if (scriptProcessorNode) {
        scriptProcessorNode.disconnect();
        scriptProcessorNode = null;
      }
      if (micStream) {
        micStream.getTracks().forEach(t => t.stop());
        micStream = null;
      }
      if (micContext && micContext.state !== "closed") {
        micContext.close();
        micContext = null;
      }
      if (playbackContext && playbackContext.state !== "closed") {
        playbackContext.close();
        playbackContext = null;
      }
      if (ws) {
        ws.onclose = null; // Prevent recursive cleanup
        ws.close();
        ws = null;
      }
      playbackQueue = [];
      isPlaying = false;
      document.getElementById("callBtn").disabled = false;
      document.getElementById("hangupBtn").disabled = true;
    }
  </script>
</body>
</html>
```

## Non-Browser Client Example (Node.js)

```javascript
import WebSocket from "ws";
import { mulaw } from "alawmulaw";

const AGENT_ID = "YOUR_AGENT_ID";
const API_KEY = "YOUR_API_KEY";
const HOST = "o2-slovakia.api.demo.wonderful.ai";

const url = `wss://${HOST}/telephony/websocket/call?agent_id=${AGENT_ID}&from=NodeClient&synthetic=true`;

// For non-browser clients, you can use either method:

// Option A: Sec-WebSocket-Protocol (same as browser)
const ws = new WebSocket(url, ["apikey", API_KEY]);

// Option B: Custom header (non-browser only)
// const ws = new WebSocket(url, { headers: { "X-API-Key": API_KEY } });

ws.on("open", () => {
  console.log("Connected");
  ws.send(JSON.stringify({ event: "start" }));

  // Send audio: read from mic/file, encode as mu-law 8kHz, base64, send
  // sendAudioChunk(mulawBase64String);
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  switch (msg.event) {
    case "start":
      console.log("Call started, communication_id:", msg.communication_id);
      break;
    case "audio":
      // Decode: base64 → mu-law → PCM int16
      const bytes = Buffer.from(msg.payload, "base64");
      const pcm = mulaw.decode(bytes);
      // Play pcm (int16, 8kHz, mono) through your audio output
      break;
    case "clear":
      // Flush playback buffer
      break;
    case "stop":
      console.log("Call ended by server");
      ws.close();
      break;
  }
});

ws.on("close", (code) => console.log("Disconnected:", code));
ws.on("error", (err) => console.error("Error:", err.message));

// Hang up
function hangup() {
  ws.send(JSON.stringify({ event: "stop" }));
  ws.close();
}
```

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 101 | Success - WebSocket connection established |
| 400 | Invalid parameters (missing agent_id, bad metadata, etc.) |
| 401 | Missing or invalid authentication |
| 403 | Agent not accessible to this user/key |
| 404 | Agent not found |

## Tips for Production Integrations

1. **Pre-buffer playback**: Buffer ~300ms of audio before starting playback to avoid choppy audio from network jitter.

2. **Handle barge-in**: When you receive a `"clear"` event, immediately stop playing any buffered audio. This means the user started speaking and the agent is listening.

3. **Track marks**: The server sends `"mark"` events with IDs. When your playback reaches that position, send the mark back. This helps the server synchronize speech and actions.

4. **Use AudioWorklet**: The browser example above uses `ScriptProcessorNode` for simplicity, but production apps should use `AudioWorklet` for better performance and lower latency.

5. **Echo cancellation**: Enable `echoCancellation`, `noiseSuppression`, and `autoGainControl` in `getUserMedia` constraints.

6. **Chunk size**: ~20ms chunks (160 samples at 8kHz = 160 bytes mu-law) is a good balance between latency and overhead.

7. **Reconnection**: If the WebSocket closes unexpectedly, wait ~2 seconds before reconnecting to avoid hammering the server.

8. **Synthetic mode**: Use `synthetic=true` during development and testing so calls don't appear in production analytics.

9. **mu-law library**: Use [alawmulaw](https://www.npmjs.com/package/alawmulaw) (npm) for encoding/decoding. The `mulaw.encode()` function takes `Int16Array` and returns `Uint8Array`; `mulaw.decode()` does the reverse.
