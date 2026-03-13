"use client";

import { Table, Button, Tag, App, Tooltip, Popconfirm } from "antd";
import { useRouter } from "next/navigation";
import { DeleteOutlined, EditOutlined, SendOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ColumnsType } from "antd/es/table";
import type { UserWithTeam, UserRole } from "@repo/shared";

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
  onDelete?: (user: UserWithTeam) => Promise<void>;
}

export default function UserTable({ data, loading, onEdit, onResendInvite, onDelete }: UserTableProps) {
  const t = useTranslations('Users');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const { message } = App.useApp();
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const ROLE_LABELS: Record<UserRole, string> = {
    admin: t('filters.admin'),
    team_manager: t('filters.manager'),
    user: t('filters.user'),
  };

  async function handleResend(user: UserWithTeam) {
    setResendingId(user.id);
    try {
      await onResendInvite?.(user);
      message.success(tCommon('messages.inviteResent'));
    } catch {
      message.error(tCommon('messages.failedToResendInvite'));
    } finally {
      setResendingId(null);
    }
  }

  const columns: ColumnsType<UserWithTeam> = [
    {
      title: t('table.name'),
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: t('table.email'),
      dataIndex: "email",
      key: "email",
    },
    {
      title: t('table.phone'),
      dataIndex: "phone",
      key: "phone",
    },
    {
      title: t('table.role'),
      dataIndex: "role",
      key: "role",
      width: 100,
      filters: [
        { text: t('filters.admin'), value: "admin" },
        { text: t('filters.manager'), value: "team_manager" },
        { text: t('filters.user'), value: "user" },
      ],
      onFilter: (value, record) => record.role === value,
      render: (role: UserRole) => (
        <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>
      ),
    },
    {
      title: t('table.status'),
      dataIndex: "status",
      key: "status",
      width: 130,
      filters: [
        { text: t('filters.active'), value: "active" },
        { text: t('filters.invited'), value: "invited" },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: string, record: UserWithTeam) =>
        status === "invited" ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Tag color="orange">{t('filters.invited')}</Tag>
            {onResendInvite && (
              <Tooltip title={t('resendInvite')}>
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
          <Tag color="green">{t('filters.active')}</Tag>
        ),
    },
    {
      title: t('table.team'),
      key: "team",
      render: (_, record) => record.team?.name ?? "—",
      sorter: (a, b) => (a.team?.name ?? "").localeCompare(b.team?.name ?? ""),
    },
    ...(onEdit || onDelete
      ? [
          {
            title: "",
            key: "actions",
            width: onEdit && onDelete ? 80 : 48,
            render: (_: unknown, record: UserWithTeam) => (
              <span style={{ display: "inline-flex", gap: 4 }}>
                {onEdit && (
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(record);
                    }}
                  />
                )}
                {onDelete && (
                  <Popconfirm
                    title={t('confirmDeleteUser')}
                    onConfirm={async (e) => {
                      e?.stopPropagation();
                      setDeletingId(record.id);
                      try {
                        await onDelete(record);
                        message.success(tCommon('messages.userDeleted'));
                      } catch {
                        message.error(tCommon('messages.failedToDeleteUser'));
                      } finally {
                        setDeletingId(null);
                      }
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                    okText={tCommon('buttons.delete')}
                    cancelText={tCommon('buttons.cancel')}
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      loading={deletingId === record.id}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                )}
              </span>
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
