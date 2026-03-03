import { Input, Typography } from "antd";
import { callOtp, callScenarioName, callDifficultyName } from "../../data/mockData";
import { O2Logo } from "../common/O2Logo";

const { Text } = Typography;

interface CallCardProps {
  statusText?: string;
  statusColor?: string;
  children?: React.ReactNode;
}

export const CallCard: React.FC<CallCardProps> = ({
  statusText,
  statusColor,
  children,
}) => {
  return (
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
        gap: 24,
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: "center" }}>
        <O2Logo width={64} height={43} variant="dark" />
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

      {/* Scenario badge */}
      <div style={{ textAlign: "center" }}>
        <Text style={{ color: "#6b7280", fontSize: 15 }}>
          {callScenarioName}
        </Text>
        <Text style={{ color: "#9CA3AF", fontSize: 13, marginLeft: 8 }}>
          {callDifficultyName}
        </Text>
      </div>

      {/* OTP */}
      <div style={{ textAlign: "center" }}>
        <div style={{ transform: "scale(1.5)", transformOrigin: "center" }}>
          <Input.OTP
            length={6}
            size="large"
            value={callOtp}
            style={{ pointerEvents: "none" }}
          />
        </div>
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

      {children}

      {statusText && (
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: statusColor || "#9CA3AF",
          }}
        >
          {statusText}
        </div>
      )}
    </div>
  );
};
