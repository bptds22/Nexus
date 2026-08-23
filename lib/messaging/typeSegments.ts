/* ═══════════════════════════════════════════════════════════════
   typeSegments — TYPE-DRIVEN segmented filter for the messaging
   inboxes. Segments are DERIVED from the distinct conversation_types
   actually present in the loaded threads, so a future type auto-
   appears with ZERO rework :
     • Coach : "Parents" appears the moment a PARENT_COACH thread
       exists (P2-ready).
     • Athlete : "Recruteurs" appears the moment a RECRUTEUR_ATHLETE
       thread exists (P3-ready).

   Framework-agnostic (no JSX) — consumed by both the web pages and
   the mobile FilterSheet wrappers.
═══════════════════════════════════════════════════════════════ */

export type MessagingViewer = "coach" | "athlete";

export interface TypeSegment {
  /** Stable filter value (also the URL/param key). */
  value: string;
  label: string;
  /** conversation_types this segment includes. */
  types: string[];
}

/* Ordered candidate segments per viewer. A segment is emitted only if
   at least one of its conversation_types is present. The viewer angle
   changes the label : ATHLETE_COACH reads "Athlètes" to a coach but
   "Mes coachs" to an athlete. */
const COACH_ORDER: { value: string; label: string; type: string }[] = [
  { value: "recruteur", label: "Recruteurs", type: "RECRUTEUR_COACH" },
  { value: "athlete", label: "Athlètes", type: "ATHLETE_COACH" },
  // Coach↔coach same-school (P4) : "Coachs" appears the moment a
  // COACH_COACH thread exists (directors included — no separate type).
  { value: "coach", label: "Coachs", type: "COACH_COACH" },
  { value: "parent", label: "Parents", type: "PARENT_COACH" },
  // Messagerie de service (ADMIN_USER). En DERNIER délibérément : c'est un
  // fil qu'on consulte, pas un fil qu'on travaille — il ne doit pas pousser
  // « Athlètes » ou « Recruteurs » d'un cran vers la droite.
  { value: "nexus", label: "Nexus", type: "ADMIN_USER" },
];

const ATHLETE_ORDER: { value: string; label: string; type: string }[] = [
  { value: "coach", label: "Mes coachs", type: "ATHLETE_COACH" },
  { value: "recruteur", label: "Recruteurs", type: "RECRUTEUR_ATHLETE" },
  { value: "nexus", label: "Nexus", type: "ADMIN_USER" },
];

export function deriveTypeSegments(
  presentTypes: Iterable<string>,
  viewer: MessagingViewer,
): TypeSegment[] {
  const present = new Set(presentTypes);
  const order = viewer === "coach" ? COACH_ORDER : ATHLETE_ORDER;
  const segments: TypeSegment[] = [{ value: "all", label: "Tous", types: [] }];
  for (const o of order) {
    if (present.has(o.type)) segments.push({ value: o.value, label: o.label, types: [o.type] });
  }
  return segments;
}

/* True if a thread of `convType` passes the currently-selected segment
   `value`. "all" (or an unknown/stale value) passes everything. */
export function matchesTypeSegment(
  segments: TypeSegment[],
  value: string,
  convType: string,
): boolean {
  if (value === "all") return true;
  const seg = segments.find((s) => s.value === value);
  if (!seg) return true;
  return seg.types.includes(convType);
}
