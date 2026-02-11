# Wonderful Voice Agent - Browser WebSocket Implementation Guide

A complete, copy-paste-ready guide for integrating real-time voice calls with a Wonderful agent from a web browser. Based on the exact production implementation.

## Architecture Overview

```
┌─────────────────── Browser (Main Thread) ───────────────────┐
│                                                              │
│  ┌──────────┐   getUserMedia    ┌───────────────────────┐   │
│  │ Mic ──────┼─────────────────►│ AudioContext (native)  │   │
│  └──────────┘                   │  └─ MicrophoneProcessor│   │
│                                 │     (AudioWorklet)     │   │
│                                 └──────────┬────────────┘   │
│                                   Float32 chunks│(~20ms)     │
│                                            ▼                 │
│                              ┌──────────────────────┐        │
│                              │  Web Worker           │        │
│                              │  ┌─ Resample 8kHz    │        │
│                              │  ├─ Float32→Int16    │        │
│                              │  ├─ mu-law encode    │        │
│                              │  ├─ Base64 encode    │        │
│                              │  │                    │        │
│                              │  │   WebSocket ◄────────────────── Server
│                              │  │                    │        │
│                              │  ├─ Base64 decode    │        │
│                              │  ├─ mu-law decode    │        │
│                              │  └─ Int16→Float32    │        │
│                              └──────────┬───────────┘        │
│                                Float32 samples│               │
│                                            ▼                 │
│                              ┌───────────────────────┐       │
│  ┌──────────┐                │ AudioContext (8kHz)    │       │
│  │ Speaker◄─┼────────────────│  └─ PlaybackProcessor │       │
│  └──────────┘                │     (AudioWorklet)    │       │
│                              └───────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

**Why this architecture?**

- **Two AudioContexts**: Playback runs at 8kHz (telephony rate) so the browser upsamples to hardware automatically. Mic runs at native rate (usually 48kHz) so no quality is lost during capture; the Worker downsamples to 8kHz.
- **Web Worker**: All WebSocket I/O and audio encoding/decoding runs off the main thread, keeping the UI responsive.
- **AudioWorklets**: Run on the audio rendering thread for glitch-free, low-latency capture and playback (unlike the deprecated `ScriptProcessorNode`).

## Step 1: Files You Need

You need **4 files** (plus the `alawmulaw` dependency):

```
your-project/
├── telephonyWorker.ts      # Web Worker: WebSocket + audio codec
├── worklets/
│   ├── microphoneProcessor.js   # AudioWorklet: mic capture
│   └── playbackProcessor.js     # AudioWorklet: audio playback
└── useTelephonySession.ts  # React hook (or adapt to vanilla JS)
```

**Dependency:** `alawmulaw` for mu-law encoding/decoding:
```bash
npm install alawmulaw
```

## Step 2: Microphone Processor (AudioWorklet)

**File: `worklets/microphoneProcessor.js`**

This runs on the audio rendering thread. It accumulates raw microphone samples into ~20ms chunks and sends them to the main thread.

```javascript
/**
 * AudioWorklet processor for microphone capture.
 * Accumulates samples into ~20ms chunks and posts them to the main thread.
 * Supports muting (sends silent audio to keep the stream alive).
 */
class MicrophoneProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = true;
    this.muted = false;
    // ~20ms chunks at 48kHz. The exact size adapts to whatever sample rate
    // the AudioContext is running at. Larger chunks = less message overhead.
    this.chunkSize = 960;
    this.buffer = new Float32Array(this.chunkSize);
    this.bufferIndex = 0;

    this.port.onmessage = (event) => {
      if (event.data?.type === "stop") {
        this.active = false;
      } else if (event.data?.type === "mute") {
        // Flush any pending audio before transitioning to muted
        // so speech captured before the mute button was pressed still reaches the server
        if (event.data.muted && !this.muted && this.bufferIndex > 0) {
          const chunk = this.buffer.slice(0, this.bufferIndex);
          this.port.postMessage(
            { type: "chunk", samples: chunk.buffer, sampleRate: sampleRate },
            [chunk.buffer]
          );
          this.buffer = new Float32Array(this.chunkSize);
          this.bufferIndex = 0;
        }
        this.muted = event.data.muted;
      }
    };
  }

  process(inputs) {
    if (!this.active) return false;

    const input = inputs[0]?.[0];
    if (!input || input.length === 0) return true;

    let inputIndex = 0;
    while (inputIndex < input.length) {
      const remaining = this.chunkSize - this.bufferIndex;
      const toCopy = Math.min(remaining, input.length - inputIndex);

      if (this.muted) {
        // Send zeros when muted (keeps the audio stream alive)
        this.buffer.fill(0, this.bufferIndex, this.bufferIndex + toCopy);
      } else {
        this.buffer.set(
          input.subarray(inputIndex, inputIndex + toCopy),
          this.bufferIndex
        );
      }
      this.bufferIndex += toCopy;
      inputIndex += toCopy;

      if (this.bufferIndex >= this.chunkSize) {
        const chunk = this.buffer.slice();
        // `sampleRate` is a global in AudioWorkletGlobalScope
        this.port.postMessage(
          { type: "chunk", samples: chunk.buffer, sampleRate: sampleRate },
          [chunk.buffer]
        );
        this.buffer = new Float32Array(this.chunkSize);
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor("microphone-processor", MicrophoneProcessor);
```

## Step 3: Playback Processor (AudioWorklet)

**File: `worklets/playbackProcessor.js`**

This runs on the audio rendering thread. It uses a ring buffer with dynamic growth, pre-buffering, barge-in support (clear), and mark tracking for synchronizing server-side events with audio playback position.

```javascript
/**
 * AudioWorklet processor for audio playback.
 *
 * Features:
 * - Dynamic ring buffer that grows as needed
 * - Pre-buffering: waits for ~300ms of audio before playing (prevents choppy start)
 * - Mark tracking: records positions in the audio stream; notifies when playback reaches them
 * - Clear (barge-in): flushes the buffer instantly when the user starts speaking
 */

const INITIAL_BUFFER_SIZE = 40000; // ~5 seconds at 8kHz
const PREBUFFER_SAMPLES = 2400;    // ~300ms at 8kHz

class PlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = true;
    this.buffer = new Float32Array(INITIAL_BUFFER_SIZE);
    this.bufferSize = INITIAL_BUFFER_SIZE;
    this.writeIndex = 0;
    this.readIndex = 0;
    this.samplesInBuffer = 0;
    this.totalSamplesWritten = 0;
    this.totalSamplesRead = 0;
    this.marks = [];
    this.isPreBuffering = true;

    // Signal ready so the main thread can start sending audio
    this.port.postMessage({ type: "ready" });

    this.port.onmessage = (event) => {
      const { type } = event.data || {};
      switch (type) {
        case "push": {
          const samples = new Float32Array(event.data.samples);
          this.enqueueSamples(samples);
          break;
        }
        case "mark": {
          // Record a mark at the current write position.
          // When playback reaches this position, we'll notify the main thread.
          this.marks.push({
            id: event.data.id,
            position: this.totalSamplesWritten,
          });
          break;
        }
        case "clear": {
          // Barge-in: flush everything and reset
          this.buffer = new Float32Array(INITIAL_BUFFER_SIZE);
          this.bufferSize = INITIAL_BUFFER_SIZE;
          this.writeIndex = 0;
          this.readIndex = 0;
          this.samplesInBuffer = 0;
          this.isPreBuffering = true;
          this.marks = [];
          this.port.postMessage({ type: "cleared" });
          break;
        }
        case "stop": {
          this.active = false;
          break;
        }
      }
    };
  }

  growBuffer() {
    const newSize = this.bufferSize + INITIAL_BUFFER_SIZE;
    const newBuffer = new Float32Array(newSize);
    // Linearize the ring buffer into the new buffer
    for (let i = 0; i < this.samplesInBuffer; i++) {
      newBuffer[i] = this.buffer[(this.readIndex + i) % this.bufferSize];
    }
    this.buffer = newBuffer;
    this.bufferSize = newSize;
    this.readIndex = 0;
    this.writeIndex = this.samplesInBuffer;
  }

  enqueueSamples(samples) {
    while (this.samplesInBuffer + samples.length > this.bufferSize) {
      this.growBuffer();
    }
    for (let i = 0; i < samples.length; i++) {
      this.buffer[this.writeIndex] = samples[i];
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
      this.samplesInBuffer++;
      this.totalSamplesWritten++;
    }
    if (this.isPreBuffering && this.samplesInBuffer >= PREBUFFER_SAMPLES) {
      this.isPreBuffering = false;
    }
  }

  process(_inputs, outputs) {
    if (!this.active) return false;

    const output = outputs[0]?.[0];
    if (!output) return true;

    if (this.isPreBuffering) {
      output.fill(0);
      return true;
    }

    for (let i = 0; i < output.length; i++) {
      if (this.samplesInBuffer > 0) {
        output[i] = this.buffer[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
        this.samplesInBuffer--;
        this.totalSamplesRead++;
      } else {
        output[i] = 0; // Underrun — output silence
      }
    }

    this.checkMarks();
    return true;
  }

  checkMarks() {
    const reached = [];
    const remaining = [];
    for (const mark of this.marks) {
      if (this.totalSamplesRead >= mark.position) {
        reached.push(mark);
      } else {
        remaining.push(mark);
      }
    }
    this.marks = remaining;
    for (const mark of reached) {
      this.port.postMessage({ type: "markReached", id: mark.id });
    }
  }
}

registerProcessor("playback-processor", PlaybackProcessor);
```

## Step 4: Web Worker (WebSocket + Audio Codec)

**File: `telephonyWorker.ts`**

This runs in a dedicated Web Worker thread. It manages the WebSocket connection and handles all audio encoding (mic → mu-law → base64) and decoding (base64 → mu-law → PCM).

```typescript
/// <reference lib="webworker" />
import { mulaw } from "alawmulaw";

// ─── Types ─────────────────────────────────────────────────────

interface ConnectPayload {
  url: string;
  protocols?: string[];
}

interface MicChunkPayload {
  samples: ArrayBuffer;  // Float32Array buffer from mic worklet
  sampleRate: number;    // Native mic sample rate (e.g., 48000)
}

export type WorkerCommand =
  | { type: "connect"; payload: ConnectPayload }
  | { type: "disconnect" }
  | { type: "sendEvent"; payload: Record<string, unknown> }
  | { type: "micChunk"; payload: MicChunkPayload };

export type WorkerMessage =
  | { type: "connected" }
  | { type: "disconnected"; code?: number; reason?: string }
  | { type: "error"; message: string }
  | { type: "event"; payload: Record<string, unknown> }
  | { type: "audio"; samples: ArrayBuffer }
  | { type: "mark"; id: string };

// ─── State ─────────────────────────────────────────────────────

const ctx = self as DedicatedWorkerGlobalScope;
let socket: WebSocket | null = null;

// ─── Audio Utilities ───────────────────────────────────────────

function float32ToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function int16ToFloat32(input: Int16Array): Float32Array {
  const output = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    output[i] = input[i] / 0x8000;
  }
  return output;
}

/**
 * Linear interpolation resampler.
 * Downsamples mic audio from native rate (e.g. 48kHz) to 8kHz.
 */
function linearResample(
  input: Float32Array,
  fromRate: number,
  toRate: number
): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const outputLength = Math.ceil(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const floor = Math.floor(srcIndex);
    const ceil = Math.min(floor + 1, input.length - 1);
    const t = srcIndex - floor;
    output[i] = input[floor] * (1 - t) + input[ceil] * t;
  }
  return output;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Message Handling ──────────────────────────────────────────

function postToMain(message: WorkerMessage, transfer?: Transferable[]): void {
  if (transfer?.length) {
    ctx.postMessage(message, transfer);
  } else {
    ctx.postMessage(message);
  }
}

/**
 * Encode a mic chunk and send it to the server.
 * Pipeline: Float32 (native rate) → resample to 8kHz → Int16 → mu-law → base64 → JSON
 */
function handleMicChunk(payload: MicChunkPayload): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  const samples = new Float32Array(payload.samples);
  if (samples.length === 0) return;

  const resampled = linearResample(samples, payload.sampleRate, 8000);
  const int16 = float32ToInt16(resampled);
  const encoded = mulaw.encode(int16);

  socket.send(
    JSON.stringify({
      event: "audio",
      payload: encodeBase64(encoded),
    })
  );
}

