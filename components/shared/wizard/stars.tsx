/* ═══════════════════════════════════════════════════════════════
   StarRow — 5-star clickable rating input for wizard-style mobile
   surfaces.

   Lifted VERBATIM from AthleteWizardMobile.tsx :2184-2250 (the
   coach wizard's local copy) so the athlete edit wizard's Évaluation
   step can consume the same primitive without forking visuals.

   Self-contained — no wizard state captures, no context. Tap
   behavior :
     - allowHalf=false (default) : tap a star → toggle that integer
       value (tapping the current value clears to 0).
     - allowHalf=true : the tap's x-offset within the star decides
       half vs whole (left half → .5, right half → integer). Tapping
       the current value clears to 0.

   Colors are canon : gold #F59E0B fill / gray #374151 empty. The
   active:scale-90 micro-interaction matches the rest of the kit.

   Sized by the `size` prop in pixels — 20 for trait rows, 28 for the
   flat-cote star input, 32 for the standalone simple-mode star input.
═══════════════════════════════════════════════════════════════ */

export function StarRow({
  value, onChange, size = 26, allowHalf = false,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
  /** If true, tapping the LEFT half of a star sets the .5 value
   *  (e.g. tapping the left half of the 4th star sets 3.5). */
  allowHalf?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_, i) => {
        const starIndex = i + 1;
        const filled = value >= starIndex;
        const half = !filled && value >= starIndex - 0.5;
        const clipId = `nx-halfstar-${i}-${size}`;
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              if (allowHalf) {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const next = x < rect.width / 2 ? starIndex - 0.5 : starIndex;
                onChange(value === next ? 0 : next);
              } else {
                onChange(value === starIndex ? 0 : starIndex);
              }
            }}
            className="active:scale-90 transition-transform relative"
            style={{ width: size, height: size }}
            aria-label={`${starIndex} étoile${starIndex > 1 ? "s" : ""}`}
          >
            {/* Empty background */}
            <svg className="absolute inset-0" width={size} height={size} viewBox="0 0 24 24"
              fill="#374151" stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {filled && (
              <svg className="absolute inset-0" width={size} height={size} viewBox="0 0 24 24"
                fill="#F59E0B" stroke="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            )}
            {half && (
              <svg className="absolute inset-0" width={size} height={size} viewBox="0 0 24 24"
                fill="none" stroke="none">
                <defs>
                  <clipPath id={clipId}>
                    <rect x="0" y="0" width="12" height="24" />
                  </clipPath>
                </defs>
                <polygon
                  points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                  fill="#F59E0B"
                  clipPath={`url(#${clipId})`}
                />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}
