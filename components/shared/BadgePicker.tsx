"use client";

/* ═══════════════════════════════════════════════════════════════
   BadgePicker — sélection des badges, partagé par les 7 surfaces.

   CONTRÔLÉ : il ne sait NI où ni comment le résultat sera enregistré.
   Les écrans coach/admin écrivent directement, les écrans athlète
   produisent une suggestion — cette différence appartient au parent, pas
   au picker. C'est ce qui permet un seul composant au lieu de deux.

   RIEN N'EST CÂBLÉ EN DUR : les libellés, les familles, les rattachements
   de sport et la forme du contexte viennent tous de la table `badges` et
   de `badge_sports`. Ajouter un honneur au catalogue ne doit obliger à
   recâbler aucun écran.

   ⚠ NON BRANCHÉ. Aucune des 7 surfaces ne l'appelle encore.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  sectionsPourSport, compter, peutAjouter,
  contexteComplet, placeholderContexte,
  PLAFOND_BADGES,
  type BadgeCatalogueEntry, type BadgeEntry,
} from "@/lib/config/badgeCatalogue";
import { useBadgeCatalogue } from "@/lib/config/useBadgeCatalogue";
import BadgeVignette from "@/components/shared/badges/BadgeVignette";

export interface BadgePickerProps {
  /** Les badges actuellement retenus. Codes du CATALOGUE (capitaine, mvp…),
   *  pas les anciens codes de evaluations.distinctions. */
  value: BadgeEntry[];
  onChange: (value: BadgeEntry[]) => void;
  /** UUID du sport de l'athlète. Les appelants qui n'ont qu'un nom le
   *  résolvent par `grilleSet.sportIdByNom.get(nom)` — le référentiel des
   *  grilles est déjà chargé sur les 7 surfaces.
   *  null / inconnu / « Autre » → universels + honneurs seulement. */
  sportId: string | null;
  /** Nom du sport, UNIQUEMENT pour proposer les statistiques du formulaire
   *  « statistique + année ». SPORT_STATS est indexé par nom, pas par UUID —
   *  d'où ce second prop plutôt qu'une table de correspondance de plus.
   *  Absent : la statistique se saisit librement, rien n'est bloqué. */
  sportNom?: string | null;
  /** Badges présents sur l'athlète que CE chemin ne gère pas : ceux d'un
   *  autre coach, ceux issus d'une suggestion ou repris de l'ancien format.
   *  Affichés en lecture seule — les retirer appartient à leur auteur.
   *  Ils COMPTENT au plafond, comme en base (badge_plafond ne regarde pas
   *  qui a attribué). */
  autresBadges?: BadgeEntry[];
  layout?: "tuiles" | "rangees";
  /** Couleur d'accent. Rouge Nexus par défaut ; les surfaces athlète mobile
   *  passent l'ambre. */
  accent?: string;
  disabled?: boolean;
  /** Délègue la saisie du contexte à l'appelant — la feuille du bas de
   *  AthleteWizardMobile. Fourni : l'éditeur EN LIGNE n'est pas rendu, et
   *  toucher un badge à contexte l'ouvre (en le sélectionnant d'abord s'il
   *  ne l'était pas). Absent : éditeur en ligne, comportement par défaut. */
  onEditerContexte?: (badge: BadgeCatalogueEntry) => void;
}

