"use client";

import { Modal, Input, App, Typography } from "antd";
import { useState } from "react";
import {useTranslations} from 'next-intl';

const { Text } = Typography;

interface ReportIssueDialogProps {
  open: boolean;
  onClose: () => void;
  communicationId: string;
  transcriptionId: string;
  category: string;
  transcriptContent?: string;
  title?: string;
  sessionId?: string;
  scenarioName?: string;
  difficultyName?: string;
}

export default function ReportIssueDialog({
  open,
  onClose,
  communicationId,
  transcriptionId,
  category,
  transcriptContent,
  title: titleProp,
  sessionId,
  scenarioName,
  difficultyName,
}: ReportIssueDialogProps) {
  const { message } = App.useApp();
  const t = useTranslations('ReportIssue');
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleOk() {
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communicationId,
          transcriptionId,
          description: description.trim(),
          category,
          sessionId,
          scenarioName,
          difficultyName,
        }),
      });
      if (!res.ok) throw new Error("Failed to create issue");
      message.success(t('issueReported'));
      setDescription("");
      onClose();
    } catch {
      message.error(t('failedToReport'));
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setDescription("");
    onClose();
  }

  return (
    <Modal
      title={titleProp ?? t('title')}
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      confirmLoading={submitting}
      okButtonProps={{ disabled: !description.trim() }}
      okText={t('submit')}
    >
      {transcriptContent && (
        <div
          style={{
            background: "#F3F4F6",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
            maxHeight: 120,
            overflowY: "auto",
          }}
        >
          <Text style={{ fontSize: 12, color: "#6B7280" }}>{t('transcriptContext')}</Text>
          <Text style={{ fontSize: 13, display: "block", marginTop: 4 }}>
            {transcriptContent}
          </Text>
        </div>
      )}
      <Input.TextArea
        rows={4}
        placeholder={t('descriptionPlaceholder')}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={{ fontSize: 15 }}
      />
    </Modal>
  );
}
