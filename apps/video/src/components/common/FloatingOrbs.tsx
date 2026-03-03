import { useCurrentFrame, interpolate } from "remotion";

export const FloatingOrbs: React.FC = () => {
  const frame = useCurrentFrame();

  const orbs = [
    { size: 600, x: 75, y: -10, color: "37,99,235", opacity: 0.15, speed: 0.008 },
    { size: 400, x: -5, y: 85, color: "124,58,237", opacity: 0.1, speed: 0.005 },
    { size: 300, x: 10, y: 40, color: "96,165,250", opacity: 0.08, speed: 0.012 },
    { size: 200, x: 60, y: 60, color: "1,18,170", opacity: 0.06, speed: 0.015 },
  ];

  return (
    <>
      {orbs.map((orb, i) => {
        const drift = Math.sin(frame * orb.speed + i * 1.5) * 30;
        const driftY = Math.cos(frame * orb.speed * 0.7 + i) * 20;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              width: orb.size,
              height: orb.size,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(${orb.color},${orb.opacity}) 0%, transparent 70%)`,
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              transform: `translate(${drift}px, ${driftY}px)`,
              pointerEvents: "none",
            }}
          />
        );
      })}
    </>
  );
};