export default function BadgePicker({
  value, onChange, sportId, sportNom, autresBadges = [], layout = "tuiles",
  accent = "#E63946", disabled = false, onEditerContexte,
}: BadgePickerProps) {
  const cat = useBadgeCatalogue();


  const sections = useMemo(() => sectionsPourSport(cat, sportId), [cat, sportId]);
  const parCode = useMemo(() => new Map(value.map((e) => [e.code, e])), [value]);

  /* Le plafond compte l'UNION. En base, badge_plafond ne regarde pas qui a
     attribué : afficher « 3/5 » alors que la base en voit 5 ferait échouer
     l'enregistrement sans que le coach comprenne pourquoi. */
  const comptes = useMemo(
    () => compter([...value, ...autresBadges], cat), [value, autresBadges, cat],
  );

  /* Badges détenus mais NON proposables pour le sport actuel — typiquement
     un athlète qui a changé de sport. Ils restent (un badge consigne un fait
     passé) et comptent au plafond. Les taire donnerait un compteur qui ment :
     « 5/5 » avec 4 tuiles cochées, sans explication. On les MONTRE, en
     lecture seule — le coach voit d'où vient son 5e et lit l'historique de
     l'athlète. */
  const horsSport = useMemo(() => {
    const offerts = new Set(sections.flatMap((s) => s.badges.map((b) => b.code)));
    return value
      .map((e) => cat.byCode.get(e.code))
      .filter((b): b is NonNullable<typeof b> => !!b && !offerts.has(b.code));
  }, [value, sections, cat]);

  const autresResolus = useMemo(
    () => autresBadges.map((e) => cat.byCode.get(e.code)).filter((b): b is NonNullable<typeof b> => !!b),
    [autresBadges, cat],
  );

  const basculer = useCallback((b: BadgeCatalogueEntry) => {
    if (disabled) return;
    if (parCode.has(b.code)) {
      onChange(value.filter((e) => e.code !== b.code));
      return;
    }
    if (!peutAjouter(comptes)) return;
    onChange([...value, { code: b.code, contexte: null }]);
  }, [disabled, parCode, value, comptes, onChange]);

  /* Avec délégation : toucher un badge à contexte ouvre l'éditeur externe
     plutôt que de le décocher — sinon on ne pourrait jamais corriger un
     millésime sans repartir de zéro. Le retrait se fait depuis la feuille. */
  const toucher = useCallback((b: BadgeCatalogueEntry) => {
    if (disabled) return;
    if (!onEditerContexte || !b.requiertContexte) { basculer(b); return; }
    if (!parCode.has(b.code)) {
      if (!peutAjouter(comptes)) return;
      onChange([...value, { code: b.code, contexte: null }]);
    }
    onEditerContexte(b);
  }, [disabled, onEditerContexte, parCode, comptes, value, onChange, basculer]);

  const majContexte = useCallback((b: BadgeCatalogueEntry, texte: string) => {
    const t = texte.trim();
    onChange(value.map((e) => e.code === b.code ? { ...e, contexte: t || null } : e));
  }, [value, onChange]);

  if (!cat.ok) {
    /* Ni liste de repli, ni silence. Proposer un badge qui n'existe pas au
       catalogue serait pire que n'en proposer aucun ; disparaître sans un
       mot laisserait le coach croire à un écran vide. */
    return (
      <p className="text-[12px] text-[#8a8d96] italic py-3">
        Catalogue de badges indisponible — réessaie dans un instant.
      </p>
    );
  }

  const styleAccent = { "--nx-accent": accent } as React.CSSProperties;

  return (
    <div style={styleAccent} className="space-y-5">
      {sections.map((section) => {
        /* Le plafond est GLOBAL : la mention ne dépend plus de la famille.
           Les honneurs n'en sont plus exemptés — cf. PLAFOND_BADGES. */
        const plafondAtteint = comptes.total >= PLAFOND_BADGES;
        return (
          <section key={section.famille}>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a8d96]">
                {section.titre}
              </p>
              {plafondAtteint && (
                <span className="text-[10px]" style={{ color: accent }}>plafond atteint</span>
              )}
            </div>

            <div className={layout === "tuiles"
              ? "grid grid-cols-2 sm:grid-cols-3 gap-3"
              : "space-y-1.5"}>
              {section.badges.map((b, i) => (
                <Tuile
                  key={b.code}
                  index={i}
                  badge={b}
                  entree={parCode.get(b.code)}
                  layout={layout}
                  accent={accent}
                  desactive={disabled || (!parCode.has(b.code) && !peutAjouter(comptes))}
                  onBasculer={() => toucher(b)}
                  onContexte={(t) => majContexte(b, t)}
                  contexteEnLigne={!onEditerContexte}
                />
              ))}
            </div>
          </section>
        );
      })}

      <SectionLectureSeule
        titre="Badges hors sport actuel"
        note="conservés — l'athlète les a mérités dans un autre sport"
        badges={horsSport}
        parCode={parCode}
        layout={layout}
      />
      <SectionLectureSeule
        titre="Attribués par quelqu'un d'autre"
        note="seul leur auteur peut les retirer"
        badges={autresResolus}
        parCode={new Map(autresBadges.map((e) => [e.code, e]))}
        layout={layout}
      />

      {/* UN seul compteur : le plafond vaut pour toutes les familles. Il
          borne la LIGNE d'affichage — 5 tiennent au web, 3+2 sur mobile —
          pas une catégorie. */}
      <div className="text-[12px] text-[#6b7280] pt-1">
        Badges :{" "}
        <span className="font-bold" style={{
          color: comptes.total >= PLAFOND_BADGES ? accent : undefined,
        }}>
          {comptes.total} / {PLAFOND_BADGES}
        </span>
      </div>
    </div>
  );
}

/* ── Sections en LECTURE SEULE ──────────────────────────────── */
/* Deux cas, un seul rendu : les badges hors du sport actuel, et ceux
   attribués par quelqu'un d'autre. Dans les deux cas ils comptent au
   plafond mais ne se décochent pas — les masquer donnerait un compteur
   inexplicable, les rendre cliquables ferait mentir l'écran (la RPC ne les
   retirerait pas). Grisés, non cliquables, avec la raison écrite. */
