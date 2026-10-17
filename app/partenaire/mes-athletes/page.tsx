"use client";

/* ═══════════════════════════════════════════════════════════════
   /partenaire/mes-athletes — « Mes athlètes » (W4d).

   Les athlètes que le partenaire a évalués ou badgés, tant qu'ils lui
   sont visibles (partenaire_mes_athletes) : un jeune qui retire sa
   visibilité partenaire disparaît d'ici ; rien n'est effacé pour autant.
   Actions, par les fonctions W2/W3/W3b existantes : voir la fiche,
   modifier l'évaluation (même fenêtre que la fiche), retirer un badge.
   Confirmations en deux temps, jamais de boîte native.

   Filtres (2026-10-16) : recherche (nom, école/club, position) et
   « Distinctions » à choix multiple, combinés — logique partagée dans
   lib/partenaires/filtresMesAthletes.ts (l'appli la réutilise telle quelle).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import EvaluerAthleteModal from "@/components/partenaire/EvaluerAthleteModal";
import { chargerMesAthletes, type BadgeMonAthlete, type MonAthlete } from "@/lib/partenaires/mesAthletes";
import {
  chargerContexteEvaluation,
  chargerEvaluationsPartenaires,
  type EvaluationPartenaire,
} from "@/lib/evaluations/partenaire";
import { iconeBadgeUrl, retirerBadgePartenaire, signalerBadgesPartenaire } from "@/lib/badges/partenaire";
import { badgeSvgPath } from "@/lib/config/badges";
import {
  basculerDistinction,
  elaguerDistinctions,
  filtrerMesAthletes,
  filtresActifs,
  optionsDistinctions,
  resumeDistinctions,
  toutesLesDistinctions,
  type OptionDistinction,
} from "@/lib/partenaires/filtresMesAthletes";

function dateCourte(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) : "—";
}
function messageErreur(e: unknown): string {
  return (e as { message?: string })?.message?.replace(/^NEXUS:\s*/, "") ?? "Action impossible.";
}

function Etoiles({ cote }: { cote: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Cote ${cote.toFixed(1)} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i <= Math.round(cote) ? "#F59E0B" : "#4a4d56"}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
      <span className="ml-1 text-[12px] text-[#9CA3AF]">{cote.toFixed(1)}</span>
    </span>
  );
}

function IconeBadge({ b }: { b: Pick<BadgeMonAthlete, "nexus" | "code" | "iconePath" | "libelle"> }) {
  const src = b.nexus ? (b.code ? badgeSvgPath(b.code) : null) : iconeBadgeUrl(createClient(), b.iconePath);
  // Badge PROPRE au partenaire ~40 % plus grand (28 → 40 px) ; badge Nexus inchangé (décision BP 2026-10-15).
  const taille = b.nexus ? "w-7 h-7" : "w-10 h-10";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${taille} object-contain shrink-0`} />
  ) : (
    <span className={`${taille} rounded-full border border-[#2D3748] flex items-center justify-center ${b.nexus ? "text-[11px]" : "text-[13px]"} font-bold text-[#9CA3AF] shrink-0`}>
      {(b.libelle ?? "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Le menu « Distinctions » : cases à cocher, « Tout » et « Aucun ». */
function MenuDistinctions({ options, choix, onChange }: {
  options: OptionDistinction[];
  choix: ReadonlySet<string>;
  onChange: (c: Set<string>) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const boite = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent) => { if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false); };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") setOuvert(false); };
    document.addEventListener("mousedown", fermer);
    document.addEventListener("keydown", echap);
    return () => { document.removeEventListener("mousedown", fermer); document.removeEventListener("keydown", echap); };
  }, [ouvert]);
  const actif = choix.size > 0;
  const propres = options.filter((o) => !o.nexus);
  const nexus = options.filter((o) => o.nexus);
  const groupe = (titre: string, liste: OptionDistinction[]) => liste.length > 0 && (
    <div className="py-1">
      <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280]">{titre}</p>
      {liste.map((o) => (
        <label key={o.cle} className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-white/5">
          <input type="checkbox" checked={choix.has(o.cle)} onChange={() => onChange(basculerDistinction(choix, o.cle))}
            className="accent-[#E63946] w-4 h-4 shrink-0" />
          <IconeBadge b={{ nexus: o.nexus, code: o.code, iconePath: o.iconePath, libelle: o.libelle }} />
          <span className="text-[13px] text-white flex-1 min-w-0 truncate">{o.libelle}</span>
          <span className="text-[11px] text-[#6b7280] shrink-0">{o.nbAthletes}</span>
        </label>
      ))}
    </div>
  );
  return (
    <div ref={boite} className="relative" data-filtre-distinctions>
      <button type="button" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert} disabled={options.length === 0}
        title={options.length === 0 ? "Aucun badge remis pour l’instant" : undefined}
        className={`h-10 px-3.5 rounded-lg border text-[13px] font-semibold flex items-center gap-2 disabled:opacity-50 ${actif ? "border-[#E63946] bg-[#E63946]/10 text-white" : "border-[#2D3748] bg-[#13151a] text-[#9CA3AF] hover:text-white"}`}>
        {resumeDistinctions(choix, options)}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {ouvert && (
        <div className="absolute z-30 mt-1.5 w-[300px] max-w-[calc(100vw-32px)] max-h-[360px] overflow-y-auto rounded-xl border border-[#2D3748] bg-[#1A1D24] shadow-2xl">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-[#2D3748] sticky top-0 bg-[#1A1D24]">
            <button type="button" onClick={() => onChange(toutesLesDistinctions(options))}
              className="px-2.5 py-1 text-[12px] font-bold text-white border border-[#2D3748] rounded-md hover:border-[#E63946]/60">Tout</button>
            <button type="button" onClick={() => onChange(new Set())}
              className="px-2.5 py-1 text-[12px] font-bold text-white border border-[#2D3748] rounded-md hover:border-[#E63946]/60">Aucun</button>
            <span className="ml-auto text-[11px] text-[#6b7280]">au moins un des badges cochés</span>
          </div>
          {groupe("Tes badges", propres)}
          {groupe("Badges Nexus remis", nexus)}
        </div>
      )}
    </div>
  );
}

