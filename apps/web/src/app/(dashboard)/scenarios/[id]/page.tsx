"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  Tag,
  Spin,
  Typography,
  Modal,
  Form,
  Button,
  Row,
  Col,
  App,
  Tabs,
  Badge,
  Table,
  Space,
  Popconfirm,
  Dropdown,
  Empty,
} from "antd";
import {
  EditOutlined,
  FileTextOutlined,
  RobotOutlined,
  PhoneOutlined,
  DeleteOutlined,
  PlusOutlined,
  LinkOutlined,
  DownOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import PageHeader from "@/components/common/PageHeader";
import AddUsersDialog from "@/components/common/AddUsersDialog";
import ScenarioForm from "@/components/scenarios/ScenarioForm";
import type {
  ScenarioWithLevels,
  AssignmentWithDetails,
  CreateScenarioPayload,
  WonderfulAgent,
  DifficultyLevel,
} from "@repo/shared";
import {
  SCENARIO_TYPE_LABELS,
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_COLORS,
} from "@repo/shared";

const { Text, Paragraph } = Typography;

export default function ScenarioDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [scenario, setScenario] = useState<ScenarioWithLevels | null>(null);
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([]);
  const [agents, setAgents] = useState<WonderfulAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editFormValid, setEditFormValid] = useState(false);
  const [editForm] = Form.useForm();
  const { message, modal } = App.useApp();

  // Unified tabs state
  const [activeLevelId, setActiveLevelId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [scenarioRes, assignmentsRes, agentsRes] = await Promise.all([
        fetch(`/api/scenarios/${id}?withLevels=true`),
        fetch(`/api/assignments?scenarioId=${id}`),
        fetch("/api/wonderful/agents"),
      ]);
      if (!scenarioRes.ok) throw new Error("Failed to fetch scenario");
      const scenarioData = await scenarioRes.json();
      setScenario(scenarioData);

      // Set default active tab to first level by sort_order
      const sorted = [...scenarioData.difficulty_levels].sort(
        (a: DifficultyLevel, b: DifficultyLevel) => a.sort_order - b.sort_order
      );
      if (sorted.length > 0 && !activeLevelId) {
        setActiveLevelId(sorted[0].id);
      }

      if (assignmentsRes.ok) {
        const assignmentsData = await assignmentsRes.json();
        setAssignments(assignmentsData);
      }

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(agentsData);
      }
    } catch {
      message.error("Failed to load scenario");
    } finally {
      setLoading(false);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleEditScenario(values: CreateScenarioPayload) {
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/scenarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("Failed to update scenario");
      message.success("Scenario updated");
      setEditModalOpen(false);
      editForm.resetFields();
      fetchData();
    } catch {
      message.error("Failed to update scenario");
    } finally {
      setEditSubmitting(false);
    }
  }

  // --- Ported handlers from AssignedUsersPanel ---

  async function handleRemoveAssignment(assignmentId: string) {
    try {
      const res = await fetch("/api/assignments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentIds: [assignmentId] }),
      });
      if (!res.ok) throw new Error("Failed to remove assignment");
      message.success("Assignment removed");
      fetchData();
    } catch {
      message.error("Failed to remove assignment");
    }
  }

  async function handleTriggerCall(assignmentId: string) {
    try {
      const res = await fetch("/api/training/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      if (!res.ok) throw new Error("Failed to trigger call");
      message.success("Call initiated");
    } catch {
      message.error("Failed to trigger call");
    }
  }

  function confirmTriggerCall(assignment: AssignmentWithDetails) {
    modal.confirm({
      title: "Confirm Call",
      icon: <PhoneOutlined style={{ color: '#0112AA' }} />,
      content: (
        <>
          <p>You are about to call <strong>{assignment.user.name}</strong> at <strong>{assignment.user.phone}</strong>. Do you want to proceed?</p>
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#F8F9FA', borderRadius: 8, fontSize: 13, color: '#6b7280' }}>
            {scenario?.name} — {assignment.difficulty_level.name}
          </div>
        </>
      ),
      okText: "Call Now",
      okButtonProps: { icon: <PhoneOutlined /> },
      cancelText: "Cancel",
      onOk: () => handleTriggerCall(assignment.id),
    });
  }

  async function handleShareLink(assignmentId: string) {
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
    } catch {
      message.error("Failed to generate link");
    }
  }

  async function handleBulkCall(difficultyLevelId: string) {
    setBulkLoading(difficultyLevelId);
    try {
      const res = await fetch("/api/training/bulk-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: id, difficultyLevelId }),
      });
      if (!res.ok) throw new Error("Failed to trigger bulk calls");
      const data = await res.json();
      message.success(`${data.initiated ?? 0} calls initiated`);
    } catch {
      message.error("Failed to trigger bulk calls");
    } finally {
      setBulkLoading(null);
    }
  }

  function confirmBulkCall(difficultyLevelId: string, count: number) {
    modal.confirm({
      title: "Confirm Bulk Call",
      icon: <PhoneOutlined style={{ color: '#0112AA' }} />,
      content: (
        <p>You are about to call <strong>{count} trainees</strong>. Each trainee will receive a separate call. Do you want to proceed?</p>
      ),
      okText: "Call All",
      okButtonProps: { icon: <PhoneOutlined /> },
      cancelText: "Cancel",
      onOk: () => handleBulkCall(difficultyLevelId),
    });
  }

  // --- Table columns ---

  const columns: ColumnsType<AssignmentWithDetails> = [
    {
      title: "User",
      key: "user",
      render: (_, r) => r.user.name,
      sorter: (a, b) => a.user.name.localeCompare(b.user.name),
    },
    {
      title: "Email",
      key: "email",
      render: (_, r) => r.user.email,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: AssignmentWithDetails["status"]) => (
        <Tag color={ASSIGNMENT_STATUS_COLORS[status]}>
          {ASSIGNMENT_STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, r) => (
        <Space>
          <Dropdown
            menu={{
              items: [
                {
                  key: "phone",
                  label: "Phone Call",
                  icon: <PhoneOutlined />,
                  onClick: () => confirmTriggerCall(r),
                },
                {
                  key: "browser",
                  label: "Share a Link",
                  icon: <LinkOutlined />,
                  onClick: () => handleShareLink(r.id),
                },
              ],
            }}
            trigger={["click"]}
            disabled={r.status === "completed"}
          >
            <Button
              type="link"
              icon={<PhoneOutlined />}
              disabled={r.status === "completed"}
            >
              Train <DownOutlined style={{ fontSize: 10 }} />
            </Button>
          </Dropdown>
          <Popconfirm
            title="Remove assignment?"
            onConfirm={() => handleRemoveAssignment(r.id)}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              Remove
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!scenario) {
    return <div>Scenario not found</div>;
  }

  const sorted = [...scenario.difficulty_levels].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  return (
    <>
      <PageHeader
        title={scenario.name}
        subtitle={`${SCENARIO_TYPE_LABELS[scenario.type]} scenario`}
        backHref="/scenarios"
        extra={
          <Button
            icon={<EditOutlined />}
            onClick={() => setEditModalOpen(true)}
          >
            Edit Scenario
          </Button>
        }
      />

      {/* Scenario info row */}
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={16}>
          <Card variant="borderless" styles={{ body: { padding: "24px" } }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <Tag
                color={scenario.type === "frontline" ? "blue" : "purple"}
                style={{ fontSize: 12 }}
              >
                {SCENARIO_TYPE_LABELS[scenario.type]}
              </Tag>
              <Tag color={scenario.is_active ? "success" : "default"}>
                {scenario.is_active ? "Active" : "Inactive"}
              </Tag>
              {scenario.agent_id ? (
                <Tag>
                  <RobotOutlined />{" "}
                  {agents.find((a) => a.id === scenario.agent_id)
                    ?.display_name ||
                    agents.find((a) => a.id === scenario.agent_id)?.name ||
                    "Custom Agent"}
                </Tag>
              ) : (
                <Tag>Default Agent</Tag>
              )}
              <Text style={{ color: "#9CA3AF", fontSize: 12 }}>
                Created{" "}
                {new Date(scenario.created_at).toLocaleDateString("sk-SK")}
              </Text>
            </div>
            {scenario.description && (
              <div style={{ marginBottom: 20 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    color: "#9CA3AF",
                    display: "block",
                    marginBottom: 6,
                  }}
                >
                  Description
                </Text>
                <Paragraph
                  style={{
                    margin: 0,
                    color: "#374151",
                    fontSize: 14,
                    lineHeight: 1.7,
                  }}
                >
                  {scenario.description}
                </Paragraph>
              </div>
            )}
            <div>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "#9CA3AF",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Base Prompt
              </Text>
              <div
                style={{
                  background: "#F8F9FA",
                  borderRadius: 12,
                  padding: "16px 20px",
                  border: "1px solid #F0F0F0",
                }}
              >
                <Paragraph
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: "#374151",
                  }}
                >
                  {scenario.prompt}
                </Paragraph>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            variant="borderless"
            style={{
              background:
                "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
              border: "none",
            }}
            styles={{ body: { padding: "24px" } }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: "linear-gradient(135deg, #0112AA, #2563EB)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(1,18,170,0.25)",
                }}
              >
                <FileTextOutlined style={{ color: "#fff", fontSize: 20 }} />
              </div>
              <div>
                <Text
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    display: "block",
                  }}
                >
                  Difficulty Levels
                </Text>
                <Text
                  strong
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: "-0.5px",
                  }}
                >
                  {scenario.difficulty_levels.length}
                </Text>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {scenario.difficulty_levels.map((dl) => (
                <Tag
                  key={dl.id}
                  style={{
                    fontSize: 12,
                    background: "rgba(1,18,170,0.08)",
                    color: "#0112AA",
                    border: "none",
                  }}
                >
                  {dl.name}
                </Tag>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Unified Tabs Section */}
      <div style={{ marginTop: 24 }}>
        <Tabs
          type="line"
          activeKey={activeLevelId ?? sorted[0]?.id}
          onChange={(key) => setActiveLevelId(key)}
          tabBarStyle={{
            marginBottom: 0,
            borderBottom: "1px solid #F0F0F0",
          }}
          items={sorted.map((level) => {
            const levelAssignments = assignments.filter(
              (a) => a.difficulty_level_id === level.id
            );
            const isActive = (activeLevelId ?? sorted[0]?.id) === level.id;
            return {
              key: level.id,
              label: (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  {level.name}
                  <Badge
                    count={levelAssignments.length}
                    style={{
                      backgroundColor: isActive ? "#0112AA" : "#E5E7EB",
                      color: isActive ? "#fff" : "#6b7280",
                      fontSize: 11,
                    }}
                  />
                </span>
              ),
              children: (
                <div>
                  {/* Zone 1 - Difficulty Config */}
                  <div
                    style={{
                      background: "#FAFBFC",
                      border: "1px solid #F0F0F0",
                      borderRadius: 10,
                      padding: "16px 20px",
                      marginTop: 20,
                      marginBottom: 20,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        color: "#9CA3AF",
                        marginBottom: 6,
                      }}
                    >
                      Difficulty Prompt
                    </div>
                    <Paragraph
                      style={{
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        fontSize: 13,
                        lineHeight: 1.6,
                        color: "#374151",
                      }}
                      ellipsis={{
                        rows: 4,
                        expandable: true,
                        symbol: "Show more",
                      }}
                    >
                      {level.prompt}
                    </Paragraph>

                    {/* Parameters row */}
                    <div
                      style={{ display: "flex", gap: 16, marginTop: 12 }}
                    >
                      <div
                        style={{
                          background: "#fff",
                          border: "1px solid #E5E7EB",
                          borderRadius: 8,
                          padding: "6px 12px",
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                          Resistance
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#1a1a2e",
                          }}
                        >
                          {level.resistance_level}/10
                        </span>
                      </div>
                      <div
                        style={{
                          background: "#fff",
                          border: "1px solid #E5E7EB",
                          borderRadius: 8,
                          padding: "6px 12px",
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                          Emotional Intensity
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#1a1a2e",
                          }}
                        >
                          {level.emotional_intensity}/10
                        </span>
                      </div>
                      <div
                        style={{
                          background: "#fff",
                          border: "1px solid #E5E7EB",
                          borderRadius: 8,
                          padding: "6px 12px",
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                          Cooperation
                        </span>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "#1a1a2e",
                          }}
                        >
                          {level.cooperation}/10
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Zone 2 - Users Table */}
                  <div>
                    {/* Toolbar */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 16,
                      }}
                    >
                      <Text strong style={{ fontSize: 15 }}>
                        Assigned Users ({levelAssignments.length})
                      </Text>
                      <Space>
                        <Button
                          icon={<PhoneOutlined />}
                          onClick={() => confirmBulkCall(level.id, levelAssignments.length)}
                          loading={bulkLoading === level.id}
                          disabled={levelAssignments.length === 0}
                        >
                          Call All
                        </Button>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            setAddDialogOpen(true);
                          }}
                        >
                          Add Users
                        </Button>
                      </Space>
                    </div>

                    {/* Table or Empty state */}
                    {levelAssignments.length > 0 ? (
                      <Table
                        columns={columns}
                        dataSource={levelAssignments}
                        rowKey="id"
                        size="middle"
                        pagination={
                          levelAssignments.length > 10
                            ? { pageSize: 10 }
                            : false
                        }
                      />
                    ) : (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No users assigned to this difficulty level yet"
                      >
                        <Button
                          type="dashed"
                          icon={<PlusOutlined />}
                          onClick={() => {
                            setAddDialogOpen(true);
                          }}
                        >
                          Add Users
                        </Button>
                      </Empty>
                    )}
                  </div>
                </div>
              ),
            };
          })}
        />
      </div>

      {/* Add Users Dialog */}
      <AddUsersDialog
        open={addDialogOpen}
        scenarioId={scenario.id}
        difficultyLevelId={activeLevelId}
        existingUserIds={assignments
          .filter((a) => a.difficulty_level_id === activeLevelId)
          .map((a) => a.user_id)}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={() => {
          setAddDialogOpen(false);
          fetchData();
        }}
      />

      <Modal
        title="Edit Scenario"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        confirmLoading={editSubmitting}
        width={720}
        okText="Save Changes"
        destroyOnHidden
        okButtonProps={{ disabled: !editFormValid }}
      >
        <ScenarioForm
          form={editForm}
          onSubmit={handleEditScenario}
          loading={editSubmitting}
          hideSubmitButton
          onValidityChange={setEditFormValid}
          initialValues={{
            name: scenario.name,
            description: scenario.description ?? "",
            prompt: scenario.prompt,
            type: scenario.type,
            agent_id: scenario.agent_id ?? undefined,
            difficulty_levels: scenario.difficulty_levels.map((dl) => ({
              name: dl.name,
              prompt: dl.prompt,
              resistance_level: dl.resistance_level,
              emotional_intensity: dl.emotional_intensity,
              cooperation: dl.cooperation,
              sort_order: dl.sort_order,
            })),
          }}
        />
      </Modal>
    </>
  );
}
