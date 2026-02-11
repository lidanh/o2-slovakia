"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Input, Button, Spin, Typography } from "antd";
import {
  AudioOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StarFilled,
} from "@ant-design/icons";
import Image from "next/image";
import dynamic from "next/dynamic";
import useBrowserCall from "@/hooks/useBrowserCall";
import type { InlineFeedback } from "@/hooks/useBrowserCall";
import useMicrophone from "@/hooks/useMicrophone";

const SiriWaveView = dynamic(
  () => import("@/components/call/SiriWaveView"),
  { ssr: false }
);

const { Text } = Typography;

// --- Animated Score Ring ---
function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const [displayScore, setDisplayScore] = useState(0);
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayScore / 100) * circumference;

  useEffect(() => {
    let start: number | null = null;
    const duration = 1200;
    const animate = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayScore(Math.round(eased * score));
      if (progress < 1) requestAnimationFrame(animate);
    };
    const frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const color =
    score >= 80 ? "#059669" : score >= 60 ? "#D97706" : "#EF4444";

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F3F4F6"
          strokeWidth={10}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.05s linear" }}
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
            fontSize: size * 0.3,
            fontWeight: 800,
            color,
            lineHeight: 1,
          }}
        >
          {displayScore}
        </span>
        <span style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
          out of 100
        </span>
      </div>
    </div>
  );
}

// --- Star Rating Display ---
function Stars({ rating }: { rating: number }) {
  return (
    <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarFilled
          key={i}
          style={{
            fontSize: 20,
            color: i <= rating ? "#FBBF24" : "#E5E7EB",
            animation: i <= rating ? `starPop 0.3s ${0.8 + i * 0.1}s both` : undefined,
          }}
        />
      ))}
    </div>
  );
}

