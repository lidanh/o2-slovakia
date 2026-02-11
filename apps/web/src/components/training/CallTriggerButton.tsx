"use client";

import { Button, Dropdown, App } from "antd";
import { PhoneOutlined, LinkOutlined, DownOutlined } from "@ant-design/icons";
import { useState } from "react";

interface CallTriggerButtonProps {
  assignmentId: string;
  disabled?: boolean;
  onSuccess?: () => void;
}

export default function CallTriggerButton({
  assignmentId,
  disabled,
  onSuccess,
}: CallTriggerButtonProps) {
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  async function handlePhoneCall() {
    setLoading(true);
    try {
      const res = await fetch("/api/training/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      if (!res.ok) throw new Error("Failed to trigger call");
      message.success("Call initiated successfully");
      onSuccess?.();
    } catch {
      message.error("Failed to trigger call");
    } finally {
      setLoading(false);
    }
  }

  async function handleShareLink() {
    setLoading(true);
    try {
      const res = await fetch("/api/training/browser-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      if (!res.ok) throw new Error("Failed to create browser call");
      const data = await res.json();
      const fullUrl = `${window.location.origin}${data.callUrl}`;
      await navigator.clipboard.writeText(fullUrl);
      message.success("Link copied to clipboard!");
      onSuccess?.();
    } catch {
      message.error("Failed to generate link");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dropdown
      menu={{
        items: [
          {
            key: "phone",
            label: "Phone Call",
            icon: <PhoneOutlined />,
            onClick: handlePhoneCall,
          },
          {
            key: "browser",
            label: "Share a Link",
            icon: <LinkOutlined />,
            onClick: handleShareLink,
          },
        ],
      }}
      trigger={["click"]}
    >
      <Button
        type="primary"
        icon={<PhoneOutlined />}
        loading={loading}
        disabled={disabled}
      >
        Start Training <DownOutlined />
      </Button>
    </Dropdown>
  );
}
