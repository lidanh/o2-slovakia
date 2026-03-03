import { interpolate, useCurrentFrame } from "remotion";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { weeklySessionData } from "../../data/mockData";

interface AnimatedAreaChartProps {
  startFrame?: number;
  /** How many frames the chart takes to fully draw. Default 120 (4s). */
  drawDuration?: number;
}

export const AnimatedAreaChart: React.FC<AnimatedAreaChartProps> = ({
  startFrame = 0,
  drawDuration = 120,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  // Data points reveal progressively — each data point appears over time
  const totalPoints = weeklySessionData.length;
  const animatedData = weeklySessionData.map((d, i) => {
    // Stagger: each point starts appearing at its proportional time
    const pointStart = (i / totalPoints) * drawDuration * 0.7;
    const pointEnd = pointStart + drawDuration * 0.35;
    const progress = interpolate(localFrame, [pointStart, pointEnd], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return {
      ...d,
      sessions: Math.round(d.sessions * progress),
      avgScore: Math.round(d.avgScore * progress),
    };
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={animatedData}>
        <defs>
          <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0112AA" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#0112AA" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#059669" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 12, fill: "#9CA3AF" }}
          axisLine={{ stroke: "#E5E7EB" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#9CA3AF" }}
          axisLine={false}
          tickLine={false}
        />
        <Area
          type="monotone"
          dataKey="sessions"
          stroke="#0112AA"
          strokeWidth={2.5}
          fill="url(#colorSessions)"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="avgScore"
          stroke="#059669"
          strokeWidth={2.5}
          fill="url(#colorScore)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
