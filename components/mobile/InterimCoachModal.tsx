"use client";

/* ═══════════════════════════════════════════════════════════════
   InterimCoachModal — l'alerte « entraîneur-chef par intérim »,
   servie une fois par démarrage à froid.

   Le bandeau du tableau de bord RESTE en place, web et mobile. Cette
   modale ne le remplace pas : elle le met devant les yeux au premier
   écran, parce qu'un intérim est un état à résoudre et que le bandeau
   se lit après avoir scrollé — c'est-à-dire souvent jamais.

   ── LA FORME VIENT DE ForceUpdateGate ───────────────────────────
   Overlay racine plutôt que route (« il n'y a aucune URL à ne pas
   taper »), retour Android neutralisé UNIQUEMENT pendant l'affichage,
   inerte hors Capacitor. On ne reprend PAS sa branche « souple », qui
   mémorise la fermeture : BP veut l'alerte à chaque ouverture.

   ── AUCUNE PERSISTANCE, ET POURTANT PAS DEUX FOIS ───────────────
   `dejaMontree` est un ref EN MÉMOIRE : il meurt avec le processus.
   Rien n'est écrit — ni Preferences, ni sessionStorage, ni base. Au
   prochain démarrage à froid, l'alerte revient. Mais dans UNE session
   elle ne peut pas surgir deux fois, même si la session auth se
   rafraîchit sous nos pieds.

   ── POURQUOI onAuthStateChange, ALORS QUE appStateChange EST EXCLU ─
   Ce ne sont pas les mêmes événements. `appStateChange` dit « l'app
   revient au premier plan » — écarté, il ferait resurgir la modale à
   chaque bascule d'application. `onAuthStateChange` dit « on sait
   enfin QUI est connecté ». Sans lui, rien ne s'afficherait jamais :
   au démarrage à froid la session n'est pas encore restaurée quand la
   racine monte, et `loadMyInterimTeams` rend `[]` sans session
   (interimTeams.ts:25-27) — un vide qu'on ne saurait pas distinguer
   de « cet entraîneur n'a aucun intérim ».

   ⚠️ Hooks AVANT toute condition (canon du dépôt) : la bascule native
   se fait dans l'effet, jamais par un retour anticipé devant les hooks.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import InterimCoachBanner from "@/components/shared/coach/InterimCoachBanner";
import { createClient } from "@/lib/supabase/client";
import { loadMyInterimTeams, type InterimTeam } from "@/lib/queries/coach/interimTeams";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export function InterimCoachModal() {
  const [teams, setTeams] = useState<InterimTeam[]>([]);
  const [ouverte, setOuverte] = useState(false);
  /* Une seule apparition par processus. En mémoire = rien de persisté. */
  const dejaMontree = useRef(false);

  useEffect(() => {
    if (!IS_CAPACITOR) return;
    let annule = false;
    let retirerListener: (() => void) | null = null;

    const evaluer = async () => {
      if (annule || dejaMontree.current) return;
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return; // pas encore connecté : on repassera
      if (annule || dejaMontree.current) return;

      const t = await loadMyInterimTeams(supabase);
      if (annule || dejaMontree.current) return;
      if (t.length === 0) return; // aucun intérim : rien à dire

      dejaMontree.current = true;
      setTeams(t);
      setOuverte(true);
    };

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || annule) return;

      /* Premier essai immédiat — couvre la session déjà restaurée. */
      await evaluer();

      /* Puis on attend que l'auth se prononce, au cas où elle n'était pas
         prête. Le garde `dejaMontree` rend les ré-émissions inoffensives
         (TOKEN_REFRESHED en émet régulièrement). */
      if (annule || dejaMontree.current) return;
      const supabase = createClient();
      const { data: sub } = supabase.auth.onAuthStateChange(() => { void evaluer(); });
      retirerListener = () => sub.subscription.unsubscribe();
    })();

    return () => {
      annule = true;
      retirerListener?.();
    };
  }, []);

  /* Retour Android confisqué UNIQUEMENT pendant l'affichage — même
     discipline que le mur de ForceUpdateGate : on ne revendique pas le
     back de toute l'app, seulement le temps de la modale. */
  useEffect(() => {
    if (!IS_CAPACITOR || !ouverte) return;
    let detacher: (() => void) | null = null;
    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;
      const { App } = await import("@capacitor/app");
      const h = await App.addListener("backButton", () => setOuverte(false));
      detacher = () => { void h.remove(); };
    })();
    return () => { detacher?.(); };
  }, [ouverte]);

  const fermer = useCallback(() => setOuverte(false), []);

  /* Les deux liens du bandeau mènent aux endroits où l'on AGIT. Naviguer
     sans fermer laisserait la modale par-dessus la page d'arrivée : la
     racine ne remonte pas d'une navigation à l'autre. Délégation plutôt
     que props — le bandeau reste l'implémentation unique web + mobile. */
  const fermerSiLien = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("a")) setOuverte(false);
  }, []);

  if (!IS_CAPACITOR || !ouverte) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tu es entraîneur-chef par intérim"
      /* z-[90] : SOUS le mur de mise à jour (z-[100]). Un binaire périmé
         est un blocage, un intérim est une information — l'ordre compte. */
      className="fixed inset-0 z-[90] flex items-end justify-center"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 16px)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
        paddingLeft: 16,
        paddingRight: 16,
      }}
    >
      <button
        type="button"
        aria-label="Fermer"
        onClick={fermer}
        className="absolute inset-0 bg-black/70"
        style={{ backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}
      />

      <div className="relative w-full max-w-[520px] max-h-full overflow-y-auto rounded-3xl bg-[#111317] border border-white/[0.08] p-3">
        {/* Le bandeau EST le contenu : une seule copie du texte, partagée
            avec les deux tableaux de bord. Rien n'est redit ici. */}
        <div onClick={fermerSiLien}>
          <InterimCoachBanner teams={teams} />
        </div>

        <button
          type="button"
          onClick={fermer}
          className="mt-3 w-full rounded-2xl bg-[#1A1D24] border border-white/[0.08] px-4 py-3.5 font-head text-[13px] font-bold uppercase tracking-widest text-white active:bg-white/[0.06]"
        >
          J&apos;ai compris
        </button>
      </div>
    </div>
  );
}
