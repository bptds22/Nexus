"use client";

/* ═══════════════════════════════════════════════════════════════
   MesEvaluationsMobile — « Mes évaluations » du partenaire, version
   NATIVE de l'appli (1.4.5, demande BP : « un feeling natif, pas web »).

   Mêmes données et mêmes règles que le web (app/partenaire/mes-athletes) :
   chargerMesAthletes + chargerVignettesMesAthletes, recherche et filtre
   « Distinctions » par lib/partenaires/filtresMesAthletes.ts, badges R3
   par <CarteBadges> (lecture groupée PartenaireCartesProvider), ouverture
   de l'évaluation identique (contexte + évaluations, peutEvaluer revérifié).

   Habits du canon recruteur/coach : en-tête natif (EnTeteMobilePartenaire),
   recherche locale RecruteurFavorisMobile, lignes CoachAthleteRowMobile
   (toucher = fiche, haptique), « Évaluer » / « Modifier » en pastille sur
   la ligne. Distinctions : feuille du bas à cases à cocher, « Tout » /
   « Aucun », tes badges puis les badges Nexus — AUCUN compte affiché (C2).
   Messages en toasts ; la fenêtre d'évaluation passe par un portail (le
   transform d'AnimatedRoute piège les `fixed`).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { triggerHaptic } from "@/lib/haptics";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { EmptyState } from "@/components/mobile/EmptyState";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";
import CarteBadges from "@/components/shared/CarteBadges";
import PartenaireCartesProvider, { useDeclarerCarteVisible } from "@/components/shared/PartenaireCartesProvider";
import EvaluerAthleteModal from "@/components/partenaire/EvaluerAthleteModal";
import BandeauVisibilite from "@/components/partenaire/BandeauVisibilite";
import { EVENEMENT_EVALUATION_PARTENAIRE } from "@/lib/evaluations/partenaire";
import { EVENEMENT_BADGE_PARTENAIRE } from "@/lib/badges/partenaire";
import {
  chargerMesAthletes,
  chargerVignettesMesAthletes,
  type BadgeMonAthlete,
  type MonAthlete,
  type VignetteMonAthlete,
} from "@/lib/partenaires/mesAthletes";
import {
  chargerContexteEvaluation,
  chargerEvaluationsPartenaires,
  type EvaluationPartenaire,
} from "@/lib/evaluations/partenaire";
import { iconeBadgeUrl } from "@/lib/badges/partenaire";
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

function messageErreur(e: unknown): string {
  return (e as { message?: string })?.message?.replace(/^NEXUS:\s*/, "") ?? "Action impossible.";
}

function Etoiles({ cote }: { cote: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Cote ${cote.toFixed(1)} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i <= Math.round(cote) ? "#F59E0B" : "#4a4d56"}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
      <span className="ml-1 text-[11px] font-bold text-white">{cote.toFixed(1)}</span>
    </span>
  );
}

