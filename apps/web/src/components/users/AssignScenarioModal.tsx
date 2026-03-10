"use client";

import { Modal, Select, Form, App, Spin } from "antd";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import type { ScenarioWithLevels } from "@repo/shared";

interface AssignScenarioModalProps {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AssignScenarioModal({
  open,
  userId,
  onClose,
  onSuccess,
}: AssignScenarioModalProps) {
  const t = useTranslations('Users');
  const tCommon = useTranslations('Common');
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [scenarios, setScenarios] = useState<ScenarioWithLevels[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formValid, setFormValid] = useState(false);

  const selectedScenarioId = Form.useWatch("scenarioId", form);
  const allValues = Form.useWatch([], form);

  useEffect(() => {
    form.validateFields({ validateOnly: true })
      .then(() => setFormValid(true))
      .catch(() => setFormValid(false));
  }, [form, allValues]);
  const selectedScenario = scenarios.find((s) => s.id === selectedScenarioId);

  useEffect(() => {
    if (open) {
      setLoading(true);
      form.resetFields();
      fetch("/api/scenarios?withLevels=true")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load scenarios");
          return res.json();
        })
        .then((data) =>
          setScenarios(
            Array.isArray(data) ? data.filter((s: ScenarioWithLevels) => s.is_active !== false) : []
          )
        )
        .catch(() => message.error(tCommon('messages.failedToLoadScenarios')))
        .finally(() => setLoading(false));
    }
  }, [open, form]);

  async function handleOk() {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: [userId],
          scenarioId: values.scenarioId,
          difficultyLevelId: values.difficultyLevelId,
        }),
      });
      if (!res.ok) throw new Error("Failed to create assignment");
      message.success(tCommon('messages.scenarioAssigned'));
      onSuccess();
    } catch {
      message.error(tCommon('messages.failedToAssignScenario'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={t('assignModal.title')}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={submitting}
      okButtonProps={{ disabled: !formValid }}
    >
      {loading ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spin />
        </div>
      ) : (
        <Form form={form} layout="vertical">
          <Form.Item
            name="scenarioId"
            label={t('assignModal.scenario')}
            rules={[{ required: true, message: t('assignModal.scenarioRequired') }]}
          >
            <Select
              placeholder={t('assignModal.scenarioPlaceholder')}
              options={scenarios.map((s) => ({ value: s.id, label: s.name }))}
              onChange={() => form.setFieldValue("difficultyLevelId", undefined)}
            />
          </Form.Item>

          <Form.Item
            name="difficultyLevelId"
            label={t('assignModal.difficultyLevel')}
            rules={[{ required: true, message: t('assignModal.difficultyRequired') }]}
          >
            <Select
              placeholder={t('assignModal.difficultyPlaceholder')}
              disabled={!selectedScenarioId}
              options={
                selectedScenario?.difficulty_levels
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .map((l) => ({
                    value: l.id,
                    label: l.name,
                  })) ?? []
              }
            />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
