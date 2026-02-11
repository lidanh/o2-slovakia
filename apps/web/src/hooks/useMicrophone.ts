"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseMicrophoneReturn {
  volume: number;
  /** Ref updated every animation frame — use for high-frequency reads (e.g. visualizations) */
  volumeRef: React.RefObject<number>;
  isListening: boolean;
  stream: MediaStream | null;
  start: () => Promise<MediaStream>;
  stop: () => void;
}

export default function useMicrophone(): UseMicrophoneReturn {
  const [volume, setVolume] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const volumeRef = useRef<number>(0);

  const measureVolume = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
    const normalized = Math.min(avg / 128, 1);
    volumeRef.current = normalized;
    setVolume(normalized);
    animFrameRef.current = requestAnimationFrame(measureVolume);
  }, []);

  const start = useCallback(async (): Promise<MediaStream> => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    streamRef.current = mediaStream;
    setStream(mediaStream);

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    // Ensure context is running (may be suspended outside user gesture)
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    const source = audioCtx.createMediaStreamSource(mediaStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    // Connect analyser to a silent gain -> destination so Chrome actually
    // processes the audio graph (required for getByteFrequencyData to work)
    const silentGain = audioCtx.createGain();
    silentGain.gain.value = 0;
    analyser.connect(silentGain);
    silentGain.connect(audioCtx.destination);

    analyserRef.current = analyser;
    measureVolume();

    setIsListening(true);
    return mediaStream;
  }, [measureVolume]);

  const stop = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setIsListening(false);
    setVolume(0);
    volumeRef.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      audioCtxRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { volume, volumeRef, isListening, stream, start, stop };
}
