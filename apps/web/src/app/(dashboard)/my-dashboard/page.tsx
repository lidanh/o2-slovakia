"use client";

import { useState, useEffect } from "react";
import { Card, Col, Row, Table, Tag, Typography, App, Spin, Button } from "antd";
import {
  PhoneOutlined,
  TrophyOutlined,
  BookOutlined,
  StarOutlined,
} from "@ant-design/icons";
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
  SESSION_STATUS_COLORS,
  ASSIGNMENT_STATUS_COLORS,
} from "@repo/shared";
import {useTranslations} from 'next-intl';

const { Text, Title } = Typography;

export default function MyDashboardPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { user } = useAuth();
  const t = useTranslations('MyDashboard');
  const tCommon = useTranslations('Common');

  const kpiConfig = [
    {
      title: t('totalSessions'),
      icon: <PhoneOutlined style={{ fontSize: 20 }} />,
      gradient: "linear-gradient(135deg, #0112AA 0%, #2563EB 100%)",
      bgGradient: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
    },
    {
      title: t('averageScore'),
      icon: <TrophyOutlined style={{ fontSize: 20 }} />,
      gradient: "linear-gradient(135deg, #059669 0%, #34D399 100%)",
      bgGradient: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
    },
    {
      title: t('pendingAssignments'),
      icon: <BookOutlined style={{ fontSize: 20 }} />,
      gradient: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
      bgGradient: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
    },
    {
      title: t('bestScore'),
      icon: <StarOutlined style={{ fontSize: 20 }} />,
      gradient: "linear-gradient(135deg, #D97706 0%, #FBBF24 100%)",
      bgGradient: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
    },
  ];
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [assignments, setAssignments] = useState<AssignmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function fetchData() {
      try {
        const [sessionsRes, assignmentsRes] = await Promise.all([
          fetch(`/api/training/sessions?userId=${user!.id}&limit=100`),
          fetch(`/api/assignments?userId=${user!.id}`),
        ]);
        if (sessionsRes.ok) {
          const json = await sessionsRes.json();
          const arr = Array.isArray(json) ? json : json.data ?? [];
          setSessions(arr);
        }
        if (assignmentsRes.ok) {
          const json = await assignmentsRes.json();
          setAssignments(Array.isArray(json) ? json : json.data ?? []);
        }
      } catch {
        message.error(tCommon('messages.failedToLoadDashboard'));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const completedSessions = sessions.filter((s) => s.status === "completed");
  const avgScore =
    completedSessions.length > 0
      ? completedSessions.reduce((sum, s) => sum + (s.score ?? 0), 0) /
        completedSessions.length
      : 0;
  const bestScore = completedSessions.reduce(
    (max, s) => Math.max(max, s.score ?? 0),
    0
  );
  const pendingAssignments = assignments.filter(
    (a) => a.status === "pending" || a.status === "in_progress"
  );

  const kpiValues = [
    sessions.length,
    avgScore,
    pendingAssignments.length,
    bestScore,
  ];

  const formatKpiValue = (idx: number, val: number) => {
    if (idx === 1) return `${val.toFixed(1)}%`;
    if (idx === 3) return val > 0 ? `${val.toFixed(0)}%` : "—";
    return val;
  };

  if (!user) return <Spin size="large" style={{ display: "block", margin: "100px auto" }} />;

  return (
    <>
      <PageHeader
        title={t('welcomeBack', { name: user.name })}
        subtitle={t('subtitle')}
      />

      <Row gutter={[20, 20]} className="animate-stagger">
        {kpiConfig.map((kpi, idx) => (
          <Col xs={24} sm={12} lg={6} key={kpi.title}>
            <Card
              loading={loading}
              variant="borderless"
              style={{
                background: kpi.bgGradient,
                border: "none",
                borderRadius: 16,
              }}
              styles={{ body: { padding: "24px" } }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "#6b7280",
                    }}
                  >
                    {kpi.title}
                  </Text>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color: "#1a1a2e",
                      letterSpacing: "-1px",
                      lineHeight: 1.2,
                      marginTop: 4,
                    }}
                  >
                    {formatKpiValue(idx, kpiValues[idx])}
                  </div>
                </div>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: kpi.gradient,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  {kpi.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Assigned Scenarios */}
      <Title level={4} style={{ marginTop: 32, marginBottom: 16, fontWeight: 500 }}>
        {t('yourAssignedScenarios')}
      </Title>
      {loading ? (
        <Spin style={{ display: "block", margin: "40px auto" }} />
      ) : pendingAssignments.length > 0 ? (
        <Row gutter={[16, 16]}>
          {pendingAssignments.map((a) => (
            <Col xs={24} sm={12} lg={8} key={a.id}>
              <Card variant="borderless" styles={{ body: { padding: 20 } }}>
                <Text strong style={{ fontSize: 15, display: "block", marginBottom: 4 }}>
                  {a.scenario?.name ?? t('unknownScenario')}
                </Text>
                <Text style={{ color: "#6b7280", fontSize: 13, display: "block", marginBottom: 12 }}>
                  {a.difficulty_level?.name ?? t('default')}
                </Text>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Tag color={ASSIGNMENT_STATUS_COLORS[a.status]}>
                    {a.status === "pending" ? tCommon('assignmentStatus.pending') : tCommon('assignmentStatus.inProgress')}
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
        <Card variant="borderless">
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <BookOutlined style={{ fontSize: 32, color: "#d9d9d9", marginBottom: 8 }} />
            <br />
            <Text style={{ color: "#9CA3AF" }}>{t('noPendingAssignments')}</Text>
          </div>
        </Card>
      )}

      {/* Recent Sessions */}
      <Title level={4} style={{ marginTop: 32, marginBottom: 16, fontWeight: 500 }}>
        {t('recentSessions')}
      </Title>
      <Card variant="borderless" styles={{ body: { padding: "0 24px 24px" } }}>
        <Table
          dataSource={sessions.slice(0, 5)}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          locale={{ emptyText: t('noSessionsYet') }}
          onRow={(record) => ({
            style: { cursor: "pointer" },
            onClick: () => router.push(`/training/${record.id}`),
          })}
          columns={[
            {
              title: tCommon('fields.date'),
              dataIndex: "created_at",
              key: "date",
              render: (d: string) =>
                new Date(d).toLocaleDateString("sk-SK", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }),
            },
            {
              title: tCommon('fields.scenario'),
              key: "scenario",
              render: (_, r) => r.scenario?.name ?? "—",
            },
            {
              title: tCommon('fields.score'),
              dataIndex: "score",
              key: "score",
              width: 80,
              render: (score: number | null) => (
                <ScoreDisplay score={score} size="small" />
              ),
            },
            {
              title: tCommon('fields.status'),
              dataIndex: "status",
              key: "status",
              width: 110,
              render: (s: SessionWithDetails["status"]) => {
                const statusKeyMap: Record<string, string> = {
                  initiated: 'initiated',
                  ringing: 'ringing',
                  in_progress: 'inProgress',
                  completed: 'completed',
                  failed: 'failed',
                  no_answer: 'noAnswer',
                  busy: 'busy',
                  canceled: 'canceled',
                };
                return (
                  <Tag color={SESSION_STATUS_COLORS[s]} style={{ fontSize: 11 }}>
                    {tCommon(`status.${statusKeyMap[s] ?? s}` as any)}
                  </Tag>
                );
              },
            },
          ]}
        />
      </Card>
    </>
  );
}
