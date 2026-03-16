"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import {
  Form,
  Input,
  Button,
  Typography,
  Alert,
  Card,
  Switch,
  Table,
  Tag,
  Popconfirm,
  Spin,
  Modal,
  Select,
  App,
} from "antd";
import { ApiOutlined, CopyOutlined, PlusOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  agent_api_key: string | null;
  user_count: number;
  created_at: string;
}

interface TenantUser {
  id: string;
  user_id: string;
  role: string;
  is_active: boolean;
  user: { id: string; name: string; email: string; avatar_url: string | null };
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  team_manager: "Team Manager",
  user: "User",
};

export default function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { message } = App.useApp();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [apiKeyRevealed, setApiKeyRevealed] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Wonderful AI settings
  const [settingsForm] = Form.useForm();
  const [savingSettings, setSavingSettings] = useState(false);
  const [existingSettings, setExistingSettings] = useState<Record<string, unknown>>({});

  // Add user modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [adding, setAdding] = useState(false);
  const [existingUser, setExistingUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lookupEmail = useCallback((email: string) => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    setExistingUser(null);

    // Basic email validation before lookup
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLookingUp(false);
      return;
    }

    setLookingUp(true);
    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/backoffice/users/lookup?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (data.exists && data.user) {
          setExistingUser(data.user);
        } else {
          setExistingUser(null);
        }
      } catch {
        setExistingUser(null);
      } finally {
        setLookingUp(false);
      }
    }, 400);
  }, []);

  function fetchUsers() {
    return fetch(`/api/backoffice/tenants/${id}/users`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setUsers(data); });
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/backoffice/tenants/${id}`).then((r) => r.json()),
      fetch(`/api/backoffice/tenants/${id}/users`).then((r) => r.json()),
      fetch(`/api/backoffice/tenants/${id}/settings`).then((r) => r.json()),
    ])
      .then(([t, u, s]) => {
        setTenant(t);
        if (Array.isArray(u)) setUsers(u);
        form.setFieldsValue({ name: t.name, slug: t.slug, is_active: t.is_active });
        const settings = s.settings ?? {};
        setExistingSettings(settings);
        const wonderful = (settings.wonderful ?? {}) as Record<string, string>;
        settingsForm.setFieldsValue({
          tenant_url: wonderful.tenant_url ?? "",
          api_key: wonderful.api_key ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, [id, form, settingsForm]);

  async function handleSave(values: { name: string; slug: string; is_active: boolean }) {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/backoffice/tenants/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to update tenant");
        return;
      }

      const updated = await res.json();
      setTenant((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSettings(values: { tenant_url: string; api_key: string }) {
    setSavingSettings(true);
    try {
      const wonderful = (existingSettings.wonderful ?? {}) as Record<string, unknown>;
      const merged = {
        ...existingSettings,
        wonderful: {
          ...wonderful,
          tenant_url: values.tenant_url,
          api_key: values.api_key,
        },
      };

      const res = await fetch(`/api/backoffice/tenants/${id}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: merged }),
      });

      if (!res.ok) {
        message.error("Failed to save settings");
        return;
      }

      const data = await res.json();
      setExistingSettings(data.settings ?? merged);
      message.success("Wonderful AI settings saved");
    } catch {
      message.error("Something went wrong");
    } finally {
      setSavingSettings(false);
    }
  }

  async function regenerateKey() {
    setRegenerating(true);
    setApiKeyRevealed(null);
    try {
      const res = await fetch(`/api/backoffice/tenants/${id}/regenerate-api-key`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeyRevealed(data.agent_api_key);
        setTenant((prev) => (prev ? { ...prev, agent_api_key: data.agent_api_key } : prev));
      }
    } finally {
      setRegenerating(false);
    }
  }

  async function handleAddUser(values: { email: string; name?: string; role: string }) {
    setAdding(true);
    try {
      const payload = existingUser
        ? { email: values.email, name: existingUser.name, role: values.role }
        : { email: values.email, name: values.name, role: values.role };
      const res = await fetch(`/api/backoffice/tenants/${id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        message.error(data.error || "Failed to add user");
        return;
      }

      if (data.action === "invited") {
        message.success(`Invitation sent to ${values.email}`);
      } else {
        message.success(`${values.email} added to tenant`);
      }

      setAddModalOpen(false);
      addForm.resetFields();
      setExistingUser(null);
      await fetchUsers();
    } catch {
      message.error("Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  async function changeRole(userId: string, role: string) {
    try {
      const res = await fetch(`/api/backoffice/tenants/${id}/users`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.user_id === userId ? { ...u, role } : u))
        );
        message.success("Role updated");
      } else {
        const data = await res.json();
        message.error(data.error || "Failed to update role");
      }
    } catch {
      message.error("Something went wrong");
    }
  }

  async function removeUser(userId: string) {
    try {
      const res = await fetch(`/api/backoffice/tenants/${id}/users?userId=${userId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.user_id !== userId));
      }
    } catch {
      // silent
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div style={{ padding: 24 }}>
        <Alert message="Tenant not found" type="error" />
      </div>
    );
  }

  const userColumns = [
    {
      title: "Name",
      key: "name",
      render: (_: unknown, record: TenantUser) => record.user?.name ?? "\u2014",
    },
    {
      title: "Email",
      key: "email",
      render: (_: unknown, record: TenantUser) => record.user?.email ?? "\u2014",
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (role: string, record: TenantUser) => (
        <Select
          value={role}
          size="small"
          style={{ width: 140 }}
          onChange={(value) => changeRole(record.user_id, value)}
          options={[
            { value: "admin", label: "Admin" },
            { value: "team_manager", label: "Team Manager" },
            { value: "user", label: "User" },
          ]}
        />
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, record: TenantUser) => (
        <Popconfirm
          title="Remove this user from the tenant?"
          onConfirm={() => removeUser(record.user_id)}
        >
          <Button type="link" danger size="small">
            Remove
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <Button type="link" onClick={() => router.push("/backoffice")} style={{ padding: 0, marginBottom: 16 }}>
        &larr; Back to tenants
      </Button>

      <Title level={3}>{tenant.name}</Title>

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          onClose={() => setError(null)}
        />
      )}

      <Card title="Tenant Settings" style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="slug"
            label="Slug"
            rules={[
              { required: true },
              { pattern: /^[a-z0-9-]+$/, message: "Lowercase alphanumeric and hyphens only" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving}>
              Save
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="Agent API Key" style={{ marginBottom: 24 }}>
        <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          This key is used by the Wonderful AI agent to authenticate requests. Configure it in the agent&apos;s X-API-Key header.
        </Text>

        {apiKeyRevealed && (
          <Alert
            type="success"
            showIcon
            message="New API key generated."
            style={{ marginBottom: 16 }}
          />
        )}

        <Input
          value={tenant.agent_api_key ?? ""}
          readOnly
          onClick={() => {
            if (tenant.agent_api_key) {
              navigator.clipboard.writeText(tenant.agent_api_key);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          }}
          suffix={copied ? <span style={{ color: "#52c41a", fontSize: 12 }}>Copied!</span> : <CopyOutlined style={{ color: "#999" }} />}
          style={{
            fontFamily: "monospace",
            fontSize: 13,
            cursor: "pointer",
            marginBottom: 16,
          }}
        />

        <Popconfirm
          title="Regenerate API key?"
          description="The current key will stop working immediately. Any configured Wonderful AI agents must be updated."
          onConfirm={regenerateKey}
          okText="Regenerate"
          okButtonProps={{ danger: true }}
        >
          <Button danger loading={regenerating}>
            Regenerate API Key
          </Button>
        </Popconfirm>
      </Card>

      <Card
        title="Wonderful AI Settings"
        style={{ marginBottom: 24 }}
        extra={
          <ApiOutlined style={{ color: "#0112AA" }} />
        }
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          Configure the Wonderful AI tenant URL and API key for this tenant&apos;s agent integration.
        </Text>
        <Form form={settingsForm} layout="vertical" onFinish={handleSaveSettings}>
          <Form.Item
            name="tenant_url"
            label="Tenant URL"
            rules={[
              { required: true, message: "Tenant URL is required" },
              { type: "url", message: "Enter a valid URL" },
            ]}
          >
            <Input placeholder="https://your-tenant.wonderful.ai" />
          </Form.Item>
          <Form.Item
            name="api_key"
            label="API Key"
            rules={[{ required: true, message: "API key is required" }]}
          >
            <Input.Password placeholder="Wonderful AI API key" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={savingSettings}>
              Save Settings
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title={`Users (${users.length})`}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="small"
            onClick={() => setAddModalOpen(true)}
          >
            Add User
          </Button>
        }
      >
        <Table
          dataSource={users}
          columns={userColumns}
          rowKey="id"
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title="Add User to Tenant"
        open={addModalOpen}
        onCancel={() => { setAddModalOpen(false); addForm.resetFields(); setExistingUser(null); }}
        footer={null}
        destroyOnClose
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          {existingUser
            ? `${existingUser.name} will be added directly to this tenant.`
            : "If the email belongs to an existing user, they will be added directly. Otherwise, an invitation email will be sent."}
        </Text>
        <Form form={addForm} layout="vertical" onFinish={handleAddUser}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Enter a valid email" },
            ]}
          >
            <Input
              placeholder="user@example.com"
              onChange={(e) => lookupEmail(e.target.value)}
              suffix={lookingUp ? <Spin size="small" /> : existingUser ? <Tag color="green" style={{ margin: 0 }}>Existing user</Tag> : null}
            />
          </Form.Item>
          {!existingUser && (
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: !existingUser, message: "Name is required" }]}
            >
              <Input placeholder="Full name" />
            </Form.Item>
          )}
          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: "Select a role" }]}
            initialValue="user"
          >
            <Select
              options={[
                { value: "admin", label: "Admin" },
                { value: "team_manager", label: "Team Manager" },
                { value: "user", label: "User" },
              ]}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Button onClick={() => { setAddModalOpen(false); addForm.resetFields(); }} style={{ marginRight: 8 }}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={adding}>
              Add User
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
