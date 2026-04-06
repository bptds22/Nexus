import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { colors, fonts } from "./styles";

type Props = {
  lines: string[];
  startFrame?: number;
  style?: "main" | "subtle" | "impact";
};

export const TextReveal: React.FC<Props> = ({
  lines,
  startFrame = 0,
  style = "main",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const relativeFrame = frame - startFrame;

  const styleMap = {
    main: {
      fontSize: 52,
      fontWeight: 300 as const,
      letterSpacing: "0.04em",
      color: colors.white,
      lineHeight: 1.5,
      textTransform: "uppercase" as const,
    },
    subtle: {
      fontSize: 28,
      fontWeight: 300 as const,
      letterSpacing: "0.12em",
      color: colors.dimWhite,
      lineHeight: 1.8,
      textTransform: "uppercase" as const,
    },
    impact: {
      fontSize: 80,
      fontWeight: 700 as const,
      letterSpacing: "0.02em",
      color: colors.accent,
      lineHeight: 1.3,
      textTransform: "uppercase" as const,
    },
  };

  const s = styleMap[style];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: fonts.heading,
      }}
    >
      {lines.map((line, i) => {
        const lineDelay = i * 12;
        const lineFrame = relativeFrame - lineDelay;

        const progress = spring({
          frame: Math.max(0, lineFrame),
          fps,
          config: { damping: 30, stiffness: 120 },
        });

        const opacity = interpolate(
          Math.max(0, lineFrame),
          [0, 15],
          [0, 1],
          { extrapolateRight: "clamp" }
        );

        const translateY = interpolate(progress, [0, 1], [40, 0]);

        return (
          <div
            key={i}
            style={{
              ...s,
              opacity,
              transform: `translateY(${translateY}px)`,
              textAlign: "center",
            }}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
};
