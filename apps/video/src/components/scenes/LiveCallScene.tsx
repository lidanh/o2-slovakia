import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  Sequence,
} from "remotion";
import { Button, Typography } from "antd";
import { AudioOutlined } from "@ant-design/icons";
import { CallCard } from "../call/CallCard";
import { SiriWaveSVG } from "../call/SiriWaveSVG";
import { TextOverlay } from "../overlays/TextOverlay";
import { FloatingOrbs } from "../common/FloatingOrbs";

const { Text } = Typography;

/** Exact background from apps/web/src/app/call/layout.tsx */
const callBackground =
  "linear-gradient(135deg, #060E5E 0%, #0112AA 40%, #0B3FBF 70%, #2563EB 100%)";

// Sub-scene: Call Ready (0-120)
const CallReady: React.FC = () => {
  const frame = useCurrentFrame();
  const cardScale = spring({
    frame,
    fps: 30,
    config: { damping: 12, stiffness: 80, mass: 0.7 },
  });

  // Subtle bg zoom
  const bgZoom = interpolate(frame, [0, 60], [1, 1.03], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: callBackground,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: -40, transform: `scale(${bgZoom})` }}>
        <FloatingOrbs />
      </div>
      <div
        style={{
          transform: `scale(${cardScale})`,
          opacity: cardScale,
          zIndex: 1,
        }}
      >
        <CallCard>
          <Button
            type="primary"
            size="large"
            icon={<AudioOutlined />}
            style={{
              height: 48,
              paddingInline: 32,
              fontWeight: 600,
              fontSize: 15,
              borderRadius: 14,
              background: "linear-gradient(135deg, #0112AA, #2563EB)",
              border: "none",
              boxShadow: "0 4px 16px rgba(1, 18, 170, 0.3)",
            }}
          >
            Start Session
          </Button>
        </CallCard>
      </div>
    </AbsoluteFill>
  );
};

// Sub-scene: Call Active (0-180) — shortened
const CallActive: React.FC = () => {
  const frame = useCurrentFrame();

  // Status transitions: Connecting (0-30), Listening (30-90), Speaking (90-180)
  const phase =
    frame < 30 ? "connecting" : frame < 90 ? "listening" : "speaking";
  const statusText =
    phase === "connecting"
      ? "Connecting to agent..."
      : phase === "listening"
        ? "Listening..."
        : "Agent is speaking...";
  const statusColor =
    phase === "connecting"
      ? "#9CA3AF"
      : phase === "listening"
        ? "#059669"
        : "#0112AA";

  const amplitude =
    phase === "connecting"
      ? interpolate(frame, [0, 30], [0.1, 0.4], { extrapolateRight: "clamp" })
      : phase === "listening"
        ? 0.5 + Math.sin(frame * 0.15) * 0.25
        : 0.9 + Math.sin(frame * 0.2) * 0.35;

  const bgZoom = interpolate(frame, [0, 180], [1.02, 1.08], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: callBackground,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: -40, transform: `scale(${bgZoom})` }}>
        <FloatingOrbs />
      </div>
      <div style={{ zIndex: 1 }}>
        <CallCard statusText={statusText} statusColor={statusColor}>
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <SiriWaveSVG amplitude={amplitude} />
          </div>
          <Button
            danger
            size="large"
            style={{
              height: 48,
              paddingInline: 32,
              fontWeight: 600,
              borderRadius: 14,
            }}
          >
            End Session
          </Button>
        </CallCard>
      </div>
    </AbsoluteFill>
  );
};

// Sub-scene: Analyzing (0-60) — fades out gradually in the last 25 frames
const AnalyzingView: React.FC = () => {
  const frame = useCurrentFrame();

  const pulseScale = 1 + Math.sin(frame * 0.12) * 0.06;
  const shimmerOffset = (frame * 5) % 400;
  const sparkleRotate = Math.sin(frame * 0.08) * 12;

  const bgZoom = interpolate(frame, [0, 60], [1.05, 1.1], {
    extrapolateRight: "clamp",
  });

  // Fade out the card content in the last 25 frames so it dissolves
  // smoothly into the feedback scene
  const contentOpacity = interpolate(frame, [35, 60], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const contentScale = interpolate(frame, [35, 60], [1, 0.92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: callBackground,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: -40, transform: `scale(${bgZoom})` }}>
        <FloatingOrbs />
      </div>
      <div
        style={{
          width: 520,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          borderRadius: 28,
          padding: "48px 40px",
          boxShadow:
            "0 20px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
          zIndex: 1,
          opacity: contentOpacity,
          transform: `scale(${contentScale})`,
        }}
      >
        {/* Pulsing sparkle icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background:
              "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${pulseScale})`,
            boxShadow: `0 0 0 ${8 + Math.sin(frame * 0.1) * 8}px rgba(1, 18, 170, ${0.15 - Math.sin(frame * 0.1) * 0.1})`,
          }}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            style={{ transform: `rotate(${sparkleRotate}deg)` }}
          >
            <path
              d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z"
              fill="url(#sparkle)"
            />
            <defs>
              <linearGradient id="sparkle" x1="4" y1="2" x2="20" y2="20">
                <stop stopColor="#0112AA" />
                <stop offset="1" stopColor="#2563EB" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#1a1a2e",
              marginBottom: 6,
            }}
          >
            Analyzing your performance
          </div>
          <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
            Our AI is reviewing your conversation...
          </Text>
        </div>

        {/* Shimmer bars */}
        <div
          style={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            padding: "0 8px",
          }}
        >
          {[100, 85, 70].map((w, i) => (
            <div
              key={i}
              style={{
                width: `${w}%`,
                height: 10,
                borderRadius: 5,
                background:
                  "linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)",
                backgroundSize: "200% 100%",
                backgroundPosition: `${-shimmerOffset + i * 40}px 0`,
              }}
            />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const LiveCallScene: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Call Ready (0-60, 2s) — quick OTP flash */}
      <Sequence from={0} durationInFrames={60}>
        <CallReady />
        <TextOverlay
          text="Browser or Phone — Your Choice"
          durationInFrames={50}
        />
      </Sequence>

      {/* Call Active (60-240, 6s) */}
      <Sequence from={60} durationInFrames={180}>
        <CallActive />
        <TextOverlay
          text="Live AI Conversation Practice"
          durationInFrames={170}
        />
      </Sequence>

      {/* Analyzing (240-300, 2s) */}
      <Sequence from={240} durationInFrames={60}>
        <AnalyzingView />
        <TextOverlay
          text="AI Analyzes in Real-Time"
          durationInFrames={50}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