// --- Feedback Display ---
function FeedbackReveal({ feedback }: { feedback: InlineFeedback }) {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        animation: "fadeIn 0.5s ease-out",
      }}
    >
      {/* Score + Stars */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          animation: "scaleIn 0.6s ease-out",
        }}
      >
        <ScoreRing score={feedback.score} />
        <Stars rating={feedback.star_rating} />
      </div>

      {/* Summary */}
      <div
        style={{
          width: "100%",
          background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
          borderRadius: 16,
          padding: "16px 20px",
          animation: "fadeInUp 0.5s 0.4s both",
        }}
      >
        <Text
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: "#374151",
            display: "block",
            textAlign: "left",
          }}
        >
          {feedback.feedback_summary}
        </Text>
      </div>

      {/* Key Suggestions */}
      {feedback.suggestions && feedback.suggestions.length > 0 && (
        <div style={{ width: "100%" }}>
          <Text
            strong
            style={{
              fontSize: 13,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              color: "#6B7280",
              display: "block",
              marginBottom: 8,
              animation: "fadeInUp 0.5s 0.6s both",
            }}
          >
            How to improve
          </Text>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {feedback.suggestions.slice(0, 3).map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "10px 14px",
                  background: "#FAFAFA",
                  borderRadius: 12,
                  border: "1px solid #F0F0F0",
                  animation: `fadeInUp 0.4s ${0.7 + i * 0.15}s both`,
                }}
              >
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    background: "linear-gradient(135deg, #0112AA, #2563EB)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {i + 1}
                </div>
                <Text style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                  {s}
                </Text>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Highlights summary */}
      {feedback.highlights && feedback.highlights.length > 0 && (
        <div
          style={{
            width: "100%",
            display: "flex",
            gap: 10,
            animation: `fadeInUp 0.5s ${0.7 + (feedback.suggestions?.length ?? 0) * 0.15 + 0.2}s both`,
          }}
        >
          {(() => {
            const pos = feedback.highlights!.filter((h) => h.type === "positive").length;
            const neg = feedback.highlights!.filter((h) => h.type === "negative").length;
            return (
              <>
                {pos > 0 && (
                  <div
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      background: "#ECFDF5",
                      borderRadius: 12,
                      textAlign: "center",
                    }}
                  >
                    <CheckCircleOutlined style={{ color: "#059669", fontSize: 18 }} />
                    <Text style={{ fontSize: 13, color: "#059669", display: "block", marginTop: 4, fontWeight: 600 }}>
                      {pos} strength{pos > 1 ? "s" : ""} noted
                    </Text>
                  </div>
                )}
                {neg > 0 && (
                  <div
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      background: "#FEF2F2",
                      borderRadius: 12,
                      textAlign: "center",
                    }}
                  >
                    <CloseCircleOutlined style={{ color: "#EF4444", fontSize: 18 }} />
                    <Text style={{ fontSize: 13, color: "#EF4444", display: "block", marginTop: 4, fontWeight: 600 }}>
                      {neg} area{neg > 1 ? "s" : ""} to improve
                    </Text>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      <Text
        style={{
          fontSize: 13,
          color: "#9CA3AF",
          animation: "fadeIn 0.5s 1.5s both",
        }}
      >
        Full feedback available in your dashboard
      </Text>
    </div>
  );
}

// --- Analyzing animation ---
function AnalyzingState() {
  return (
    <div
      style={{
        padding: "32px 0",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          animation: "pulse 2s ease-in-out infinite",
          boxShadow: "0 0 0 0 rgba(1, 18, 170, 0.2)",
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z"
            fill="url(#sparkleGrad)"
            style={{ animation: "sparkleRotate 3s ease-in-out infinite" }}
          />
          <defs>
            <linearGradient id="sparkleGrad" x1="4" y1="2" x2="20" y2="20">
              <stop stopColor="#0112AA" />
              <stop offset="1" stopColor="#2563EB" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div>
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
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, padding: "0 8px" }}>
        {[100, 85, 70].map((w, i) => (
          <div
            key={i}
            style={{
              width: `${w}%`,
              height: 10,
              borderRadius: 5,
              background: "linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)",
              backgroundSize: "200% 100%",
              animation: `shimmer 1.5s ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// --- Main Page ---
export default function BrowserCallPage() {
  const params = useParams();
  const token = params.token as string;

  const mic = useMicrophone();
  const call = useBrowserCall(token, mic.start);

  // Validate token on mount
  useEffect(() => {
    call.validate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleStart = useCallback(() => {
    call.connect();
  }, [call]);

  const handleEnd = useCallback(() => {
    mic.stop();
    call.endSession();
  }, [mic, call]);

  const isActive =
    call.state === "connected" ||
    call.state === "connecting" ||
    call.state === "requesting_mic";

  // Derived amplitude ref: reads mic volume directly (60fps) when active,
  // otherwise returns a small idle value. Avoids React rerender bottleneck.
  const amplitudeRef = useRef(0.02);
  const isActiveRef = useRef(isActive);
  isActiveRef.current = isActive;

  useEffect(() => {
    let frame = 0;
    const sync = () => {
      amplitudeRef.current = isActiveRef.current
        ? Math.max(mic.volumeRef.current, 0.02)
        : 0.02;
      frame = requestAnimationFrame(sync);
    };
    frame = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(frame);
  }, [mic.volumeRef]);

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(1, 18, 170, 0.3); }
          50% { box-shadow: 0 0 0 16px rgba(1, 18, 170, 0); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes starPop {
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.3); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes sparkleRotate {
          0%, 100% { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(15deg) scale(1.1); }
        }
      `}</style>
      <div
        className="login-card-animated"
        style={{
          width: 520,
          maxWidth: "95vw",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          borderRadius: 28,
          padding: "48px 40px",
          boxShadow:
            "0 20px 60px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)",
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        {/* Logo + Title */}
        <div style={{ textAlign: "center" }}>
          <Image
            src="/o2-logo.svg"
            alt="O2"
            width={64}
            height={43}
            priority
          />
          <div
            style={{
              fontSize: 26,
              fontWeight: 500,
              color: "#1a1a2e",
              letterSpacing: "-0.3px",
              marginTop: 8,
            }}
          >
            O2 Trainer
          </div>
        </div>

        {/* Loading state */}
        {call.state === "loading" && (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: "#9CA3AF", fontSize: 15 }}>
              Validating session...
            </div>
          </div>
        )}

        {/* Error state */}
        {call.state === "error" && (
          <div style={{ padding: "24px 0", textAlign: "center" }}>
            <CloseCircleOutlined
              style={{ fontSize: 48, color: "#EF4444", marginBottom: 16 }}
            />
            <div style={{ color: "#EF4444", fontSize: 17, fontWeight: 600 }}>
              {call.statusText}
            </div>
            <Text
              style={{ color: "#9CA3AF", fontSize: 14, marginTop: 8, display: "block" }}
            >
              Please request a new link from your administrator.
            </Text>
          </div>
        )}

        {/* Completing / Analyzing state */}
        {call.state === "completing" && <AnalyzingState />}

        {/* Completed state — with or without feedback */}
        {call.state === "completed" && (
          call.feedbackResult ? (
            <FeedbackReveal feedback={call.feedbackResult} />
          ) : (
            <div style={{ padding: "24px 0", textAlign: "center", animation: "fadeIn 0.5s ease-out" }}>
              <CheckCircleOutlined
                style={{ fontSize: 48, color: "#059669", marginBottom: 16 }}
              />
              <div
                style={{ color: "#1a1a2e", fontSize: 20, fontWeight: 700, marginBottom: 8 }}
              >
                Session Completed
              </div>
              <Text style={{ color: "#9CA3AF", fontSize: 15 }}>
                Your training session has been recorded. Feedback will be available
                in your dashboard.
              </Text>
            </div>
          )
        )}

        {/* Ready / Active states */}
        {call.state !== "loading" &&
          call.state !== "error" &&
          call.state !== "completed" &&
          call.state !== "completing" && (
            <>
              {/* Scenario info */}
              {call.config && (
                <div style={{ textAlign: "center" }}>
                  <Text style={{ color: "#6b7280", fontSize: 15 }}>
                    {call.config.scenarioName}
                  </Text>
                  <Text
                    style={{
                      color: "#9CA3AF",
                      fontSize: 13,
                      marginLeft: 8,
                    }}
                  >
                    {call.config.difficultyName}
                  </Text>
                </div>
              )}

              {/* OTP Display */}
              {call.config && (
                <div style={{ textAlign: "center" }}>
                  <Input.OTP
                    length={6}
                    size="large"
                    value={call.config.otp}
                    disabled
                    style={{ pointerEvents: "none" }}
                  />
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 14,
                      color: "#6b7280",
                      fontWeight: 500,
                    }}
                  >
                    Tell this code to the agent
                  </div>
                </div>
              )}

              {/* Siri Wave */}
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  minHeight: 150,
                }}
              >
                <SiriWaveView
                  amplitudeRef={amplitudeRef}
                  speed={call.isSpeaking ? 0.08 : isActive ? 0.04 : 0.02}
                  width={440}
                  height={150}
                />
              </div>

              {/* Status text */}
              <div
                style={{
                  textAlign: "center",
                  fontSize: 15,
                  fontWeight: 500,
                  color: call.state === "connected"
                    ? call.isSpeaking
                      ? "#0112AA"
                      : "#059669"
                    : "#9CA3AF",
                  minHeight: 20,
                }}
              >
                {call.state === "ready" && "Press Start to begin your session"}
                {call.state === "requesting_mic" && "Allow microphone access..."}
                {call.state === "connecting" && "Connecting to agent..."}
                {call.state === "connected" && call.statusText}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 12 }}>
                {call.state === "ready" && (
                  <Button
                    type="primary"
                    size="large"
                    icon={<AudioOutlined />}
                    onClick={handleStart}
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
                )}
                {(call.state === "connected" || call.state === "connecting") && (
                  <Button
                    danger
                    size="large"
                    onClick={handleEnd}
                    style={{
                      height: 48,
                      paddingInline: 32,
                      fontWeight: 600,
                      borderRadius: 14,
                    }}
                  >
                    End Session
                  </Button>
                )}
              </div>
            </>
          )}
      </div>
    </>
  );
}
