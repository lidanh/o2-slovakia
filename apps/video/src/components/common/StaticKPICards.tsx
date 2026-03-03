import { interpolate, useCurrentFrame, spring } from "remotion";
import { Card, Statistic } from "antd";
import {
  PlayCircleOutlined,
  RiseOutlined,
  UserOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { kpis } from "../../data/mockData";

const cards = [
  {
    title: "Total Sessions",
    value: kpis.totalSessions,
    suffix: "",
    decimals: 0,
    icon: <PlayCircleOutlined />,
    color: "#0112AA",
    bgGradient: "linear-gradient(135deg, #EEF2FF, #E0E7FF)",
  },
  {
    title: "Avg Score",
    value: kpis.avgScore,
    suffix: "",
    decimals: 1,
    icon: <RiseOutlined />,
    color: "#059669",
    bgGradient: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
  },
  {
    title: "Active Users",
    value: kpis.totalUsers,
    suffix: "",
    decimals: 0,
    icon: <UserOutlined />,
    color: "#7C3AED",
    bgGradient: "linear-gradient(135deg, #F3E8FF, #EDE9FE)",
  },
  {
    title: "Completion Rate",
    value: kpis.completionRate,
    suffix: "%",
    decimals: 1,
    icon: <CheckCircleOutlined />,
    color: "#D97706",
    bgGradient: "linear-gradient(135deg, #FFFBEB, #FEF3C7)",
  },
];

export const StaticKPICards: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", gap: 20 }}>
      {cards.map((card, i) => {
        const delay = i * 4; // Tighter stagger
        const scale = spring({
          frame: frame - delay,
          fps: 30,
          config: { damping: 10, stiffness: 120, mass: 0.4 },
        });
        const countProgress = interpolate(
          frame,
          [delay + 8, delay + 30],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const displayValue =
          card.decimals > 0
            ? (card.value * countProgress).toFixed(card.decimals)
            : Math.round(card.value * countProgress);

        return (
          <div
            key={card.title}
            style={{
              flex: 1,
              transform: `scale(${scale})`,
              opacity: scale,
            }}
          >
            <Card
              style={{
                borderRadius: 16,
                border: "1px solid #F0F0F0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              }}
              styles={{ body: { padding: 24 } }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <Statistic
                  title={card.title}
                  value={displayValue}
                  suffix={card.suffix}
                  valueStyle={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: "#1a1a2e",
                  }}
                />
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: card.bgGradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: card.color,
                    fontSize: 22,
                  }}
                >
                  {card.icon}
                </div>
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
};
