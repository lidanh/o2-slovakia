"use client";

import { useState, useEffect } from "react";
import { Select, Modal, Form, Button, App } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import PageHeader from "@/components/common/PageHeader";
import ScenarioTable from "@/components/scenarios/ScenarioTable";
import ScenarioForm from "@/components/scenarios/ScenarioForm";
import type { Scenario, ScenarioType, CreateScenarioPayload } from "@repo/shared";

export default function ScenariosPage() {
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
      message.error("Failed to load scenarios");
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
      message.success(`Scenario ${active ? "activated" : "deactivated"}`);
    } catch {
      message.error("Failed to update scenario");
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
      message.success("Scenario created");
      setModalOpen(false);
      form.resetFields();
      fetchScenarios();
    } catch {
      message.error("Failed to create scenario");
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
        title="Scenarios"
        subtitle="Manage training scenarios"
        extra={
          <>
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              style={{ width: 150 }}
              options={[
                { value: "all", label: "All Types" },
                { value: "frontline", label: "Frontline" },
                { value: "leadership", label: "Leadership" },
              ]}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
            >
              New Scenario
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
        title="Create Scenario"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={720}
        okText="Create Scenario"
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
