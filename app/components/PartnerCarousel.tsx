"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { PartnerTier } from "@/lib/types/models";

/* ═══════════════════════════════════════════════════════════════
   Bandeau partenaires de la page d'accueil — données live.

   Ensemble CURÉ : status='APPROVED' ET show_on_homepage=true. Une page
   publique existe pour tout partenaire approuvé (/partenaires/[id]),
   mais seuls les `show_on_homepage` remontent ici.

   Anon-safe : la page d'accueil est publique, on lit avec le client
   navigateur (clé anon) et on ne sélectionne que des colonnes
   publiques — jamais `*`. Aucun partenaire en vedette → la section ne
   rend rien (pas de bandeau vide).

   ── DEUX RANGÉES, PAS UN DÉFILEMENT PERMANENT ──────────────────────
   L'ancienne version était un marquee inconditionnel. Il suppose une
   piste PLUS LARGE que son conteneur : en dessous, l'animation
   `translateX(-50% - 32px)` fait dériver les créneaux vers la gauche et
   le premier passe sous le masque. Avec un seul partenaire — l'état
   réel — on voyait deux fois le même logo, dont un coupé.

   Le défilement est donc CONDITIONNEL, et la condition est MESURÉE :
   un ResizeObserver donne la largeur réelle du conteneur, comparée à la
   largeur naturelle de la rangée (n créneaux + n-1 gouttières). Pas de
   seuil « au-delà de 8 partenaires » : un nombre en dur redevient faux
   au premier changement de largeur de créneau ou sur mobile.

   ── LE REPLI EST UN ÉTAT ASSUMÉ ────────────────────────────────────
   `logo_url` NULL est l'état NORMAL d'un partenaire tant que son
   fichier n'est pas arrivé — c'est celui de L'Esprit Sportif
   aujourd'hui. Il doit se présenter proprement : le nom centré, à une
   taille choisie selon sa longueur, jamais tronqué ni débordant. Un
   `onError` renvoie au même repli, pour qu'une URL morte ne laisse
   jamais un cadre vide (le cas Facebook 403 de juillet-août).
═══════════════════════════════════════════════════════════════ */

type FeaturedPartner = {
  id: string;
  organization_name: string;
  logo_url: string | null;
  tier: PartnerTier;
  category: string | null;
  homepage_order: number | null;
};

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";

/* Rang d'affichage. Le tri ne peut pas se faire côté serveur : PostgREST
   ordonnerait `tier` alphabétiquement (MAJEUR < OFFICIEL < PARTENAIRE),
   ce qui est faux. L'ensemble est minuscule, on trie ici. */
const RANG: Record<PartnerTier, number> = { OFFICIEL: 0, MAJEUR: 1, PARTENAIRE: 2 };

/* Géométrie. Les plafonds du logo sont à 65 % de la hauteur du créneau et
   78 % de sa largeur.

   L'ancien réglage (créneau 220×88, logo max-h 44 / max-w 150) donnait un
   rapport de surface de 1 à 3,8 entre un logo horizontal et un logo carré :
   le carré, borné par une hauteur trop basse, paraissait écrasé. Relever
   le plafond de hauteur ramène l'écart à ~1:2,3. On ne peut pas atteindre
   1:1 sans déformer — un canevas 3:1 fourni par le partenaire supprime le
   problème à la source (consigne posée dans l'admin). */
const GEO = {
  officiel:   { w: 340, h: 150, logoH: 96, logoW: 264 },
  secondaire: { w: 200, h: 96,  logoH: 62, logoW: 156 },
} as const;

const GOUTTIERE = 24; // px, rangée secondaire — doit refléter le `gap` du rendu

/* Taille de police du repli, choisie sur la longueur du nom. Le but n'est
   pas d'être joli à 12 caractères mais de ne JAMAIS déborder à 40. */
function taillePolice(nom: string, grand: boolean): number {
  const n = nom.length;
  if (grand) return n <= 14 ? 26 : n <= 24 ? 21 : n <= 36 ? 17 : 14;
  return n <= 14 ? 16 : n <= 24 ? 13 : n <= 36 ? 11 : 10;
}

