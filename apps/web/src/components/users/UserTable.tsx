"use client";

import { Table, Button, Tag, App, Tooltip } from "antd";
import { useRouter } from "next/navigation";
import { EditOutlined, SendOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { ColumnsType } from "antd/es/table";
import type { UserWithTeam, UserRole } from "@repo/shared";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  team_manager: "Manager",
  user: "User",
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "purple",
  team_manager: "blue",
  user: "default",
};

interface UserTableProps {
  data: UserWithTeam[];
  loading: boolean;
  onEdit?: (user: UserWithTeam) => void;
  onResendInvite?: (user: UserWithTeam) => Promise<void>;
}

export default function UserTable({ data, loading, onEdit, onResendInvite }: UserTableProps) {
  const router = useRouter();
  const { message } = App.useApp();
  const [resendingId, setResendingId] = useState<string | null>(null);

  async function handleResend(user: UserWithTeam) {
    setResendingId(user.id);
    try {
      await onResendInvite?.(user);
      message.success("Invite resent");
    } catch {
      message.error("Failed to resend invite");
    } finally {
      setResendingId(null);
    }
  }

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
      title: "Role",
      dataIndex: "role",
      key: "role",
      width: 100,
      filters: [
        { text: "Admin", value: "admin" },
        { text: "Manager", value: "team_manager" },
        { text: "User", value: "user" },
      ],
      onFilter: (value, record) => record.role === value,
      render: (role: UserRole) => (
        <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      filters: [
        { text: "Active", value: "active" },
        { text: "Invited", value: "invited" },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: string, record: UserWithTeam) =>
        status === "invited" ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Tag color="orange">Invited</Tag>
            {onResendInvite && (
              <Tooltip title="Resend invite">
                <Button
                  type="text"
                  size="small"
                  icon={<SendOutlined />}
                  loading={resendingId === record.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResend(record);
                  }}
                />
              </Tooltip>
            )}
          </span>
        ) : (
          <Tag color="green">Active</Tag>
        ),
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
