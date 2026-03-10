"use client";

import { useState, useEffect } from "react";
import { Card, Select, Flex, App } from "antd";
import {useTranslations} from 'next-intl';
import PageHeader from "@/components/common/PageHeader";
import SessionTable from "@/components/training/SessionTable";
import type { SessionWithDetails, SessionStatus, Scenario } from "@repo/shared";
import { SESSION_STATUS_LABELS } from "@repo/shared";

export default function TrainingPage() {
  const t = useTranslations('Training');
  const tCommon = useTranslations('Common');
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<SessionStatus | "all">("all");
  const [scenarioFilter, setScenarioFilter] = useState<string | "all">("all");
  const { message } = App.useApp();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [sessionsRes, scenariosRes] = await Promise.all([
        fetch("/api/training/sessions"),
        fetch("/api/scenarios"),
      ]);
      if (!sessionsRes.ok) throw new Error("Failed to fetch sessions");
      const sessionsJson = await sessionsRes.json();
      setSessions(Array.isArray(sessionsJson) ? sessionsJson : sessionsJson.data ?? []);
      if (scenariosRes.ok) setScenarios(await scenariosRes.json());
    } catch {
      message.error(tCommon('messages.failedToLoadTraining'));
    } finally {
      setLoading(false);
    }
  }

  let filtered = sessions;
  if (statusFilter !== "all") {
    filtered = filtered.filter((s) => s.status === statusFilter);
  }
  if (scenarioFilter !== "all") {
    filtered = filtered.filter((s) => s.scenario_id === scenarioFilter);
  }

  const statusOptions = [
    { value: "all", label: tCommon('filters.allStatuses') },
    ...Object.entries(SESSION_STATUS_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
  ];

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card variant="borderless" style={{ marginBottom: 20 }} styles={{ body: { padding: "16px 24px" } }}>
        <Flex gap={12} wrap>
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as SessionStatus | "all")}
            style={{ width: 180 }}
            options={statusOptions}
          />
          <Select
            value={scenarioFilter}
            onChange={setScenarioFilter}
            style={{ width: 220 }}
            options={[
              { value: "all", label: tCommon('filters.allScenarios') },
              ...scenarios.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </Flex>
      </Card>

      <Card variant="borderless" styles={{ body: { padding: "0 24px 24px" } }}>
        <SessionTable data={filtered} loading={loading} />
      </Card>
    </>
  );
}
