"use client";

import { useState, useEffect } from "react";
import { Card, Row, Col, Table, Typography, App } from "antd";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import PageHeader from "@/components/common/PageHeader";
import KPICards from "@/components/analytics/KPICards";
import ScoreDisplay from "@/components/common/ScoreDisplay";
import type { AnalyticsKPIs, LeaderboardEntry } from "@repo/shared";

const { Text } = Typography;

interface ScoreTrend {
  date: string;
  avg_score: number;
  session_count: number;
}

interface ScenarioStats {
  scenario_name: string;
  session_count: number;
}

export default function AnalyticsPage() {
  const [kpis, setKpis] = useState<AnalyticsKPIs | null>(null);
  const [scoreTrend, setScoreTrend] = useState<ScoreTrend[]>([]);
  const [scenarioStats, setScenarioStats] = useState<ScenarioStats[]>([]);
  const [topPerformers, setTopPerformers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { message } = App.useApp();

  useEffect(() => {
    async function fetchData() {
      try {
        const [kpiRes, trendRes, scenarioRes, leaderboardRes] = await Promise.all([
          fetch("/api/analytics/kpis"),
          fetch("/api/analytics/score-trend"),
          fetch("/api/analytics/scenarios"),
          fetch("/api/analytics/leaderboard?limit=5"),
        ]);

        if (kpiRes.ok) setKpis(await kpiRes.json());
        if (trendRes.ok) setScoreTrend(await trendRes.json());
        if (scenarioRes.ok) setScenarioStats(await scenarioRes.json());
        if (leaderboardRes.ok) setTopPerformers(await leaderboardRes.json());
      } catch {
        message.error("Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <>
      <PageHeader title="Analytics" subtitle="Training performance overview" />

      <div style={{ marginBottom: 24 }}>
        <KPICards data={kpis} loading={loading} />
      </div>

      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={14}>
          <Card
            title="Score Trend"
            loading={loading}
            variant="borderless"
            styles={{ body: { padding: "16px 24px 24px" } }}
          >
            {scoreTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={scoreTrend}>
                  <defs>
                    <linearGradient id="analyticsScoreGradient" x1="0" y1="0" x2="0" y2="1">
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
                    fill="url(#analyticsScoreGradient)"
                    name="Avg Score"
                    dot={{ r: 4, fill: "#0112AA", strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "#0112AA", stroke: "#fff", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ height: 320 }}>
                <Text style={{ color: "#9CA3AF" }}>
                  Chart data will appear once training sessions are recorded
                </Text>
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title="Sessions by Scenario"
            loading={loading}
            variant="borderless"
            styles={{ body: { padding: "16px 24px 24px" } }}
          >
            {scenarioStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={scenarioStats} layout="vertical">
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0112AA" />
                      <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    axisLine={{ stroke: "#F0F0F0" }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="scenario_name"
                    width={120}
                    tick={{ fontSize: 11, fill: "#6b7280" }}
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
                  <Bar
                    dataKey="session_count"
                    fill="url(#barGradient)"
                    name="Sessions"
                    radius={[0, 6, 6, 0]}
                    barSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ height: 320 }}>
                <Text style={{ color: "#9CA3AF" }}>No data yet</Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card
        title="Top Performers"
        loading={loading}
        variant="borderless"
        styles={{ body: { padding: "0 24px 24px" } }}
      >
        <Table
          dataSource={topPerformers}
          rowKey="user_id"
          pagination={false}
          size="middle"
          columns={[
            {
              title: "Rank",
              key: "rank",
              render: (_, __, idx) => (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background:
                      idx === 0
                        ? "linear-gradient(135deg, #F59E0B, #FBBF24)"
                        : idx === 1
                        ? "linear-gradient(135deg, #9CA3AF, #D1D5DB)"
                        : idx === 2
                        ? "linear-gradient(135deg, #B45309, #D97706)"
                        : "#F3F4F6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 12,
                    color: idx < 3 ? "#fff" : "#6b7280",
                  }}
                >
                  {idx + 1}
                </div>
              ),
              width: 60,
            },
            {
              title: "User",
              dataIndex: "user_name",
              key: "user_name",
              render: (name: string) => (
                <Text strong style={{ fontSize: 13 }}>{name}</Text>
              ),
            },
            {
              title: "Team",
              dataIndex: "team_name",
              key: "team_name",
              render: (name: string | null) => (
                <Text style={{ color: "#6b7280", fontSize: 13 }}>{name ?? "—"}</Text>
              ),
            },
            {
              title: "Avg Score",
              dataIndex: "avg_score",
              key: "avg_score",
              render: (score: number) => <ScoreDisplay score={score} size="small" />,
            },
            {
              title: "Sessions",
              dataIndex: "total_sessions",
              key: "total_sessions",
            },
          ]}
        />
      </Card>
    </>
  );
}
