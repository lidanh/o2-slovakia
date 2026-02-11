"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  Table,
  Button,
  Spin,
  Row,
  Col,
  Select,
  Popconfirm,
  Space,
  Typography,
  App,
} from "antd";
import { PlusOutlined, DeleteOutlined, TeamOutlined, TrophyOutlined, PhoneOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import type { TeamWithMembers, User } from "@repo/shared";
import PageHeader from "@/components/common/PageHeader";
import ScoreDisplay from "@/components/common/ScoreDisplay";

const { Text, Paragraph } = Typography;

interface TeamMemberStats {
  userId: string;
  userName: string;
  avgScore: number | null;
  totalSessions: number;
  lastSessionDate: string | null;
}

interface TeamStats {
  avgScore: number | null;
  totalSessions: number;
  completedSessions: number;
  members: TeamMemberStats[];
}

export default function TeamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { message } = App.useApp();

  const [team, setTeam] = useState<TeamWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [stats, setStats] = useState<TeamStats>({
    avgScore: null,
    totalSessions: 0,
    completedSessions: 0,
    members: [],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, usersRes, statsRes] = await Promise.all([
        fetch(`/api/teams/${id}?withMembers=true`),
        fetch("/api/users"),
        fetch(`/api/teams/${id}/stats`),
      ]);
      if (!teamRes.ok) throw new Error("Failed to fetch team");
      setTeam(await teamRes.json());
      if (usersRes.ok) setAllUsers(await usersRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      message.error("Failed to load team data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleAddMember() {
    if (!selectedUserId) return;
    setAddLoading(true);
    try {
      const res = await fetch(`/api/users/${selectedUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: id }),
      });
      if (!res.ok) throw new Error("Failed to add member");
      message.success("Member added");
      setSelectedUserId(null);
      fetchData();
    } catch {
      message.error("Failed to add member");
    } finally {
      setAddLoading(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_id: null }),
      });
      if (!res.ok) throw new Error("Failed to remove member");
      message.success("Member removed");
      fetchData();
    } catch {
      message.error("Failed to remove member");
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!team) return <div>Team not found</div>;

  const memberIds = new Set(team.members.map((m) => m.id));
  const availableUsers = allUsers.filter((u) => !memberIds.has(u.id));

  const rankedMembers = [...stats.members]
    .sort((a, b) => {
      if (a.avgScore === null && b.avgScore === null) return 0;
      if (a.avgScore === null) return 1;
      if (b.avgScore === null) return -1;
      return b.avgScore - a.avgScore;
    })
    .map((m, i) => ({ ...m, rank: i + 1 }));

  const rankBadge = (rank: number) => {
    const colors: Record<number, string> = { 1: "#FBBF24", 2: "#9CA3AF", 3: "#CD7F32" };
    const bg = colors[rank];
    if (!bg) {
      return <Text style={{ fontSize: 13, color: "#6b7280" }}>{rank}</Text>;
    }
    return (
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${bg}, ${bg}dd)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 12,
          color: rank === 1 ? "#78350F" : "#fff",
          boxShadow: `0 2px 6px ${bg}66`,
        }}
      >
        {rank}
      </div>
    );
  };

  const memberColumns: ColumnsType<TeamMemberStats & { rank: number }> = [
    {
      title: "#",
      dataIndex: "rank",
      key: "rank",
      width: 60,
      render: (rank: number) => rankBadge(rank),
    },
    {
      title: "Name",
      dataIndex: "userName",
      key: "userName",
      render: (name: string) => <Text strong style={{ fontSize: 13 }}>{name}</Text>,
    },
    {
      title: "Avg Score",
      dataIndex: "avgScore",
      key: "avgScore",
      width: 120,
      render: (score: number | null) => <ScoreDisplay score={score} size="small" />,
    },
    {
      title: "Sessions",
      dataIndex: "totalSessions",
      key: "totalSessions",
      width: 100,
      render: (count: number) => <Text style={{ fontSize: 13 }}>{count}</Text>,
    },
    {
      title: "Last Activity",
      dataIndex: "lastSessionDate",
      key: "lastSessionDate",
      width: 140,
      render: (date: string | null) => (
        <Text style={{ fontSize: 13, color: "#6b7280" }}>
          {date ? new Date(date).toLocaleDateString("sk-SK") : "—"}
        </Text>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      render: (_, r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Popconfirm title="Remove from team?" onConfirm={() => handleRemoveMember(r.userId)}>
            <Button type="text" danger size="small" icon={<DeleteOutlined />}>
              Remove
            </Button>
          </Popconfirm>
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={team.name} subtitle="Team details" backHref="/teams" />

      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={16}>
          <Card variant="borderless" styles={{ body: { padding: "24px" } }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
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
                <TeamOutlined style={{ color: "#fff", fontSize: 20 }} />
              </div>
              <div>
                <Text strong style={{ fontSize: 18, fontWeight: 700 }}>{team.name}</Text>
                <br />
                <Text style={{ color: "#9CA3AF", fontSize: 13 }}>
                  {team.members.length} member{team.members.length !== 1 ? "s" : ""}
                </Text>
              </div>
            </div>
            {team.description && (
              <Paragraph style={{ color: "#374151", fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                {team.description}
              </Paragraph>
            )}
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
                  {stats.avgScore !== null ? `${stats.avgScore.toFixed(1)}%` : "—"}
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
                  {stats.totalSessions}
                  <PhoneOutlined style={{ fontSize: 16, color: "#0112AA" }} />
                </div>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>

      <Card
        variant="borderless"
        styles={{ body: { padding: "0 24px 24px" } }}
        title={`Members (${team.members.length})`}
        extra={
          <Space>
            <Select
              value={selectedUserId}
              onChange={setSelectedUserId}
              placeholder="Select user to add"
              style={{ width: 250 }}
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label as string ?? "").toLowerCase().includes(input.toLowerCase())
              }
              options={availableUsers.map((u) => ({
                value: u.id,
                label: `${u.name} (${u.email})`,
              }))}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddMember}
              loading={addLoading}
              disabled={!selectedUserId}
            >
              Add Member
            </Button>
          </Space>
        }
      >
        <Table<TeamMemberStats & { rank: number }>
          columns={memberColumns}
          dataSource={rankedMembers}
          rowKey="userId"
          pagination={false}
          size="middle"
          locale={{ emptyText: "No members yet" }}
          onRow={(record) => ({
            style: { cursor: "pointer" },
            onClick: () => router.push(`/users/${record.userId}`),
          })}
        />
      </Card>
    </>
  );
}
