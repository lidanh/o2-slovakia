"use client";

import { Typography, Progress } from "antd";

interface ScoreDisplayProps {
  score: number | null;
  size?: "small" | "default";
}

export default function ScoreDisplay({ score, size = "default" }: ScoreDisplayProps) {
  if (score === null) {
    return <Typography.Text type="secondary">—</Typography.Text>;
  }

  const color =
    score >= 80 ? "#52c41a" : score >= 60 ? "#faad14" : "#ff4d4f";

  if (size === "small") {
    return (
      <Typography.Text strong style={{ color }}>
        {score.toFixed(0)}
      </Typography.Text>
    );
  }

  return (
    <div className={score >= 80 ? "score-pulse" : undefined} style={{ display: "inline-block" }}>
      <Progress
        type="circle"
        percent={score}
        size={64}
        strokeColor={color}
        format={(p) => `${p?.toFixed(0)}`}
      />
    </div>
  );
}
