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
import type { UserWithTeam, InviteUserPayload, InvitationWithInviter } from "@repo/shared";

export interface UserOrInvitation {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  team: { name: string } | null;
  team_id: string | null;
  created_at: string;
  type: "user" | "invitation";
}

export default function UsersPage() {
  const t = useTranslations('Users');
  const tCommon = useTranslations('Common');
  const [users, setUsers] = useState<UserWithTeam[]>([]);
  const [invitations, setInvitations] = useState<InvitationWithInviter[]>([]);
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
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ withTeam: "true" });
      if (user?.role === "team_manager" && user.teamId) {
        params.set("teamId", user.teamId);
      }
      const [usersRes, invitationsRes] = await Promise.all([
        fetch(`/api/users?${params}`),
        fetch("/api/users?invitations=pending"),
      ]);
      if (!usersRes.ok) throw new Error("Failed to fetch users");
      setUsers(await usersRes.json());
      if (invitationsRes.ok) {
        setInvitations(await invitationsRes.json());
      }
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
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to invite user");
      }
      message.success(tCommon('messages.userInvited'));
      setModalOpen(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      message.error((err as Error).message || tCommon('messages.failedToInviteUser'));
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
      fetchData();
    } catch {
      message.error(tCommon('messages.failedToUpdateUser'));
    } finally {
      setSubmitting(false);
    }
  }

  // Build unified list
  const combined: UserOrInvitation[] = [
    ...invitations.map((inv) => ({
      id: inv.id,
      name: inv.name,
      email: inv.email,
      phone: null,
      role: inv.role,
      team: inv.team,
      team_id: inv.team_id,
      created_at: inv.created_at,
      type: "invitation" as const,
    })),
    ...users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      team: u.team,
      team_id: u.team_id,
      created_at: u.created_at,
      type: "user" as const,
    })),
  ];

  const filtered = search
    ? combined.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      )
    : combined;

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
          if (editUser.type === "invitation") return;
          const original = users.find((u) => u.id === editUser.id);
          if (!original) return;
          form.setFieldsValue({
            name: original.name,
            email: original.email,
            phone: original.phone,
            role: original.role,
            team_id: original.team_id ?? undefined,
          });
          setEditingUser(original);
        }}
        onDelete={async (item) => {
          if (item.type === "invitation") {
            // Cancel invitation
            const res = await fetch(`/api/users?cancelInvitation=${item.id}`, {
              method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to cancel invitation");
          } else {
            const res = await fetch(`/api/users/${item.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete");
          }
          fetchData();
        }}
        onResendInvite={async (item) => {
          const res = await fetch("/api/users/invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: item.name,
              email: item.email,
              role: item.role,
              team_id: item.team_id ?? undefined,
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
