import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  spring,
} from "remotion";
import { Card, Input, Select, Slider, Tag, Typography } from "antd";
import { AppShell } from "../layout/AppShell";
import { scenario, difficultyLevels } from "../../data/mockData";

const { Text } = Typography;
const { TextArea } = Input;

function useTypingText(
  fullText: string,
  startFrame: number,
  charsPerFrame = 2
) {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;
  if (localFrame < 0) return "";
  const charCount = Math.min(
    Math.floor(localFrame * charsPerFrame),
    fullText.length
  );
  return fullText.slice(0, charCount);
}

interface ScenarioCreationSceneProps {
  showDifficultyPhase?: boolean;
}

export const ScenarioCreationScene: React.FC<ScenarioCreationSceneProps> = ({
  showDifficultyPhase,
}) => {
  if (showDifficultyPhase) {
    return <DifficultyConfigView />;
  }
  return <ScenarioFormView />;
};

export const ScenarioFormView: React.FC = () => {
  const frame = useCurrentFrame();

  // Fast typing: name appears quickly, prompt fills faster
  const nameText = useTypingText(scenario.name, 8, 2.5);
  const promptText = useTypingText(scenario.prompt, 30, 3);

  const typeOpacity = interpolate(frame, [20, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const tagsOpacity = interpolate(frame, [120, 135], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tagsSlide = interpolate(frame, [120, 135], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AppShell activeKey="scenarios" title="Create Scenario">
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Card
          style={{
            borderRadius: 16,
            border: "1px solid #F0F0F0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
          styles={{ body: { padding: 32 } }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Name field */}
            <div>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#374151",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Scenario Name
              </Text>
              <Input
                value={nameText}
                placeholder="Enter scenario name"
                size="large"
                style={{ borderRadius: 10 }}
                readOnly
              />
            </div>

            {/* Type selector */}
            <div style={{ opacity: typeOpacity }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#374151",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Scenario Type
              </Text>
              <Select
                value="frontline"
                size="large"
                style={{ width: "100%", borderRadius: 10 }}
                options={[
                  { value: "frontline", label: "Frontline" },
                  { value: "leadership", label: "Leadership" },
                ]}
                open={false}
              />
            </div>

            {/* Prompt field */}
            <div>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#374151",
                  display: "block",
                  marginBottom: 8,
                }}
              >
                AI Customer Prompt
              </Text>
              <TextArea
                value={promptText}
                rows={4}
                placeholder="Describe the AI customer persona..."
                style={{ borderRadius: 10 }}
                readOnly
              />
            </div>

            {/* Tags slide in */}
            <div
              style={{
                display: "flex",
                gap: 8,
                opacity: tagsOpacity,
                transform: `translateY(${tagsSlide}px)`,
              }}
            >
              <Tag color="blue">Frontline</Tag>
              <Tag color="green">Active</Tag>
              <Tag>3 Difficulty Levels</Tag>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

export const DifficultyConfigView: React.FC = () => {
  const frame = useCurrentFrame();

  // Only show Medium difficulty — no tab switching
  const level = difficultyLevels[1]; // Medium

  const sliderProgress = interpolate(frame, [5, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const promptOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const promptSlide = interpolate(frame, [30, 45], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Typing animation for prompt text starting at frame 25, 3 chars/frame
  const promptChars = Math.max(0, Math.floor((frame - 25) * 3));
  const promptText = level.prompt.slice(0, Math.min(promptChars, level.prompt.length));

  const sliders = [
    { label: "Resistance Level", value: level.resistance_level, color: "#0112AA", delay: 0 },
    { label: "Emotional Intensity", value: level.emotional_intensity, color: "#7C3AED", delay: 5 },
    { label: "Cooperation", value: level.cooperation, color: "#059669", delay: 10 },
  ];

  return (
    <AppShell activeKey="scenarios" title="Difficulty Configuration">
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Card
          style={{
            borderRadius: 16,
            border: "1px solid #F0F0F0",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
          styles={{ body: { padding: 32 } }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "#1a1a2e",
              }}
            >
              {scenario.name}
            </Text>
            <Tag color="processing" style={{ fontSize: 13 }}>
              Medium
            </Tag>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 28,
            }}
          >
            {sliders.map((s) => {
              const progress = interpolate(
                frame - s.delay,
                [5, 45],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              );
              return (
                <div key={s.label}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}
                    >
                      {s.label}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: 600, color: s.color }}>
                      {Math.round(s.value * progress)}%
                    </Text>
                  </div>
                  <Slider
                    value={Math.round(s.value * progress)}
                    max={100}
                    disabled
                    styles={{ track: { background: s.color } }}
                  />
                </div>
              );
            })}

            {/* Prompt preview */}
            <div
              style={{
                background: "#F8FAFF",
                borderRadius: 12,
                padding: 16,
                border: "1px solid #E0E7FF",
                opacity: promptOpacity,
                transform: `translateY(${promptSlide}px)`,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: "#6b7280",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Customer Behavior Prompt
              </Text>
              <Text style={{ fontSize: 14, color: "#374151" }}>
                {promptText}
              </Text>
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  );
};
