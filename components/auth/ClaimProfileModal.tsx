"use client";

/* ─────────────────────────────────────────────────────────────────
   ClaimProfileModal — Phase 2

   Surfaced at athlete onboarding mount when a coach-created orphan
   row matches the freshly-authenticated email. The athlete sees the
   coach's pre-filled context (name, sport, school) and decides:
   - "Oui, je le réclame" → wizard pre-fills + downstream save UPDATEs
     the orphan row instead of INSERTing a duplicate.
   - "Non, créer un nouveau profil" → wizard proceeds normal INSERT
     path; the orphan stays untouched (coach can still claim it back
     manually via the existing flow).

   The modal does no DB writes itself — claim/skip just dispatch
   callbacks. All RLS happens via the parent wizard's UPDATE.
───────────────────────────────────────────────────────────────── */

export interface OrphanProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  sport_name: string | null;
  school_name: string | null;
  coach_name: string | null;
}

interface Props {
  orphan: OrphanProfile;
  onClaim: () => void;
  onSkip: () => void;
}

export default function ClaimProfileModal({ orphan, onClaim, onSkip }: Props) {
  const fullName = `${orphan.first_name ?? ""} ${orphan.last_name ?? ""}`.trim() || "ce profil";
  const facts: string[] = [];
  if (orphan.sport_name) facts.push(orphan.sport_name);
  if (orphan.school_name) facts.push(orphan.school_name);
  if (orphan.coach_name) facts.push(`coach ${orphan.coach_name}`);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#E63946]/15 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
              <path d="M20 8v6M23 11h-6" />
            </svg>
          </div>
          <div>
            <h2 className="font-head text-lg font-black text-white uppercase tracking-tight">
              On a trouvé un profil pour toi
            </h2>
            <p className="text-[12px] text-[#6b7280] mt-1">Créé par ton coach avant ton inscription.</p>
          </div>
        </div>

        <div className="bg-[#111317] border border-[#2D3748] rounded-lg p-4 mb-4">
          <p className="text-[14px] font-bold text-white">{fullName}</p>
          {facts.length > 0 && (
            <p className="text-[12px] text-[#9CA3AF] mt-1">{facts.join(" · ")}</p>
          )}
        </div>

        <p className="text-[13px] text-[#9CA3AF] mb-2">
          Si tu le réclames, ton inscription part avec ces infos déjà remplies. Tu pourras tout modifier dans le wizard.
        </p>
        <p className="text-[12px] text-[#6b7280] mb-5">
          Sinon, on crée un nouveau profil et le profil coach reste à part — tu pourras en parler avec ton coach plus tard.
        </p>

        <div className="flex flex-col-reverse sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onSkip}
            className="flex-1 h-11 rounded-lg border border-white/10 text-[13px] font-bold text-[#9CA3AF] hover:text-white hover:border-white/20 transition-colors"
          >
            Non, créer un nouveau profil
          </button>
          <button
            type="button"
            onClick={onClaim}
            className="flex-1 h-11 rounded-lg bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors"
          >
            Oui, je le réclame
          </button>
        </div>
      </div>
    </div>
  );
}
