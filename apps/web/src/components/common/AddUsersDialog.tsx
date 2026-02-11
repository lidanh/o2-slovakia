"use client";

import { Modal, Transfer, App, Spin } from "antd";
import { useState, useEffect } from "react";
import type { User } from "@repo/shared";

interface AddUsersDialogProps {
  open: boolean;
  scenarioId: string;
  difficultyLevelId: string | null;
  existingUserIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddUsersDialog({
  open,
  scenarioId,
  difficultyLevelId,
  existingUserIds,
  onClose,
  onSuccess,
}: AddUsersDialogProps) {
  const { message } = App.useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setSelectedKeys([]);
      fetch("/api/users")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load users");
          return res.json();
        })
        .then((data) => setUsers(Array.isArray(data) ? data : []))
        .catch(() => message.error("Failed to load users"))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const availableUsers = users.filter((u) => !existingUserIds.includes(u.id));

  async function handleOk() {
    if (!difficultyLevelId || selectedKeys.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: selectedKeys,
          scenarioId,
          difficultyLevelId,
        }),
      });
      if (!res.ok) throw new Error("Failed to create assignments");
      message.success(`${selectedKeys.length} users assigned`);
      onSuccess();
    } catch {
      message.error("Failed to assign users");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="Add Users"
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={submitting}
      okButtonProps={{ disabled: selectedKeys.length === 0 }}
      width={600}
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spin />
        </div>
      ) : (
        <Transfer
          dataSource={availableUsers.map((u) => ({
            key: u.id,
            title: u.name,
            description: u.email,
          }))}
          targetKeys={selectedKeys}
          onChange={(keys) => setSelectedKeys(keys as string[])}
          render={(item) => `${item.title} (${item.description})`}
          listStyle={{ width: 250, height: 300 }}
          titles={["Available", "Selected"]}
          showSearch
          filterOption={(input, item) =>
            (item.title?.toLowerCase() ?? "").includes(input.toLowerCase()) ||
            (item.description?.toLowerCase() ?? "").includes(input.toLowerCase())
          }
        />
      )}
    </Modal>
  );
}