/**
 * Decode server audio and send to the main thread for playback.
 * Pipeline: base64 → mu-law bytes → Int16 → Float32
 */
function handleInboundAudio(b64Payload: string): void {
  const bytes = decodeBase64(b64Payload);
  const int16 = mulaw.decode(bytes);
  const float32 = int16ToFloat32(int16);
  const buffer = float32.buffer as ArrayBuffer;
  postToMain({ type: "audio", samples: buffer }, [buffer]);
}

function handleSocketMessage(data: string): void {
  try {
    const message = JSON.parse(data);
    switch (message.event as string) {
      case "audio":
        if (typeof message.payload === "string") {
          handleInboundAudio(message.payload);
        }
        break;
      case "mark":
        if (typeof message.mark === "string") {
          postToMain({ type: "mark", id: message.mark });
        }
        break;
      case "clear":
        postToMain({ type: "event", payload: message });
        break;
      default:
        // Forward start, stop, and any other events
        postToMain({ type: "event", payload: message });
        break;
    }
  } catch {
    postToMain({ type: "error", message: "Failed to parse message" });
  }
}

// ─── WebSocket Management ──────────────────────────────────────

function connect(payload: ConnectPayload): void {
  if (socket) {
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    socket.onopen = null;
    socket.close();
    socket = null;
  }

  socket = new WebSocket(payload.url, payload.protocols);

  socket.onopen = () => postToMain({ type: "connected" });

  socket.onclose = (event) => {
    postToMain({ type: "disconnected", code: event.code, reason: event.reason });
    socket = null;
  };

  socket.onerror = () => {
    postToMain({ type: "error", message: "WebSocket connection error" });
  };

  socket.onmessage = (event) => {
    if (typeof event.data === "string") {
      handleSocketMessage(event.data);
    }
  };
}

