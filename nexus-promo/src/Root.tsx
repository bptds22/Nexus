import { Composition } from "remotion";
import { NexusPromo, nexusSchema } from "./NexusPromo";
import { getAudioDuration } from "@remotion/media-utils";
import { staticFile } from "remotion";

const FPS = 30;
const ENDCARD_FRAMES = 150; // 5s end card
const BEAT_FRAMES = 15; // 0.5s black beat before end card

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="NexusPromo"
      component={NexusPromo}
      schema={nexusSchema}
      defaultProps={{}}
      fps={FPS}
      width={1920}
      height={1080}
      calculateMetadata={async () => {
        const audioDuration = await getAudioDuration(
          staticFile("voiceover.mp3")
        );
        const audioFrames = Math.ceil(audioDuration * FPS);
        return {
          durationInFrames: audioFrames + BEAT_FRAMES + ENDCARD_FRAMES,
        };
      }}
    />
  );
};
