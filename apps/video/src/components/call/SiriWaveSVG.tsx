import { useCurrentFrame } from "remotion";

interface SiriWaveSVGProps {
  width?: number;
  height?: number;
  amplitude?: number;
  color?: string;
}

export const SiriWaveSVG: React.FC<SiriWaveSVGProps> = ({
  width = 440,
  height = 150,
  amplitude = 1,
  color = "#0112AA",
}) => {
  const frame = useCurrentFrame();

  const generateWavePath = (
    freq: number,
    amp: number,
    phase: number,
    yOffset: number
  ) => {
    const points: string[] = [];
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      const normalizedX = (i / steps) * Math.PI * 2 * freq;
      // Gaussian envelope — tapers at edges
      const envelope = Math.exp(-Math.pow((i / steps - 0.5) * 2.8, 2));
      const y =
        yOffset +
        Math.sin(normalizedX + phase) * amp * envelope * amplitude;
      points.push(
        `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`
      );
    }
    return points.join(" ");
  };

  const phase = (frame / 30) * Math.PI * 5; // Faster rotation

  const waves = [
    { freq: 2.5, amp: 32, phaseOffset: 0, opacity: 0.5, strokeWidth: 3, blur: 4 },
    { freq: 3.5, amp: 22, phaseOffset: Math.PI * 0.4, opacity: 0.6, strokeWidth: 2.5, blur: 0 },
    { freq: 4.5, amp: 15, phaseOffset: Math.PI * 0.8, opacity: 0.35, strokeWidth: 2, blur: 0 },
    { freq: 2, amp: 36, phaseOffset: Math.PI * 1.2, opacity: 0.3, strokeWidth: 2.5, blur: 6 },
    { freq: 5.5, amp: 10, phaseOffset: Math.PI * 1.6, opacity: 0.2, strokeWidth: 1.5, blur: 0 },
  ];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <filter id="waveGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {waves.map((wave, i) => (
        <path
          key={i}
          d={generateWavePath(
            wave.freq,
            wave.amp,
            phase + wave.phaseOffset,
            height / 2
          )}
          fill="none"
          stroke={color}
          strokeWidth={wave.strokeWidth}
          opacity={wave.opacity}
          strokeLinecap="round"
          filter={wave.blur > 0 ? "url(#waveGlow)" : undefined}
        />
      ))}
    </svg>
  );
};
