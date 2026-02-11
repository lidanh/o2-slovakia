"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { WorkerCommand, WorkerMessage } from "../workers/telephonyWorker.types";
import type { FeedbackBreakdown, SessionHighlight } from "@repo/shared";

export type CallState =
  | "loading"
  | "ready"
  | "requesting_mic"
  | "connecting"
  | "connected"
  | "completing"
  | "completed"
  | "error";

interface SessionConfig {
  sessionId: string;
  otp: string;
  scenarioName: string;
  difficultyName: string;
  agentId: string;
  apiKey: string;
  wonderfulHost: string;
}

export interface InlineFeedback {
  score: number;
  star_rating: number;
  feedback_summary: string;
  feedback_breakdown: FeedbackBreakdown | null;
  suggestions: string[] | null;
  highlights: SessionHighlight[] | null;
}

interface UseBrowserCallReturn {
  state: CallState;
  statusText: string;
  config: SessionConfig | null;
  isSpeaking: boolean;
  feedbackResult: InlineFeedback | null;
  validate: (token: string) => Promise<void>;
  connect: () => void;
  endSession: () => void;
}

// Track which AudioContexts already have worklets loaded
const micWorkletLoaded = new WeakSet<BaseAudioContext>();
const playbackWorkletLoaded = new WeakSet<BaseAudioContext>();

