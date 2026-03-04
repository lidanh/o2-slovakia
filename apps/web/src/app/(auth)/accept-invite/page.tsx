"use client";

import { useState } from "react";
import { Form, Input, Button, Typography, Alert, Flex } from "antd";
import { LockOutlined } from "@ant-design/icons";
import Image from "next/image";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;

export default function AcceptInvitePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSetPassword(values: {
    password: string;
    confirm: string;
  }) {
    setLoading(true);
    setError(null);

    if (values.password !== values.confirm) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    // Set password and activate via server-side API
    // (browser can't reach Supabase directly behind reverse proxy)
    const res = await fetch("/api/users/me", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: values.password, status: "active" }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Failed to set password");
      setLoading(false);
      return;
    }

    const user = await res.json();
    const role = user?.role ?? "user";

    const redirectMap: Record<string, string> = {
      admin: "/dashboard",
      team_manager: "/dashboard",
      user: "/my-dashboard",
    };

    router.push(redirectMap[role] || "/dashboard");
    router.refresh();
  }

  return (
    <div
      className="login-card-animated"
      style={{
        width: 440,
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(20px)",
        borderRadius: 24,
        padding: "48px 40px",
        boxShadow:
          "0 20px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        position: "relative",
        zIndex: 1,
      }}
    >
      <Flex vertical align="center" gap={8} style={{ marginBottom: 40 }}>
        <Image
          src="/o2-logo.svg"
          alt="O2 Slovakia"
          width={80}
          height={53}
          priority
        />
        <Title
          level={2}
          style={{
            margin: 0,
            marginTop: 8,
            fontWeight: 500,
            letterSpacing: "-0.3px",
            color: "#1a1a2e",
          }}
        >
          Set Your Password
        </Title>
        <Text style={{ color: "#9CA3AF", fontSize: 14 }}>
          Welcome to O2 Trainer! Create a password to complete your setup.
        </Text>
      </Flex>

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          style={{ marginBottom: 20, borderRadius: 12 }}
          onClose={() => setError(null)}
        />
      )}

      <Form
        layout="vertical"
        onFinish={handleSetPassword}
        autoComplete="off"
        size="large"
      >
        <Form.Item
          name="password"
          rules={[
            { required: true, message: "Please enter a password" },
            { min: 8, message: "Password must be at least 8 characters" },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: "#9CA3AF" }} />}
            placeholder="New password"
          />
        </Form.Item>

        <Form.Item
          name="confirm"
          rules={[
            { required: true, message: "Please confirm your password" },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: "#9CA3AF" }} />}
            placeholder="Confirm password"
          />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 12 }}>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            block
            size="large"
            style={{
              height: 48,
              fontWeight: 600,
              fontSize: 15,
              borderRadius: 12,
              background: "linear-gradient(135deg, #0112AA, #2563EB)",
              border: "none",
              boxShadow: "0 4px 16px rgba(1, 18, 170, 0.3)",
            }}
          >
            Complete Setup
          </Button>
        </Form.Item>
      </Form>

      <Text
        style={{
          display: "block",
          textAlign: "center",
          marginTop: 24,
          fontSize: 12,
          color: "#C0C0C0",
        }}
      >
        O2 Trainer Platform
      </Text>
    </div>
  );
}
