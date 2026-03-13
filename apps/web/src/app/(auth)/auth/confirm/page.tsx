"use client";

import { Suspense, useState } from "react";
import { Button, Typography, Alert, Flex, Spin } from "antd";
import { CheckCircleOutlined, RedoOutlined } from "@ant-design/icons";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";

const { Title, Text } = Typography;

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spin size="large" />
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}

function ConfirmContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const isRecovery = type === "recovery";
  const title = isRecovery ? "Reset Your Password" : "You\u2019ve Been Invited!";
  const subtitle = isRecovery
    ? "Click below to continue resetting your password."
    : "You\u2019ve been invited to join the O2 Trainer platform.";
  const buttonText = isRecovery ? "Continue" : "Accept Invitation";
  const buttonIcon = isRecovery ? <RedoOutlined /> : <CheckCircleOutlined />;

  async function handleVerify() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_hash: tokenHash, type }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed. The link may have expired.");
        setLoading(false);
        return;
      }

      router.push(data.redirectPath);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (!tokenHash || !type) {
    return (
      <Card>
        <Flex vertical align="center" gap={8} style={{ marginBottom: 24 }}>
          <Image src="/o2-logo.svg" alt="O2 Slovakia" width={80} height={53} priority />
          <Title level={2} style={{ margin: 0, marginTop: 8, fontWeight: 500, letterSpacing: "-0.3px", color: "#1a1a2e" }}>
            Invalid Link
          </Title>
        </Flex>
        <Alert
          message="This link is missing required parameters. Please check your email for the correct link."
          type="error"
          showIcon
          style={{ borderRadius: 12 }}
        />
      </Card>
    );
  }

  return (
    <Card>
      <Flex vertical align="center" gap={8} style={{ marginBottom: 40 }}>
        <Image src="/o2-logo.svg" alt="O2 Slovakia" width={80} height={53} priority />
        <Title level={2} style={{ margin: 0, marginTop: 8, fontWeight: 500, letterSpacing: "-0.3px", color: "#1a1a2e" }}>
          {title}
        </Title>
        <Text style={{ color: "#9CA3AF", fontSize: 14, textAlign: "center" }}>
          {subtitle}
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

      <Button
        type="primary"
        icon={buttonIcon}
        loading={loading}
        onClick={handleVerify}
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
        {buttonText}
      </Button>

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
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        position: "relative",
        zIndex: 1,
      }}
    >
      {children}
    </div>
  );
}
