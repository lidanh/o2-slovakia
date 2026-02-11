"use client";

import { useState, useEffect } from "react";
import { Button, Card, Col, Row, Table, Tag, Typography, App } from "antd";
import {
  PhoneOutlined,
  UserOutlined,
  FileTextOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import PageHeader from "@/components/common/PageHeader";
import ScoreDisplay from "@/components/common/ScoreDisplay";
import type { AnalyticsKPIs, SessionWithDetails } from "@repo/shared";
import { SESSION_STATUS_LABELS, SESSION_STATUS_COLORS } from "@repo/shared";

const { Text } = Typography;

interface ScoreTrend {
  date: string;
  avg_score: number;
}

const kpiConfig = [
  {
    title: "Total Sessions",
    icon: <PhoneOutlined style={{ fontSize: 20 }} />,
    gradient: "linear-gradient(135deg, #0112AA 0%, #2563EB 100%)",
    bgGradient: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
    iconBg: "rgba(1, 18, 170, 0.1)",
  },
  {
    title: "Active Users",
    icon: <UserOutlined style={{ fontSize: 20 }} />,
    gradient: "linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)",
    bgGradient: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
    iconBg: "rgba(37, 99, 235, 0.1)",
  },
  {
    title: "Active Scenarios",
    icon: <FileTextOutlined style={{ fontSize: 20 }} />,
    gradient: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
    bgGradient: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
    iconBg: "rgba(124, 58, 237, 0.1)",
  },
  {
    title: "Avg. Score",
    icon: <TrophyOutlined style={{ fontSize: 20 }} />,
    gradient: "linear-gradient(135deg, #059669 0%, #34D399 100%)",
    bgGradient: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
    iconBg: "rgba(5, 150, 105, 0.1)",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [kpis, setKpis] = useState<AnalyticsKPIs | null>(null);
  const [recentSessions, setRecentSessions] = useState<SessionWithDetails[]>([]);
  const [scoreTrend, setScoreTrend] = useState<ScoreTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [kpiRes, sessionsRes, trendRes] = await Promise.all([
          fetch("/api/analytics/kpis"),
          fetch("/api/training/sessions?limit=5"),
          fetch("/api/analytics/score-trend"),
        ]);

        if (kpiRes.ok) setKpis(await kpiRes.json());
        if (sessionsRes.ok) {
          const sessionsJson = await sessionsRes.json();
          const sessionsArr = Array.isArray(sessionsJson) ? sessionsJson : sessionsJson.data ?? [];
          setRecentSessions(sessionsArr.slice(0, 5));
        }
        if (trendRes.ok) setScoreTrend(await trendRes.json());
      } catch {
        message.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const kpiValues = [
    kpis?.totalSessions ?? 0,
    kpis?.totalUsers ?? 0,
    kpis?.activeScenarios ?? 0,
    kpis?.avgScore ?? 0,
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Overview of your voice training platform" />

      <Row gutter={[20, 20]} className="animate-stagger">
        {kpiConfig.map((kpi, idx) => (
          <Col xs={24} sm={12} lg={6} key={kpi.title}>
            <Card
              loading={loading}
              variant="borderless"
              className="kpi-card"
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
                    {idx === 3 ? `${kpiValues[idx].toFixed?.(1) ?? kpiValues[idx]}%` : kpiValues[idx]}
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
                    boxShadow: `0 4px 12px ${kpi.gradient.includes("0112AA") ? "rgba(1,18,170,0.25)" : "rgba(0,0,0,0.1)"}`,
                  }}
                >
                  {kpi.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[20, 20]} style={{ marginTop: 24 }} className="animate-stagger">
        <Col xs={24} lg={16}>
          <Card
            title="Training Activity"
            loading={loading}
            variant="borderless"
            styles={{ body: { padding: "16px 24px 24px" } }}
          >
            {scoreTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={scoreTrend}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0112AA" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#0112AA" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    axisLine={{ stroke: "#F0F0F0" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "none",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                      fontSize: 13,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avg_score"
                    stroke="#0112AA"
                    strokeWidth={2.5}
                    fill="url(#scoreGradient)"
                    name="Avg Score"
                    dot={{ r: 4, fill: "#0112AA", strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "#0112AA", stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ height: 320 }}>
                <PhoneOutlined className="empty-state-icon" />
                <Text style={{ color: "#9CA3AF" }}>
                  Chart data will appear once training sessions are recorded
                </Text>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title="Recent Sessions"
            variant="borderless"
            extra={
              <Button type="link" size="small" onClick={() => router.push("/training")} style={{ fontSize: 13 }}>
                View all
              </Button>
            }
          >
            {recentSessions.length > 0 ? (
              <Table
                dataSource={recentSessions}
                rowKey="id"
                pagination={false}
                size="small"
                showHeader={false}
                onRow={(record) => ({
                  style: { cursor: "pointer" },
                  onClick: () => router.push(`/training/${record.id}`),
                })}
                columns={[
                  {
                    key: "user",
                    render: (_, r) => (
                      <div>
                        <Text strong style={{ fontSize: 13 }}>{r.user?.name ?? "—"}</Text>
                        <br />
                        <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{r.scenario?.name ?? ""}</Text>
                      </div>
                    ),
                  },
                  {
                    dataIndex: "score",
                    key: "score",
                    width: 50,
                    render: (score: number | null) => (
                      <ScoreDisplay score={score} size="small" />
                    ),
                  },
                  {
                    dataIndex: "status",
                    key: "status",
                    width: 90,
                    render: (s: SessionWithDetails["status"]) => (
                      <Tag color={SESSION_STATUS_COLORS[s]} style={{ fontSize: 11 }}>
                        {SESSION_STATUS_LABELS[s]}
                      </Tag>
                    ),
                  },
                ]}
              />
            ) : (
              <div className="empty-state">
                <PhoneOutlined className="empty-state-icon" />
                <Text style={{ color: "#9CA3AF" }}>No sessions yet</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}
