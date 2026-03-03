import { AbsoluteFill, useCurrentFrame, interpolate, spring } from "remotion";
import { Card, Typography } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { AnimatedRadarChart } from "../charts/AnimatedRadarChart";
import { AnimatedBarChart } from "../charts/AnimatedBarChart";
import { TextOverlay } from "../overlays/TextOverlay";
import { FloatingOrbs } from "../common/FloatingOrbs";
import { scatteredFeedbackItems } from "../../data/mockData";

const { Title } = Typography;

const BLUE_GRADIENT =
  "linear-gradient(135deg, #060E5E 0%, #0112AA 40%, #0B3FBF 70%, #2563EB 100%)";

// Pre-calculated positions for 24 feedback chips spread across the screen
const CHIP_POSITIONS = [
  { x: 6, y: 7 },
  { x: 52, y: 5 },
  { x: 30, y: 16 },
  { x: 74, y: 10 },
  { x: 12, y: 32 },
  { x: 62, y: 26 },
  { x: 40, y: 9 },
  { x: 84, y: 20 },
  { x: 5, y: 50 },
  { x: 48, y: 40 },
  { x: 70, y: 46 },
  { x: 20, y: 58 },
  { x: 56, y: 54 },
  { x: 80, y: 36 },
  { x: 8, y: 72 },
  { x: 34, y: 66 },
  { x: 66, y: 62 },
  { x: 88, y: 52 },
  { x: 16, y: 44 },
  { x: 50, y: 76 },
  { x: 76, y: 70 },
  { x: 28, y: 80 },
  { x: 58, y: 84 },
  { x: 44, y: 48 },
];

export const AIFeedbackScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Background slow zoom
  const bgZoom = interpolate(frame, [0, 300], [1, 1.08], {
    extrapolateRight: "clamp",
  });
  const bgDriftX = Math.sin(frame * 0.012) * 10;
  const bgDriftY = Math.cos(frame * 0.01) * 8;

  // --- Charts ---
  // Left card springs in from left (frames 0-30)
  const leftCardSpring = spring({
    frame,
    fps: 30,
    config: { damping: 12, stiffness: 60, mass: 0.6 },
  });
  // Right card springs in from right (staggered, frames 10-40)
  const rightCardSpring = spring({
    frame: frame - 10,
    fps: 30,
    config: { damping: 12, stiffness: 60, mass: 0.6 },
  });

  // Cards float gently
  const leftFloat = Math.sin(frame * 0.035) * 5;
  const rightFloat = Math.sin(frame * 0.035 + 1.2) * 5;

  // Charts fade out between frames 80-150
  const chartsOpacity = interpolate(frame, [80, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: BLUE_GRADIENT,
        overflow: "hidden",
      }}
    >
      {/* Background orbs with zoom + drift */}
      <div
        style={{
          position: "absolute",
          inset: -60,
          transform: `scale(${bgZoom}) translate(${bgDriftX}px, ${bgDriftY}px)`,
        }}
      >
        <FloatingOrbs />
      </div>

      {/* Charts layer — fades out frames 80-150 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          padding: 48,
          justifyContent: "center",
          alignItems: "center",
          opacity: chartsOpacity,
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 24,
            maxWidth: 1400,
            width: "100%",
          }}
        >
          {/* Radar Chart card */}
          <Card
            style={{
              flex: 1,
              borderRadius: 20,
              border: "none",
              boxShadow:
                "0 20px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255,255,255,0.1)",
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(16px)",
              transform: `translateX(${interpolate(leftCardSpring, [0, 1], [-60, 0])}px) translateY(${leftFloat}px)`,
              opacity: leftCardSpring,
            }}
            styles={{ body: { padding: 28 } }}
          >
            <Title level={5} style={{ marginTop: 0, color: "#1a1a2e" }}>
              Skills Overview
            </Title>
            <AnimatedRadarChart startFrame={10} />
          </Card>

          {/* Bar Chart card */}
          <Card
            style={{
              flex: 1,
              borderRadius: 20,
              border: "none",
              boxShadow:
                "0 20px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255,255,255,0.1)",
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(16px)",
              transform: `translateX(${interpolate(rightCardSpring, [0, 1], [60, 0])}px) translateY(${rightFloat}px)`,
              opacity: rightCardSpring,
            }}
            styles={{ body: { padding: 28 } }}
          >
            <Title level={5} style={{ marginTop: 0, color: "#1a1a2e" }}>
              Category Scores
            </Title>
            <AnimatedBarChart startFrame={20} />
          </Card>
        </div>
      </div>

      {/* Scattered feedback chips — appearing one by one starting at frame 30 */}
      <div style={{ position: "absolute", inset: 0, zIndex: 2 }}>
        {scatteredFeedbackItems.map((item, i) => {
          const delay = 30 + i * 7;
          if (frame < delay) return null;

          const chipSpring = spring({
            frame: frame - delay,
            fps: 30,
            config: { damping: 10, stiffness: 90, mass: 0.5 },
          });

          const pos = CHIP_POSITIONS[i % CHIP_POSITIONS.length];
          const floatX = Math.sin(frame * 0.02 + i * 1.3) * 8;
          const floatY = Math.cos(frame * 0.025 + i * 0.9) * 6;

          const isPositive = item.type === "positive";

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: `translate(${floatX}px, ${floatY + interpolate(frame, [260, 300], [0, 30], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px) scale(${chipSpring})`,
                opacity: chipSpring * interpolate(frame, [250, 290], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 20px",
                borderRadius: 14,
                background: isPositive
                  ? "rgba(236, 253, 245, 0.97)"
                  : "rgba(254, 242, 242, 0.97)",
                border: isPositive
                  ? "1px solid rgba(5, 150, 105, 0.25)"
                  : "1px solid rgba(239, 68, 68, 0.25)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                backdropFilter: "blur(12px)",
                fontSize: 15,
                fontWeight: 600,
                lineHeight: 1.3,
                color: "#1f2937",
                maxWidth: 460,
              }}
            >
              {isPositive ? (
                <CheckCircleOutlined
                  style={{ color: "#059669", fontSize: 18, flexShrink: 0 }}
                />
              ) : (
                <CloseCircleOutlined
                  style={{ color: "#EF4444", fontSize: 18, flexShrink: 0 }}
                />
              )}
              {item.text}
            </div>
          );
        })}
      </div>

      {/* Text overlay at the bottom */}
      <TextOverlay
        text="AI-Powered Performance Insights"
        durationInFrames={290}
      />
    </AbsoluteFill>
  );
};
