"use client";

import { useState } from "react";
import { Card, Tag, Typography, List, Row, Col, Space, Button, Spin, App } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  FileSearchOutlined,
} from "@ant-design/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import type { SessionWithDetails } from "@repo/shared";
import { SESSION_STATUS_LABELS, SESSION_STATUS_COLORS, FEEDBACK_CATEGORIES } from "@repo/shared";
import ScoreDisplay from "@/components/common/ScoreDisplay";
import StarRating from "@/components/common/StarRating";

const { Text, Paragraph } = Typography;

interface SessionDetailProps {
  session: SessionWithDetails;
  onSessionUpdate?: (session: SessionWithDetails) => void;
}

export default function SessionDetail({ session, onSessionUpdate }: SessionDetailProps) {
  const [generating, setGenerating] = useState(false);
  const { message } = App.useApp();

  const canGenerateFeedback =
    session.status === "completed" &&
    session.communication_id !== null;

  async function handleGenerateFeedback() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/training/sessions/${session.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to generate feedback");
      const updated = await res.json();
      onSessionUpdate?.(updated);
    } catch {
      message.error("Failed to generate feedback. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  const breakdownData = session.feedback_breakdown
    ? FEEDBACK_CATEGORIES.map((cat) => ({
        category: cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: session.feedback_breakdown?.[cat] ?? 0,
        fullMark: 100,
      }))
    : [];

  const duration = session.call_duration
    ? `${Math.floor(session.call_duration / 60)}:${String(session.call_duration % 60).padStart(2, "0")}`
    : "—";

  const infoItems = [
    { icon: <UserOutlined />, label: "User", value: session.user?.name ?? "—", gradient: "linear-gradient(135deg, #0112AA, #2563EB)" },
    { icon: <FileTextOutlined />, label: "Scenario", value: session.scenario?.name ?? "—", gradient: "linear-gradient(135deg, #7C3AED, #A78BFA)" },
    { icon: <ClockCircleOutlined />, label: "Duration", value: duration, gradient: "linear-gradient(135deg, #059669, #34D399)" },
    { icon: <CalendarOutlined />, label: "Date", value: new Date(session.created_at).toLocaleString("sk-SK"), gradient: "linear-gradient(135deg, #2563EB, #60A5FA)" },
  ];

  return (
    <>
      <Row gutter={[20, 20]} className="animate-stagger">
        <Col xs={24} lg={16}>
          <Card variant="borderless" styles={{ body: { padding: "24px" } }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
              <Tag color={SESSION_STATUS_COLORS[session.status]} style={{ fontSize: 12 }}>
                {SESSION_STATUS_LABELS[session.status]}
              </Tag>
              {session.difficulty_level && (
                <Tag style={{ fontSize: 12, background: "rgba(1,18,170,0.08)", color: "#0112AA", border: "none" }}>
                  {session.difficulty_level.name}
                </Tag>
              )}
            </div>
            <Row gutter={[24, 20]}>
              {infoItems.map((item) => (
                <Col xs={24} sm={12} key={item.label}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: item.gradient,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: 16,
                      }}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <Text style={{ fontSize: 12, color: "#9CA3AF", display: "block" }}>{item.label}</Text>
                      <Text strong style={{ fontSize: 14 }}>{item.value}</Text>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            variant="borderless"
            style={{ background: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)", border: "none" }}
            styles={{ body: { padding: "24px", textAlign: "center" } }}
          >
            {session.score === null ? (
              session.status === "completed" ? (
                <Space direction="vertical" size="middle" align="center" style={{ width: "100%" }}>
                  <FileSearchOutlined style={{ fontSize: 32, color: "#9CA3AF" }} />
                  <Text style={{ fontSize: 14, color: "#6B7280" }}>
                    Feedback not yet generated
                  </Text>
                  <Button
                    type="primary"
                    loading={generating}
                    disabled={!canGenerateFeedback}
                    onClick={handleGenerateFeedback}
                  >
                    {generating ? "Generating..." : "Generate Feedback"}
                  </Button>
                  <Text style={{ fontSize: 12, color: "#9CA3AF" }}>
                    This may take a few seconds
                  </Text>
                </Space>
              ) : (
                <Space direction="vertical" size="middle" align="center" style={{ width: "100%" }}>
                  <Spin size="small" />
                  <Text style={{ fontSize: 14, color: "#6B7280" }}>
                    Waiting for call to complete...
                  </Text>
                </Space>
              )
            ) : (
              <Space direction="vertical" size="large" align="center">
                <div>
                  <Text style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280" }}>
                    Score
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <ScoreDisplay score={session.score} />
                  </div>
                </div>
                <div>
                  <Text style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280" }}>
                    Rating
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <StarRating rating={session.star_rating} />
                  </div>
                </div>
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {session.feedback_summary && (
        <Card title="Feedback Summary" variant="borderless" className="card-animated" style={{ marginTop: 20, animationDelay: "150ms" }}>
          <Paragraph style={{ fontSize: 14, lineHeight: 1.8, color: "#374151", margin: 0 }}>
            {session.feedback_summary}
          </Paragraph>
        </Card>
      )}

      {breakdownData.length > 0 && (
        <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
          <Col xs={24} lg={12}>
            <Card title="Performance Radar" variant="borderless" styles={{ body: { padding: "16px 24px 24px" } }}>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={breakdownData}>
                  <PolarGrid stroke="#E5E7EB" />
                  <PolarAngleAxis dataKey="category" tick={{ fontSize: 11, fill: "#6b7280" }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                  <Radar
                    dataKey="value"
                    stroke="#0112AA"
                    fill="#0112AA"
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: 13 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Score Breakdown" variant="borderless" styles={{ body: { padding: "16px 24px 24px" } }}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={breakdownData} layout="vertical">
                  <defs>
                    <linearGradient id="detailBarGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#0112AA" />
                      <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#9CA3AF" }} axisLine={{ stroke: "#F0F0F0" }} tickLine={false} />
                  <YAxis type="category" dataKey="category" width={120} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)", fontSize: 13 }}
                  />
                  <Bar dataKey="value" fill="url(#detailBarGradient)" radius={[0, 6, 6, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>
      )}

      {session.suggestions && session.suggestions.length > 0 && (
        <Card title="Suggestions" variant="borderless" style={{ marginTop: 20 }}>
          <List
            dataSource={session.suggestions}
            renderItem={(item, idx) => (
              <List.Item style={{ padding: "12px 0", borderBottom: idx < session.suggestions!.length - 1 ? "1px solid #F0F0F0" : "none" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 8,
                      background: "linear-gradient(135deg, #EEF2FF, #E0E7FF)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#0112AA",
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}
                  </div>
                  <Text style={{ fontSize: 14, lineHeight: 1.6, color: "#374151" }}>{item}</Text>
                </div>
              </List.Item>
            )}
          />
        </Card>
      )}

      {session.highlights && session.highlights.length > 0 && (
        <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
          <Col xs={24} lg={12}>
            <Card
              variant="borderless"
              title={
                <Space>
                  <CheckCircleOutlined style={{ color: "#059669" }} />
                  <span>Positive Highlights</span>
                </Space>
              }
            >
              <List
                dataSource={session.highlights.filter((h) => h.type === "positive")}
                renderItem={(item) => (
                  <List.Item style={{ padding: "10px 0" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", marginTop: 7, flexShrink: 0 }} />
                      <Text style={{ fontSize: 13, color: "#374151" }}>{item.text}</Text>
                    </div>
                  </List.Item>
                )}
                locale={{ emptyText: "No positive highlights" }}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              variant="borderless"
              title={
                <Space>
                  <CloseCircleOutlined style={{ color: "#EF4444" }} />
                  <span>Areas for Improvement</span>
                </Space>
              }
            >
              <List
                dataSource={session.highlights.filter((h) => h.type === "negative")}
                renderItem={(item) => (
                  <List.Item style={{ padding: "10px 0" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#EF4444", marginTop: 7, flexShrink: 0 }} />
                      <Text style={{ fontSize: 13, color: "#374151" }}>{item.text}</Text>
                    </div>
                  </List.Item>
                )}
                locale={{ emptyText: "No improvement areas" }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {session.transcript && session.transcript.length > 0 && (
        <Card title="Transcript" variant="borderless" style={{ marginTop: 20 }}>
          <div style={{ maxHeight: 500, overflowY: "auto", padding: "8px 0" }}>
            {session.transcript.map((entry, i) => (
              <div
                key={i}
                className="transcript-bubble"
                style={{
                  display: "flex",
                  justifyContent: entry.role === "agent" ? "flex-start" : "flex-end",
                  marginBottom: 16,
                  animationDelay: `${Math.min(i * 50, 500)}ms`,
                }}
              >
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "12px 16px",
                    borderRadius: entry.role === "agent" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                    background: entry.role === "agent"
                      ? "#F3F4F6"
                      : "linear-gradient(135deg, #0112AA, #2563EB)",
                    color: entry.role === "agent" ? "#374151" : "#fff",
                    boxShadow: entry.role === "agent"
                      ? "none"
                      : "0 2px 8px rgba(1, 18, 170, 0.2)",
                  }}
                >
                  <Text
                    strong
                    style={{
                      fontSize: 11,
                      display: "block",
                      marginBottom: 4,
                      color: entry.role === "agent" ? "#9CA3AF" : "rgba(255,255,255,0.7)",
                    }}
                  >
                    {entry.role === "agent" ? "AI Agent" : "Customer (User)"}
                  </Text>
                  <Text style={{ color: entry.role === "agent" ? "#374151" : "#fff", fontSize: 13, lineHeight: 1.6 }}>
                    {entry.content}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
