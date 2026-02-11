"use client";

import { Table, Tag, Switch } from "antd";
import { useRouter } from "next/navigation";
import type { ColumnsType } from "antd/es/table";
import type { Scenario, ScenarioType } from "@repo/shared";
import { SCENARIO_TYPE_LABELS } from "@repo/shared";

interface ScenarioTableProps {
  data: Scenario[];
  loading: boolean;
  onToggleActive: (id: string, active: boolean) => void;
}

export default function ScenarioTable({ data, loading, onToggleActive }: ScenarioTableProps) {
  const router = useRouter();

  const columns: ColumnsType<Scenario> = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (name: string, record) => (
        <span style={record.is_active ? undefined : { color: "#00000040" }}>{name}</span>
      ),
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (type: ScenarioType) => (
        <Tag color={type === "frontline" ? "blue" : "purple"}>
          {SCENARIO_TYPE_LABELS[type]}
        </Tag>
      ),
    },
    {
      title: "Active",
      dataIndex: "is_active",
      key: "is_active",
      render: (active: boolean, record) => (
        <Switch
          checked={active}
          onChange={(checked) => onToggleActive(record.id, checked)}
          size="small"
        />
      ),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      render: (date: string) => new Date(date).toLocaleDateString("sk-SK"),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      loading={loading}
      size="middle"
      pagination={{ pageSize: 20, showSizeChanger: true }}
      onRow={(record) => ({
        style: { cursor: "pointer" },
        onClick: (e) => {
          // Don't navigate when clicking interactive elements (Switch)
          if ((e.target as HTMLElement).closest(".ant-switch")) return;
          router.push(`/scenarios/${record.id}`);
        },
      })}
    />
  );
}
