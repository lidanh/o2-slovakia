import { AbsoluteFill, Sequence } from "remotion";
import { ScenarioFormView, DifficultyConfigView } from "./ScenarioCreationScene";
import { UserAssignmentView } from "./UserAssignmentView";
import { TrainSendView } from "./TrainSendView";
import { TextOverlay } from "../overlays/TextOverlay";

/**
 * App Flow Scene — all app-shell scenes in one master sequence.
 * Total: 540 frames (18 seconds)
 *
 * 0-210:   Scenario Creation (7s) — typing name, selecting type, typing prompt
 * 210-270: Difficulty Config (2s)  — quick sliders + prompt, cuts mid-animation
 * 270-420: User Assignment (5s)   — users checked one by one
 * 420-540: Train / Send Link (4s) — dropdown, send, success toast
 */
export const AppFlowScene: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Scenario Creation */}
      <Sequence from={0} durationInFrames={210}>
        <ScenarioFormView />
        <TextOverlay
          text="Design Custom Training Scenarios"
          durationInFrames={200}
        />
      </Sequence>

      {/* Difficulty Config — quick, cuts mid-slider */}
      <Sequence from={210} durationInFrames={60}>
        <DifficultyConfigView />
        <TextOverlay
          text="Fine-tune AI Behavior"
          durationInFrames={50}
        />
      </Sequence>

      {/* User Assignment */}
      <Sequence from={270} durationInFrames={150}>
        <UserAssignmentView />
        <TextOverlay
          text="Assign Your Team"
          durationInFrames={140}
        />
      </Sequence>

      {/* Train / Send Link */}
      <Sequence from={420} durationInFrames={120}>
        <TrainSendView />
        <TextOverlay
          text="Deploy Training Instantly"
          durationInFrames={110}
        />
      </Sequence>
    </AbsoluteFill>
  );
};
