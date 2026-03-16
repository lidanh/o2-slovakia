"use client";

import { useState, useEffect, use } from "react";
import { Form, Input, Button, Typography, Alert, Flex, Spin, Tag } from "antd";
import { LockOutlined, UserOutlined, TeamOutlined, BankOutlined } from "@ant-design/icons";
import Image from "next/image";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;

interface InvitationDetails {
  email: string;
  name: string;
  role: string;
  team_name: string | null;
  tenant_name: string | null;
  inviter_name: string | null;
  expires_at: string;
  existing_user: boolean;
}

function Card({ children }: { children: React.ReactNode }) {
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
      {children}
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  team_manager: "Team Manager",
  user: "User",
};

export default function InviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [invalidStatus, setInvalidStatus] = useState<string | null>(null);

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(`/api/invitations/verify/${token}`);
        if (res.ok) {
          setInvitation(await res.json());
        } else {
          const data = await res.json().catch(() => null);
          setInvalidStatus(
            data?.status || data?.error || "This invitation is no longer valid."
          );
        }
      } catch {
        setInvalidStatus("Failed to verify invitation. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    verify();
  }, [token]);

  async function handleSubmit(values?: { password?: string; confirm?: string }) {
    if (values?.password && values?.confirm && values.password !== values.confirm) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values?.password ? { password: values.password } : {}),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to accept invitation");
        setSubmitting(false);
        return;
      }

      router.push(data.redirectPath || "/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <Flex vertical align="center" gap={16}>
          <Spin size="large" />
          <Text style={{ color: "#9CA3AF" }}>Verifying invitation...</Text>
        </Flex>
      </Card>
    );
  }

  if (invalidStatus) {
    return (
      <Card>
        <Flex vertical align="center" gap={8} style={{ marginBottom: 24 }}>
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
            Invitation Unavailable
          </Title>
        </Flex>
        <Alert
          message={
            invalidStatus === "expired"
              ? "This invitation has expired. Please ask your administrator to send a new one."
              : invalidStatus === "accepted"
                ? "This invitation has already been accepted."
                : invalidStatus === "cancelled"
                  ? "This invitation has been cancelled."
                  : invalidStatus
          }
          type="warning"
          showIcon
          style={{ borderRadius: 12 }}
        />
      </Card>
    );
  }

  if (!invitation) return null;

  return (
    <Card>
      <Flex vertical align="center" gap={8} style={{ marginBottom: 32 }}>
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
          {invitation.existing_user ? "Join Organization" : "You've Been Invited"}
        </Title>
        <Text style={{ color: "#9CA3AF", fontSize: 14, textAlign: "center" }}>
          {invitation.inviter_name
            ? `${invitation.inviter_name} invited you to join ${invitation.tenant_name ?? "O2 Trainer"}.`
            : `You've been invited to join ${invitation.tenant_name ?? "O2 Trainer"}.`}
        </Text>
      </Flex>

      <Flex gap={8} wrap style={{ marginBottom: 24, justifyContent: "center" }}>
        {invitation.tenant_name && (
          <Tag icon={<BankOutlined />} color="purple">
            {invitation.tenant_name}
          </Tag>
        )}
        <Tag icon={<UserOutlined />} color="blue">
          {ROLE_LABELS[invitation.role] || invitation.role}
        </Tag>
        {invitation.team_name && (
          <Tag icon={<TeamOutlined />} color="cyan">
            {invitation.team_name}
          </Tag>
        )}
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

      {invitation.existing_user ? (
        <>
          <Text style={{ color: "#6B7280", fontSize: 14, textAlign: "center", display: "block", marginBottom: 24 }}>
            You already have an account as <strong>{invitation.email}</strong>. Click below to join this organization.
          </Text>
          <Button
            type="primary"
            loading={submitting}
            block
            size="large"
            onClick={() => handleSubmit()}
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
            Join {invitation.tenant_name ?? "Organization"}
          </Button>
        </>
      ) : (
        <Form
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item label="Email">
            <Input value={invitation.email} disabled />
          </Form.Item>

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
              loading={submitting}
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
      )}

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
    </Card>
  );
}