function Logo({ p, grand }: { p: FeaturedPartner; grand: boolean }) {
  const [errored, setErrored] = useState(false);
  const g = grand ? GEO.officiel : GEO.secondaire;

  if (!p.logo_url || errored) {
    return (
      <span
        className="nx-partner-name block text-center px-3 font-head font-black uppercase leading-tight"
        style={{
          fontSize: taillePolice(p.organization_name, grand),
          letterSpacing: "0.02em",
          overflowWrap: "anywhere",
        }}
      >
        {p.organization_name}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={p.logo_url}
      alt={p.organization_name}
      onError={() => setErrored(true)}
      className="object-contain opacity-80 hover:opacity-100 transition-opacity"
      style={{ maxHeight: g.logoH, maxWidth: g.logoW }}
    />
  );
}

/* Libellé. « PARTENAIRE OFFICIEL » est un texte FIXE que nous contrôlons ;
   `category` est juxtaposée après un point médian, jamais accordée avec
   lui. Composer « Partenaire {category} officiel » produirait « Partenaire
   École officiel » — l'accord en genre casse dès que l'étiquette n'est pas
   masculine. La juxtaposition est toujours grammaticale. */
function Libelle({ p }: { p: FeaturedPartner }) {
  if (p.tier === "OFFICIEL") {
    return (
      <p className={`${label} nx-partner-label-fort mt-3 text-center`}>
        Partenaire officiel
        {p.category && <span className="nx-partner-label"> · {p.category}</span>}
      </p>
    );
  }
  if (!p.category) return null;
  return <p className="nx-partner-label mt-2 text-center text-[10px] tracking-[0.18em] uppercase font-bold">{p.category}</p>;
}

function Creneau({ p, grand }: { p: FeaturedPartner; grand: boolean }) {
  const g = grand ? GEO.officiel : GEO.secondaire;
  return (
    <div className="flex flex-col items-center">
      <Link
        href={`/partenaires/${p.id}`}
        aria-label={p.organization_name}
        className="nx-partner-slot flex items-center justify-center overflow-hidden"
        style={{ width: g.w, height: g.h }}
      >
        <Logo p={p} grand={grand} />
      </Link>
      <Libelle p={p} />
    </div>
  );
}

export default function PartnerCarousel() {
  const [partners, setPartners] = useState<FeaturedPartner[] | null>(null);
  const [defile, setDefile] = useState(false);
  const zoneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("media_partners")
        .select("id, organization_name, logo_url, tier, category, homepage_order")
        .eq("status", "APPROVED")
        .eq("show_on_homepage", true);
      const rows = (data as FeaturedPartner[] | null) ?? [];
      rows.sort(
        (a, b) =>
          RANG[a.tier ?? "PARTENAIRE"] - RANG[b.tier ?? "PARTENAIRE"] ||
          // NULLS LAST : un ordre absent ne doit pas passer devant un 1.
          (a.homepage_order ?? Number.POSITIVE_INFINITY) -
            (b.homepage_order ?? Number.POSITIVE_INFINITY) ||
          a.organization_name.localeCompare(b.organization_name, "fr"),
      );
      setPartners(rows);
    })();
  }, []);

  const officiels = (partners ?? []).filter((p) => p.tier === "OFFICIEL");
  const secondaires = (partners ?? []).filter((p) => p.tier !== "OFFICIEL");

  /* La bascule est une MESURE, pas un compte. Largeur naturelle de la
     rangée = n créneaux + (n-1) gouttières ; on défile si elle dépasse le
     conteneur observé. */
  const mesurer = useCallback(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    const n = secondaires.length;
    const naturelle = n * GEO.secondaire.w + Math.max(0, n - 1) * GOUTTIERE;
    setDefile(n > 1 && naturelle > zone.clientWidth);
  }, [secondaires.length]);

  useEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    /* Pas d'appel manuel a mesurer() ici : observe() declenche deja un
       premier passage avec la taille courante. L'ajouter ne ferait que
       poser un setState directement dans l'effet. */
    const ro = new ResizeObserver(mesurer);
    ro.observe(zone);
    return () => ro.disconnect();
  }, [mesurer]);

  // Chargement (null) ou aucun partenaire → on ne rend rien.
  if (!partners || partners.length === 0) return null;

  /* En mode défilement seulement : la liste est doublée pour que la boucle
     se referme sans couture. Les doublons sortent de l'arbre
     d'accessibilité et du parcours clavier. */
  const boucle = defile ? [...secondaires, ...secondaires] : secondaires;

  return (
    <section className="relative bg-transparent py-20 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 mb-12 text-center">
        <div className="inline-flex items-center gap-3">
          <span className="w-10 h-px bg-[#E63946]" />
          <span className={`${label} text-[#E63946]`}>Ils nous font confiance</span>
          <span className="w-10 h-px bg-[#E63946]" />
        </div>
      </div>

      {/* Rangée OFFICIEL — se masque toute seule s'il n'y en a aucun. */}
      {officiels.length > 0 && (
        <div className="flex flex-wrap items-start justify-center gap-10 mb-12">
          {officiels.map((p) => (
            <Creneau key={p.id} p={p} grand />
          ))}
        </div>
      )}

      {/* Rangée secondaire — MAJEUR puis PARTENAIRE, déjà triés. */}
      {secondaires.length > 0 && (
        <div ref={zoneRef} className={defile ? "nx-marquee" : "w-full px-6"} aria-label="Partenaires Nexus">
          <div
            className={
              defile
                ? "nx-marquee-track"
                : "flex flex-wrap items-start justify-center gap-6"
            }
          >
            {boucle.map((p, i) => {
              const doublon = defile && i >= secondaires.length;
              return (
                <div key={`${p.id}-${i}`} aria-hidden={doublon ? "true" : undefined}>
                  <div className={doublon ? "pointer-events-none" : undefined} tabIndex={doublon ? -1 : undefined}>
                    <Creneau p={p} grand={false} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
