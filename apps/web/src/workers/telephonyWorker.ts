/// <reference lib="webworker" />
import { mulaw } from "alawmulaw";
import type { WorkerCommand, WorkerMessage, MicChunkPayload } from "./telephonyWorker.types";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
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

function handleMicChunk(payload: MicChunkPayload): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  const samples = new Float32Array(payload.samples);
  if (samples.length === 0) return;

  const resampled = linearResample(samples, payload.sampleRate, 8000);
  const int16 = float32ToInt16(resampled);
  const encoded = mulaw.encode(int16);

  socket.send(
    JSON.stringify({ event: "audio", payload: encodeBase64(encoded) })
  );
}

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
      default:
        // Forward start, stop, clear, and any other events
        postToMain({ type: "event", payload: message });
        break;
    }
  } catch {
    postToMain({ type: "error", message: "Failed to parse message" });
  }
}

// ─── WebSocket Management ──────────────────────────────────────

function connect(payload: { url: string; protocols?: string[] }): void {
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
