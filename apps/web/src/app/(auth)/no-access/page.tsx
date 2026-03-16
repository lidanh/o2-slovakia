"use client";

import { Typography, Button } from "antd";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;

export default function NoAccessPage() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div
      style={{
        width: 440,
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(20px)",
        borderRadius: 24,
        padding: "48px 40px",
        boxShadow:
          "0 20px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        textAlign: "center",
      }}
    >
      <Image
        src="/o2-logo.svg"
        alt="O2"
        width={80}
        height={53}
        priority
        style={{ marginBottom: 16 }}
      />
      <Title
        level={2}
        style={{
          margin: 0,
          marginBottom: 12,
          fontWeight: 500,
          letterSpacing: "-0.3px",
          color: "#1a1a2e",
        }}
      >
        No Access
      </Title>
      <Text style={{ color: "#6B7280", fontSize: 15, display: "block", marginBottom: 32 }}>
        You don&apos;t have access to any organization. Please contact your administrator to receive an invitation.
      </Text>
      <Button
        type="primary"
        onClick={handleSignOut}
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
        Sign Out
      </Button>
    </div>
  );
}
