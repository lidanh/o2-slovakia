"use client";

import { Layout, Button, Dropdown, Typography, Flex } from "antd";
import { LogoutOutlined, UserOutlined, BellOutlined } from "@ant-design/icons";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { MenuProps } from "antd";

const { Header } = Layout;
const { Text } = Typography;

export default function AppHeader() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const items: MenuProps["items"] = [
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Sign Out",
      onClick: handleLogout,
    },
  ];

  return (
    <Header
      style={{
        background: "#FFFFFF",
        padding: "0 40px",
        borderBottom: "1px solid #F0F0F0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 64,
        position: "sticky",
        top: 0,
        zIndex: 99,
      }}
    >
      <div />
      <Flex align="center" gap={8}>
        <Button
          type="text"
          icon={<BellOutlined />}
          className="bell-btn"
          style={{ color: "#9CA3AF", width: 40, height: 40 }}
        />
        <div style={{ width: 1, height: 24, background: "#F0F0F0", margin: "0 4px" }} />
        <Dropdown menu={{ items }} placement="bottomRight">
          <Button type="text" style={{ height: 40, padding: "0 8px" }}>
            <Flex align="center" gap={10}>
              <div
                className="avatar-glow"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, #0112AA, #2563EB)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UserOutlined style={{ fontSize: 14, color: "#fff" }} />
              </div>
              <Text style={{ color: "#374151", fontWeight: 500 }}>Admin</Text>
            </Flex>
          </Button>
        </Dropdown>
      </Flex>
    </Header>
  );
}