function disconnect(): void {
  if (socket) {
    socket.close();
    socket = null;
  }
}

function sendEvent(payload: Record<string, unknown>): void {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

// ─── Worker Entry Point ────────────────────────────────────────

ctx.onmessage = (event: MessageEvent<WorkerCommand>) => {
  switch (event.data.type) {
    case "connect":
      connect(event.data.payload);
      break;
    case "disconnect":
      disconnect();
      break;
    case "sendEvent":
      sendEvent(event.data.payload);
      break;
    case "micChunk":
      handleMicChunk(event.data.payload);
      break;
  }
};
```

## Step 5: React Hook (Orchestrator)

**File: `useTelephonySession.ts`**

This is the main orchestrator. It creates the AudioContexts, loads the worklets, wires up the microphone, playback, and Worker, and exposes a simple API to the UI.

```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkerCommand, WorkerMessage } from "./telephonyWorker";

// ─── Types ─────────────────────────────────────────────────────

type SessionStatus = "idle" | "connecting" | "connected" | "disconnected";

interface UseTelephonySessionParams {
  /** Your Wonderful API base URL, e.g. "wss://myco.api.wonderful.ai" */
  wsBaseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Caller identifier (shown in transcripts) */
  from?: string;
  /** Optional base64url-encoded metadata JSON */
  metadataBase64?: string;
  /** Mark as test call (won't appear in analytics) */
  synthetic?: boolean;
  /** Callback with the communication_id (for transcript polling) */
  onCommunicationId?: (id: string) => void;
}

