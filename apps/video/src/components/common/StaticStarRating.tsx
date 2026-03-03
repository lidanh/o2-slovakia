import { spring, useCurrentFrame } from "remotion";
import { StarFilled } from "@ant-design/icons";

interface StaticStarRatingProps {
  rating: number;
  startFrame?: number;
  fps?: number;
}

export const StaticStarRating: React.FC<StaticStarRatingProps> = ({
  rating,
  startFrame = 0,
  fps = 30,
}) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const delay = startFrame + i * 4;
        const scale = spring({
          frame: frame - delay,
          fps,
          config: { damping: 8, stiffness: 150, mass: 0.4 },
        });
        const isActive = i <= rating;

        return (
          <StarFilled
            key={i}
            style={{
              fontSize: 28,
              color: isActive ? "#FBBF24" : "#E5E7EB",
              transform: `scale(${isActive ? scale : 1})`,
              opacity: isActive ? scale : 0.5,
            }}
          />
        );
      })}
    </div>
  );
};
