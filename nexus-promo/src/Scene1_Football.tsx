import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  Sequence,
} from "remotion";
import { VideoClip, Vignette } from "./VideoClip";
import { TextReveal } from "./TextReveal";
import { colors } from "./styles";

/**
 * ACT 1 — L'ombre (The Shadow)
 * Slow, dark, isolated. One athlete alone at night.
 *
 * Clips:
 *  - flag-football-night.mp4 (AI hero shot — the multi-shot night scene)
 *  - silhouette-stretch.mp4 (woman stretching in silhouette)
 *  - runner-start.mp4 (female runner crouched at start position)
 */
export const Scene1_Football: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Fade in from black
  const fadeIn = interpolate(frame, [0, 35], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Fade out to black
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 25, durationInFrames],
    [1, 0],
    { extrapolateRight: "clamp" }
  );

  // Cross-fade timings between clips
  const clip2Opacity = interpolate(frame, [120, 150], [0, 1], {
    extrapolateRight: "clamp",
  });
  const clip3Opacity = interpolate(frame, [210, 240], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ backgroundColor: colors.black, opacity: fadeIn * fadeOut }}
    >
      {/* Base layer: AI flag football at night — the hero shot */}
      <VideoClip
        src="flag-football-night.mp4"
        brightness={0.4}
        saturation={0.25}
        contrast={1.3}
        zoom={[1, 1.1]}
      />

      {/* Cross-fade to silhouette stretching */}
      <VideoClip
        src="silhouette-stretch.mp4"
        brightness={0.5}
        saturation={0.15}
        contrast={1.4}
        zoom={[1.02, 1.08]}
        opacity={clip2Opacity}
      />

      {/* Cross-fade to runner at start blocks */}
      <VideoClip
        src="runner-start.mp4"
        brightness={0.3}
        saturation={0.2}
        contrast={1.3}
        zoom={[1, 1.05]}
        opacity={clip3Opacity}
      />

      <Vignette intensity={0.75} />

      {/* Text overlays */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 35,
        }}
      >
        <TextReveal
          lines={["Elle court depuis", "des heures."]}
          startFrame={30}
          style="main"
        />
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "12%",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <TextReveal
          lines={["Personne n'a rien vu."]}
          startFrame={140}
          style="subtle"
        />
      </div>
    </AbsoluteFill>
  );
};
