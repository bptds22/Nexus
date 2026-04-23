/* ═══════════════════════════════════════════════════════════════
   Editorial texture system — barrel exports.

   Tree-shakeable: each component is its own file and is re-exported
   here as a default. Import as:
     import { GrainOverlay, TapeMark, ScribbleUnderline } from "@/components/editorial";
═══════════════════════════════════════════════════════════════ */

export { default as GrainOverlay } from "./GrainOverlay";
export { default as TapeMark } from "./TapeMark";
export { default as ScribbleUnderline } from "./ScribbleUnderline";
export { default as ScribbleCircle } from "./ScribbleCircle";
export { default as ScribbleArrow } from "./ScribbleArrow";
