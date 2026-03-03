import { AbsoluteFill, Sequence } from "remotion";
import { Card, Typography } from "antd";
import { AppShell } from "../layout/AppShell";
import { StaticKPICards } from "../common/StaticKPICards";
import { AnimatedAreaChart } from "../charts/AnimatedAreaChart";
import { TextOverlay } from "../overlays/TextOverlay";
import { ScenarioCreationScene } from "./ScenarioCreationScene";

const { Title } = Typography;

const DashboardView: React.FC = () => {
  return (
    <AppShell activeKey="dashboard" title="Dashboard">
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <StaticKPICards />
        <Card
          style={{
            borderRadius: 16,
            border: "1px solid #F0F0F0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
          styles={{ body: { padding: 24 } }}
        >
          <Title
            level={5}
            style={{ marginTop: 0, marginBottom: 16, color: "#1a1a2e" }}
          >
            Weekly Training Activity
          </Title>
          {/* Graph draws very slowly — spans nearly the entire scene */}
          <AnimatedAreaChart startFrame={15} drawDuration={130} />
        </Card>
      </div>
    </AppShell>
  );
};

export const DashboardScene: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Dashboard establishing shot (0-150, 5s) */}
      <Sequence from={0} durationInFrames={150}>
        <DashboardView />
        <TextOverlay
          text="AI-Powered Voice Training"
          durationInFrames={140}
        />
      </Sequence>

      {/* Scenario Creation with fast typing (150-420, 9s) */}
      <Sequence from={150} durationInFrames={270}>
        <ScenarioCreationScene />
        <TextOverlay
          text="Design Custom Training Scenarios"
          durationInFrames={260}
        />
      </Sequence>

      {/* Difficulty Config — cuts mid-slider for dynamic feel (420-530, ~3.7s) */}
      <Sequence from={420} durationInFrames={110}>
        <ScenarioCreationScene showDifficultyPhase />
        <TextOverlay
          text="Fine-tune AI Behavior"
          durationInFrames={100}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
