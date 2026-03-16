"use client";

import { useState } from "react";
import { Form, Input, Button, Typography, Alert, Card } from "antd";
import { useRouter } from "next/navigation";

const { Title } = Typography;

export default function NewTenantPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: { name: string; slug: string }) {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/backoffice/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create tenant");
        return;
      }

      const tenant = await res.json();
      router.push(`/backoffice/tenants/${tenant.id}`);
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <Title level={3}>Create Tenant</Title>

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

      <Card>
        <Form
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="Tenant Name"
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input placeholder="e.g. O2 Slovakia" />
          </Form.Item>

          <Form.Item
            name="slug"
            label="Slug"
            rules={[
              { required: true, message: "Slug is required" },
              { pattern: /^[a-z0-9-]+$/, message: "Lowercase alphanumeric and hyphens only" },
            ]}
            tooltip="URL-friendly identifier"
          >
            <Input placeholder="e.g. o2-slovakia" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Create
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => router.back()}>
              Cancel
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
