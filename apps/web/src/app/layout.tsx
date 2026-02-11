"use client";

import { ConfigProvider, App } from "antd";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { antdTheme } from "@/theme/antd-theme";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>O2 Trainer</title>
      </head>
      <body>
        <AntdRegistry>
          <ConfigProvider theme={antdTheme}><App>{children}</App></ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