export default function MesAthletesPartenairePage() {
  const [athletes, setAthletes] = useState<MonAthlete[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [avis, setAvis] = useState<{ ok: boolean; texte: string } | null>(null);
  const [retrait, setRetrait] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [edition, setEdition] = useState<{ athlete: MonAthlete; grilleId: string | null; existante: EvaluationPartenaire | null } | null>(null);
  const [texte, setTexte] = useState("");
  const [distinctions, setDistinctions] = useState<Set<string>>(new Set());

  const options = useMemo(() => optionsDistinctions(athletes), [athletes]);
  // Un badge retiré (ou un athlète sorti) ne laisse pas de case cochée fantôme.
  useEffect(() => {
    setDistinctions((c) => {
      const e = elaguerDistinctions(c, options);
      return e.size === c.size ? c : e;
    });
  }, [options]);
  const visibles = useMemo(() => filtrerMesAthletes(athletes, { texte, distinctions }), [athletes, texte, distinctions]);

  const notifier = (ok: boolean, texte: string) => {
    setAvis({ ok, texte });
    setTimeout(() => setAvis(null), 4000);
  };

  const charger = useCallback(async () => {
    try {
      setAthletes(await chargerMesAthletes(createClient()));
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { void charger(); }, [charger]);

  async function ouvrirEvaluation(a: MonAthlete) {
    setOccupe(`eval:${a.athleteId}`);
    try {
      const supabase = createClient();
      const [ctx, evals] = await Promise.all([
        chargerContexteEvaluation(supabase, a.athleteId),
        chargerEvaluationsPartenaires(supabase, a.athleteId),
      ]);
      if (!ctx.peutEvaluer) {
        notifier(false, "Ton organisation ne peut plus évaluer cet athlète (sport non permis).");
        return;
      }
      setEdition({ athlete: a, grilleId: ctx.grilleId, existante: evals.find((e) => e.estLaMienne) ?? null });
    } catch (e) {
      notifier(false, messageErreur(e));
    } finally {
      setOccupe(null);
    }
  }

  async function retirerBadge(a: MonAthlete, b: BadgeMonAthlete) {
    setOccupe(b.attributionId);
    try {
      await retirerBadgePartenaire(createClient(), b.attributionId);
      signalerBadgesPartenaire(a.athleteId);
      notifier(true, `Badge « ${b.libelle ?? ""} » retiré.`);
      setRetrait(null);
      await charger();
    } catch (e) {
      notifier(false, messageErreur(e));
    } finally {
      setOccupe(null);
    }
  }

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-5xl" data-page-mes-athletes>
      <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#6b7280]">Espace partenaire</p>
      <h1 className="font-head text-[26px] sm:text-[30px] font-black text-white uppercase tracking-tight">Mes athlètes</h1>
      <p className="text-[13px] text-[#9CA3AF] mt-1 max-w-xl">
        Les athlètes que tu as évalués ou à qui tu as remis un badge. Un athlète qui retire sa visibilité
        partenaire disparaît de cette liste ; ton évaluation et tes badges ne sont pas effacés pour autant.
      </p>

      {avis && (
        <div role="status" className={`mt-5 rounded-lg border px-4 py-3 text-[13px] ${avis.ok ? "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#86efac]" : "border-[#EF4444]/40 bg-[#EF4444]/10 text-[#fca5a5]"}`}>
          {avis.texte}
        </div>
      )}
      {erreur && <p className="mt-5 text-[13px] text-[#EF4444]">{erreur}</p>}

      {chargement ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : athletes.length === 0 ? (
        <div className="mt-8 rounded-xl border border-[#2D3748] bg-[#1A1D24] p-6">
          <p className="text-[14px] font-bold text-white">Aucun athlète pour l&apos;instant.</p>
          <p className="text-[13px] text-[#9CA3AF] mt-2">
            Évalue un athlète ou remets-lui un badge depuis sa fiche : il apparaîtra ici.
          </p>
        </div>
      ) : (
        <>
        <div className="mt-6 flex flex-wrap items-center gap-2" data-filtres-mes-athletes>
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
            <input type="search" value={texte} onChange={(e) => setTexte(e.target.value)}
              placeholder="Nom, école ou club, position"
              aria-label="Rechercher dans mes athlètes"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#2D3748] bg-[#13151a] text-white text-[16px] sm:text-[13px] placeholder:text-[#6b7280] focus:outline-none focus:border-[#E63946]/60" />
          </div>
          <MenuDistinctions options={options} choix={distinctions} onChange={setDistinctions} />
          {filtresActifs({ texte, distinctions }) && (
            <button type="button" onClick={() => { setTexte(""); setDistinctions(new Set()); }}
              className="h-10 px-3 text-[12px] font-bold text-[#9CA3AF] hover:text-white">
              Réinitialiser
            </button>
          )}
          <span className="ml-auto text-[12px] text-[#6b7280]" data-compte-mes-athletes>
            {visibles.length === athletes.length ? `${athletes.length} athlète${athletes.length > 1 ? "s" : ""}` : `${visibles.length} sur ${athletes.length}`}
          </span>
        </div>
        {visibles.length === 0 ? (
          <p className="mt-6 text-[13px] text-[#9CA3AF]">Aucun athlète ne correspond à ces filtres.</p>
        ) : (
        <ul className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibles.map((a) => (
            <li key={a.athleteId} className="rounded-xl border border-[#2D3748] bg-[#1A1D24] p-4 flex flex-col gap-3" data-mon-athlete={a.athleteId}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[16px] font-bold text-white">{`${a.prenom} ${a.nom}`.trim()}</p>
                  <p className="text-[12px] text-[#9CA3AF]">{[a.sport, a.poste, a.ecole].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <span className="text-[11px] text-[#6b7280] shrink-0">{dateCourte(a.derniereAction)}</span>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280]">Ton évaluation</p>
                {a.coteGlobale != null ? (
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <Etoiles cote={a.coteGlobale} />
                    <span className="text-[11px] text-[#6b7280]">le {dateCourte(a.evalueeLe)}</span>
                  </div>
                ) : (
                  <p className="mt-1 text-[12px] text-[#9CA3AF]">Pas encore évalué.</p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7280]">Tes badges</p>
                {a.badges.length === 0 ? (
                  <p className="mt-1 text-[12px] text-[#9CA3AF]">Aucun badge.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1.5">
                    {a.badges.map((b) => (
                      <li key={b.attributionId} className="flex items-center gap-2 flex-wrap">
                        <IconeBadge b={b} />
                        <span className="text-[13px] text-white">{b.libelle ?? "—"}</span>
                        {b.masque && <span className="text-[11px] text-[#F59E0B]">masqué par le coach</span>}
                        <span className="text-[11px] text-[#6b7280]">{dateCourte(b.le)}</span>
                        {retrait === b.attributionId ? (
                          <span className="flex items-center gap-1.5 ml-auto">
                            <button type="button" disabled={occupe === b.attributionId} onClick={() => void retirerBadge(a, b)}
                              className="px-2.5 py-1 bg-[#E63946] text-white text-[11px] font-bold rounded-md disabled:opacity-50">
                              Confirmer le retrait
                            </button>
                            <button type="button" onClick={() => setRetrait(null)} className="px-2 py-1 text-[11px] text-[#9CA3AF] hover:text-white">
                              Annuler
                            </button>
                          </span>
                        ) : (
                          <button type="button" onClick={() => setRetrait(b.attributionId)}
                            className="ml-auto px-2.5 py-1 text-[11px] font-bold text-[#9CA3AF] hover:text-[#E63946]">
                            Retirer
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex gap-2 flex-wrap pt-1">
                <Link href={`/partenaire/athletes/${a.athleteId}`}
                  className="px-3.5 py-2 border border-[#2D3748] text-white hover:border-[#E63946]/60 text-[12px] font-bold rounded-lg">
                  Voir la fiche
                </Link>
                <button type="button" disabled={occupe === `eval:${a.athleteId}`} onClick={() => void ouvrirEvaluation(a)}
                  className="px-3.5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold rounded-lg disabled:opacity-50">
                  {a.coteGlobale != null ? "Modifier l'évaluation" : "Évaluer"}
                </button>
              </div>
            </li>
          ))}
        </ul>
        )}
        </>
      )}

      {edition && (
        <EvaluerAthleteModal
          athleteId={edition.athlete.athleteId}
          athleteNom={`${edition.athlete.prenom} ${edition.athlete.nom}`.trim()}
          grilleId={edition.grilleId}
          existante={edition.existante}
          onClose={() => setEdition(null)}
          onSaved={() => {
            setEdition(null);
            notifier(true, "Évaluation enregistrée.");
            void charger();
          }}
        />
      )}
    </div>
  );
}
