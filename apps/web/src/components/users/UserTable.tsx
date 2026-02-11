"use client";

import { Table, Button } from "antd";
import { useRouter } from "next/navigation";
import { EditOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { UserWithTeam } from "@repo/shared";

interface UserTableProps {
  data: UserWithTeam[];
  loading: boolean;
  onEdit?: (user: UserWithTeam) => void;
}

export default function UserTable({ data, loading, onEdit }: UserTableProps) {
  const router = useRouter();

  const columns: ColumnsType<UserWithTeam> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
    },
    {
      title: "Phone",
      dataIndex: "phone",
      key: "phone",
    },
    {
      title: "Team",
      key: "team",
      render: (_, record) => record.team?.name ?? "—",
      sorter: (a, b) => (a.team?.name ?? "").localeCompare(b.team?.name ?? ""),
    },
    ...(onEdit
      ? [
          {
            title: "",
            key: "actions",
            width: 48,
            render: (_: unknown, record: UserWithTeam) => (
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
        onClick: () => router.push(`/users/${record.id}`),
      })}
    />
  );
}
