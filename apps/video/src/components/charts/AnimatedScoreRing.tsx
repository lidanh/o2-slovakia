import { interpolate, useCurrentFrame } from "remotion";

interface AnimatedScoreRingProps {
  targetScore: number;
  size?: number;
  animationDuration?: number;
}

export const AnimatedScoreRing: React.FC<AnimatedScoreRingProps> = ({
  targetScore,
  size = 160,
  animationDuration = 36,
}) => {
  const frame = useCurrentFrame();

  // Ease-out cubic for satisfying reveal
  const rawProgress = interpolate(frame, [0, animationDuration], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const eased = 1 - Math.pow(1 - rawProgress, 3);
  const displayScore = Math.round(eased * targetScore);

  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayScore / 100) * circumference;

  const color =
    targetScore >= 80 ? "#059669" : targetScore >= 60 ? "#D97706" : "#EF4444";

  // Glow pulses once the score is fully revealed
  const glowIntensity =
    rawProgress >= 1
      ? 8 + Math.sin(frame * 0.15) * 4
      : rawProgress * 6;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(-90deg)" }}
      >
        <defs>
          <filter id="ringGlow">
            <feGaussianBlur stdDeviation={glowIntensity} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F3F4F6"
          strokeWidth={14}
        />
        {/* Animated arc with glow */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          filter="url(#ringGlow)"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: size * 0.32,
            fontWeight: 800,
            color,
            lineHeight: 1,
            fontFamily: '"Open Sans", -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          {displayScore}
        </span>
        <span
          style={{
            fontSize: 13,
            color: "#9CA3AF",
            marginTop: 4,
            fontFamily: '"Open Sans", -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          out of 100
        </span>
      </div>
    </div>
  );
};
