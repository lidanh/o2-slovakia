"use client";

import { Card, Col, Row, Typography } from "antd";
import {
  PhoneOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import type { AnalyticsKPIs } from "@repo/shared";

const { Text } = Typography;

interface KPICardsProps {
  data: AnalyticsKPIs | null;
  loading: boolean;
}

const kpiConfig = [
  {
    title: "Total Sessions",
    icon: <PhoneOutlined style={{ fontSize: 20 }} />,
    gradient: "linear-gradient(135deg, #0112AA 0%, #2563EB 100%)",
    bgGradient: "linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)",
  },
  {
    title: "Avg Score",
    icon: <TrophyOutlined style={{ fontSize: 20 }} />,
    gradient: "linear-gradient(135deg, #059669 0%, #34D399 100%)",
    bgGradient: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
  },
  {
    title: "Avg Duration",
    icon: <ClockCircleOutlined style={{ fontSize: 20 }} />,
    gradient: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
    bgGradient: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
  },
  {
    title: "Completion Rate",
    icon: <CheckCircleOutlined style={{ fontSize: 20 }} />,
    gradient: "linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)",
    bgGradient: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
  },
];

export default function KPICards({ data, loading }: KPICardsProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const values = [
    data?.totalSessions ?? 0,
    data?.avgScore != null ? `${data.avgScore.toFixed(1)}%` : "0%",
    data ? formatDuration(data.avgCallDuration) : "0:00",
    data?.completionRate != null ? `${data.completionRate.toFixed(1)}%` : "0%",
  ];

  return (
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
                  {values[idx]}
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
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              >
                {kpi.icon}
              </div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
