"use client";

import { useState, useEffect } from "react";
import { Card, Table, Tag, Tabs, Typography, App, Spin, Button, Row, Col, Rate } from "antd";
import { BookOutlined, PhoneOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/common/PageHeader";
import ScoreDisplay from "@/components/common/ScoreDisplay";
import CallTriggerButton from "@/components/training/CallTriggerButton";
import { useAuth } from "@/contexts/AuthContext";
import type {
  SessionWithDetails,
  AssignmentWithDetails,
} from "@repo/shared";
import {
  SESSION_STATUS_LABELS,
  SESSION_STATUS_COLORS,
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_COLORS,
} from "@repo/shared";

const { Text } = Typography;

export default function MyTrainingPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function fetchData() {
      try {
        const [sessionsRes, assignmentsRes] = await Promise.all([
          fetch(`/api/training/sessions?userId=${user!.id}`),
          fetch(`/api/assignments?userId=${user!.id}`),
        ]);
        if (sessionsRes.ok) {
          const json = await sessionsRes.json();
          setSessions(Array.isArray(json) ? json : json.data ?? []);
        }
        if (assignmentsRes.ok) {
          const json = await assignmentsRes.json();
          setAssignments(Array.isArray(json) ? json : json.data ?? []);
        }
      } catch {
        message.error("Failed to load training data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingAssignments = assignments.filter(
    (a) => a.status === "pending" || a.status === "in_progress"
  );

  if (!user) return <Spin size="large" style={{ display: "block", margin: "100px auto" }} />;

  const assignedTab = (
    <>
      {loading ? (
        <Spin style={{ display: "block", margin: "40px auto" }} />
      ) : pendingAssignments.length > 0 ? (
        <Row gutter={[16, 16]}>
          {pendingAssignments.map((a) => (
            <Col xs={24} sm={12} lg={8} key={a.id}>
              <Card variant="borderless" styles={{ body: { padding: 20 } }}>
                <Text strong style={{ fontSize: 15, display: "block", marginBottom: 4 }}>
                  {a.scenario?.name ?? "Unknown Scenario"}
                </Text>
                <Text style={{ color: "#6b7280", fontSize: 13, display: "block", marginBottom: 12 }}>
                  {a.difficulty_level?.name ?? "Default"}
                </Text>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Tag color={ASSIGNMENT_STATUS_COLORS[a.status]}>
                    {ASSIGNMENT_STATUS_LABELS[a.status]}
                  </Tag>
                  <CallTriggerButton
                    assignmentId={a.id}
                    selfService
                    disabled={a.status === "completed"}
                  />
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <BookOutlined style={{ fontSize: 32, color: "#d9d9d9", marginBottom: 8 }} />
          <br />
          <Text style={{ color: "#9CA3AF" }}>No pending assignments</Text>
        </div>
      )}
    </>
  );

  const historyTab = (
    <Table
      dataSource={sessions}
      rowKey="id"
      loading={loading}
      pagination={{ pageSize: 10 }}
      size="small"
      locale={{ emptyText: "No sessions yet" }}
      onRow={(record) => ({
        style: { cursor: "pointer" },
        onClick: () => router.push(`/training/${record.id}`),
      })}
      columns={[
        {
          title: "Date",
          dataIndex: "created_at",
          key: "date",
          width: 120,
          render: (d: string) =>
            new Date(d).toLocaleDateString("sk-SK", {
              day: "numeric",
              month: "short",
              year: "numeric",
            }),
        },
        {
          title: "Scenario",
          key: "scenario",
          render: (_, r) => r.scenario?.name ?? "—",
        },
        {
          title: "Difficulty",
          key: "difficulty",
          render: (_, r) => r.difficulty_level?.name ?? "—",
        },
        {
          title: "Score",
          dataIndex: "score",
          key: "score",
          width: 80,
          render: (score: number | null) => (
            <ScoreDisplay score={score} size="small" />
          ),
        },
        {
          title: "Rating",
          dataIndex: "star_rating",
          key: "star_rating",
          width: 140,
          render: (rating: number | null) =>
            rating ? (
              <Rate disabled value={rating} style={{ fontSize: 14 }} />
            ) : (
              <Text type="secondary">—</Text>
            ),
        },
        {
          title: "Status",
          dataIndex: "status",
          key: "status",
          width: 110,
          render: (s: SessionWithDetails["status"]) => (
            <Tag color={SESSION_STATUS_COLORS[s]} style={{ fontSize: 11 }}>
              {SESSION_STATUS_LABELS[s]}
            </Tag>
          ),
        },
        {
          title: "",
          key: "action",
          width: 80,
          render: (_, r) => (
            <Button
              type="link"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/training/${r.id}`);
              }}
            >
              Details
            </Button>
          ),
        },
      ]}
    />
  );

  return (
    <>
      <PageHeader title="My Training" subtitle="Your assignments and training history" />

      <Card variant="borderless" styles={{ body: { padding: "8px 24px 24px" } }}>
        <Tabs
          defaultActiveKey="assigned"
          items={[
            {
              key: "assigned",
              label: (
                <span>
                  <BookOutlined /> Assigned{" "}
                  {pendingAssignments.length > 0 && (
                    <Tag color="blue" style={{ marginLeft: 4, fontSize: 11 }}>
                      {pendingAssignments.length}
                    </Tag>
                  )}
                </span>
              ),
              children: assignedTab,
            },
            {
              key: "history",
              label: (
                <span>
                  <PhoneOutlined /> History
                </span>
              ),
              children: historyTab,
            },
          ]}
        />
      </Card>
    </>
  );
}
