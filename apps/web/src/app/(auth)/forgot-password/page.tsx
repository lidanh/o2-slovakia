"use client";

import { useState } from "react";
import { Form, Input, Button, Typography, Alert, Flex } from "antd";
import { MailOutlined } from "@ant-design/icons";
import Image from "next/image";
import Link from "next/link";

const { Title, Text } = Typography;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(values: { email: string }) {
    setLoading(true);

    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: values.email }),
    });

    setLoading(false);
    setSubmitted(true);
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
          Forgot Password
        </Title>
        <Text style={{ color: "#9CA3AF", fontSize: 14 }}>
          Enter your email and we&apos;ll send you a reset link.
        </Text>
      </Flex>

      {submitted ? (
        <Alert
          message="Check your email"
          description="If an account exists with that email, you'll receive a password reset link shortly."
          type="success"
          showIcon
          style={{ marginBottom: 20, borderRadius: 12 }}
        />
      ) : (
        <Form
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
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
              Send Reset Link
            </Button>
          </Form.Item>
        </Form>
      )}

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <Link
          href="/login"
          style={{ color: "#0112AA", fontSize: 14, fontWeight: 500 }}
        >
          Back to login
        </Link>
      </div>

      <Text
        style={{
          display: "block",
          textAlign: "center",
          marginTop: 16,
          fontSize: 12,
          color: "#C0C0C0",
        }}
      >
        O2 Trainer Platform
      </Text>
    </div>
  );
}
