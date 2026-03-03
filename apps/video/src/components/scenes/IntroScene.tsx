import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
} from "remotion";
import { FloatingOrbs } from "../common/FloatingOrbs";
import { O2Logo } from "../common/O2Logo";


export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const fps = 30;

  const logoScale = spring({
    frame: frame - 5,
    fps,
    config: { damping: 10, stiffness: 80, mass: 0.6 },
  });

  const titleOpacity = interpolate(frame, [18, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleSlide = interpolate(frame, [18, 30], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineOpacity = interpolate(frame, [32, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineSlide = interpolate(frame, [32, 44], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle continuous zoom on background
  const bgZoom = interpolate(frame, [0, 90], [1, 1.06], {
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
      <div style={{ transform: `scale(${bgZoom})`, position: "absolute", inset: -60 }}>
        <FloatingOrbs />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          zIndex: 1,
        }}
      >
        <div
          style={{
            transform: `scale(${logoScale})`,
            opacity: logoScale,
            filter: "drop-shadow(0 4px 24px rgba(37,99,235,0.4))",
          }}
        >
          <O2Logo width={100} height={67} variant="white" />
        </div>

        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: "-1px",
            fontFamily: '"Open Sans", -apple-system, BlinkMacSystemFont, sans-serif',
            opacity: titleOpacity,
            transform: `translateY(${titleSlide}px)`,
            textShadow: "0 2px 30px rgba(37,99,235,0.5)",
          }}
        >
          O2 Trainer
        </div>

        <div
          style={{
            fontSize: 22,
            color: "rgba(255, 255, 255, 0.75)",
            fontFamily: '"Open Sans", -apple-system, BlinkMacSystemFont, sans-serif',
            fontWeight: 400,
            letterSpacing: "0.5px",
            opacity: taglineOpacity,
            transform: `translateY(${taglineSlide}px)`,
          }}
        >
          AI-Powered Voice Training Platform
        </div>
      </div>
    </AbsoluteFill>
  );
};
