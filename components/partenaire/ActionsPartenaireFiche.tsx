"use client";

/* ═══════════════════════════════════════════════════════════════
   Actions du PARTENAIRE sur la fiche d'un athlète (lots W3 et « C »).

   BP 2026-10-19 : DEUX choix seulement.
   - « Attribuer un badge » : UN menu déroulant (MenuDeroulant, accroché au
     bouton) avec ses badges ET les badges Nexus que le serveur juge
     admissibles pour CET athlète (universels, et ceux de SON sport ; jamais
     les honneurs). Toucher un badge que j'ai posé le retire, sans
     confirmation (il se réattribue facilement). Un badge Nexus porté par un
     autre reste listé, grisé, avec qui le porte — le serveur refuse de toute
     façon le doublon. Sans droit d'évaluer, seuls mes badges posés sont
     listés : les retirer réduit l'exposition, ça ne l'étend jamais.
   - « Évaluer » / « Mon évaluation » : ouvre EvaluerAthleteModal, où vit
     aussi « Retirer mon évaluation ».
   Le lien sous la vignette des « Distinctions » reste.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EvaluationPartenaire } from "@/lib/evaluations/partenaire";
import {
  attribuerBadgePartenaire,
  attribuerBadgeNexus,
  retirerBadgePartenaire,
  chargerBadgesNexusAdmissibles,
  chargerMesBadgesPartenaire,
  signalerBadgesPartenaire,
  EVENEMENT_BADGE_PARTENAIRE,
  type BadgeCatalogue,
  type BadgeNexusAdmissible,
} from "@/lib/badges/partenaire";
import { badgeSvgPath } from "@/lib/config/badges";
import { useBadgesPartenaires } from "@/components/shared/athlete/BadgesPartenaire";
import MenuDeroulant from "@/components/shared/MenuDeroulant";

function messageErreur(e: unknown): string {
  return (e as { message?: string })?.message?.replace(/^NEXUS:\s*/, "") ?? "Action impossible.";
}

const BOUTON = "px-4 py-2 border border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/10 text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

interface LigneBadge {
  cle: string;
  libelle: string;
  svg: string | null;
  sousTitre: string;
  /** Porté par un autre partenaire (badge Nexus) : grisé. */
  ailleurs: string | null;
  poser: () => Promise<void>;
}

