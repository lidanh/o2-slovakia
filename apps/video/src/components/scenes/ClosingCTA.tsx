import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
} from "remotion";
import { FloatingOrbs } from "../common/FloatingOrbs";
import { O2Logo } from "../common/O2Logo";

export const ClosingCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const fps = 30;

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 80, mass: 0.5 },
  });

  const titleOpacity = interpolate(frame, [12, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleSlide = interpolate(frame, [12, 24], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const urlOpacity = interpolate(frame, [24, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const urlSlide = interpolate(frame, [24, 36], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Background zoom for motion
  const bgZoom = interpolate(frame, [0, 120], [1, 1.08], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(135deg, #060E5E 0%, #0112AA 40%, #0B3FBF 70%, #2563EB 100%)",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -60,
          transform: `scale(${bgZoom})`,
        }}
      >
        <FloatingOrbs />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          zIndex: 1,
        }}
      >
        <div
          style={{
            transform: `scale(${logoScale})`,
            opacity: logoScale,
            filter: "drop-shadow(0 4px 30px rgba(37,99,235,0.5))",
          }}
        >
          <O2Logo width={140} height={93} variant="white" />
        </div>

        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: "#FFFFFF",
            textAlign: "center",
            maxWidth: 750,
            lineHeight: 1.25,
            letterSpacing: "-0.5px",
            fontFamily:
              '"Open Sans", -apple-system, BlinkMacSystemFont, sans-serif',
            opacity: titleOpacity,
            transform: `translateY(${titleSlide}px)`,
            textShadow: "0 2px 40px rgba(37,99,235,0.5)",
          }}
        >
          Transform your team's performance
        </div>

        <div
          style={{
            fontSize: 24,
            color: "rgba(255, 255, 255, 0.8)",
            fontFamily:
              '"Open Sans", -apple-system, BlinkMacSystemFont, sans-serif',
            fontWeight: 500,
            opacity: urlOpacity,
            transform: `translateY(${urlSlide}px)`,
            letterSpacing: "1px",
          }}
        >
          o2trainer.sk
        </div>
      </div>
    </AbsoluteFill>
  );
};