interface UseTelephonySessionReturn {
  status: SessionStatus;
  error: string | null;
  /** Call duration in seconds */
  elapsed: number;
  isMuted: boolean;
  /** Start a call to the given agent */
  connect: (agentId: string) => Promise<void>;
  /** End the call */
  hangup: () => void;
  /** Send a DTMF digit ("0"-"9", "*", "#") */
  sendDtmf: (digit: string) => void;
  /** Mute/unmute the microphone */
  setMuted: (muted: boolean) => void;
}

// ─── Worklet Loading ───────────────────────────────────────────

// Adjust these URLs to match where your worklet files are served from.
// With Vite/Webpack, `new URL("./path", import.meta.url)` works.
const microphoneWorkletUrl = new URL(
  "./worklets/microphoneProcessor.js",
  import.meta.url
);
const playbackWorkletUrl = new URL(
  "./worklets/playbackProcessor.js",
  import.meta.url
);

const loadedContexts = new WeakSet<AudioContext>();

async function ensureWorkletsLoaded(ctx: AudioContext): Promise<void> {
  if (loadedContexts.has(ctx)) return;
  await Promise.all([
    ctx.audioWorklet.addModule(microphoneWorkletUrl),
    ctx.audioWorklet.addModule(playbackWorkletUrl),
  ]);
  loadedContexts.add(ctx);
}

// ─── Hook ──────────────────────────────────────────────────────

