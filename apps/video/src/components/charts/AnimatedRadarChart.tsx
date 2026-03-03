import { interpolate, useCurrentFrame } from "remotion";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import { feedbackBreakdown } from "../../data/mockData";
import { FEEDBACK_CATEGORIES } from "@repo/shared";

const categoryLabels: Record<string, string> = {
  communication: "Communication",
  active_listening: "Active Listening",
  empathy: "Empathy",
  problem_solving: "Problem Solving",
  confidence: "Confidence",
};

interface AnimatedRadarChartProps {
  startFrame?: number;
}

export const AnimatedRadarChart: React.FC<AnimatedRadarChartProps> = ({
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  const progress = interpolate(localFrame, [0, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const data = FEEDBACK_CATEGORIES.map((cat) => ({
    category: categoryLabels[cat] || cat,
    value: Math.round(feedbackBreakdown[cat] * progress),
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
        <PolarGrid stroke="#E5E7EB" />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fontSize: 12, fill: "#6b7280" }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: "#9CA3AF" }}
        />
        <Radar
          name="Score"
          dataKey="value"
          stroke="#0112AA"
          fill="#0112AA"
          fillOpacity={0.2}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
};
