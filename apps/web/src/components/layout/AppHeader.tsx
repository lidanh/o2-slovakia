"use client";

import { useState } from "react";
import { Layout, Button, Dropdown, Typography, Flex, Tag } from "antd";
import { LogoutOutlined, UserOutlined, BellOutlined, IdcardOutlined, BugOutlined } from "@ant-design/icons";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { MenuProps } from "antd";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@repo/shared";
import ReportIssueDialog from "@/components/common/ReportIssueDialog";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import {useTranslations} from 'next-intl';

const { Header } = Layout;
const { Text } = Typography;

const roleColors: Record<UserRole, string> = {
  admin: "#0112AA",
  team_manager: "#7C3AED",
  user: "#059669",
};

export default function AppHeader() {
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const t = useTranslations();

  const roleLabels: Record<UserRole, string> = {
    admin: t('Common.roles.admin'),
    team_manager: t('Common.roles.manager'),
    user: t('Common.roles.user'),
  };

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const items: MenuProps["items"] = [
    {
      key: "profile",
      icon: <IdcardOutlined />,
      label: t('Profile.title'),
      onClick: () => router.push("/my-profile"),
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: t('Profile.signOut'),
      onClick: handleLogout,
    },
  ];

  const displayName = user?.name ?? "User";
  const avatarLetter = displayName.charAt(0).toUpperCase();
  const role = user?.role ?? "user";

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
        <LanguageSwitcher />
        <Button
          type="text"
          icon={<BugOutlined />}
          onClick={() => setIssueDialogOpen(true)}
          style={{ color: "#9CA3AF", width: 40, height: 40 }}
        />
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
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#fff",
                }}
              >
                {avatarLetter}
              </div>
              <Text style={{ color: "#374151", fontWeight: 500 }}>{displayName}</Text>
              <Tag
                color={roleColors[role]}
                style={{ marginLeft: 4, marginRight: 0 }}
              >
                {roleLabels[role]}
              </Tag>
            </Flex>
          </Button>
        </Dropdown>
      </Flex>
      <ReportIssueDialog
        open={issueDialogOpen}
        onClose={() => setIssueDialogOpen(false)}
        communicationId="5086f6bc-ad18-4f67-93a4-3f022f785a11"
        transcriptionId="cdde8a06-de70-42aa-87c9-77f94e6384b9"
        category="ui_bug"
        title={t('ReportIssue.reportUiIssue')}
      />
    </Header>
  );
}
