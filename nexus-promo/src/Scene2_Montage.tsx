import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  Sequence,
  Video,
  staticFile,
} from "remotion";
import { Vignette } from "./VideoClip";
import { TextReveal } from "./TextReveal";
import { colors } from "./styles";

/**
 * ACT 2 — Le grind
 * Fast-cut montage across multiple sports. Nike "work in the dark" energy.
 * Each clip shows ~45-60 frames (1.5-2s) with hard cuts.
 *
 * Order designed for visual rhythm:
 *  1. Basketball dribbling (low, rhythmic)
 *  2. Football training jumps (explosive)
 *  3. QB pass close-up (precision)
 *  4. Soccer goal (release)
 *  5. Tennis match (speed)
 *  6. Push-ups (grind)
 *  7. Basketball dunk (climax)
 *  8. Football portrait (face reveal — breath)
 *  9. Warm-up exercises (continuation)
 */

type MontageClip = {
  src: string;
  duration: number;
  startFrom: number;
  brightness: number;
  saturation: number;
  zoom: [number, number];
};

const clips: MontageClip[] = [
  { src: "basketball-dribble.mp4", duration: 50, startFrom: 30, brightness: 0.35, saturation: 0.25, zoom: [1, 1.08] },
  { src: "football-jumps.mp4", duration: 40, startFrom: 15, brightness: 0.3, saturation: 0.2, zoom: [1.05, 1.12] },
  { src: "qb-pass.mp4", duration: 35, startFrom: 0, brightness: 0.4, saturation: 0.3, zoom: [1, 1.06] },
  { src: "soccer-goal.mp4", duration: 45, startFrom: 20, brightness: 0.35, saturation: 0.25, zoom: [1, 1.1] },
  { src: "tennis-match.mp4", duration: 40, startFrom: 60, brightness: 0.3, saturation: 0.2, zoom: [1.02, 1.08] },
  { src: "pushups.mp4", duration: 35, startFrom: 10, brightness: 0.35, saturation: 0.15, zoom: [1, 1.05] },
  { src: "basketball-dunk.mp4", duration: 50, startFrom: 10, brightness: 0.4, saturation: 0.3, zoom: [1, 1.15] },
  { src: "football-portrait.mp4", duration: 45, startFrom: 0, brightness: 0.45, saturation: 0.35, zoom: [1, 1.04] },
  { src: "warmup.mp4", duration: 40, startFrom: 40, brightness: 0.3, saturation: 0.2, zoom: [1.02, 1.08] },
];

const FlashCut: React.FC = () => {
  const frame = useCurrentFrame();
  const flash = interpolate(frame, [0, 3], [0.8, 0], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{ backgroundColor: `rgba(255, 255, 255, ${flash})` }}
    />
  );
};

export const Scene2_Montage: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Fade in
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Fade out
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateRight: "clamp" }
  );

  // Calculate running offset for each clip
  let offset = 0;

  return (
    <AbsoluteFill
      style={{ backgroundColor: colors.black, opacity: fadeIn * fadeOut }}
    >
      {clips.map((clip, i) => {
        const from = offset;
        offset += clip.duration;

        const clipZoom = clip.zoom;
        return (
          <Sequence key={i} from={from} durationInFrames={clip.duration}>
            <MontageClipView clip={clip} />
            <Vignette intensity={0.6} />
            {/* Flash on hard cut */}
            {i > 0 && <FlashCut />}
          </Sequence>
        );
      })}

      {/* Text — drops in across the montage */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <TextReveal
          lines={["Pas de coéquipiers."]}
          startFrame={10}
          style="main"
        />
        <TextReveal
          lines={["Pas de coach."]}
          startFrame={80}
          style="main"
        />
        <TextReveal
          lines={["Personne dans les gradins."]}
          startFrame={160}
          style="main"
        />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "10%",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <TextReveal lines={["Seul."]} startFrame={260} style="subtle" />
      </div>
    </AbsoluteFill>
  );
};

const MontageClipView: React.FC<{ clip: MontageClip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = interpolate(
    frame,
    [0, durationInFrames],
    clip.zoom,
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        filter: `brightness(${clip.brightness}) contrast(1.2) saturate(${clip.saturation})`,
      }}
    >
      <Video
        src={staticFile(clip.src)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        startFrom={clip.startFrom}
        volume={0}
      />
    </AbsoluteFill>
  );
};
