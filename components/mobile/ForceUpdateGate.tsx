"use client";

/* ═══════════════════════════════════════════════════════════════
   ForceUpdateGate — le mur, et la bannière.

   Monté dans app/layout.tsx AU-DESSUS de SplashGate : la requête part
   pendant l'animation du splash, qui attend déjà MIN_SPLASH_MS = 2000 ms au
   démarrage à froid. Le contrôle est donc gratuit en temps perçu.

   ── UN OVERLAY, PAS UNE ROUTE ───────────────────────────────────
   Une route /mise-a-jour serait atteignable, quittable, et devrait être
   exclue de chaque garde d'auth existante. Un overlay rendu à la racine ne
   l'est pas : il n'y a aucune URL à ne pas taper.

   ── LE BOUTON RETOUR ANDROID DOIT ÊTRE NEUTRALISÉ ───────────────
   Sinon il quitte l'app ou navigue derrière le mur. `lib/platform/app.ts`
   contient bien un listener `backButton` — mais il n'a AUCUN appelant, c'est
   du code mort (même dette que `lib/platform/haptics.ts`). Le comportement
   par défaut de Capacitor s'applique donc aujourd'hui. Le gate pose son
   propre listener TANT QU'IL EST AFFICHÉ, et le retire en sortant : il ne
   revendique pas le back de toute l'app, seulement le temps du mur.

   ── CAPACITOR SEULEMENT ─────────────────────────────────────────
   Le web n'a pas de binaire à mettre à jour : un usager qui recharge a déjà
   la dernière version. Le gate est inerte hors natif, et `App.getInfo()`
   n'y est de toute façon pas disponible.

   ⚠️ Hooks AVANT toute condition (canon du dépôt) — la bascule native se
   fait dans l'effet, pas par un retour anticipé devant les hooks.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import NexusLogo from "@/components/ui/NexusLogo";
import { createClient } from "@/lib/supabase/client";
import { APP_STORE_URL, storeUrlPour } from "@/lib/config/appStores";
import {
  deciderVerdict,
  fermerSouple,
  lireReglages,
  memoriserVerdict,
  sessionDejaValidee,
  soupleDejaFermee,
  verdictDurEnCache,
  type Plateforme,
  type Verdict,
} from "@/lib/config/versionGate";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";
const COURRIEL_SUPPORT = "info@nexussports.ca";

export function ForceUpdateGate() {
  const [verdict, setVerdict] = useState<Verdict>({ type: "a-jour" });
  const [urlStore, setUrlStore] = useState<string>(APP_STORE_URL);
  const [souplemasquee, setSoupleMasquee] = useState<boolean>(false);

  useEffect(() => {
    if (!IS_CAPACITOR) return;
    let annule = false;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const brut = Capacitor.getPlatform();
      if (brut !== "ios" && brut !== "android") return;
      const plateforme: Plateforme = brut;

      const { App } = await import("@capacitor/app");
      let installee: string | null = null;
      try {
        installee = (await App.getInfo()).version || null;
      } catch {
        /* getInfo indisponible → version inconnue → deciderVerdict laisse
           passer. On ne mure personne sur une information qu'on n'a pas. */
      }
      if (annule) return;

      /* Un blocage déjà constaté s'applique AVANT toute requête : hors ligne,
         c'est ce qui empêche « couper le réseau » d'être une porte de
         sortie. Il sera défait par la première lecture qui dit le contraire. */
      const enCache = verdictDurEnCache(installee);
      if (enCache) setVerdict(enCache);

      /* MPA : la session déjà validée nous dispense de la requête, sinon
         elle repartirait à chaque navigation. */
      if (!enCache && sessionDejaValidee()) return;

      const reglages = await lireReglages(createClient());
      if (annule) return;

      if (!reglages) {
        /* FAIL-OPEN sur erreur — mais le blocage en cache, lui, tient. */
        return;
      }

      const v = deciderVerdict(installee, plateforme, reglages);
      memoriserVerdict(v);
      /* `storeUrlPour` vit dans appStores.ts — l'ordre code-puis-surcharge y
         est documenté une seule fois, pour tous les appelants. */
      setUrlStore(storeUrlPour(plateforme, plateforme === "ios" ? reglages.urlIos : reglages.urlAndroid));
      if (v.type === "souple" && soupleDejaFermee()) setSoupleMasquee(true);
      setVerdict(v);
    })();

    return () => { annule = true; };
  }, []);

  /* Back Android confisqué UNIQUEMENT pendant le mur. */
  useEffect(() => {
    if (!IS_CAPACITOR || verdict.type !== "dur") return;
    let detacher: (() => void) | null = null;
    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;
      const { App } = await import("@capacitor/app");
      const h = await App.addListener("backButton", () => { /* avalé */ });
      detacher = () => { void h.remove(); };
    })();
    return () => { detacher?.(); };
  }, [verdict.type]);

  const ouvrirMagasin = useCallback(() => {
    window.open(urlStore, "_blank");
  }, [urlStore]);

  const fermerBanniere = useCallback(() => {
    fermerSouple();
    setSoupleMasquee(true);
  }, []);

  if (!IS_CAPACITOR) return null;

  /* ── LE MUR ─────────────────────────────────────────────────── */
  if (verdict.type === "dur") {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mise à jour requise"
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-8 text-center"
        style={{
          backgroundColor: "#111317",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <NexusLogo height={34} priority />

        <h1 className="font-head text-[26px] font-black uppercase tracking-tight text-white mt-9">
          Mise à jour requise
        </h1>

        <p className="text-[15px] leading-relaxed text-[#9CA3AF] mt-4 max-w-[320px]">
          {verdict.message}
        </p>

        <button
          type="button"
          onClick={ouvrirMagasin}
          className="mt-9 w-full max-w-[320px] flex items-center justify-center gap-2.5 bg-[#E63946] text-white rounded-2xl px-6 py-4 font-head font-bold text-[14px] uppercase tracking-widest active:bg-[#D42B22] shadow-[0_0_24px_rgba(230,57,70,0.3)]"
        >
          Mettre à jour
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
          </svg>
        </button>

        {/* Ces deux nombres sont là POUR LE SUPPORT : quand un usager écrit,
            il les recopie et BP sait tout sans avoir à deviner. */}
        <p className="mt-7 text-[12px] text-[#6b7280] tabular-nums">
          Version installée {verdict.installee} · requise {verdict.requise}
        </p>

        <a
          href={`mailto:${COURRIEL_SUPPORT}`}
          className="mt-2.5 text-[12px] text-[#6b7280] underline underline-offset-2 active:text-white"
        >
          Un problème&nbsp;? Écris-nous
        </a>
      </div>
    );
  }

  /* ── LA BANNIÈRE ────────────────────────────────────────────── */
  if (verdict.type === "souple" && !souplemasquee) {
    return (
      <div
        className="fixed left-0 right-0 z-[90] px-3"
        style={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
      >
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{ backgroundColor: "#1A1D24", border: "0.5px solid rgba(255,255,255,0.10)" }}
        >
          <span className="w-9 h-9 rounded-xl bg-[#E63946]/10 border border-[#E63946]/30 flex items-center justify-center shrink-0">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5" /><path d="M5 12l7-7 7 7" />
            </svg>
          </span>

          <button
            type="button"
            onClick={ouvrirMagasin}
            className="min-w-0 flex-1 text-left"
          >
            <span className="block text-[14px] font-bold text-white">
              Une nouvelle version est disponible
            </span>
            <span className="block text-[12px] text-[#6b7280]">
              Version {verdict.recommandee} · Mettre à jour
            </span>
          </button>

          <button
            type="button"
            onClick={fermerBanniere}
            aria-label="Fermer"
            className="w-8 h-8 flex items-center justify-center text-[#6b7280] active:text-white shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return null;
}
