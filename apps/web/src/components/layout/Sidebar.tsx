"use client";

import Image from "next/image";
import { Layout, Menu } from "antd";
import {
  DashboardOutlined,
  FileTextOutlined,
  UserOutlined,
  TeamOutlined,
  PhoneOutlined,
  BarChartOutlined,
  TrophyOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { usePathname, useRouter } from "next/navigation";
import type { MenuProps } from "antd";

const { Sider } = Layout;

const menuItems: MenuProps["items"] = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
  { key: "/training", icon: <PhoneOutlined />, label: "Sessions" },
  { key: "/scenarios", icon: <FileTextOutlined />, label: "Scenarios" },
  { key: "/users", icon: <UserOutlined />, label: "Users" },
  { key: "/teams", icon: <TeamOutlined />, label: "Teams" },
  {
    key: "analytics-group",
    icon: <BarChartOutlined />,
    label: "Analytics",
    children: [
      { key: "/analytics", icon: <BarChartOutlined />, label: "Overview" },
      { key: "/analytics/leaderboard", icon: <TrophyOutlined />, label: "Leaderboard" },
    ],
  },
  { key: "/settings", icon: <SettingOutlined />, label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const selectedKey =
    menuItems
      ?.flatMap((item) => {
        if (item && "children" in item && item.children) {
          return item.children;
        }
        return [item];
      })
      .sort((a, b) => {
        const aLen = a && "key" in a ? (a.key as string).length : 0;
        const bLen = b && "key" in b ? (b.key as string).length : 0;
        return bLen - aLen;
      })
      .find(
        (item) =>
          item && "key" in item && pathname.startsWith(item.key as string)
      )?.key as string ?? "/dashboard";

  return (
    <Sider
      width={260}
      style={{
        overflow: "auto",
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
        background: "linear-gradient(180deg, #060E5E 0%, #0112AA 40%, #0B3FBF 100%)",
      }}
    >
      {/* Logo Area */}
      <div
        style={{
          height: 72,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            overflow: "hidden",
            padding: 6,
          }}
        >
          <Image
            src="/o2-logo-white.svg"
            alt="O2"
            width={28}
            height={28}
            style={{ objectFit: "contain" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontWeight: 700,
              fontSize: 18,
              color: "#fff",
              letterSpacing: "-0.3px",
              lineHeight: 1.2,
            }}
          >
            O2 Trainer
          </span>
          <span
            style={{
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.7)",
              fontWeight: 600,
              letterSpacing: "0.5px",
              textTransform: "uppercase" as const,
            }}
          >
            O2 Slovakia
          </span>
        </div>
      </div>

      {/* Gradient Divider */}
      <div
        style={{
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
          margin: "0 20px 8px",
        }}
      />

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        defaultOpenKeys={["analytics-group"]}
        items={menuItems}
        onClick={({ key }) => router.push(key)}
        style={{
          background: "transparent",
          borderRight: 0,
          padding: "0 4px",
          fontSize: 15,
        }}
      />

      {/* Bottom fade */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          background: "linear-gradient(transparent, rgba(0, 0, 0, 0.12))",
          pointerEvents: "none",
        }}
      />
    </Sider>
  );
}
