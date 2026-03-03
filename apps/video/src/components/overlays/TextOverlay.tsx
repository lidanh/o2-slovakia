import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";

interface TextOverlayProps {
  text: string;
  startFrame?: number;
  durationInFrames: number;
}

export const TextOverlay: React.FC<TextOverlayProps> = ({
  text,
  startFrame = 0,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  if (localFrame < 0 || localFrame > durationInFrames) return null;

  const enterProgress = spring({
    frame: localFrame,
    fps: 30,
    config: { damping: 14, stiffness: 100, mass: 0.5 },
  });
  const fadeOut = interpolate(
    localFrame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = Math.min(enterProgress, fadeOut);
  const slideUp = interpolate(enterProgress, [0, 1], [30, 0]);
  const scaleX = interpolate(enterProgress, [0, 1], [0.9, 1]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          bottom: 52,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity,
          transform: `translateY(${slideUp}px) scaleX(${scaleX})`,
        }}
      >
        <div
          style={{
            background:
              "linear-gradient(135deg, rgba(1,18,170,0.95) 0%, rgba(11,63,191,0.95) 100%)",
            color: "#FFFFFF",
            fontSize: 26,
            fontWeight: 600,
            fontFamily:
              '"Open Sans", -apple-system, BlinkMacSystemFont, sans-serif',
            padding: "12px 36px",
            borderRadius: 12,
            letterSpacing: "-0.2px",
            boxShadow:
              "0 8px 32px rgba(1,18,170,0.4), 0 0 60px rgba(37,99,235,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
