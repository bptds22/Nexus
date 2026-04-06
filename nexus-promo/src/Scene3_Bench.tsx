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
 * ACT 3 — Le tournant (The Turning Point)
 * Starts in isolation, ends with the first hint of change.
 *
 * Clips:
 *  - bench-multishot.mp4 (AI — athlete sitting alone at night, multi-angle)
 *  - bench-simple.mp4 (AI — simpler bench shot)
 *  - silhouette-water.mp4 (man drinking water in silhouette — exhaustion)
 *  - athlete-coach.mp4 (woman training WITH a coach — first connection)
 *  - cheerleaders.mp4 (team formation — community)
 */
export const Scene3_Bench: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Fade in
  const fadeIn = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Cross-fade layers
  const clip2Opacity = interpolate(frame, [90, 110], [0, 1], {
    extrapolateRight: "clamp",
  });
  const clip3Opacity = interpolate(frame, [160, 180], [0, 1], {
    extrapolateRight: "clamp",
  });
  const clip4Opacity = interpolate(frame, [230, 255], [0, 1], {
    extrapolateRight: "clamp",
  });
  const clip5Opacity = interpolate(frame, [290, 310], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Brightness shift — gradually getting brighter as hope arrives
  const baseBrightness = interpolate(frame, [0, durationInFrames], [0.3, 0.5], {
    extrapolateRight: "clamp",
  });

  // Final impact text reveal
  const impactReveal = interpolate(frame, [270, 300], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.black, opacity: fadeIn }}>
      {/* Layer 1: AI bench multi-shot — hero isolation shot */}
      <VideoClip
        src="bench-multishot.mp4"
        brightness={0.3}
        saturation={0.15}
        contrast={1.4}
        zoom={[1, 1.12]}
      />

      {/* Layer 2: AI bench simple — cross-fade, different angle */}
      <VideoClip
        src="bench-simple.mp4"
        brightness={0.35}
        saturation={0.2}
        contrast={1.3}
        zoom={[1.02, 1.08]}
        opacity={clip2Opacity}
      />

      {/* Layer 3: Man drinking water silhouette — exhaustion */}
      <VideoClip
        src="silhouette-water.mp4"
        brightness={0.35}
        saturation={0.1}
        contrast={1.3}
        zoom={[1, 1.06]}
        startFrom={30}
        opacity={clip3Opacity}
      />

      {/* Layer 4: Athlete with coach — the TURN. First time someone else appears */}
      <VideoClip
        src="athlete-coach.mp4"
        brightness={baseBrightness + 0.1}
        saturation={0.35}
        contrast={1.15}
        zoom={[1, 1.05]}
        startFrom={20}
        opacity={clip4Opacity}
      />

      {/* Layer 5: Cheerleaders team — community, belonging */}
      <VideoClip
        src="cheerleaders.mp4"
        brightness={baseBrightness + 0.15}
        saturation={0.4}
        contrast={1.1}
        zoom={[1, 1.04]}
        startFrom={10}
        opacity={clip5Opacity}
      />

      <Vignette intensity={0.65} />

      {/* Text: isolation */}
      <div
        style={{
          position: "absolute",
          top: "12%",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 25,
        }}
      >
        <TextReveal
          lines={["Aucun message.", "Aucun appel."]}
          startFrame={25}
          style="main"
        />
      </div>

      {/* Text: the turn — impact style */}
      <div
        style={{
          position: "absolute",
          bottom: "8%",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          opacity: impactReveal,
        }}
      >
        <TextReveal
          lines={[
            "Il ne sait pas encore que",
            "tout est sur le point de changer.",
          ]}
          startFrame={0}
          style="impact"
        />
      </div>
    </AbsoluteFill>
  );
};
