"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  Table,
  Tag,
  Button,
  Spin,
  Row,
  Col,
  Typography,
  App,
} from "antd";
import { PlusOutlined, TrophyOutlined, PhoneOutlined, UserOutlined, MailOutlined } from "@ant-design/icons";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import type { ColumnsType } from "antd/es/table";
import type {
  UserWithTeam,
  AssignmentWithDetails,
  SessionWithDetails,
} from "@repo/shared";
import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_COLORS,
  isValidScore,
  averageScore,
} from "@repo/shared";
import PageHeader from "@/components/common/PageHeader";
import ScoreDisplay from "@/components/common/ScoreDisplay";
import AssignScenarioModal from "@/components/users/AssignScenarioModal";

const { Text } = Typography;

export default function UserDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { message } = App.useApp();

  const [user, setUser] = useState<UserWithTeam | null>(null);
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([]);
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [userRes, assignRes, sessionRes] = await Promise.all([
        fetch(`/api/users/${id}?withTeam=true`),
        fetch(`/api/assignments?userId=${id}`),
        fetch(`/api/training/sessions?userId=${id}`),
      ]);
      if (!userRes.ok) throw new Error("Failed to fetch user");
      setUser(await userRes.json());
      if (assignRes.ok) setAssignments(await assignRes.json());
      if (sessionRes.ok) {
        const sessionsJson = await sessionRes.json();
        setSessions(Array.isArray(sessionsJson) ? sessionsJson : sessionsJson.data ?? []);
      }
    } catch {
      message.error("Failed to load user data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) return <div>User not found</div>;

  const completedSessions = sessions.filter((s) => s.status === "completed");
  const validScored = completedSessions.filter((s) => isValidScore(s.score));
  const avgScore = averageScore(validScored.map((s) => s.score as number));

  const scoreTrend = completedSessions
    .filter((s) => isValidScore(s.score))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((s) => ({
      date: new Date(s.created_at).toLocaleDateString("sk-SK"),
      score: s.score as number,
    }));

  const assignmentColumns: ColumnsType<AssignmentWithDetails> = [
    {
      title: "Scenario",
      key: "scenario",
      render: (_, r) => <Text strong style={{ fontSize: 13 }}>{r.scenario?.name ?? "—"}</Text>,
    },
    {
      title: "Difficulty",
      key: "difficulty",
      render: (_, r) => r.difficulty_level?.name ?? "—",
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
  ];

  const sessionColumns: ColumnsType<SessionWithDetails> = [
    {
      title: "Scenario",
      key: "scenario",
      render: (_, r) => <Text strong style={{ fontSize: 13 }}>{r.scenario?.name ?? "—"}</Text>,
    },
    {
      title: "Score",
      dataIndex: "score",
      key: "score",
      render: (score: number | null) => <ScoreDisplay score={score} size="small" />,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => <Tag>{status}</Tag>,
    },
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      render: (d: string) => new Date(d).toLocaleDateString("sk-SK"),
    },
  ];

  return (
    <>
      <PageHeader
        title={user.name}
        subtitle="User profile"
        backHref="/users"
      />

      {/* User info + stats row */}
      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={16}>
          <Card variant="borderless" styles={{ body: { padding: "24px" } }}>
            <Row gutter={[24, 16]}>
              <Col xs={24} sm={12}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "linear-gradient(135deg, #0112AA, #2563EB)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <UserOutlined style={{ color: "#fff", fontSize: 16 }} />
                  </div>
                  <div>
                    <Text style={{ fontSize: 12, color: "#9CA3AF", display: "block" }}>Full Name</Text>
                    <Text strong style={{ fontSize: 14 }}>{user.name}</Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <MailOutlined style={{ color: "#fff", fontSize: 16 }} />
                  </div>
                  <div>
                    <Text style={{ fontSize: 12, color: "#9CA3AF", display: "block" }}>Email</Text>
                    <Text strong style={{ fontSize: 14 }}>{user.email}</Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "linear-gradient(135deg, #059669, #34D399)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <PhoneOutlined style={{ color: "#fff", fontSize: 16 }} />
                  </div>
                  <div>
                    <Text style={{ fontSize: 12, color: "#9CA3AF", display: "block" }}>Phone</Text>
                    <Text strong style={{ fontSize: 14 }}>{user.phone}</Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "#F3F4F6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontWeight: 700, fontSize: 11, color: "#6b7280" }}>T</Text>
                  </div>
                  <div>
                    <Text style={{ fontSize: 12, color: "#9CA3AF", display: "block" }}>Team</Text>
                    <Text strong style={{ fontSize: 14 }}>{user.team?.name ?? "No team"}</Text>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Row gutter={[20, 20]}>
            <Col span={12}>
              <Card
                variant="borderless"
                style={{ background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)", border: "none" }}
                styles={{ body: { padding: "20px" } }}
              >
                <Text style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280" }}>
                  Avg Score
                </Text>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1a1a2e", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  {avgScore !== null ? `${avgScore.toFixed(1)}%` : "—"}
                  <TrophyOutlined style={{ fontSize: 16, color: "#059669" }} />
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card
                variant="borderless"
                style={{ background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)", border: "none" }}
                styles={{ body: { padding: "20px" } }}
              >
                <Text style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280" }}>
                  Sessions
                </Text>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#1a1a2e", marginTop: 4, display: "flex", alignItems: "center", gap: 8 }}>
                  {completedSessions.length}
                  <PhoneOutlined style={{ fontSize: 16, color: "#0112AA" }} />
                </div>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      {scoreTrend.length > 1 && (
        <Card
          title="Score Trend"
          variant="borderless"
          style={{ marginBottom: 20 }}
          styles={{ body: { padding: "16px 24px 24px" } }}
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={scoreTrend}>
              <defs>
                <linearGradient id="userScoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0112AA" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0112AA" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={{ stroke: "#F0F0F0" }} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: 13 }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#0112AA"
                strokeWidth={2.5}
                fill="url(#userScoreGradient)"
                dot={{ r: 4, fill: "#0112AA", strokeWidth: 0 }}
                activeDot={{ r: 6, fill: "#0112AA", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card
        title="Assigned Scenarios"
        variant="borderless"
        style={{ marginBottom: 20 }}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setAssignModalOpen(true)}
          >
            Assign Scenario
          </Button>
        }
        styles={{ body: { padding: "0 24px 24px" } }}
      >
        <Table
          columns={assignmentColumns}
          dataSource={assignments}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </Card>

      <Card
        title="Training History"
        variant="borderless"
        styles={{ body: { padding: "0 24px 24px" } }}
      >
        <Table
          columns={sessionColumns}
          dataSource={sessions}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      </Card>

      <AssignScenarioModal
        open={assignModalOpen}
        userId={user.id}
        onClose={() => setAssignModalOpen(false)}
        onSuccess={() => {
          setAssignModalOpen(false);
          fetchData();
        }}
      />
    </>
  );
}
