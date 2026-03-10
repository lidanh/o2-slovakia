"use client";

import { useState, useEffect } from "react";
import { Select, Modal, Form, Button, App } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import {useTranslations} from 'next-intl';
import PageHeader from "@/components/common/PageHeader";
import ScenarioTable from "@/components/scenarios/ScenarioTable";
import ScenarioForm from "@/components/scenarios/ScenarioForm";
import type { Scenario, ScenarioType, CreateScenarioPayload } from "@repo/shared";

export default function ScenariosPage() {
  const t = useTranslations('Scenarios');
  const tCommon = useTranslations('Common');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<ScenarioType | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formReady, setFormReady] = useState(true);
  const [formValid, setFormValid] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  useEffect(() => {
    fetchScenarios();
  }, []);

  async function fetchScenarios() {
    setLoading(true);
    try {
      const res = await fetch("/api/scenarios");
      if (!res.ok) throw new Error("Failed to fetch scenarios");
      const data = await res.json();
      setScenarios(data);
    } catch {
      message.error(tCommon('messages.failedToLoadScenarios'));
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(id: string, active: boolean) {
    try {
      const res = await fetch(`/api/scenarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: active }),
      });
      if (!res.ok) throw new Error("Failed to update scenario");
      setScenarios((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: active } : s))
      );
      message.success(active ? tCommon('messages.scenarioActivated') : tCommon('messages.scenarioDeactivated'));
    } catch {
      message.error(tCommon('messages.failedToUpdateScenario'));
    }
  }

  async function handleCreateScenario(values: CreateScenarioPayload) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed to create scenario");
      message.success(tCommon('messages.scenarioCreated'));
      setModalOpen(false);
      form.resetFields();
      fetchScenarios();
    } catch {
      message.error(tCommon('messages.failedToCreateScenario'));
    } finally {
      setSubmitting(false);
    }
  }

  const filtered =
    typeFilter === "all"
      ? scenarios
      : scenarios.filter((s) => s.type === typeFilter);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        extra={
          <>
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              style={{ width: 150 }}
              options={[
                { value: "all", label: tCommon('scenarioTypes.allTypes') },
                { value: "frontline", label: tCommon('scenarioTypes.frontline') },
                { value: "leadership", label: tCommon('scenarioTypes.leadership') },
              ]}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
            >
              {t('newScenario')}
            </Button>
          </>
        }
      />
      <ScenarioTable
        data={filtered}
        loading={loading}
        onToggleActive={handleToggleActive}
      />

      <Modal
        title={t('createScenario')}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={720}
        okText={t('createScenario')}
        destroyOnHidden
        footer={formReady ? undefined : null}
        okButtonProps={{ disabled: !formValid }}
      >
        <ScenarioForm
          form={form}
          onSubmit={handleCreateScenario}
          loading={submitting}
          hideSubmitButton
          onFormReady={setFormReady}
          onValidityChange={setFormValid}
        />
      </Modal>
    </>
  );
}
