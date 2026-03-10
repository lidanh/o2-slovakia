"use client";

import { Table, Tag } from "antd";
import { useRouter } from "next/navigation";
import {useTranslations} from 'next-intl';
import type { ColumnsType } from "antd/es/table";
import type { SessionWithDetails, SessionStatus } from "@repo/shared";
import { SESSION_STATUS_LABELS, SESSION_STATUS_COLORS } from "@repo/shared";
import ScoreDisplay from "@/components/common/ScoreDisplay";
import StarRating from "@/components/common/StarRating";

interface SessionTableProps {
  data: SessionWithDetails[];
  loading: boolean;
}

export default function SessionTable({ data, loading }: SessionTableProps) {
  const t = useTranslations('Training');
  const router = useRouter();

  const columns: ColumnsType<SessionWithDetails> = [
    {
      title: t('table.user'),
      key: "user",
      render: (_, r) => r.user?.name ?? "—",
      sorter: (a, b) => (a.user?.name ?? "").localeCompare(b.user?.name ?? ""),
    },
    {
      title: t('table.scenario'),
      key: "scenario",
      render: (_, r) => r.scenario?.name ?? "—",
    },
    {
      title: t('table.difficulty'),
      key: "difficulty",
      render: (_, r) => r.difficulty_level?.name ?? "—",
    },
    {
      title: t('table.status'),
      dataIndex: "status",
      key: "status",
      render: (status: SessionStatus) => (
        <Tag color={SESSION_STATUS_COLORS[status]}>
          {SESSION_STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: t('table.score'),
      dataIndex: "score",
      key: "score",
      render: (score: number | null) => <ScoreDisplay score={score} size="small" />,
      sorter: (a, b) => (a.score ?? 0) - (b.score ?? 0),
    },
    {
      title: t('table.rating'),
      dataIndex: "star_rating",
      key: "star_rating",
      render: (rating: number | null) => <StarRating rating={rating} />,
    },
    {
      title: t('table.duration'),
      dataIndex: "call_duration",
      key: "call_duration",
      render: (d: number | null) => {
        if (d == null) return "—";
        const mins = Math.floor(d / 60);
        const secs = d % 60;
        return `${mins}:${String(secs).padStart(2, "0")}`;
      },
    },
    {
      title: t('table.date'),
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => new Date(date).toLocaleDateString("sk-SK"),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      defaultSortOrder: "descend",
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      size="middle"
      pagination={{ pageSize: 20, showSizeChanger: true }}
      onRow={(record) => ({
        style: { cursor: "pointer" },
        onClick: () => router.push(`/training/${record.id}`),
      })}
    />
  );
}
