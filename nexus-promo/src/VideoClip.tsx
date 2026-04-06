import React from "react";
import {
  AbsoluteFill,
  Video,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

type Props = {
  src: string;
  startFrom?: number;
  brightness?: number;
  saturation?: number;
  contrast?: number;
  zoom?: [number, number]; // [start, end] scale
  opacity?: number;
};

export const VideoClip: React.FC<Props> = ({
  src,
  startFrom = 0,
  brightness = 0.35,
  saturation = 0.3,
  contrast = 1.2,
  zoom = [1, 1.06],
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = interpolate(frame, [0, durationInFrames], zoom, {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${scale})`,
        filter: `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`,
      }}
    >
      <Video
        src={staticFile(src)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        startFrom={startFrom}
        volume={0}
      />
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ intensity?: number }> = ({
  intensity = 0.7,
}) => (
  <AbsoluteFill
    style={{
      background: `
        radial-gradient(ellipse 65% 65% at 50% 50%, transparent 20%, rgba(0,0,0,${intensity}) 100%),
        linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.4) 100%)
      `,
    }}
  />
);
