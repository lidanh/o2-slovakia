"use client";

import { Table, Button } from "antd";
import { useRouter } from "next/navigation";
import { EditOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { Team } from "@repo/shared";

interface TeamRow extends Team {
  member_count?: number;
  avg_score?: number | null;
  total_sessions?: number;
}

interface TeamTableProps {
  data: TeamRow[];
  loading: boolean;
  onEdit?: (team: TeamRow) => void;
}

export default function TeamTable({ data, loading, onEdit }: TeamTableProps) {
  const router = useRouter();

  const columns: ColumnsType<TeamRow> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "Members",
      dataIndex: "member_count",
      key: "member_count",
      render: (count: number | undefined) => count ?? 0,
      sorter: (a, b) => (a.member_count ?? 0) - (b.member_count ?? 0),
    },
    {
      title: "Avg Score",
      dataIndex: "avg_score",
      key: "avg_score",
      defaultSortOrder: "descend" as const,
      render: (score: number | null | undefined) =>
        score != null ? `${score}%` : "—",
      sorter: (a, b) => (a.avg_score ?? -1) - (b.avg_score ?? -1),
    },
    {
      title: "Sessions",
      dataIndex: "total_sessions",
      key: "total_sessions",
      render: (count: number | undefined) => count ?? 0,
      sorter: (a, b) => (a.total_sessions ?? 0) - (b.total_sessions ?? 0),
    },
    ...(onEdit
      ? [
          {
            title: "",
            key: "actions",
            width: 48,
            render: (_: unknown, record: TeamRow) => (
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(record);
                }}
              />
            ),
          },
        ]
      : []),
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
        onClick: () => router.push(`/teams/${record.id}`),
      })}
    />
  );
}
