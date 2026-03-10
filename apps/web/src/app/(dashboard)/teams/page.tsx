"use client";

import { useState, useEffect } from "react";
import { Modal, Form, Button, App } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import PageHeader from "@/components/common/PageHeader";
import TeamTable from "@/components/teams/TeamTable";
import TeamForm from "@/components/teams/TeamForm";
import type { CreateTeamPayload } from "@repo/shared";

interface TeamRow {
  id: string;
  name: string;
  description: string | null;
  parent_team_id: string | null;
  created_at: string;
  updated_at: string;
  member_count?: number;
  avg_score?: number | null;
  total_sessions?: number;
}

export default function TeamsPage() {
  const t = useTranslations('Teams');
  const tCommon = useTranslations('Common');
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  useEffect(() => {
    fetchTeams();
  }, []);

  async function fetchTeams() {
    setLoading(true);
    try {
      const res = await fetch("/api/teams?withStats=true");
      if (!res.ok) throw new Error("Failed to fetch teams");
      const data = await res.json();
      setTeams(data);
    } catch {
      message.error(tCommon('messages.failedToLoadTeams'));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTeam(values: CreateTeamPayload) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed to create team");
      message.success(tCommon('messages.teamCreated'));
      setModalOpen(false);
      form.resetFields();
      fetchTeams();
    } catch {
      message.error(tCommon('messages.failedToCreateTeam'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditTeam(values: CreateTeamPayload) {
    if (!editingTeam) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/teams/${editingTeam.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed to update team");
      message.success(tCommon('messages.teamUpdated'));
      setEditingTeam(null);
      form.resetFields();
      fetchTeams();
    } catch {
      message.error(tCommon('messages.failedToUpdateTeam'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
          >
            {tCommon('buttons.newTeam')}
          </Button>
        }
      />
      <TeamTable
        data={teams}
        loading={loading}
        onEdit={(team) => {
          form.setFieldsValue({
            name: team.name,
            description: team.description ?? "",
          });
          setEditingTeam(team);
        }}
      />

      <Modal
        title={t('createTeam')}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={640}
        okText={tCommon('buttons.createTeam')}
        destroyOnHidden
        okButtonProps={{ disabled: !formValid }}
      >
        <TeamForm
          form={form}
          onSubmit={handleCreateTeam}
          loading={submitting}
          hideSubmitButton
          onValidityChange={setFormValid}
        />
      </Modal>

      <Modal
        title={t('editTeam')}
        open={!!editingTeam}
        onCancel={() => {
          setEditingTeam(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={640}
        okText={tCommon('buttons.saveChanges')}
        destroyOnHidden
        okButtonProps={{ disabled: !formValid }}
      >
        <TeamForm
          form={form}
          onSubmit={handleEditTeam}
          loading={submitting}
          hideSubmitButton
          onValidityChange={setFormValid}
          initialValues={
            editingTeam
              ? {
                  name: editingTeam.name,
                  description: editingTeam.description ?? "",
                }
              : undefined
          }
        />
      </Modal>
    </>
  );
}
