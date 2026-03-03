import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { ConfigProvider, App } from "antd";
import { antdTheme } from "./theme/antdTheme";
import { IntroScene } from "./components/scenes/IntroScene";
import { AppFlowScene } from "./components/scenes/AppFlowScene";
import { LiveCallScene } from "./components/scenes/LiveCallScene";
import { AIFeedbackScene } from "./components/scenes/AIFeedbackScene";
import { ClosingCTA } from "./components/scenes/ClosingCTA";
import { PoweredByScene } from "./components/scenes/PoweredByScene";

/**
 * Scene flow (~44.5s):
 *
 * 1. Intro:        90f  (3s)   — Logo reveal + tagline
 *      fade 15f
 * 2. App Flow:     540f (18s)  — Scenario (7s) → Difficulty (2s) → Users (5s) → Train (4s)
 *      fade 15f
 * 3. Call Flow:    300f (10s)  — OTP (2s) → Call Active (6s) → Analyzing (2s)
 *      fade 15f
 * 4. Feedback:     300f (10s)  — Charts animate (3s), feedback items overlay, charts fade
 *      fade 15f
 * 5. Closing CTA:  90f  (3s)  — Logo + tagline + URL
 *      fade 15f
 * 6. Powered By:   90f  (3s)  — "powered by" + Wonderful logo
 *
 * Total sequences: 90 + 540 + 300 + 300 + 90 + 90 = 1410
 * Transition overlaps: 5 × 15 = 75
 * Net frames: 1410 - 75 = 1335 (~44.5s @ 30fps)
 */
const TOTAL_FRAMES = 1335;

export const Video: React.FC = () => {
  const frame = useCurrentFrame();

  const musicVolume = interpolate(
    frame,
    [0, 45, TOTAL_FRAMES - 90, TOTAL_FRAMES],
    [0, 0.28, 0.28, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <ConfigProvider theme={antdTheme}>
      <App>
        <AbsoluteFill style={{ backgroundColor: "#F7F8FA" }}>
          <TransitionSeries>
            {/* 1. Intro — logo reveal + tagline */}
            <TransitionSeries.Sequence durationInFrames={90}>
              <IntroScene />
            </TransitionSeries.Sequence>

            <TransitionSeries.Transition
              presentation={fade()}
              timing={linearTiming({ durationInFrames: 15 })}
            />

            {/* 2. App Flow — scenario → difficulty → users → train/send */}
            <TransitionSeries.Sequence durationInFrames={540}>
              <AppFlowScene />
            </TransitionSeries.Sequence>

            <TransitionSeries.Transition
              presentation={fade()}
              timing={linearTiming({ durationInFrames: 15 })}
            />

            {/* 3. Call Flow — OTP → active call → analyzing */}
            <TransitionSeries.Sequence durationInFrames={300}>
              <LiveCallScene />
            </TransitionSeries.Sequence>

            <TransitionSeries.Transition
              presentation={fade()}
              timing={linearTiming({ durationInFrames: 15 })}
            />

            {/* 4. Feedback — charts animate, then feedback items take over */}
            <TransitionSeries.Sequence durationInFrames={300}>
              <AIFeedbackScene />
            </TransitionSeries.Sequence>

            <TransitionSeries.Transition
              presentation={fade()}
              timing={linearTiming({ durationInFrames: 15 })}
            />

            {/* 5. Closing CTA — logo + tagline + URL */}
            <TransitionSeries.Sequence durationInFrames={90}>
              <ClosingCTA />
            </TransitionSeries.Sequence>

            <TransitionSeries.Transition
              presentation={fade()}
              timing={linearTiming({ durationInFrames: 15 })}
            />

            {/* 6. Powered By — "powered by" + Wonderful logo */}
            <TransitionSeries.Sequence durationInFrames={90}>
              <PoweredByScene />
            </TransitionSeries.Sequence>
          </TransitionSeries>

          {/* Background music with fade in/out */}
          <Audio src={staticFile("music.mp3")} volume={musicVolume} />

          {/*
           * Voice clips from real agent calls — separate audio channel.
           * Clip 4 at 210 (~7s, early in scenario creation)
           * Clip 2 at 420 (mid app-flow, during user assignment)
           * Clip 1 at 630 (call scene, during active call)
           * Clip 3 at 900 (end of call / start of feedback)
           */}
          <Sequence from={210} durationInFrames={300}>
            <Audio src={staticFile("voice-clip-4.mp3")} volume={0.8} />
          </Sequence>
          <Sequence from={420} durationInFrames={300}>
            <Audio src={staticFile("voice-clip-2.mp3")} volume={0.8} />
          </Sequence>
          <Sequence from={630} durationInFrames={300}>
            <Audio src={staticFile("voice-clip-1.mp3")} volume={1.0} />
          </Sequence>
          <Sequence from={900} durationInFrames={300}>
            <Audio src={staticFile("voice-clip-3.mp3")} volume={0.8} />
          </Sequence>
        </AbsoluteFill>
      </App>
    </ConfigProvider>
  );
};
