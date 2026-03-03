import { Composition } from "remotion";
import { Video } from "./Video";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="O2TrainerDemo"
      component={Video}
      durationInFrames={1335}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
