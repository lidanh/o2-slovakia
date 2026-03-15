"use client";

import { Modal, Input, Button, Typography, Space, App, Spin } from "antd";
import {
  CopyOutlined,
  MailOutlined,
  CheckCircleOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";

const { Text } = Typography;

interface SendLinkDialogProps {
  open: boolean;
  onClose: () => void;
  assignment: {
    id: string;
    user: { name: string; email: string };
    scenario: { name: string };
    difficulty_level: { name: string };
  } | null;
}

export default function SendLinkDialog({
  open,
  onClose,
  assignment,
}: SendLinkDialogProps) {
  const { message } = App.useApp();
  const tCommon = useTranslations("Common");

  const [linkLoading, setLinkLoading] = useState(false);
  const [callUrl, setCallUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const generateLink = useCallback(async (assignmentId: string) => {
    setLinkLoading(true);
    setCallUrl(null);
    setSent(false);
    try {
      const res = await fetch("/api/training/browser-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      if (!res.ok) throw new Error("Failed to generate link");
      const data = await res.json();
      setCallUrl(`${window.location.origin}${data.callUrl}`);
    } catch {
      message.error(tCommon("sendLink.failedToGenerate"));
    } finally {
      setLinkLoading(false);
    }
  }, [message, tCommon]);

  useEffect(() => {
    if (open && assignment) {
      generateLink(assignment.id);
    }
    if (!open) {
      setCallUrl(null);
      setSent(false);
      setSending(false);
      setLinkLoading(false);
    }
  }, [open, assignment, generateLink]);

  async function handleCopy() {
    if (!callUrl) return;
    try {
      await navigator.clipboard.writeText(callUrl);
      message.success(tCommon("sendLink.linkCopied"));
    } catch {
      message.error(tCommon("sendLink.failedToCopy"));
    }
  }

  async function handleSendEmail() {
    if (!assignment) return;
    setSending(true);
    try {
      const res = await fetch("/api/training/browser-call/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: assignment.id }),
      });
      if (!res.ok) throw new Error("Failed to send email");
      setSent(true);
      message.success(tCommon("sendLink.emailSent"));
    } catch {
      message.error(tCommon("sendLink.failedToSend"));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      title={
        <Space>
          <LinkOutlined />
          {tCommon("sendLink.title")}
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={520}
    >
      {linkLoading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">{tCommon("sendLink.generating")}</Text>
          </div>
        </div>
      ) : callUrl && assignment ? (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Text type="secondary">{tCommon("sendLink.sendTo")}</Text>
            <br />
            <Text strong style={{ fontSize: 16 }}>
              {assignment.user.email}
            </Text>
          </div>

          <div>
            <Text type="secondary" style={{ marginBottom: 8, display: "block" }}>
              {tCommon("sendLink.trainingUrl")}
            </Text>
            <Input
              value={callUrl}
              readOnly
              suffix={<CopyOutlined style={{ color: "#999" }} />}
              onClick={handleCopy}
              style={{
                backgroundColor: "#F8F9FA",
                cursor: "pointer",
              }}
            />
          </div>

          {sent ? (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <CheckCircleOutlined
                style={{ fontSize: 32, color: "#52c41a", marginBottom: 8 }}
              />
              <br />
              <Text type="success">{tCommon("sendLink.emailSentSuccess")}</Text>
            </div>
          ) : (
            <Button
              type="primary"
              icon={<MailOutlined />}
              loading={sending}
              onClick={handleSendEmail}
              block
              size="large"
            >
              {tCommon("sendLink.sendEmail")}
            </Button>
          )}
        </Space>
      ) : null}
    </Modal>
  );
}
