import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Button, Card, Tag, Typography } from "antd";
import {
  CaretDownOutlined,
  MailOutlined,
  CalendarOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { AppShell } from "../layout/AppShell";
import { scenario } from "../../data/mockData";

const { Text } = Typography;

const MENU_ITEMS = [
  { icon: <MailOutlined />, label: "Send Training Link" },
  { icon: <CalendarOutlined />, label: "Schedule Session" },
  { icon: <PlayCircleOutlined />, label: "Start Now" },
];

export const TrainSendView: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // === Phase 1: Button springs in (frame 0-10) ===
  const buttonSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.6 },
  });
  const buttonScale = interpolate(buttonSpring, [0, 1], [0.8, 1]);
  const buttonOpacity = interpolate(buttonSpring, [0, 1], [0, 1]);

  // === Phase 2: Dropdown appears (frame 15-25) ===
  const dropdownSpring = spring({
    frame: frame - 15,
    fps,
    config: { damping: 14, stiffness: 100, mass: 0.5 },
  });
  const dropdownScale = interpolate(dropdownSpring, [0, 1], [0.95, 1]);
  const dropdownOpacity = interpolate(dropdownSpring, [0, 1], [0, 1]);

  // === Phase 3: Highlight "Send Training Link" (frame 35-40) ===
  const highlightProgress = interpolate(frame, [35, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // === Phase 4: Success notification (frame 55-70) ===
  const notifSpring = spring({
    frame: frame - 55,
    fps,
    config: { damping: 12, stiffness: 150, mass: 0.5 },
  });
  const notifSlideY = interpolate(notifSpring, [0, 1], [-30, 0]);
  const notifOpacity = interpolate(notifSpring, [0, 1], [0, 1]);
  const notifScale = interpolate(notifSpring, [0, 1], [0.92, 1]);

  // Dropdown fades after notification appears
  const dropdownDim = frame >= 70
    ? interpolate(frame, [70, 85], [1, 0.5], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  return (
    <AppShell activeKey="training" title="Training Sessions">
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <Card
          style={{
            borderRadius: 16,
            border: "1px solid #F0F0F0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
          styles={{ body: { padding: 28 } }}
        >
          {/* Scenario info header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 28,
              paddingBottom: 20,
              borderBottom: "1px solid #F0F0F0",
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: 600, color: "#1a1a2e" }}>
              {scenario.name}
            </Text>
            <Text style={{ fontSize: 14, color: "#9ca3af" }}>&bull;</Text>
            <Tag color="blue" style={{ fontSize: 13 }}>
              Frontline
            </Tag>
            <Tag style={{ fontSize: 13 }}>
              5 users assigned
            </Tag>
          </div>

          {/* Button + dropdown area */}
          <div style={{ position: "relative", display: "inline-block" }}>
            {/* Start Training button */}
            <div
              style={{
                opacity: buttonOpacity,
                transform: `scale(${buttonScale})`,
                transformOrigin: "left top",
              }}
            >
              <Button
                type="primary"
                size="large"
                style={{
                  borderRadius: 10,
                  height: 48,
                  paddingInline: 28,
                  fontSize: 15,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#0112AA",
                  boxShadow: "0 4px 12px rgba(1, 18, 170, 0.3)",
                }}
              >
                Start Training
                <CaretDownOutlined style={{ fontSize: 12 }} />
              </Button>
            </div>

            {/* Dropdown menu */}
            <div
              style={{
                position: "absolute",
                top: 56,
                left: 0,
                minWidth: 240,
                background: "#FFFFFF",
                borderRadius: 12,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
                border: "1px solid #E5E7EB",
                padding: "6px 0",
                opacity: dropdownOpacity * dropdownDim,
                transform: `scale(${dropdownScale})`,
                transformOrigin: "left top",
                overflow: "hidden",
              }}
            >
              {MENU_ITEMS.map((item, i) => {
                const isHighlighted = i === 0 && highlightProgress > 0;
                const bgColor = isHighlighted
                  ? interpolateColor(highlightProgress, "rgba(239,246,255,0)", "rgba(239,246,255,1)")
                  : "transparent";
                const textColor = isHighlighted
                  ? interpolateColor(highlightProgress, "#374151", "#0112AA")
                  : "#374151";

                return (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 18px",
                      cursor: "default",
                      background: bgColor,
                    }}
                  >
                    <span style={{ fontSize: 16, color: textColor }}>
                      {item.icon}
                    </span>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: isHighlighted ? 600 : 400,
                        color: textColor,
                      }}
                    >
                      {item.label}
                    </Text>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Success notification — positioned top-right of container */}
        {frame >= 52 && (
          <div
            style={{
              position: "absolute",
              top: 28,
              right: 32,
              opacity: notifOpacity,
              transform: `translateY(${notifSlideY}px) scale(${notifScale})`,
              transformOrigin: "top right",
            }}
          >
            <div
              style={{
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: 14,
                padding: "16px 22px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                boxShadow: "0 8px 24px rgba(5, 150, 105, 0.15), 0 2px 6px rgba(0,0,0,0.04)",
                minWidth: 260,
              }}
            >
              <CheckCircleOutlined
                style={{ fontSize: 24, color: "#059669" }}
              />
              <div>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#065F46",
                    display: "block",
                    lineHeight: 1.3,
                  }}
                >
                  Training links sent
                </Text>
                <Text style={{ fontSize: 13, color: "#6EE7B7" }}>
                  5 users notified
                </Text>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

/** Simple linear color interpolation between two CSS color strings. */
function interpolateColor(t: number, from: string, to: string): string {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const fromRGBA = parseRGBA(from);
  const toRGBA = parseRGBA(to);
  if (!fromRGBA || !toRGBA) return to;
  const r = Math.round(fromRGBA[0] + (toRGBA[0] - fromRGBA[0]) * t);
  const g = Math.round(fromRGBA[1] + (toRGBA[1] - fromRGBA[1]) * t);
  const b = Math.round(fromRGBA[2] + (toRGBA[2] - fromRGBA[2]) * t);
  const a = fromRGBA[3] + (toRGBA[3] - fromRGBA[3]) * t;
  return `rgba(${r},${g},${b},${a})`;
}

function parseRGBA(color: string): [number, number, number, number] | null {
  const m = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
  );
  if (!m) return null;
  return [
    parseInt(m[1], 10),
    parseInt(m[2], 10),
    parseInt(m[3], 10),
    m[4] !== undefined ? parseFloat(m[4]) : 1,
  ];
}
