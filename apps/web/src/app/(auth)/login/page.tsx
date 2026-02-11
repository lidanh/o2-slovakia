"use client";

import { useState } from "react";
import { Form, Input, Button, Typography, Alert, Flex } from "antd";
import { MailOutlined, LockOutlined } from "@ant-design/icons";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(values: { email: string; password: string }) {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
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
          O2 Trainer
        </Title>
        <Text style={{ color: "#9CA3AF", fontSize: 14 }}>
          Sign in to your admin account
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

      <Form layout="vertical" onFinish={handleLogin} autoComplete="off" size="large">
        <Form.Item
          name="email"
          rules={[
            { required: true, message: "Please enter your email" },
            { type: "email", message: "Please enter a valid email" },
          ]}
        >
          <Input
            prefix={<MailOutlined style={{ color: "#9CA3AF" }} />}
            placeholder="Email address"
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: "Please enter your password" }]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: "#9CA3AF" }} />}
            placeholder="Password"
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
            Sign In
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