export default function useBrowserCall(
  token: string,
  requestMic: () => Promise<MediaStream>
): UseBrowserCallReturn {
  const [state, setState] = useState<CallState>("loading");
  const [statusText, setStatusText] = useState("Validating session...");
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<InlineFeedback | null>(null);

  const stateRef = useRef<CallState>("loading");
  useEffect(() => { stateRef.current = state; }, [state]);

  const tokenRef = useRef(token);
  tokenRef.current = token;

  const communicationIdRef = useRef<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const micNodeRef = useRef<AudioWorkletNode | null>(null);
  const playbackNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const playbackReadyRef = useRef(false);
  const pendingAudioRef = useRef<ArrayBuffer[]>([]);
  const speakingTimeoutRef = useRef<number>(0);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Worker communication ---

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

  // --- Validation ---

  const validate = useCallback(async (tkn: string) => {
    try {
      const res = await fetch(
        `/api/training/browser-call/validate?token=${encodeURIComponent(tkn)}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid session");
      }
      const data: SessionConfig = await res.json();
      setConfig(data);
      setState("ready");
      setStatusText("Ready to start");
    } catch (err) {
      setState("error");
      setStatusText((err as Error).message || "Session validation failed");
    }
  }, []);

  // --- Complete session ---

  const completeSession = useCallback(async () => {
    setState("completing");
    setStatusText("Analyzing your performance...");

    try {
      const res = await fetch("/api/training/browser-call/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenRef.current,
          communicationId: communicationIdRef.current ?? "",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.score !== null && data.score !== undefined) {
          setFeedbackResult({
            score: data.score,
            star_rating: data.star_rating ?? 0,
            feedback_summary: data.feedback_summary ?? "",
            feedback_breakdown: data.feedback_breakdown ?? null,
            suggestions: data.suggestions ?? null,
            highlights: data.highlights ?? null,
          });
        }
      }
    } catch (err) {
      console.error("Failed to complete session:", err);
    }

    setState("completed");
    setStatusText("Session completed");
  }, []);

  // --- Cleanup audio nodes ---

  const cleanupAudio = useCallback(() => {
    clearTimeout(speakingTimeoutRef.current);
    setIsSpeaking(false);

    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }

    micNodeRef.current?.port.postMessage({ type: "stop" });
    micNodeRef.current?.disconnect();
    micNodeRef.current = null;

    playbackNodeRef.current?.port.postMessage({ type: "stop" });
    playbackNodeRef.current?.disconnect();
    playbackNodeRef.current = null;

    mediaStreamRef.current = null;

    if (micContextRef.current?.state !== "closed") {
      micContextRef.current?.close();
    }
    micContextRef.current = null;

    if (playbackContextRef.current?.state !== "closed") {
      playbackContextRef.current?.close();
    }
    playbackContextRef.current = null;

    postToWorker({ type: "disconnect" });

    playbackReadyRef.current = false;
    pendingAudioRef.current = [];
  }, [postToWorker]);

  // --- Worker message handler ---

  const handleWorkerMessage = useCallback(
    (message: WorkerMessage) => {
      switch (message.type) {
        case "connected":
          // WebSocket opened — tell server we're ready
          sendEvent({ event: "start" });
          break;

        case "disconnected":
          if (
            message.code !== 1000 &&
            stateRef.current !== "completing" &&
            stateRef.current !== "completed"
          ) {
            cleanupAudio();
            setState("error");
            setStatusText(`Connection failed (code ${message.code})`);
          }
          break;

        case "error":
          if (
            stateRef.current !== "completing" &&
            stateRef.current !== "completed"
          ) {
            console.error("Worker error:", message.message);
          }
          break;

        case "event": {
          const evt = message.payload.event as string;
          if (evt === "start") {
            if (connectTimeoutRef.current) {
              clearTimeout(connectTimeoutRef.current);
              connectTimeoutRef.current = null;
            }
            communicationIdRef.current =
              (message.payload.communication_id as string) ?? null;
            setState("connected");
            setStatusText("Listening...");
          } else if (evt === "stop") {
            cleanupAudio();
            completeSession();
          } else if (evt === "clear") {
            // Barge-in: flush playback buffer
            playbackNodeRef.current?.port.postMessage({ type: "clear" });
            clearTimeout(speakingTimeoutRef.current);
            setIsSpeaking(false);
          }
          break;
        }

        case "audio": {
          // Agent audio -> playback worklet
          setIsSpeaking(true);
          clearTimeout(speakingTimeoutRef.current);
          speakingTimeoutRef.current = window.setTimeout(() => {
            setIsSpeaking(false);
          }, 500);

          if (playbackNodeRef.current && playbackReadyRef.current) {
            playbackNodeRef.current.port.postMessage(
              { type: "push", samples: message.samples },
              [message.samples]
            );
          } else {
            pendingAudioRef.current.push(message.samples);
          }
          break;
        }

        case "mark":
          // Track mark position in playback worklet
          playbackNodeRef.current?.port.postMessage({
            type: "mark",
            id: message.id,
          });
          break;
      }
    },
    [sendEvent, cleanupAudio, completeSession]
  );

  // --- Worker setup (once on mount) ---

  const handleWorkerMessageRef = useRef(handleWorkerMessage);
  useEffect(() => {
    handleWorkerMessageRef.current = handleWorkerMessage;
  }, [handleWorkerMessage]);

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/telephonyWorker.ts", import.meta.url),
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

  // --- Connect ---

  const connect = useCallback(() => {
    if (!config) return;

    setState("requesting_mic");
    setStatusText("Requesting microphone access...");

    requestMic()
      .then(async (stream) => {
        mediaStreamRef.current = stream;
        setState("connecting");
        setStatusText("Connecting to agent...");

        // Mic AudioContext at native sample rate for capture worklet
        let micCtx = micContextRef.current;
        if (!micCtx || micCtx.state === "closed") {
          micCtx = new AudioContext();
          micContextRef.current = micCtx;
        }
        if (micCtx.state === "suspended") await micCtx.resume();

        // Playback AudioContext at 8kHz — browser upsamples to hardware rate
        let playbackCtx = playbackContextRef.current;
        if (!playbackCtx || playbackCtx.state === "closed") {
          playbackCtx = new AudioContext({ sampleRate: 8000 });
          playbackContextRef.current = playbackCtx;
        }
        if (playbackCtx.state === "suspended") await playbackCtx.resume();

        // Load worklets (idempotent per-context)
        if (!micWorkletLoaded.has(micCtx)) {
          await micCtx.audioWorklet.addModule("/worklets/microphoneProcessor.js");
          micWorkletLoaded.add(micCtx);
        }
        if (!playbackWorkletLoaded.has(playbackCtx)) {
          await playbackCtx.audioWorklet.addModule(
            "/worklets/playbackProcessor.js"
          );
          playbackWorkletLoaded.add(playbackCtx);
        }

        // Playback worklet node
        if (!playbackNodeRef.current) {
          const playbackNode = new AudioWorkletNode(
            playbackCtx,
            "playback-processor",
            {
              numberOfInputs: 0,
              numberOfOutputs: 1,
              outputChannelCount: [1],
            }
          );
          playbackNode.connect(playbackCtx.destination);
          playbackNodeRef.current = playbackNode;

          playbackNode.port.onmessage = (event) => {
            if (event.data?.type === "ready") {
              playbackReadyRef.current = true;
              // Flush any audio that arrived before worklet was ready
              for (const samples of pendingAudioRef.current) {
                playbackNode.port.postMessage(
                  { type: "push", samples },
                  [samples]
                );
              }
              pendingAudioRef.current = [];
            } else if (event.data?.type === "markReached") {
              // Tell server we played past this mark
              sendEvent({ event: "mark", mark: event.data.id });
            }
          };
        }

        // Mic worklet node
        if (!micNodeRef.current) {
          const micNode = new AudioWorkletNode(
            micCtx,
            "microphone-processor",
            { numberOfInputs: 1, numberOfOutputs: 0 }
          );
          micNodeRef.current = micNode;

          const source = micCtx.createMediaStreamSource(stream);
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

        // Build WebSocket URL
        const wsHost = config.wonderfulHost
          .replace("https://", "wss://")
          .replace("http://", "ws://");
        const params = new URLSearchParams({ agent_id: config.agentId });
        const metadata = JSON.stringify({
          otp: config.otp,
          session_id: config.sessionId,
        });
        params.set(
          "metadata",
          btoa(metadata)
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "")
        );
        const wsUrl = `${wsHost}/telephony/websocket/call?${params}`;

        // Connection timeout
        connectTimeoutRef.current = setTimeout(() => {
          if (stateRef.current === "connecting") {
            cleanupAudio();
            setState("error");
            setStatusText("Connection timed out");
          }
        }, 15000);

        // Connect WebSocket via Worker
        postToWorker({
          type: "connect",
          payload: {
            url: wsUrl,
            protocols: ["apikey", config.apiKey],
          },
        });
      })
      .catch((err) => {
        console.error("Mic access failed:", err);
        setState("error");
        setStatusText("Microphone access denied");
      });
  }, [config, requestMic, postToWorker, sendEvent, cleanupAudio]);

  // --- End session ---

  const endSession = useCallback(() => {
    sendEvent({ event: "stop" });
    cleanupAudio();
    completeSession();
  }, [sendEvent, cleanupAudio, completeSession]);

  // --- Cleanup on unmount ---

  const cleanupRef = useRef(cleanupAudio);
  useEffect(() => {
    cleanupRef.current = cleanupAudio;
  }, [cleanupAudio]);
  useEffect(() => {
    return () => cleanupRef.current();
  }, []);

  return { state, statusText, config, isSpeaking, feedbackResult, validate, connect, endSession };
}
