import { CSSProperties } from "react";

export const colors = {
  black: "#000000",
  darkBg: "#0a0a0a",
  white: "#ffffff",
  dimWhite: "rgba(255, 255, 255, 0.6)",
  accent: "#c8ff00", // electric yellow-green — Nexus brand energy
  warmGlow: "rgba(255, 180, 50, 0.15)",
  streetlight: "rgba(255, 220, 140, 0.9)",
};

export const fonts = {
  heading: "Inter, Helvetica Neue, Arial, sans-serif",
  body: "Inter, Helvetica Neue, Arial, sans-serif",
};

export const fullScreen: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
};
