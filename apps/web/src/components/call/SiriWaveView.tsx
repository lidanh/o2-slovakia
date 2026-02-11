"use client";

import { useEffect, useRef } from "react";

interface SiriWaveViewProps {
  /** Static amplitude (used when amplitudeRef is not provided) */
  amplitude?: number;
  /** Ref read every frame for smooth, high-frequency amplitude updates */
  amplitudeRef?: React.RefObject<number>;
  speed?: number;
  width?: number;
  height?: number;
}

export default function SiriWaveView({
  amplitude = 0,
  amplitudeRef,
  speed = 0.04,
  width = 400,
  height = 150,
}: SiriWaveViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const waveRef = useRef<any>(null);
  const speedRef = useRef(speed);
  const amplitudePropRef = useRef(amplitude);
  const frameRef = useRef<number>(0);

  // Keep refs in sync with props
  speedRef.current = speed;
  amplitudePropRef.current = amplitude;

  // Create siriwave instance
  useEffect(() => {
    if (!containerRef.current) return;

    let instance: any; // eslint-disable-line @typescript-eslint/no-explicit-any

    import("siriwave").then((mod) => {
      const SiriWave = mod.default;
      if (!containerRef.current) return;
      instance = new SiriWave({
        container: containerRef.current,
        style: "ios9",
        width,
        height,
        amplitude: 0,
        speed: 0.04,
        autostart: true,
        curveDefinition: [
          { color: "1,18,170", supportLine: true },
          { color: "37,99,235" },
          { color: "96,165,250" },
        ],
      });
      waveRef.current = instance;
    });

    return () => {
      if (instance) instance.dispose();
      waveRef.current = null;
    };
  }, [width, height]);

  // rAF loop: reads amplitude from ref every frame for smooth visualization
  useEffect(() => {
    const update = () => {
      if (waveRef.current) {
        const amp = amplitudeRef ? amplitudeRef.current : amplitudePropRef.current;
        waveRef.current.setAmplitude(amp * 6);
        waveRef.current.setSpeed(speedRef.current);
      }
      frameRef.current = requestAnimationFrame(update);
    };
    frameRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameRef.current);
  }, [amplitudeRef]);

  return (
    <div
      ref={containerRef}
      style={{
        width,
        height,
        overflow: "hidden",
        borderRadius: 16,
      }}
    />
  );
}