function IconeBadge({ b }: { b: Pick<BadgeMonAthlete, "nexus" | "code" | "iconePath" | "libelle"> }) {
  const src = b.nexus ? (b.code ? badgeSvgPath(b.code) : null) : iconeBadgeUrl(createClient(), b.iconePath);
  // Badge PROPRE au partenaire plus grand que le badge Nexus (même règle que le web, BP 2026-10-15).
  const taille = b.nexus ? "w-7 h-7" : "w-10 h-10";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`${taille} object-contain shrink-0`} />
  ) : (
    <span className={`${taille} rounded-full border border-white/15 flex items-center justify-center ${b.nexus ? "text-[11px]" : "text-[13px]"} font-bold text-[#9CA3AF] shrink-0`}>
      {(b.libelle ?? "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Feuille du bas « Distinctions » : cases à cocher, « Tout » / « Aucun », deux groupes, aucun compte (C2). */
function FeuilleDistinctions({ ouverte, onFermer, options, choix, onChange }: {
  ouverte: boolean;
  onFermer: () => void;
  options: OptionDistinction[];
  choix: ReadonlySet<string>;
  onChange: (c: Set<string>) => void;
}) {
  // Portail : document.body n'existe pas au prérendu de l'export statique.
  const monte = useSyncExternalStore(() => () => {}, () => true, () => false);
  if (!monte || !ouverte) return null;

  const fermer = () => { void triggerHaptic("Light"); onFermer(); };
  const propres = options.filter((o) => !o.nexus);
  const nexus = options.filter((o) => o.nexus);
  const groupe = (titre: string, liste: OptionDistinction[]) => liste.length > 0 && (
    <div className="py-1">
      <p className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6B7280]">{titre}</p>
      {liste.map((o) => {
        const coche = choix.has(o.cle);
        return (
          <button key={o.cle} type="button" role="checkbox" aria-checked={coche}
            onClick={() => { void triggerHaptic("Light"); onChange(basculerDistinction(choix, o.cle)); }}
            className="w-full min-h-[52px] flex items-center gap-3 px-3 text-left rounded-xl active:bg-white/[0.04]">
            <span className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center ${coche ? "bg-[#E63946] border-[#E63946]" : "border-white/30"}`}>
              {coche && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </span>
            <IconeBadge b={{ nexus: o.nexus, code: o.code, iconePath: o.iconePath, libelle: o.libelle }} />
            <span className="flex-1 min-w-0 text-[15px] text-white truncate">{o.libelle}</span>
          </button>
        );
      })}
    </div>
  );

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] bg-black/60" style={{ animation: "nx-modal-fade 200ms ease-out forwards" }} onClick={fermer} />
      <div role="dialog" aria-label="Distinctions" data-feuille-distinctions
        className="fixed inset-x-0 bottom-0 z-[70] max-h-[80vh] bg-[#111317] rounded-t-2xl flex flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom)", animation: "nx-modal-slideup 280ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards" }}>
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
        <div className="px-4 pb-3 flex items-center justify-between border-b border-white/[0.06]">
          <h2 className="font-head text-[18px] font-black uppercase tracking-tight text-white truncate">Distinctions</h2>
          <button type="button" onClick={fermer} className="min-h-[44px] px-3 -mr-3 text-[14px] font-bold text-[#E63946]">OK</button>
        </div>
        <div className="px-4 pt-3 flex items-center gap-2">
          <button type="button" onClick={() => { void triggerHaptic("Light"); onChange(toutesLesDistinctions(options)); }}
            className="min-h-[36px] px-3.5 rounded-full bg-white/[0.08] active:bg-white/[0.14] text-[13px] font-bold text-white">Tout</button>
          <button type="button" onClick={() => { void triggerHaptic("Light"); onChange(new Set()); }}
            className="min-h-[36px] px-3.5 rounded-full bg-white/[0.08] active:bg-white/[0.14] text-[13px] font-bold text-white">Aucun</button>
          <span className="ml-auto text-[12px] text-[#6B7280]">au moins un des badges cochés</span>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {groupe("Tes badges", propres)}
          {groupe("Badges Nexus remis", nexus)}
        </div>
      </div>
    </>,
    document.body,
  );
}

/** Une ligne native (canon CoachAthleteRowMobile). Toucher = fiche ; la pastille « Évaluer » /
 *  « Modifier » ne propage pas. La ligne se déclare à l'approche de l'écran : ses badges partenaire
 *  partent avec le paquet suivant (PartenaireCartesProvider). */
function LigneEvaluation({ a, vignette, occupe, onOuvrir, onEvaluer }: {
  a: MonAthlete;
  vignette: VignetteMonAthlete | undefined;
  occupe: boolean;
  onOuvrir: () => void;
  onEvaluer: () => void;
}) {
  const ref = useDeclarerCarteVisible(a.athleteId);
  const nom = `${a.prenom} ${a.nom}`.trim();
  const ouvrir = () => { void triggerHaptic("Light"); onOuvrir(); };
  return (
    <li data-mon-athlete={a.athleteId}>
      <div ref={ref} role="link" tabIndex={0} aria-label={`Voir la fiche de ${nom || "l'athlète"}`}
        onClick={ouvrir}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ouvrir(); } }}
        className="w-full text-left flex items-center gap-3 p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors cursor-pointer">
        <div className="relative w-16 h-16 rounded-2xl overflow-hidden shrink-0 bg-[#2F3440]">
          <AthletePhotoFill photoUrl={vignette?.photo} firstName={a.prenom} lastName={a.nom} initialsFontSize={22} className="object-[center_15%]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-[14px] truncate leading-tight">{nom || "Athlète"}</p>
          <p className="text-[11px] text-[#9CA3AF] truncate mt-0.5">
            {[a.sport, a.posteAbr ?? a.poste, a.ecole].filter(Boolean).join(" · ") || "—"}
          </p>
          <div className="mt-1 flex items-center">
            {a.coteGlobale != null ? <Etoiles cote={a.coteGlobale} /> : <span className="text-[11px] text-[#6B7280]">Pas encore évalué</span>}
          </div>
          <CarteBadges athleteId={a.athleteId} coach={vignette?.badgesCoach} variante="ligne" className="mt-1.5" />
        </div>
        <button type="button" disabled={occupe}
          onClick={(e) => { e.stopPropagation(); void triggerHaptic("Medium"); onEvaluer(); }}
          onKeyDown={(e) => e.stopPropagation()}
          className={`shrink-0 h-9 px-3.5 rounded-full text-[12px] font-bold active:scale-95 transition-transform disabled:opacity-50 ${a.coteGlobale != null ? "bg-white/[0.08] text-white" : "bg-[#E63946] text-white shadow-[0_4px_12px_rgba(230,57,70,0.30)]"}`}>
          {occupe ? "…" : a.coteGlobale != null ? "Modifier" : "Évaluer"}
        </button>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </li>
  );
}

function LignesSquelette() {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-[#1A1D24] animate-pulse" />
      ))}
    </div>
  );
}

/** Pastille « Mes évaluations » de « Mes athlètes » (fusion du 2026-10-18, 6.1) : l'en-tête
 *  et les pastilles sont posés par MesAthletesPartenaire. */
export default function MesEvaluationsMobile() {
  const router = useRouter();
  const toast = useMobileToast();
  const [athletes, setAthletes] = useState<MonAthlete[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vignettes, setVignettes] = useState<Map<string, VignetteMonAthlete>>(new Map());
  const [occupe, setOccupe] = useState<string | null>(null);
  const [edition, setEdition] = useState<{ athlete: MonAthlete; grilleId: string | null; existante: EvaluationPartenaire | null } | null>(null);
  const [texte, setTexte] = useState("");
  const [choixDistinctions, setChoixDistinctions] = useState<Set<string>>(new Set());
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);

  const options = useMemo(() => optionsDistinctions(athletes), [athletes]);
  // Un badge retiré (ou un athlète sorti) ne laisse pas de case cochée fantôme — élagué
  // à la lecture plutôt que par un effet (pas de setState synchrone dans un useEffect).
  const distinctions = useMemo(() => elaguerDistinctions(choixDistinctions, options), [choixDistinctions, options]);
  const visibles = useMemo(() => filtrerMesAthletes(athletes, { texte, distinctions }), [athletes, texte, distinctions]);
  const actifs = filtresActifs({ texte, distinctions });

  const charger = useCallback(async () => {
    try {
      const supabase = createClient();
      // BP 2026-10-19 : seulement les athlètes où j'ai encore une évaluation ou un badge (plus de « réclamées » à part).
      const liste = (await chargerMesAthletes(supabase)).filter((a) => a.evaluationId != null || a.badges.length > 0);
      setAthletes(liste);
      setErreur(null);
      setVignettes(await chargerVignettesMesAthletes(supabase, liste.map((x) => x.athleteId)));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { void charger(); }, [charger]);
  // Retirer une évaluation ou un badge sur la fiche : la liste suit.
  useEffect(() => {
    const relire = () => { void charger(); };
    window.addEventListener(EVENEMENT_EVALUATION_PARTENAIRE, relire);
    window.addEventListener(EVENEMENT_BADGE_PARTENAIRE, relire);
    return () => {
      window.removeEventListener(EVENEMENT_EVALUATION_PARTENAIRE, relire);
      window.removeEventListener(EVENEMENT_BADGE_PARTENAIRE, relire);
    };
  }, [charger]);

  const reessayer = () => {
    void triggerHaptic("Light");
    setChargement(true);
    setErreur(null);
    void charger();
  };

  const reinitialiser = () => {
    void triggerHaptic("Light");
    setTexte("");
    setChoixDistinctions(new Set());
  };

  async function ouvrirEvaluation(a: MonAthlete) {
    setOccupe(`eval:${a.athleteId}`);
    try {
      const supabase = createClient();
      const [ctx, evals] = await Promise.all([
        chargerContexteEvaluation(supabase, a.athleteId),
        chargerEvaluationsPartenaires(supabase, a.athleteId),
      ]);
      if (!ctx.peutEvaluer) {
        toast.error({ message: "Évaluation impossible", detail: "Ton organisation ne peut plus évaluer cet athlète (sport non permis)." });
        return;
      }
      setEdition({ athlete: a, grilleId: ctx.grilleId, existante: evals.find((e) => e.estLaMienne) ?? null });
    } catch (e) {
      toast.error({ message: "Échec", detail: messageErreur(e) });
    } finally {
      setOccupe(null);
    }
  }

  const resume = resumeDistinctions(distinctions, options);
  const distinctionsActives = distinctions.size > 0;

  return (
    <div className="text-white" data-page-mes-athletes data-vue-evaluations>
      <div className="px-4 pt-2"><BandeauVisibilite className="mb-3" /></div>
      <div className="sticky top-0 z-30 bg-[#111317]">
        {athletes.length > 0 && (
          <div className="px-4 pt-2 pb-3" data-filtres-mes-athletes>
            <div className="relative">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={texte}
                onChange={(e) => setTexte(e.target.value)}
                placeholder="Nom, école ou club, position"
                aria-label="Rechercher dans mes évaluations"
                className="w-full bg-white/[0.06] rounded-2xl pl-9 pr-9 py-2.5 text-[16px] text-white placeholder:text-white/40 outline-none"
              />
              {texte && (
                <button
                  type="button"
                  onClick={() => { void triggerHaptic("Light"); setTexte(""); }}
                  aria-label="Effacer"
                  className="absolute right-0 top-1/2 -translate-y-1/2 nx-mobile-touch-min flex items-center justify-center"
                >
                  <span className="w-6 h-6 rounded-full bg-white/[0.10] flex items-center justify-center active:bg-white/[0.18]">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round">
                      <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                    </svg>
                  </span>
                </button>
              )}
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                disabled={options.length === 0}
                onClick={() => { void triggerHaptic("Light"); setFeuilleOuverte(true); }}
                aria-haspopup="dialog"
                className={`min-h-[36px] max-w-[70%] px-3.5 rounded-full text-[13px] font-semibold flex items-center gap-1.5 disabled:opacity-40 active:scale-95 transition-transform ${distinctionsActives ? "bg-[#E63946]/15 text-white border border-[#E63946]" : "bg-white/[0.06] text-[#9CA3AF] border border-transparent"}`}
              >
                <span className="truncate">{options.length === 0 ? "Aucun badge remis" : resume}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0"><path d="M6 9l6 6 6-6" /></svg>
              </button>
              {actifs && (
                <button type="button" onClick={reinitialiser} className="min-h-[36px] px-2 text-[13px] font-bold text-[#9CA3AF] active:text-white">
                  Réinitialiser
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pt-2 pb-6">
        {chargement ? (
          <LignesSquelette />
        ) : erreur && athletes.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 px-4">
            <p className="text-[15px] text-[#9CA3AF] max-w-xs">{erreur}</p>
            <button type="button" onClick={reessayer}
              className="mt-5 h-11 px-6 rounded-2xl bg-white/[0.08] active:bg-white/[0.14] text-[14px] font-bold text-white">
              Réessayer
            </button>
          </div>
        ) : athletes.length === 0 ? (
          <EmptyState
            image="/empty/nexus-empty-shortlist.png"
            title="Aucun athlète pour l'instant"
            description="Évalue un athlète ou remets-lui un badge depuis sa fiche : il apparaîtra ici."
          />
        ) : (
          <>
            {erreur && (
              <div className="mb-3 flex items-center gap-3 rounded-2xl bg-[#E63946]/10 border border-[#E63946]/30 px-3 py-2.5">
                <p className="flex-1 min-w-0 text-[13px] text-white/80">{erreur}</p>
                <button type="button" onClick={reessayer} className="shrink-0 text-[13px] font-bold text-[#E63946]">Réessayer</button>
              </div>
            )}
            {visibles.length === 0 ? (
              <div className="flex flex-col items-center text-center py-12">
                <p className="text-[14px] text-white/55 italic">Aucun athlète ne correspond à ces filtres.</p>
                <button type="button" onClick={reinitialiser} className="mt-4 min-h-[40px] px-4 text-[13px] font-bold text-[#E63946]">
                  Réinitialiser les filtres
                </button>
              </div>
            ) : (
              <PartenaireCartesProvider>
                <ul className="flex flex-col gap-2.5">
                  {visibles.map((a) => (
                    <LigneEvaluation key={a.athleteId} a={a} vignette={vignettes.get(a.athleteId)}
                      occupe={occupe === `eval:${a.athleteId}`}
                      onOuvrir={() => router.push(`/partenaire/athletes/${a.athleteId}`)}
                      onEvaluer={() => void ouvrirEvaluation(a)} />
                  ))}
                </ul>
              </PartenaireCartesProvider>
            )}
          </>
        )}
      </div>

      <FeuilleDistinctions
        ouverte={feuilleOuverte}
        onFermer={() => setFeuilleOuverte(false)}
        options={options}
        choix={distinctions}
        onChange={setChoixDistinctions}
      />

      {edition && createPortal(
        <EvaluerAthleteModal
          athleteId={edition.athlete.athleteId}
          athleteNom={`${edition.athlete.prenom} ${edition.athlete.nom}`.trim()}
          grilleId={edition.grilleId}
          existante={edition.existante}
          onClose={() => setEdition(null)}
          onSaved={() => {
            setEdition(null);
            toast.success({ message: "Évaluation enregistrée." });
            void charger();
          }}
        />,
        document.body,
      )}
    </div>
  );
}
