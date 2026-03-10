"use client";

import { Button, Dropdown, App } from "antd";
import { PhoneOutlined, LinkOutlined, DownOutlined } from "@ant-design/icons";
import { useState } from "react";
import {useTranslations} from 'next-intl';

interface CallTriggerButtonProps {
  assignmentId: string;
  disabled?: boolean;
  /** When true, browser call navigates to the call page instead of copying a link */
  selfService?: boolean;
  onSuccess?: () => void;
}

export default function CallTriggerButton({
  assignmentId,
  disabled,
  selfService,
  onSuccess,
}: CallTriggerButtonProps) {
  const t = useTranslations('Training');
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
      message.success(t('callTrigger.callInitiated'));
      onSuccess?.();
    } catch {
      message.error(t('callTrigger.failedToTriggerCall'));
    } finally {
      setLoading(false);
    }
  }

  async function handleBrowserCall() {
    setLoading(true);
    try {
      const res = await fetch("/api/training/browser-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      if (!res.ok) throw new Error("Failed to create browser call");
      const data = await res.json();
      if (selfService) {
        window.open(data.callUrl, "_blank");
      } else {
        const fullUrl = `${window.location.origin}${data.callUrl}`;
        await navigator.clipboard.writeText(fullUrl);
        message.success(t('callTrigger.linkCopied'));
      }
      onSuccess?.();
    } catch {
      message.error(t('callTrigger.failedToGenerateLink'));
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
            label: t('callTrigger.phoneCall'),
            icon: <PhoneOutlined />,
            onClick: handlePhoneCall,
          },
          {
            key: "browser",
            label: selfService ? t('callTrigger.browserCall') : t('callTrigger.shareLink'),
            icon: <LinkOutlined />,
            onClick: handleBrowserCall,
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
        {t('callTrigger.startTraining')} <DownOutlined />
      </Button>
    </Dropdown>
  );
}
