import Link from "next/link";
import type { RecruiterKpiData } from "../../_data/mockDashboardData";
import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";
import { getStatusConfig } from "@/lib/config/recruitmentStatuses";
import { StatusIcon } from "../../_components/RecruitmentStatusBadge";

/* ─────────────────────────────────────────────────────────────────
   Zone 2 — deux composants, deux zones (option A de BP, 2026-09-23)

   · EntonnoirProcessus — « Mon processus de recrutement », sur fond rouge
     léger, bordure rouge, barre rouge à gauche. Même grammaire que le bloc
     « Parcours d'équipes » de la fiche : c'est LE bloc principal.
   · IndicateursMessagerie — messages, réponses, conversion. Cartes grises
     neutres, rangées par la page sous « Mon activité » avec les 4 tuiles.

   Avant, les deux vivaient dans une seule carte grise, et l'entonnoir se
   confondait avec tout ce qui l'entourait.
───────────────────────────────────────────────────────────────── */

const PIPELINE_STATUSES: RecruitmentStatus[] = [
  "identifie", "contacte", "en_discussion", "visite_planifiee", "engage", "lettre_signee",
];

export function EntonnoirProcessus({ pipelineCounts }: { pipelineCounts?: Record<string, number> }) {
  const counts = (pipelineCounts || {}) as Record<RecruitmentStatus, number>;
  const totalActive = PIPELINE_STATUSES.reduce((s, k) => s + (counts[k] || 0), 0);

  return (
      /* Fond #E63946 à 4 %, bordure à 25 %, barre de 4 px à gauche (ombre
         interne : elle suit l'arrondi sans élément de plus). */
      <section className="rounded-xl border border-[#E63946]/25 bg-[#E63946]/[0.04] shadow-[inset_4px_0_0_#E63946] p-5 pl-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-head font-bold text-[15px] tracking-[0.15em] uppercase text-white">Mon processus de recrutement</h2>
          <Link href="/recruteur/pipeline" className="text-[12px] font-bold text-[#E63946] hover:text-[#60A5FA] transition-colors flex items-center gap-1">
            Voir tout
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Status cards row */}
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {PIPELINE_STATUSES.map((status, i) => {
            const cfg = getStatusConfig(status);
            const count = counts[status] || 0;
            const isCommitment = cfg.phase === "commitment";
            const isActive = count > 0;

            // Couleurs — relevées le 2026-09-23 (retour BP : « trop pâle, peu
            // lisible » depuis que le bloc est sur fond rouge léger). Le
            // principe ne change pas : les étapes d'engagement restent
            // rouges, les étapes automatiques grises, et une étape VIDE reste
            // en retrait d'une pleine — mais un retrait LISIBLE, plus un
            // effacement. Aucun niveau ne descend sous 70 % d'opacité.
            // - Commitment stages (en_discussion, visite, engage, lettre_signee): rouge
            // - Auto stages (identifie, contacte): blanc cassé actif, gris clair vide
            const iconColor = isCommitment
              ? (isActive ? "#E63946" : "rgba(230,57,70,0.75)")
              : (isActive ? "#FFFFFF" : "#9CA3AF");
            const numberColor = iconColor;
            const labelColor = isCommitment
              ? (isActive ? "#F87171" : "rgba(248,113,113,0.8)")
              : (isActive ? "#D1D5DB" : "#9CA3AF");
            const borderColor = isCommitment
              ? (isActive ? "rgba(230,57,70,0.5)" : "rgba(230,57,70,0.3)")
              : (isActive ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)");
            const background = isCommitment
              ? (isActive ? "rgba(230,57,70,0.12)" : "rgba(17,19,23,0.35)")
              : (isActive ? "rgba(255,255,255,0.06)" : "rgba(17,19,23,0.35)");

            return (
              /* Plus un lien : `?stage=` n'était lu par aucune page (web ni
                 mobile) et ouvrait le kanban non filtré. Retiré (décision BP
                 2026-09-23) plutôt que de faire lire un paramètre de plus. */
              <div
                key={status}
                className="relative rounded-lg border p-3 text-center"
                style={{ borderColor, background }}
              >
                {/* Connector arrow between cards (hidden on first) */}
                {i > 0 && (
                  <div className="hidden lg:block absolute -left-2 top-1/2 -translate-y-1/2 text-[#2D3748]">
                    <svg width="7" height="10" viewBox="0 0 7 10" fill="none">
                      <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                <div className="flex justify-center mb-2">
                  <StatusIcon icon={cfg.icon} color={iconColor} size={16} />
                </div>
                <p className="text-[26px] font-head font-black leading-none" style={{ color: numberColor }}>
                  {count}
                </p>
                <p className="text-[11px] font-bold tracking-[0.15em] uppercase mt-1" style={{ color: labelColor }}>
                  {cfg.shortLabel}
                </p>
              </div>
            );
          })}
        </div>

        {/* Total + retired */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#E63946]/20">
          <span className="text-[13px] text-[#D1D5DB]">
            <span className="font-bold text-white">{totalActive}</span> athlète{totalActive !== 1 ? "s" : ""} actif{totalActive !== 1 ? "s" : ""} dans ton processus
            <span className="text-[11px] text-[#9CA3AF] ml-2">· 50 max en gratuit</span>
          </span>
          {counts.retire > 0 && (
            <span className="text-[13px] text-[#D1D5DB]">
              {counts.retire} retiré{counts.retire !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </section>
  );
}

export function IndicateursMessagerie({ data, pipelineCounts }: { data: RecruiterKpiData; pipelineCounts?: Record<string, number> }) {
  const counts = (pipelineCounts || {}) as Record<RecruitmentStatus, number>;
  // Le taux de conversion rapporte les engagés au total ACTIF de l'entonnoir.
  const totalActive = PIPELINE_STATUSES.reduce((s, k) => s + (counts[k] || 0), 0);
  return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="group bg-[#1A1D24] rounded-xl border border-[#2D3748] hover:border-[#E63946]/20 px-5 py-4 flex items-center gap-4 relative overflow-hidden transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          <div className="w-10 h-10 rounded-full bg-[#E63946]/15 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <div>
            <p className="text-[26px] font-head font-black text-white leading-none">{data.messagesSent}</p>
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-0.5">Messages envoyés</p>
          </div>
        </div>

        <div className="group bg-[#1A1D24] rounded-xl border border-[#2D3748] hover:border-[#E63946]/20 px-5 py-4 flex items-center gap-4 relative overflow-hidden transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
          <div className="w-10 h-10 rounded-full bg-[#22C55E]/15 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 17 4 12 9 7" />
              <path d="M20 18v-2a4 4 0 00-4-4H4" />
            </svg>
          </div>
          <div>
            <p className="text-[26px] font-head font-black text-white leading-none">{data.responsesReceived}</p>
            <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-0.5">Réponses reçues</p>
          </div>
        </div>

        {(() => {
          // Conversion: contacted (all who passed contacte) vs committed (engage + lettre_signee)
          const total = totalActive;
          const committed = (counts.engage || 0) + (counts.lettre_signee || 0);
          const rate = total > 0 ? Math.round((committed / total) * 100) : 0;
          return (
            <div className="group bg-[#1A1D24] rounded-xl border border-[#2D3748] hover:border-[#E63946]/20 px-5 py-4 flex items-center gap-4 relative overflow-hidden transition-all duration-300">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#E63946] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
              <div className="w-10 h-10 rounded-full bg-[#E63946]/15 flex items-center justify-center shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                  <polyline points="16 7 22 7 22 13" />
                </svg>
              </div>
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-[26px] font-head font-black text-white leading-none">{rate}%</p>
                  <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mt-0.5">Taux de conversion</p>
                </div>
                {/* fraction hidden */}
              </div>
            </div>
          );
        })()}
      </div>
  );
}
