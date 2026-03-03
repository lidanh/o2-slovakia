import { interpolate, useCurrentFrame } from "remotion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { feedbackBreakdown } from "../../data/mockData";
import { FEEDBACK_CATEGORIES } from "@repo/shared";

const categoryLabels: Record<string, string> = {
  communication: "Communication",
  active_listening: "Listening",
  empathy: "Empathy",
  problem_solving: "Problem Solving",
  confidence: "Confidence",
};

const barColors = ["#0112AA", "#2563EB", "#7C3AED", "#059669", "#D97706"];

interface AnimatedBarChartProps {
  startFrame?: number;
}

export const AnimatedBarChart: React.FC<AnimatedBarChartProps> = ({
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  const data = FEEDBACK_CATEGORIES.map((cat, i) => {
    const delay = i * 6;
    const progress = interpolate(localFrame - delay, [0, 30], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return {
      category: categoryLabels[cat] || cat,
      value: Math.round(feedbackBreakdown[cat] * progress),
    };
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" barSize={28}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: "#9CA3AF" }}
          axisLine={{ stroke: "#E5E7EB" }}
          tickLine={false}
        />
        <YAxis
          dataKey="category"
          type="category"
          tick={{ fontSize: 13, fill: "#374151" }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={barColors[i % barColors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
