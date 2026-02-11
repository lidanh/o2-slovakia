"use client";

import { Layout } from "antd";
import Sidebar from "@/components/layout/Sidebar";
import AppHeader from "@/components/layout/AppHeader";
import { usePathname } from "next/navigation";

const { Content } = Layout;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <Layout style={{ minHeight: "100vh", background: "#FFFFFF" }}>
      <Sidebar />
      <Layout style={{ marginLeft: 260, background: "#FFFFFF" }}>
        <AppHeader />
        <Content
          style={{
            padding: "28px 40px 40px",
            background: "#FFFFFF",
            minHeight: "calc(100vh - 64px)",
          }}
        >
          <div key={pathname} className="page-content">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}
