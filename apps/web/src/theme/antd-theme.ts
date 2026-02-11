import type { ThemeConfig } from "antd";

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: "#0112AA",
    colorBgLayout: "#F7F8FA",
    colorText: "#1a1a2e",
    colorTextSecondary: "#6b7280",
    colorBgContainer: "#FFFFFF",
    borderRadius: 10,
    fontFamily:
      '"Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: 14,
    colorBorder: "#E5E7EB",
    colorBorderSecondary: "#F0F0F0",
    motionDurationSlow: "0.3s",
    motionDurationMid: "0.2s",
    motionDurationFast: "0.1s",
    motionEaseInOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    motionEaseOut: "cubic-bezier(0, 0, 0.2, 1)",
  },
  components: {
    Layout: {
      siderBg: "transparent",
      headerBg: "#FFFFFF",
      bodyBg: "#FFFFFF",
    },
    Menu: {
      darkItemBg: "transparent",
      darkItemColor: "rgba(255, 255, 255, 0.7)",
      darkItemSelectedBg: "rgba(255, 255, 255, 0.15)",
      darkItemSelectedColor: "#FFFFFF",
      darkItemHoverBg: "rgba(255, 255, 255, 0.08)",
      darkSubMenuItemBg: "transparent",
      itemBorderRadius: 10,
      itemMarginInline: 8,
      itemMarginBlock: 3,
    },
    Button: {
      primaryShadow: "0 2px 8px rgba(1, 18, 170, 0.25)",
      borderRadius: 10,
      controlHeight: 38,
    },
    Card: {
      borderRadiusLG: 16,
      boxShadowTertiary: "none",
      paddingLG: 24,
    },
    Table: {
      headerBg: "#FAFBFC",
      headerColor: "#6b7280",
      rowHoverBg: "#F8FAFF",
      borderColor: "#F0F0F0",
      headerSplitColor: "transparent",
    },
    Input: {
      borderRadius: 10,
      controlHeight: 40,
    },
    Select: {
      borderRadius: 10,
      controlHeight: 40,
    },
    Tag: {
      borderRadiusSM: 6,
    },
    Modal: {
      borderRadiusLG: 20,
    },
    Statistic: {
      titleFontSize: 13,
      contentFontSize: 28,
    },
    Tabs: {
      itemSelectedColor: "#0112AA",
      inkBarColor: "#0112AA",
    },
    Typography: {
      fontSizeHeading2: 36,
      fontSizeHeading3: 28,
    },
  },
};
