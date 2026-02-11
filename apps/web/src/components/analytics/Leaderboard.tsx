"use client";

import { Card, Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { LeaderboardEntry } from "@repo/shared";
import ScoreDisplay from "@/components/common/ScoreDisplay";
import StarRating from "@/components/common/StarRating";

const { Text } = Typography;

interface LeaderboardProps {
  data: LeaderboardEntry[];
  loading: boolean;
}

function RankBadge({ rank }: { rank: number }) {
  const bg =
    rank === 1
      ? "linear-gradient(135deg, #F59E0B, #FBBF24)"
      : rank === 2
      ? "linear-gradient(135deg, #9CA3AF, #D1D5DB)"
      : rank === 3
      ? "linear-gradient(135deg, #B45309, #D97706)"
      : "#F3F4F6";
  const color = rank <= 3 ? "#fff" : "#6b7280";

  return (
    <div
      className="rank-badge"
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 13,
        color,
        boxShadow: rank <= 3 ? "0 2px 6px rgba(0,0,0,0.1)" : "none",
      }}
    >
      {rank}
    </div>
  );
}

export default function Leaderboard({ data, loading }: LeaderboardProps) {
  const columns: ColumnsType<LeaderboardEntry & { rank: number }> = [
    {
      title: "Rank",
      dataIndex: "rank",
      key: "rank",
      width: 70,
      render: (rank: number) => <RankBadge rank={rank} />,
    },
    {
      title: "User",
      dataIndex: "user_name",
      key: "user_name",
      render: (name: string) => <Text strong style={{ fontSize: 13 }}>{name}</Text>,
      sorter: (a, b) => a.user_name.localeCompare(b.user_name),
    },
    {
      title: "Team",
      dataIndex: "team_name",
      key: "team_name",
      render: (name: string | null) => (
        <Text style={{ color: "#6b7280", fontSize: 13 }}>{name ?? "—"}</Text>
      ),
    },
    {
      title: "Avg Score",
      dataIndex: "avg_score",
      key: "avg_score",
      render: (score: number) => <ScoreDisplay score={score} size="small" />,
      sorter: (a, b) => a.avg_score - b.avg_score,
      defaultSortOrder: "descend",
    },
    {
      title: "Total Sessions",
      dataIndex: "total_sessions",
      key: "total_sessions",
      sorter: (a, b) => a.total_sessions - b.total_sessions,
    },
    {
      title: "Avg Rating",
      dataIndex: "avg_star_rating",
      key: "avg_star_rating",
      render: (rating: number) => <StarRating rating={rating} />,
      sorter: (a, b) => a.avg_star_rating - b.avg_star_rating,
    },
  ];

  const rankedData = data.map((entry, idx) => ({ ...entry, rank: idx + 1 }));

  return (
    <Card variant="borderless" styles={{ body: { padding: "0 24px 24px" } }}>
      <Table
        columns={columns}
        dataSource={rankedData}
        rowKey="user_id"
        loading={loading}
        size="middle"
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />
    </Card>
  );
}
