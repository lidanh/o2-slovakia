import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";

/**
 * "Powered by Wonderful" closing badge.
 * Uses the actual background.png as the background for pixel-perfect match.
 */
export const PoweredByScene: React.FC = () => {
  const frame = useCurrentFrame();
  const fps = 30;

  // "powered by" text fades + slides up
  const textSpring = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80, mass: 0.6 },
  });
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
  const textSlide = interpolate(textSpring, [0, 1], [20, 0]);

  // Logo scales in slightly after text
  const logoSpring = spring({
    frame: frame - 8,
    fps,
    config: { damping: 10, stiffness: 70, mass: 0.5 },
  });
  const logoScale = interpolate(logoSpring, [0, 1], [0.85, 1]);
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1]);

  // Subtle background zoom for motion
  const bgZoom = interpolate(frame, [0, 90], [1, 1.04], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Actual background.png for pixel-perfect gradient */}
      <Img
        src={staticFile("background.png")}
        style={{
          position: "absolute",
          inset: -20,
          width: "calc(100% + 40px)",
          height: "calc(100% + 40px)",
          objectFit: "cover",
          transform: `scale(${bgZoom})`,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
          zIndex: 1,
        }}
      >
        {/* "powered by" text */}
        <div
          style={{
            fontSize: 24,
            fontWeight: 500,
            color: "#9993AD",
            letterSpacing: "3px",
            textTransform: "uppercase",
            fontFamily:
              '"Open Sans", -apple-system, BlinkMacSystemFont, sans-serif',
            opacity: textOpacity,
            transform: `translateY(${textSlide}px)`,
          }}
        >
          powered by
        </div>

        {/* Wonderful logo — large and centered */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
          }}
        >
          <Img
            src={staticFile("Wonderful-logo.png")}
            style={{
              height: 140,
              objectFit: "contain",
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
