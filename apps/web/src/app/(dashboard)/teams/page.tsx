"use client";

import { useState, useEffect } from "react";
import { Modal, Form, Button, App } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import PageHeader from "@/components/common/PageHeader";
import TeamTable from "@/components/teams/TeamTable";
import TeamForm from "@/components/teams/TeamForm";
import type { CreateTeamPayload } from "@repo/shared";

interface TeamRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  member_count?: number;
  avg_score?: number | null;
  total_sessions?: number;
}

export default function TeamsPage() {
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
      message.error("Failed to load teams");
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
      message.success("Team created");
      setModalOpen(false);
      form.resetFields();
      fetchTeams();
    } catch {
      message.error("Failed to create team");
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
      message.success("Team updated");
      setEditingTeam(null);
      form.resetFields();
      fetchTeams();
    } catch {
      message.error("Failed to update team");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Teams"
        subtitle="Manage training teams"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
          >
            New Team
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
        title="Create Team"
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={640}
        okText="Create Team"
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
        title="Edit Team"
        open={!!editingTeam}
        onCancel={() => {
          setEditingTeam(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        width={640}
        okText="Save Changes"
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
