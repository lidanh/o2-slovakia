"use client";

import { useState, useEffect } from "react";
import { Input, Modal, Form, Button, App } from "antd";
import { SearchOutlined, PlusOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import PageHeader from "@/components/common/PageHeader";
import ExportButton from "@/components/common/ExportButton";
import UserTable from "@/components/users/UserTable";
import UserForm from "@/components/users/UserForm";
import { useAuth } from "@/contexts/AuthContext";
import type { UserWithTeam, InviteUserPayload } from "@repo/shared";

export default function UsersPage() {
  const t = useTranslations('Users');
  const tCommon = useTranslations('Common');
  const [users, setUsers] = useState<UserWithTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithTeam | null>(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { user } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchUsers() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ withTeam: "true" });
      if (user?.role === "team_manager" && user.teamId) {
        params.set("teamId", user.teamId);
      }
      const res = await fetch(`/api/users?${params}`);
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch {
      message.error(tCommon('messages.failedToLoadUsers'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(values: InviteUserPayload) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed to invite user");
      message.success(tCommon('messages.userInvited'));
      setModalOpen(false);
      form.resetFields();
      fetchUsers();
    } catch {
      message.error(tCommon('messages.failedToInviteUser'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditUser(values: InviteUserPayload) {
    if (!editingUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed to update user");
      message.success(tCommon('messages.userUpdated'));
      setEditingUser(null);
      form.resetFields();
      fetchUsers();
    } catch {
      message.error(tCommon('messages.failedToUpdateUser'));
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = search
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        extra={
          <>
            <ExportButton url="/api/users/export" filename="users.xlsx" />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
            >
              {tCommon('buttons.inviteUser')}
            </Button>
          </>
        }
      />

      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder={t('searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
      </div>

      <UserTable
        data={filtered}
        loading={loading}
        onEdit={(editUser) => {
          form.setFieldsValue({
            name: editUser.name,
            email: editUser.email,
            phone: editUser.phone,
            role: editUser.role,
            team_id: editUser.team_id ?? undefined,
          });
          setEditingUser(editUser);
        }}
        onResendInvite={async (u) => {
          const res = await fetch("/api/users/invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: u.name,
              email: u.email,
              role: u.role,
              team_id: u.team_id ?? undefined,
              resend: true,
            }),
          });
          if (!res.ok) throw new Error("Failed to resend");
        }}
      />

      <Modal
        title={tCommon('buttons.inviteUser')}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={640}
        okText={tCommon('buttons.inviteUser')}
        destroyOnHidden
        okButtonProps={{ disabled: !formValid }}
      >
        <UserForm
          form={form}
          onSubmit={handleCreateUser}
          loading={submitting}
          hideSubmitButton
          onValidityChange={setFormValid}
          currentUserRole={user?.role}
        />
      </Modal>

      <Modal
        title={t('editUser')}
        open={!!editingUser}
        onCancel={() => {
          setEditingUser(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={640}
        okText={tCommon('buttons.saveChanges')}
        destroyOnHidden
        okButtonProps={{ disabled: !formValid }}
      >
        <UserForm
          form={form}
          onSubmit={handleEditUser}
          loading={submitting}
          hideSubmitButton
          onValidityChange={setFormValid}
          currentUserRole={user?.role}
          initialValues={
            editingUser
              ? {
                  name: editingUser.name,
                  email: editingUser.email,
                  phone: editingUser.phone ?? undefined,
                  role: editingUser.role,
                  team_id: editingUser.team_id ?? undefined,
                }
              : undefined
          }
        />
      </Modal>
    </>
  );
}
