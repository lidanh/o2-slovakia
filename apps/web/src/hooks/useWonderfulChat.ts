"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { TranscriptEntry } from "@repo/shared";

interface UseWonderfulChatOptions {
  communicationId: string | null;
  enabled?: boolean;
}

interface UseWonderfulChatReturn {
  messages: TranscriptEntry[];
  isConnected: boolean;
  error: string | null;
}

export function useWonderfulChat({
  communicationId,
  enabled = true,
}: UseWonderfulChatOptions): UseWonderfulChatReturn {
  const [messages, setMessages] = useState<TranscriptEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!communicationId || !enabled) return;

    const baseUrl = process.env.NEXT_PUBLIC_WONDERFUL_WS_URL ?? "";
    const wsUrl = `${baseUrl.replace(/^http/, "ws")}/v1/communications/${communicationId}/stream`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transcript") {
          const entry: TranscriptEntry = {
            role: data.role,
            content: data.content,
            timestamp: data.timestamp,
          };
          setMessages((prev) => [...prev, entry]);
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection error");
      setIsConnected(false);
    };

    ws.onclose = () => {
      setIsConnected(false);
    };
  }, [communicationId, enabled]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return { messages, isConnected, error };
}
