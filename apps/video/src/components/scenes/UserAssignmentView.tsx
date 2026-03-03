import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Card, Tag, Typography } from "antd";
import { CheckCircleFilled } from "@ant-design/icons";
import { AppShell } from "../layout/AppShell";
import { assignableUsers, scenario } from "../../data/mockData";

const { Text } = Typography;

const AVATAR_COLORS = ["#0112AA", "#7C3AED", "#059669", "#D97706", "#2563EB"];
const STAGGER = 15; // frames between each user row
const ROW_START = 10; // first row appears at this frame
const CHECK_DELAY = 12; // checkmark appears this many frames after row starts

export const UserAssignmentView: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Count how many checks are visible for the counter
  let assignedCount = 0;
  for (let i = 0; i < assignableUsers.length; i++) {
    const checkFrame = ROW_START + i * STAGGER + CHECK_DELAY;
    if (frame >= checkFrame + 4) {
      assignedCount++;
    }
  }

  // Counter spring — triggers once first check is fully in
  const counterSpring = spring({
    frame: frame - (ROW_START + CHECK_DELAY + 6),
    fps,
    config: { damping: 14, stiffness: 80, mass: 0.6 },
  });
  const counterOpacity = interpolate(counterSpring, [0, 1], [0, 1]);
  const counterSlideY = interpolate(counterSpring, [0, 1], [10, 0]);

  return (
    <AppShell activeKey="scenarios" title="Assign Users">
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Scenario info card */}
        <Card
          style={{
            borderRadius: 16,
            border: "1px solid #F0F0F0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
          styles={{ body: { padding: 28 } }}
        >
          {/* Scenario header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
              paddingBottom: 20,
              borderBottom: "1px solid #F0F0F0",
            }}
          >
            <Text
              style={{ fontSize: 18, fontWeight: 600, color: "#1a1a2e" }}
            >
              {scenario.name}
            </Text>
            <Tag color="blue" style={{ fontSize: 13 }}>
              Frontline
            </Tag>
          </div>

          {/* User list */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {assignableUsers.map((user, i) => (
              <UserRow
                key={user.name}
                user={user}
                color={AVATAR_COLORS[i % AVATAR_COLORS.length]}
                index={i}
              />
            ))}
          </div>

          {/* Assigned counter */}
          <div
            style={{
              marginTop: 24,
              paddingTop: 20,
              borderTop: "1px solid #F0F0F0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              opacity: counterOpacity,
              transform: `translateY(${counterSlideY}px)`,
            }}
          >
            <Text style={{ fontSize: 15, color: "#6b7280" }}>
              <Text style={{ fontWeight: 700, color: "#0112AA", fontSize: 15 }}>
                {assignedCount}
              </Text>{" "}
              of {assignableUsers.length} users assigned
            </Text>
            {assignedCount === assignableUsers.length && (
              <Tag
                color="success"
                style={{
                  fontSize: 13,
                  opacity: interpolate(
                    frame,
                    [
                      ROW_START +
                        (assignableUsers.length - 1) * STAGGER +
                        CHECK_DELAY +
                        6,
                      ROW_START +
                        (assignableUsers.length - 1) * STAGGER +
                        CHECK_DELAY +
                        16,
                    ],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                  ),
                }}
              >
                All Assigned
              </Tag>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

interface UserRowProps {
  user: (typeof assignableUsers)[number];
  color: string;
  index: number;
}

const UserRow: React.FC<UserRowProps> = ({ user, color, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rowStartFrame = ROW_START + index * STAGGER;

  // Row slide-in from right + fade
  const rowSpring = spring({
    frame: frame - rowStartFrame,
    fps,
    config: { damping: 14, stiffness: 90, mass: 0.7 },
  });
  const rowSlideX = interpolate(rowSpring, [0, 1], [60, 0]);
  const rowOpacity = interpolate(rowSpring, [0, 1], [0, 1]);

  // Checkmark appears after row slides in
  const checkStartFrame = rowStartFrame + CHECK_DELAY;
  const checkSpring = spring({
    frame: frame - checkStartFrame,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.5 },
  });
  const checkScale = interpolate(checkSpring, [0, 1], [0, 1]);
  const checkOpacity = interpolate(checkSpring, [0, 1], [0, 1]);

  // Gentle floating for the avatar
  const floatY = Math.sin((frame + index * 20) * 0.06) * 1.5;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 16px",
        borderRadius: 12,
        background:
          frame >= checkStartFrame + 4
            ? "rgba(1, 18, 170, 0.03)"
            : "transparent",
        transform: `translateX(${rowSlideX}px)`,
        opacity: rowOpacity,
        transition: "background 0.3s",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transform: `translateY(${floatY}px)`,
          boxShadow: `0 2px 8px ${color}33`,
        }}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: 0.5,
          }}
        >
          {user.initials}
        </Text>
      </div>

      {/* Name + Role */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#1a1a2e",
            display: "block",
            lineHeight: 1.3,
          }}
        >
          {user.name}
        </Text>
        <Text style={{ fontSize: 13, color: "#9ca3af" }}>
          {user.role} &middot; {user.department}
        </Text>
      </div>

      {/* Animated checkmark */}
      <div
        style={{
          width: 28,
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: checkOpacity,
          transform: `scale(${checkScale})`,
        }}
      >
        <CheckCircleFilled
          style={{ fontSize: 22, color: "#059669" }}
        />
      </div>
    </div>
  );
};
