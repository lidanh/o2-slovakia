"use client";

import { Layout, ConfigProvider } from "antd";
import Sidebar from "@/components/layout/Sidebar";
import AppHeader from "@/components/layout/AppHeader";
import { usePathname } from "next/navigation";
import {useLocale} from 'next-intl';
import enUS from 'antd/locale/en_US';
import skSK from 'antd/locale/sk_SK';
import huHU from 'antd/locale/hu_HU';
import LanguageSync from "@/components/common/LanguageSync";

const { Content } = Layout;

const ANTD_LOCALES: Record<string, typeof enUS> = { en: enUS, sk: skSK, hu: huHU };

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const locale = useLocale();

  return (
    <ConfigProvider locale={ANTD_LOCALES[locale] ?? enUS}>
      <Layout style={{ minHeight: "100vh", background: "#FFFFFF" }}>
        <LanguageSync />
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
            <div key={pathname} className="page-content">
              {children}
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
