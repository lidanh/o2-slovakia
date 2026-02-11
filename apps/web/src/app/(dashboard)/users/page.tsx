"use client";

import { useState, useEffect } from "react";
import { Input, Modal, Form, Button, App } from "antd";
import { SearchOutlined, PlusOutlined } from "@ant-design/icons";
import PageHeader from "@/components/common/PageHeader";
import ExportButton from "@/components/common/ExportButton";
import UserTable from "@/components/users/UserTable";
import UserForm from "@/components/users/UserForm";
import type { UserWithTeam, CreateUserPayload } from "@repo/shared";

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithTeam | null>(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch("/api/users?withTeam=true");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch {
      message.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateUser(values: CreateUserPayload) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed to create user");
      message.success("User created");
      setModalOpen(false);
      form.resetFields();
      fetchUsers();
    } catch {
      message.error("Failed to create user");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditUser(values: CreateUserPayload) {
    if (!editingUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed to update user");
      message.success("User updated");
      setEditingUser(null);
      form.resetFields();
      fetchUsers();
    } catch {
      message.error("Failed to update user");
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
        title="Users"
        subtitle="Manage training participants"
        extra={
          <>
            <ExportButton url="/api/users/export" filename="users.xlsx" />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
            >
              New User
            </Button>
          </>
        }
      />

      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search by name or email..."
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
        onEdit={(user) => {
          form.setFieldsValue({
            name: user.name,
            email: user.email,
            phone: user.phone,
            team_id: user.team_id ?? undefined,
          });
          setEditingUser(user);
        }}
      />

      <Modal
        title="Create User"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={640}
        okText="Create User"
        destroyOnHidden
        okButtonProps={{ disabled: !formValid }}
      >
        <UserForm
          form={form}
          onSubmit={handleCreateUser}
          loading={submitting}
          hideSubmitButton
          onValidityChange={setFormValid}
        />
      </Modal>

      <Modal
        title="Edit User"
        open={!!editingUser}
        onCancel={() => {
          setEditingUser(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={640}
        okText="Save Changes"
        destroyOnHidden
        okButtonProps={{ disabled: !formValid }}
      >
        <UserForm
          form={form}
          onSubmit={handleEditUser}
          loading={submitting}
          hideSubmitButton
          onValidityChange={setFormValid}
          initialValues={
            editingUser
              ? {
                  name: editingUser.name,
                  email: editingUser.email,
                  phone: editingUser.phone,
                  team_id: editingUser.team_id ?? undefined,
                }
              : undefined
          }
        />
      </Modal>
    </>
  );
}