export default function ActionsPartenaireFiche({
  athleteId,
  peutEvaluer,
  maEvaluation,
  onEvaluer,
  notifier,
}: {
  athleteId: string;
  peutEvaluer: boolean;
  maEvaluation: EvaluationPartenaire | null;
  /** Ouvre la fenêtre d'évaluation (le retrait de l'évaluation y vit). */
  onEvaluer: () => void;
  notifier: (kind: "success" | "error", message: string) => void;
}) {
  const [occupe, setOccupe] = useState(false);
  const [catalogue, setCatalogue] = useState<BadgeCatalogue[]>([]);
  const [nexus, setNexus] = useState<BadgeNexusAdmissible[]>([]);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const poses = useBadgesPartenaires(athleteId);
  const mesPoses = poses.filter((b) => b.estLeMien);
  const refBadge = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!peutEvaluer) return;
    let vivant = true;
    const charger = () => {
      chargerBadgesNexusAdmissibles(createClient(), athleteId)
        .then((r) => { if (vivant) setNexus(r); })
        .catch((e) => console.warn("[partenaire] badges Nexus admissibles :", e?.message ?? e));
    };
    charger();
    // Une pose ou un retrait change « déjà porté » : on relit.
    const surChangement = (e: Event) => {
      if ((e as CustomEvent<{ athleteId?: string }>).detail?.athleteId === athleteId) charger();
    };
    window.addEventListener(EVENEMENT_BADGE_PARTENAIRE, surChangement);
    return () => { vivant = false; window.removeEventListener(EVENEMENT_BADGE_PARTENAIRE, surChangement); };
  }, [peutEvaluer, athleteId]);

  useEffect(() => {
    if (!peutEvaluer) return;
    chargerMesBadgesPartenaire(createClient())
      .then(setCatalogue)
      .catch((e) => console.warn("[partenaire] catalogue de badges :", e?.message ?? e));
  }, [peutEvaluer]);

  // Mes poses, par badge : « p:id » pour les miens, « n:id » pour les Nexus.
  const cleDe = (b: { estNexus: boolean; badgeId: string }) => `${b.estNexus ? "n" : "p"}:${b.badgeId}`;
  const maPose = new Map(mesPoses.map((b) => [cleDe(b), b.id]));

  const agir = async (f: () => Promise<void>, succes: string) => {
    setOccupe(true);
    try {
      await f();
      signalerBadgesPartenaire(athleteId);
      notifier("success", succes);
    } catch (e) {
      notifier("error", messageErreur(e));
    } finally {
      setOccupe(false);
    }
  };
  const basculer = (l: LigneBadge) => {
    const pose = maPose.get(l.cle);
    if (pose) void agir(() => retirerBadgePartenaire(createClient(), pose), `Badge « ${l.libelle} » retiré.`);
    else void agir(l.poser, `Badge « ${l.libelle} » attribué.`);
  };

  const badgesPossibles = (peutEvaluer && (catalogue.length > 0 || nexus.length > 0)) || mesPoses.length > 0;
  const evaluationPossible = peutEvaluer || !!maEvaluation;
  if (!badgesPossibles && !evaluationPossible) return null;

  const lignes: LigneBadge[] = peutEvaluer
    ? [
        ...catalogue.map((b) => ({
          cle: `p:${b.id}`, libelle: b.libelle, svg: b.iconeUrl, sousTitre: "Ton badge", ailleurs: null,
          poser: () => attribuerBadgePartenaire(createClient(), athleteId, b.id),
        })),
        ...nexus.map((b) => ({
          cle: `n:${b.id}`, libelle: b.libelle, svg: badgeSvgPath(b.code),
          sousTitre: b.famille === "sport" ? "Badge Nexus · sport" : "Badge Nexus",
          ailleurs: b.dejaPar && !maPose.has(`n:${b.id}`) ? b.dejaPar : null,
          poser: () => attribuerBadgeNexus(createClient(), athleteId, b.id),
        })),
      ]
    : [];
  // Mes poses absentes des listes (sans droit d'évaluer, ou badge sorti du catalogue) : pour les retirer.
  const listees = new Set(lignes.map((l) => l.cle));
  for (const b of mesPoses) {
    if (listees.has(cleDe(b))) continue;
    lignes.push({
      cle: cleDe(b), libelle: b.libelle, svg: b.estNexus && b.codeNexus ? badgeSvgPath(b.codeNexus) : b.iconeUrl,
      sousTitre: b.estNexus ? "Badge Nexus" : "Ton badge", ailleurs: null, poser: async () => {},
    });
  }

  return (
    <div className="flex items-center gap-3 flex-wrap" data-actions-partenaire>
      {badgesPossibles && (
        <div className="relative">
          <button type="button" disabled={occupe} ref={refBadge} onClick={() => setMenuOuvert((v) => !v)} className={BOUTON} data-attribuer-badge>
            Attribuer un badge
          </button>
          {menuOuvert && (
            <MenuDeroulant ancre={refBadge} onFermer={() => setMenuOuvert(false)} testId="menu-attribuer-badge" largeur={320}>
              {lignes.map((l) => {
                const pose = maPose.has(l.cle);
                return (
                  <button key={l.cle} type="button" disabled={occupe || !!l.ailleurs} aria-pressed={pose} onClick={() => basculer(l)}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 text-left disabled:opacity-45 disabled:hover:bg-transparent disabled:cursor-not-allowed">
                    {l.svg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.svg} alt="" className="w-9 h-9 object-contain shrink-0" />
                    ) : (
                      <span className="w-9 h-9 rounded-full border border-[#2D3748] flex items-center justify-center text-[13px] font-bold text-[#9CA3AF] shrink-0">
                        {l.libelle.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-[13px] font-semibold text-white truncate">{l.libelle}</span>
                      <span className="text-[11px] text-[#6B7280]">{l.ailleurs ? `Déjà porté — ${l.ailleurs}` : l.sousTitre}</span>
                    </span>
                    {pose && <span className="shrink-0 text-[12px] font-bold text-[#E63946]">Retirer</span>}
                  </button>
                );
              })}
            </MenuDeroulant>
          )}
        </div>
      )}
      {evaluationPossible && (
        <button type="button" disabled={occupe} onClick={onEvaluer} className={BOUTON} data-evaluation-partenaire>
          {maEvaluation ? "Mon évaluation" : "Évaluer"}
        </button>
      )}
    </div>
  );
}
