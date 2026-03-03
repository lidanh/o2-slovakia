import {
  DashboardOutlined,
  FileTextOutlined,
  UserOutlined,
  TeamOutlined,
  PhoneOutlined,
  BarChartOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { O2Logo } from "../common/O2Logo";

interface FakeSidebarProps {
  activeKey?: string;
}

const menuItems = [
  { key: "dashboard", label: "Dashboard", icon: <DashboardOutlined /> },
  { key: "scenarios", label: "Scenarios", icon: <FileTextOutlined /> },
  { key: "users", label: "Users", icon: <UserOutlined /> },
  { key: "teams", label: "Teams", icon: <TeamOutlined /> },
  { key: "training", label: "Training", icon: <PhoneOutlined /> },
  { key: "analytics", label: "Analytics", icon: <BarChartOutlined /> },
  { key: "settings", label: "Settings", icon: <SettingOutlined /> },
];

export const FakeSidebar: React.FC<FakeSidebarProps> = ({
  activeKey = "dashboard",
}) => {
  return (
    <div
      style={{
        width: 240,
        height: "100%",
        background: "linear-gradient(180deg, #0112AA 0%, #010D7A 100%)",
        display: "flex",
        flexDirection: "column",
        padding: "24px 0",
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 24px",
          marginBottom: 36,
        }}
      >
        <O2Logo width={40} height={27} variant="white" />
        <span
          style={{
            color: "#FFFFFF",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "-0.3px",
          }}
        >
          O2 Trainer
        </span>
      </div>

      {/* Menu Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 12px" }}>
        {menuItems.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                borderRadius: 10,
                background: isActive
                  ? "rgba(255, 255, 255, 0.15)"
                  : "transparent",
                color: isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.7)",
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                cursor: "default",
              }}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </div>
          );
        })}
      </div>

      {/* Bottom spacer + user */}
      <div style={{ flex: 1 }} />
      <div
        style={{
          padding: "16px 24px",
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "rgba(255, 255, 255, 0.7)",
          fontSize: 13,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          JN
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 500 }}>Ján Novák</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Admin</div>
        </div>
      </div>
    </div>
  );
};
