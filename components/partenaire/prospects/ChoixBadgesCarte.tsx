"use client";

/* ═══════════════════════════════════════════════════════════════
   ChoixBadgesCarte — badges d'une carte prospect (W4b), facultatifs.

   Deux catalogues, les mêmes que sur la fiche d'un athlète inscrit
   (ActionsPartenaireFiche) :
   - les badges PROPRES du partenaire (W3, partenaire_mes_badges) ;
   - les badges du catalogue NEXUS (W3b) : universels, et ceux du SPORT DE LA
     CARTE ; actifs, sans contexte requis, jamais la famille honneur — la
     règle de partenaire_prospect_enregistrer, qui la revérifie.
   Au plus 10 de chaque sorte (garde serveur). Rien n'est posé ici : les
   badges partent avec la carte et ne passent sur le profil qu'au transfert,
   où le serveur saute ceux déjà portés (avec leur raison).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { chargerMesBadgesPartenaire, type BadgeCatalogue } from "@/lib/badges/partenaire";
import { badgeSvgPath } from "@/lib/config/badges";

const MAX_PAR_SORTE = 10;

interface BadgeNexus { id: string; code: string; libelle: string; famille: "universel" | "sport" }

export default function ChoixBadgesCarte({
  sportId,
  partenaire,
  nexus,
  onChange,
}: {
  sportId: string;
  partenaire: string[];
  nexus: string[];
  onChange: (v: { partenaire: string[]; nexus: string[] }) => void;
}) {
  const [propres, setPropres] = useState<BadgeCatalogue[]>([]);
  const [catalogue, setCatalogue] = useState<BadgeNexus[]>([]);

  useEffect(() => {
    chargerMesBadgesPartenaire(createClient())
      .then(setPropres)
      .catch((e) => console.warn("[prospects] badges propres :", e?.message ?? e));
  }, []);

  useEffect(() => {
    if (!sportId) { setCatalogue([]); return; }
    let vivant = true;
    void (async () => {
      const supabase = createClient();
      const [{ data: badges }, { data: duSport }] = await Promise.all([
        supabase.from("badges").select("id, code, libelle, famille, ordre")
          .eq("actif", true).eq("requiert_contexte", false).in("famille", ["universel", "sport"]),
        supabase.from("badge_sports").select("badge_id").eq("sport_id", sportId),
      ]);
      if (!vivant) return;
      const permis = new Set(((duSport ?? []) as { badge_id: string }[]).map((r) => r.badge_id));
      const liste = ((badges ?? []) as (BadgeNexus & { ordre: number })[])
        .filter((b) => b.famille === "universel" || permis.has(b.id))
        .sort((a, b) => (a.famille === b.famille ? a.ordre - b.ordre : a.famille === "universel" ? -1 : 1));
      setCatalogue(liste);
      // Un badge de sport choisi pour un autre sport tombe quand le sport change.
      const gardes = nexus.filter((id) => liste.some((b) => b.id === id));
      if (gardes.length !== nexus.length) onChange({ partenaire, nexus: gardes });
    })();
    return () => { vivant = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sportId]);

  const basculer = (sorte: "partenaire" | "nexus", id: string) => {
    const liste = sorte === "partenaire" ? partenaire : nexus;
    const suivante = liste.includes(id) ? liste.filter((x) => x !== id) : liste.length >= MAX_PAR_SORTE ? liste : [...liste, id];
    onChange(sorte === "partenaire" ? { partenaire: suivante, nexus } : { partenaire, nexus: suivante });
  };

  const puce = (actif: boolean) =>
    `flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-[12px] font-semibold transition-colors ${
      actif ? "border-[#F59E0B]/60 bg-[#F59E0B]/12 text-white" : "border-[#2a2d36] text-[#9CA3AF] hover:text-white hover:border-[#4a4d56]"
    }`;

  return (
    <div className="space-y-4" data-choix-badges-carte>
      {propres.length > 0 && (
        <div>
          <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Tes badges</p>
          <div className="flex flex-wrap gap-2">
            {propres.map((b) => {
              const actif = partenaire.includes(b.id);
              return (
                <button key={b.id} type="button" aria-pressed={actif} onClick={() => basculer("partenaire", b.id)} className={puce(actif)}>
                  {b.iconeUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.iconeUrl} alt="" className="w-6 h-6 object-contain" />
                  ) : (
                    <span className="w-6 h-6 rounded-full border border-[#2D3748] flex items-center justify-center text-[11px] font-bold">{b.libelle.slice(0, 1).toUpperCase()}</span>
                  )}
                  {b.libelle}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div>
        <p className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#6b7280] mb-2">Badges Nexus</p>
        {catalogue.length === 0 ? (
          <p className="text-[12px] text-[#6b7280]">{sportId ? "Chargement…" : "Choisis d'abord le sport."}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {catalogue.map((b) => {
              const actif = nexus.includes(b.id);
              const svg = badgeSvgPath(b.code);
              return (
                <button key={b.id} type="button" aria-pressed={actif} onClick={() => basculer("nexus", b.id)} className={puce(actif)}
                  title={b.famille === "sport" ? "Badge de sport" : "Badge universel"}>
                  {svg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={svg} alt="" className="w-6 h-6 object-contain" />
                  ) : <span className="w-6 h-6" />}
                  {b.libelle}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <p className="text-[11px] text-[#6b7280]">
        Les badges passent sur le profil du jeune seulement s&apos;il confirme que c&apos;est lui. Un badge qu&apos;il porte déjà est sauté.
      </p>
    </div>
  );
}