function SectionLectureSeule({
  titre, note, badges, parCode, layout,
}: {
  titre: string;
  note: string;
  badges: BadgeCatalogueEntry[];
  parCode: Map<string, BadgeEntry>;
  layout: "tuiles" | "rangees";
}) {
  if (badges.length === 0) return null;
  return (
    <section aria-label={titre}>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#6b7280]">
          {titre}
        </p>
        <span className="text-[10px] text-[#4a4d56] italic">{note}</span>
      </div>
      <div className={layout === "tuiles"
        ? "grid grid-cols-2 sm:grid-cols-3 gap-3"
        : "space-y-1.5"}>
        {badges.map((b, i) => {
          const contexte = parCode.get(b.code)?.contexte;
          return (
            <div
              key={b.code}
              className="border border-[#2a2d36] rounded-lg bg-white/[0.02] opacity-60"
              title="Lecture seule"
            >
              <div className={layout === "tuiles"
                ? "flex flex-col items-center gap-2 px-3 py-4 text-center"
                : "flex items-center gap-3 px-3 py-2.5"}>
                {layout === "tuiles" && <BadgeVignette code={b.code} taille="lg" index={i} />}
                <span className="text-[12px] font-bold text-[#8a8d96]">{b.libelle}</span>
              </div>
              {contexte && (
                <p className={`text-[11px] text-[#6b7280] pb-3 ${layout === "tuiles" ? "px-3 text-center" : "px-3 pl-10"}`}>
                  {contexte}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Une tuile, ou une rangée ───────────────────────────────── */

function Tuile({
  badge, entree, layout, accent, desactive, onBasculer, onContexte,
  contexteEnLigne, index,
}: {
  badge: BadgeCatalogueEntry;
  /** Rang dans la grille — echelonne le reflet, rien d'autre. */
  index?: number;
  entree: BadgeEntry | undefined;
  layout: "tuiles" | "rangees";
  accent: string;
  desactive: boolean;
  onBasculer: () => void;
  onContexte: (contexte: string) => void;
  contexteEnLigne: boolean;
}) {
  const choisi = !!entree;
  const incomplet = choisi && !contexteComplet(badge, entree?.contexte);

  const bordure = choisi
    ? { borderColor: `${accent}66`, backgroundColor: `${accent}0F` }
    : undefined;

  return (
    <div
      className={`border rounded-lg transition-colors ${choisi ? "" : "border-[#2a2d36]"} ${desactive ? "opacity-40" : ""}`}
      style={bordure}
    >
      <button
        type="button"
        onClick={onBasculer}
        disabled={desactive}
        aria-pressed={choisi}
        className={layout === "tuiles"
          ? "w-full flex flex-col items-center gap-2 px-3 py-4 text-center"
          : "w-full flex items-center gap-3 px-3 py-2.5 text-left"}
      >
        {layout === "tuiles" ? (
          <BadgeVignette code={badge.code} taille="lg" index={index} />
        ) : (
          <span
            className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
            style={choisi
              ? { backgroundColor: accent, borderColor: accent }
              : { borderColor: "#4a4d56" }}
          >
            {choisi && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff"
                   strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </span>
        )}
        <span className={`text-[12px] font-bold ${choisi ? "text-white" : "text-[#8a8d96]"}`}>
          {badge.libelle}
        </span>
      </button>

      {choisi && badge.requiertContexte && contexteEnLigne && (
        <div className={layout === "tuiles" ? "px-3 pb-3 space-y-2" : "px-3 pb-3 pl-10 space-y-2"}>
          <ContexteEditeur
            forme={badge.contexteForme}
            contexte={entree?.contexte}
            accent={accent}
            onChange={onContexte}
          />
          {incomplet && (
            <p className="text-[11px]" style={{ color: accent }}>
              À compléter — ce badge ne peut pas être enregistré sans.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Le contexte : UN champ, un placeholder ─────────────────── */
/* La forme vient de badges.contexte_forme, jamais d'un `if` sur le code —
   et elle ne choisit plus QUE le placeholder. Ajouter un honneur au
   catalogue ne change rien ici. */

const CHAMP_CLS =
  "w-full bg-[#13151a] border border-[#2a2d36] rounded px-2 py-1.5 " +
  "text-[12px] text-white placeholder:text-[#4a4d56] outline-none";

export function ContexteEditeur({
  forme, contexte, accent, onChange,
}: {
  forme: BadgeCatalogueEntry["contexteForme"];
  contexte: string | null | undefined;
  accent: string;
  onChange: (contexte: string) => void;
}) {
  return (
    <input
      type="text"
      value={contexte ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholderContexte(forme)}
      aria-label="Contexte de la distinction"
      className={CHAMP_CLS}
      style={{ outlineColor: accent } as React.CSSProperties}
    />
  );
}
