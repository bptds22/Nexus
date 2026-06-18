"use client";

/* ═══════════════════════════════════════════════════════════════
   TeamDetailsBlock — small "Équipes" list slotted at the bottom of
   the Sportif section across the recruiter-facing athlete profiles.

   Surfaces : AthleteRecruiterProfileBodyMobile (coach + recruiter
   mobile) and AthleteRecruiterProfileBody (recruiter + partner web).
   Replaces the previous civil-only team display block — this
   generalized block carries the team detail for BOTH école AND
   civil athletes, with the civil discriminator becoming a small
   "Ligue civile" badge instead of a separate code path.

   Design intent : SUBDUED. This is buried FYI at the bottom of
   Sportif, not a hero. Muted card, smaller text, compact spacing.

   Multi-team : list ALL active teams sorted by season desc then
   name asc. Most athletes have 1 ; multi-team athletes (sport
   secondaire + primary, or roster turnover mid-season) get a short
   stack. No "primary team" pick — derived faithfully from the
   team_athletes → teams join.

   Empty state : when teams is [], renders a one-line "Aucune équipe
   rattachée" so the section communicates the absence rather than
   silently collapsing.
═══════════════════════════════════════════════════════════════ */

export interface TeamDetail {
  id: string;
  name: string;
  /** teams.sport_id → sports.nom — the team's sport (NOT the athlete's
   *  primary sport ; an athlete with primary basketball can be on a
   *  soccer team — team sport is per-row, never derived from athlete). */
  sportName: string;
  league: string | null;
  ageGroup: string | null;
  division: string | null;
  gender: string | null;
  season: string | null;
  isActive: boolean;
  /** True when teams.schools!school_id.type === 'LIGUE_CIVILE'. Drives
   *  the "Ligue civile" badge + the clubName display. */
  isCivil: boolean;
  /** For civil teams : the LIGUE_CIVILE schools.name — i.e. the parent
   *  club. Empty/null for école teams. */
  clubName: string | null;
}

export interface TeamDetailsBlockProps {
  teams: TeamDetail[];
}

function sortTeams(teams: TeamDetail[]): TeamDetail[] {
  return [...teams]
    .filter((t) => t.isActive)
    .sort((a, b) => {
      const sA = a.season ?? "";
      const sB = b.season ?? "";
      if (sA !== sB) return sB.localeCompare(sA); // season desc (2026-2027 > 2025-2026)
      return a.name.localeCompare(b.name);
    });
}

/* Joined sub-line : "{sport} · {age} · {division} · {league}". Empty
   parts dropped. Same idiom as the team cards on the coach roster +
   the picker sheets. */
function teamSubLine(t: TeamDetail): string {
  return [t.sportName, t.ageGroup, t.division, t.league]
    .map((v) => (v ?? "").trim())
    .filter((v) => v.length > 0)
    .join(" · ");
}

export function TeamDetailsBlock({ teams }: TeamDetailsBlockProps) {
  const sorted = sortTeams(teams);

  return (
    <div className="mt-4 pt-4 border-t border-white/[0.06]">
      <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-2">
        Équipes
      </p>
      {sorted.length === 0 ? (
        <p className="text-[12px] text-[#6b7280] italic">Aucune équipe rattachée</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((t) => {
            const sub = teamSubLine(t);
            return (
              <li
                key={t.id}
                className="bg-[#111317] border border-white/[0.06] rounded-xl px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-white truncate">{t.name}</p>
                  {t.isCivil && (
                    <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-[#E63946]/15 border border-[#E63946]/30 text-[#E63946] shrink-0">
                      Ligue civile
                    </span>
                  )}
                </div>
                {sub && (
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5 truncate">{sub}</p>
                )}
                {/* Civil : club name (the LIGUE_CIVILE schools row) +
                    season chip. École : just season chip. */}
                <div className="flex items-center gap-2 mt-1">
                  {t.isCivil && t.clubName && (
                    <span className="text-[10px] text-[#6b7280] truncate">{t.clubName}</span>
                  )}
                  {t.season && (
                    <span className="text-[9px] font-bold tracking-wider uppercase text-[#6b7280] ml-auto">
                      {t.season}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