export function useTelephonySession({
  wsBaseUrl,
  apiKey,
  from,
  metadataBase64,
  synthetic = false,
  onCommunicationId,
}: UseTelephonySessionParams): UseTelephonySessionReturn {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const micNodeRef = useRef<AudioWorkletNode | null>(null);
  const playbackNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isConnectingRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const playbackReadyRef = useRef(false);
  const pendingAudioRef = useRef<ArrayBuffer[]>([]);
  const onCommunicationIdRef = useRef(onCommunicationId);

  useEffect(() => {
    onCommunicationIdRef.current = onCommunicationId;
  }, [onCommunicationId]);

  // ── URL builder ────────────────────────────────────────────

  const buildWebSocketUrl = useCallback(
    (agentId: string): string => {
      const params = new URLSearchParams();
      params.set("agent_id", agentId);
      if (from) params.set("from", from);
      if (metadataBase64) params.set("metadata", metadataBase64);
      if (synthetic) params.set("synthetic", "true");
      return `${wsBaseUrl}/telephony/websocket/call?${params.toString()}`;
    },
    [wsBaseUrl, from, metadataBase64, synthetic]
  );

  // ── Helpers ────────────────────────────────────────────────

  const postToWorker = useCallback(
    (command: WorkerCommand, transfer?: Transferable[]) => {
      if (!workerRef.current) return;
      if (transfer?.length) {
        workerRef.current.postMessage(command, transfer);
      } else {
        workerRef.current.postMessage(command);
      }
    },
    []
  );

  const sendEvent = useCallback(
    (payload: Record<string, unknown>) => {
      postToWorker({ type: "sendEvent", payload });
    },
    [postToWorker]
  );

  // ── Timer ──────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── Cleanup ────────────────────────────────────────────────

  const cleanup = useCallback(
    (force = false) => {
      if (!force && (isConnectingRef.current || hasConnectedRef.current)) return;

      setIsMuted(false);
      micNodeRef.current?.port.postMessage({ type: "stop" });
      micNodeRef.current?.disconnect();
      micNodeRef.current = null;

      playbackNodeRef.current?.port.postMessage({ type: "stop" });
      playbackNodeRef.current?.disconnect();
      playbackNodeRef.current = null;

      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;

      if (playbackContextRef.current?.state !== "closed") {
        playbackContextRef.current?.close();
      }
      playbackContextRef.current = null;

      if (micContextRef.current?.state !== "closed") {
        micContextRef.current?.close();
      }
      micContextRef.current = null;

      postToWorker({ type: "disconnect" });
      stopTimer();
      setElapsed(0);

      isConnectingRef.current = false;
      hasConnectedRef.current = false;
      playbackReadyRef.current = false;
      pendingAudioRef.current = [];
    },
    [postToWorker, stopTimer]
  );

  // ── Worker message handler ─────────────────────────────────

  const handleWorkerMessage = useCallback(
    (message: WorkerMessage) => {
      switch (message.type) {
        case "connected":
          // Tell the server we're ready
          sendEvent({ event: "start" });
          break;

        case "disconnected":
          cleanup(true);
          setStatus("disconnected");
          break;

        case "error":
          setError(message.message);
          break;

        case "event": {
          const event = message.payload.event as string;
          if (event === "start") {
            setStatus("connected");
            setError(null);
            startTimer();
            if (message.payload.communication_id) {
              onCommunicationIdRef.current?.(
                message.payload.communication_id as string
              );
            }
          } else if (event === "stop") {
            cleanup(true);
            setStatus("disconnected");
          } else if (event === "clear") {
            // Barge-in: flush playback buffer immediately
            playbackNodeRef.current?.port.postMessage({ type: "clear" });
          }
          break;
        }

        case "audio":
          if (playbackNodeRef.current && playbackReadyRef.current) {
            playbackNodeRef.current.port.postMessage(
              { type: "push", samples: message.samples },
              [message.samples]
            );
          } else if (playbackNodeRef.current) {
            // Queue until playback worklet signals ready
            pendingAudioRef.current.push(message.samples);
          }
          break;

        case "mark":
          playbackNodeRef.current?.port.postMessage({
            type: "mark",
            id: message.id,
          });
          break;
      }
    },
    [cleanup, sendEvent, startTimer]
  );

  // ── Worker setup (once) ────────────────────────────────────

  const handleWorkerMessageRef = useRef(handleWorkerMessage);
  useEffect(() => {
    handleWorkerMessageRef.current = handleWorkerMessage;
  }, [handleWorkerMessage]);

  useEffect(() => {
    const worker = new Worker(
      new URL("./telephonyWorker.ts", import.meta.url),
      { type: "module" }
    );
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      handleWorkerMessageRef.current(event.data);
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // ── Connect ────────────────────────────────────────────────

  const connect = useCallback(
    async (agentId: string) => {
      if (!agentId) {
        setError("Agent ID is required");
        return;
      }

      const alreadyConnecting =
        isConnectingRef.current || hasConnectedRef.current;
      isConnectingRef.current = true;
      hasConnectedRef.current = true;
      setStatus("connecting");
      setError(null);

      try {
        // Create two AudioContexts:
        //  1. Playback at 8kHz — browser upsamples to hardware rate
        //  2. Mic at native rate — worker downsamples to 8kHz
        let playbackCtx = playbackContextRef.current;
        if (!playbackCtx || playbackCtx.state === "closed") {
          playbackCtx = new AudioContext({ sampleRate: 8000 });
          playbackContextRef.current = playbackCtx;
        }
        if (playbackCtx.state === "suspended") await playbackCtx.resume();

        let micCtx = micContextRef.current;
        if (!micCtx || micCtx.state === "closed") {
          micCtx = new AudioContext(); // Native rate
          micContextRef.current = micCtx;
        }
        if (micCtx.state === "suspended") await micCtx.resume();

        // Load worklets into both contexts
        await Promise.all([
          ensureWorkletsLoaded(playbackCtx),
          ensureWorkletsLoaded(micCtx),
        ]);

        // ── Playback worklet node ──────────────────────────────
        if (!playbackNodeRef.current) {
          const playbackNode = new AudioWorkletNode(
            playbackCtx,
            "playback-processor",
            { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] }
          );
          playbackNode.connect(playbackCtx.destination);
          playbackNodeRef.current = playbackNode;

          playbackNode.port.onmessage = (event) => {
            if (event.data?.type === "ready") {
              playbackReadyRef.current = true;
              for (const samples of pendingAudioRef.current) {
                playbackNode.port.postMessage({ type: "push", samples }, [samples]);
              }
              pendingAudioRef.current = [];
            } else if (event.data?.type === "markReached") {
              // Tell server we played past this mark
              sendEvent({ event: "mark", mark: event.data.id });
            }
          };
        }

        // ── Microphone access ──────────────────────────────────
        if (!mediaStreamRef.current) {
          mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        }

        // ── Microphone worklet node ────────────────────────────
        if (!micNodeRef.current && mediaStreamRef.current) {
          const micNode = new AudioWorkletNode(micCtx, "microphone-processor", {
            numberOfInputs: 1,
            numberOfOutputs: 0,
          });
          micNodeRef.current = micNode;

          const source = micCtx.createMediaStreamSource(mediaStreamRef.current);
          source.connect(micNode);

          micNode.port.onmessage = (event) => {
            if (event.data?.type === "chunk") {
              postToWorker(
                {
                  type: "micChunk",
                  payload: {
                    samples: event.data.samples,
                    sampleRate: event.data.sampleRate,
                  },
                },
                [event.data.samples]
              );
            }
          };
        }

        if (alreadyConnecting) return;

        // ── Open WebSocket via Worker ──────────────────────────
        const url = buildWebSocketUrl(agentId);
        postToWorker({
          type: "connect",
          payload: {
            url,
            protocols: ["apikey", apiKey],
          },
        });
      } catch (err) {
        cleanup();
        setStatus("idle");
        setError((err as Error).message || "Failed to connect");
      }
    },
    [apiKey, postToWorker, buildWebSocketUrl, cleanup, sendEvent]
  );

  // ── Hangup ─────────────────────────────────────────────────

  const hangup = useCallback(() => {
    sendEvent({ event: "stop" });
    cleanup(true);
    setStatus("disconnected");
  }, [sendEvent, cleanup]);

  // ── DTMF ──────────────────────────────────────────────────

  const sendDtmf = useCallback(
    (digit: string) => {
      sendEvent({ event: "dtmf", dtmf: digit });
    },
    [sendEvent]
  );

  // ── Mute ──────────────────────────────────────────────────

  const setMutedFn = useCallback((muted: boolean) => {
    setIsMuted(muted);
    micNodeRef.current?.port.postMessage({ type: "mute", muted });
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────

  const cleanupRef = useRef(cleanup);
  useEffect(() => {
    cleanupRef.current = cleanup;
  }, [cleanup]);

  useEffect(() => {
    return () => cleanupRef.current(true);
  }, []);

  // ── Return ────────────────────────────────────────────────

  return useMemo(
    () => ({
      status,
      error,
      elapsed,
      isMuted,
      connect,
      hangup,
      sendDtmf,
      setMuted: setMutedFn,
    }),
    [status, error, elapsed, isMuted, connect, hangup, sendDtmf, setMutedFn]
  );
}
```

## Step 6: Usage in a Component

```tsx
import { useTelephonySession } from "./useTelephonySession";

function CallButton({ agentId }: { agentId: string }) {
  const {
    status,
    error,
    elapsed,
    isMuted,
    connect,
    hangup,
    sendDtmf,
    setMuted,
  } = useTelephonySession({
    wsBaseUrl: "wss://o2-slovakia.api.demo.wonderful.ai",
    apiKey: "your-api-key-here",
    from: "My App User",
    synthetic: true,           // Set false for production calls
    onCommunicationId: (id) => {
      console.log("Call ID:", id);
      // Use this ID to poll for transcripts via the REST API
    },
  });

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timer = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <div>
      <p>Status: {status} {status === "connected" && timer}</p>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {status === "idle" && (
        <button onClick={() => connect(agentId)}>Start Call</button>
      )}

      {status === "connected" && (
        <>
          <button onClick={hangup}>Hang Up</button>
          <button onClick={() => setMuted(!isMuted)}>
            {isMuted ? "Unmute" : "Mute"}
          </button>
          <button onClick={() => sendDtmf("1")}>Press 1</button>
        </>
      )}

      {status === "disconnected" && (
        <button onClick={() => connect(agentId)}>Call Again</button>
      )}
    </div>
  );
}
```

## WebSocket Protocol Quick Reference

### Authentication

```javascript
// Browser — use Sec-WebSocket-Protocol (only option from browser JS)
new WebSocket(url, ["apikey", "YOUR_API_KEY"]);

// Non-browser — can also use X-API-Key header
new WebSocket(url, { headers: { "X-API-Key": "YOUR_API_KEY" } });
```

### Messages (all JSON text frames)

| Direction | Event | Payload | When |
|-----------|-------|---------|------|
| Client→Server | `start` | `{}` | After WebSocket opens |
| Client→Server | `audio` | `{ payload: "<base64 mu-law>" }` | Continuously from mic |
| Client→Server | `dtmf` | `{ dtmf: "1" }` | Keypad press |
| Client→Server | `mark` | `{ mark: "<id>" }` | Playback reached a mark position |
| Client→Server | `stop` | `{}` | Hang up |
| Server→Client | `start` | `{ communication_id: "uuid" }` | Call confirmed |
| Server→Client | `audio` | `{ payload: "<base64 mu-law>" }` | Agent speech |
| Server→Client | `mark` | `{ mark: "<id>" }` | Track this position in playback |
| Server→Client | `clear` | `{}` | Barge-in: flush playback buffer |
| Server→Client | `stop` | `{}` | Agent ended the call |

### Audio Spec

| Property | Value |
|----------|-------|
| Codec | mu-law (G.711) |
| Sample rate | 8000 Hz |
| Channels | 1 (mono) |
| Bits per sample | 8 (after mu-law) |
| Transport | Base64 in JSON |

## Key Implementation Details

### Why Two AudioContexts?

The playback AudioContext runs at **8000 Hz** (`new AudioContext({ sampleRate: 8000 })`). This means the playback worklet's `process()` callback receives output buffers sized for 8kHz, and the browser handles upsampling to the hardware output rate. This avoids manual upsampling in JavaScript.

The microphone AudioContext runs at the browser's **native rate** (typically 48kHz). This gives maximum mic quality. The Web Worker downsamples to 8kHz using linear interpolation before mu-law encoding.

### Why a Web Worker for the WebSocket?

Encoding/decoding mu-law and base64 on every ~20ms audio chunk is CPU work that would block the main thread and cause UI jank. The Worker keeps the main thread free.

### Pre-buffering (300ms)

The playback worklet waits until 2400 samples (~300ms at 8kHz) are buffered before starting playback. This absorbs network jitter and prevents choppy audio at the start of each agent utterance.

### Mark Tracking

Marks synchronize server-side events with audio playback position. The flow is:

1. Server sends `{ event: "mark", mark: "abc" }` alongside audio chunks
2. Playback worklet records the mark at its current write position
3. As `process()` reads through the buffer, it checks if `totalSamplesRead >= mark.position`
4. When a mark is reached, the worklet posts `markReached` to the main thread
5. The main thread sends `{ event: "mark", mark: "abc" }` back to the server

This tells the server exactly when the user heard a specific piece of audio, enabling precise timing for actions that should happen at specific points in the agent's speech.

### Barge-in (Clear)

When the server detects the user is speaking (barge-in), it sends `{ event: "clear" }`. The client must immediately:
1. Flush the entire playback ring buffer
2. Reset to pre-buffering state
3. Clear all pending marks

This stops the agent's speech so the user can be heard.

### Muting

When muted, the microphone worklet sends **zeros** (silence) instead of actual audio. The audio stream stays alive — the server continues receiving frames. This is important because the server expects a continuous audio stream.

## Adapting for Non-React Projects

If you're not using React, you can extract the logic from `useTelephonySession` into a plain class:

```typescript
class TelephonySession {
  private worker: Worker;
  private playbackContext: AudioContext;
  private micContext: AudioContext;
  // ... same refs as the hook

  async connect(agentId: string, apiKey: string, wsBaseUrl: string) {
    // Same logic as the hook's connect() function
  }

  hangup() {
    // Same logic as the hook's hangup()
  }

  // etc.
}
```

The Worker and Worklet files need no changes — they're framework-agnostic.
