export interface ConnectPayload {
  url: string;
  protocols?: string[];
}

export interface MicChunkPayload {
  samples: ArrayBuffer;
  sampleRate: number;
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
