"use client";

import { useEffect, useState } from "react";
import { Table, Button, Tag, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";

const { Title } = Typography;

interface Tenant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  user_count: number;
  created_at: string;
}

export default function BackofficePage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/backoffice/tenants")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTenants(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: Tenant) => (
        <a onClick={() => router.push(`/backoffice/tenants/${record.id}`)}>{name}</a>
      ),
    },
    { title: "Slug", dataIndex: "slug", key: "slug" },
    {
      title: "Status",
      dataIndex: "is_active",
      key: "is_active",
      render: (active: boolean) => (
        <Tag color={active ? "green" : "red"}>{active ? "Active" : "Inactive"}</Tag>
      ),
    },
    { title: "Users", dataIndex: "user_count", key: "user_count" },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      render: (d: string) => {
        const date = new Date(d);
        return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Tenants</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push("/backoffice/tenants/new")}
        >
          Create Tenant
        </Button>
      </div>
      <Table
        dataSource={tenants}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        onRow={(record) => ({
          onClick: () => router.push(`/backoffice/tenants/${record.id}`),
          style: { cursor: "pointer" },
        })}
      />
    </div>
  );
}
