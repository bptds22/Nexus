import { Composition } from "remotion";
import { NexusPromo } from "./NexusPromo";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="NexusPromo"
      component={NexusPromo}
      durationInFrames={850}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
