import { AbsoluteFill, interpolate, spring, useCurrentFrame } from "remotion";
import { FakeSidebar } from "./FakeSidebar";

interface AppShellProps {
  activeKey?: string;
  title?: string;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeKey,
  title,
  children,
}) => {
  const frame = useCurrentFrame();

  // Subtle slow zoom for cinematic feel
  const zoom = interpolate(frame, [0, 600], [1, 1.04], {
    extrapolateRight: "clamp",
  });

  // Content slides in from right on entry
  const contentSlide = spring({
    frame,
    fps: 30,
    config: { damping: 15, stiffness: 60, mass: 0.8 },
  });
  const slideX = interpolate(contentSlide, [0, 1], [40, 0]);
  const contentOpacity = interpolate(contentSlide, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          width: "100%",
          height: "100%",
          transform: `scale(${zoom})`,
          transformOrigin: "60% 40%",
        }}
      >
        <FakeSidebar activeKey={activeKey} />
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header bar */}
          <div
            style={{
              height: 64,
              background: "#FFFFFF",
              borderBottom: "1px solid #E5E7EB",
              display: "flex",
              alignItems: "center",
              padding: "0 32px",
              fontSize: 20,
              fontWeight: 600,
              color: "#1a1a2e",
              fontFamily:
                '"Open Sans", -apple-system, BlinkMacSystemFont, sans-serif',
            }}
          >
            {title}
          </div>
          {/* Content with slide-in */}
          <div
            style={{
              flex: 1,
              background: "#F7F8FA",
              padding: 32,
              overflow: "hidden",
              transform: `translateX(${slideX}px)`,
              opacity: contentOpacity,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
