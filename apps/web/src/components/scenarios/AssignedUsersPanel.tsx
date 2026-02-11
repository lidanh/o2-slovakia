"use client";

import { Card, Table, Button, Space, Tag, Popconfirm, App, Dropdown } from "antd";
import { PhoneOutlined, DeleteOutlined, PlusOutlined, LinkOutlined, DownOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { AssignmentWithDetails, DifficultyLevel } from "@repo/shared";
import { ASSIGNMENT_STATUS_LABELS, ASSIGNMENT_STATUS_COLORS } from "@repo/shared";
import { useState } from "react";
import AddUsersDialog from "@/components/common/AddUsersDialog";

interface AssignedUsersPanelProps {
  assignments: AssignmentWithDetails[];
  difficultyLevels: DifficultyLevel[];
  scenarioId: string;
  onRefresh: () => void;
}

export default function AssignedUsersPanel({
  assignments,
  difficultyLevels,
  scenarioId,
  onRefresh,
}: AssignedUsersPanelProps) {
  const { message } = App.useApp();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  async function handleRemoveAssignment(assignmentId: string) {
    try {
      const res = await fetch("/api/assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentIds: [assignmentId] }),
      });
      if (!res.ok) throw new Error("Failed to remove assignment");
      message.success("Assignment removed");
      onRefresh();
    } catch {
      message.error("Failed to remove assignment");
    }
  }

  async function handleTriggerCall(assignmentId: string) {
    try {
      const res = await fetch("/api/training/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      if (!res.ok) throw new Error("Failed to trigger call");
      message.success("Call initiated");
    } catch {
      message.error("Failed to trigger call");
    }
  }

  async function handleShareLink(assignmentId: string) {
    try {
      const res = await fetch("/api/training/browser-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      if (!res.ok) throw new Error("Failed to create browser call");
      const data = await res.json();
      const fullUrl = `${window.location.origin}${data.callUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      message.success("Link copied to clipboard!");
    } catch {
      message.error("Failed to generate link");
    }
  }

  async function handleBulkCall(difficultyLevelId: string) {
    setBulkLoading(difficultyLevelId);
    try {
      const res = await fetch("/api/training/bulk-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, difficultyLevelId }),
      });
      if (!res.ok) throw new Error("Failed to trigger bulk calls");
      const data = await res.json();
      message.success(`${data.initiated ?? 0} calls initiated`);
    } catch {
      message.error("Failed to trigger bulk calls");
    } finally {
      setBulkLoading(null);
    }
  }

  const columns: ColumnsType<AssignmentWithDetails> = [
    {
      title: "User",
      key: "user",
      render: (_, r) => r.user.name,
      sorter: (a, b) => a.user.name.localeCompare(b.user.name),
    },
    {
      title: "Email",
      key: "email",
      render: (_, r) => r.user.email,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: AssignmentWithDetails["status"]) => (
        <Tag color={ASSIGNMENT_STATUS_COLORS[status]}>
          {ASSIGNMENT_STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, r) => (
        <Space>
          <Dropdown
            menu={{
              items: [
                {
                  key: "phone",
                  label: "Phone Call",
                  icon: <PhoneOutlined />,
                  onClick: () => handleTriggerCall(r.id),
                },
                {
                  key: "browser",
                  label: "Share a Link",
                  icon: <LinkOutlined />,
                  onClick: () => handleShareLink(r.id),
                },
              ],
            }}
            trigger={["click"]}
            disabled={r.status === "completed"}
          >
            <Button
              type="link"
              icon={<PhoneOutlined />}
              disabled={r.status === "completed"}
            >
              Train <DownOutlined style={{ fontSize: 10 }} />
            </Button>
          </Dropdown>
          <Popconfirm title="Remove assignment?" onConfirm={() => handleRemoveAssignment(r.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              Remove
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const sorted = [...difficultyLevels].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      {sorted.map((level) => {
        const levelAssignments = assignments.filter(
          (a) => a.difficulty_level_id === level.id
        );
        return (
          <Card
            key={level.id}
            title={`${level.name} - ${levelAssignments.length} users`}
            style={{ marginBottom: 16 }}
            extra={
              <Space>
                <Button
                  icon={<PhoneOutlined />}
                  onClick={() => handleBulkCall(level.id)}
                  loading={bulkLoading === level.id}
                  disabled={levelAssignments.length === 0}
                >
                  Call All
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setSelectedLevelId(level.id);
                    setAddDialogOpen(true);
                  }}
                >
                  Add Users
                </Button>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={levelAssignments}
              rowKey="id"
              pagination={false}
              size="middle"
            />
          </Card>
        );
      })}

      <AddUsersDialog
        open={addDialogOpen}
        scenarioId={scenarioId}
        difficultyLevelId={selectedLevelId}
        existingUserIds={assignments
          .filter((a) => a.difficulty_level_id === selectedLevelId)
          .map((a) => a.user_id)}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={() => {
          setAddDialogOpen(false);
          onRefresh();
        }}
      />
    </>
  );
}
