"use client";

/* ═══════════════════════════════════════════════════════════════
   Meta Pixel sous consentement — monté une fois dans le layout racine.

   - Bandeau de consentement sur les routes publiques tant qu'aucun choix
     n'est posé (ou rouvert par « Gérer les témoins »).
   - Le script fbevents.js n'est injecté QU'APRÈS « Accepter ». Le snippet
     officiel de Meta n'est pas collé tel quel : il tirerait avant le
     consentement. Pas d'<noscript><img> non plus — il ne peut pas
     respecter un refus.
   - Avant init : autoConfig coupé (pas de collecte automatique des clics
     ni des champs de formulaire) et disablePushState (le pixel ne tire
     pas seul un PageView à chaque navigation SPA — c'est nous qui
     décidons, route publique par route publique).
   - Inscription OAuth : /auth/callback (serveur) dépose le rôle dans le
     cookie nx_meta_inscription ; on le consomme ici une seule fois.
   - Rien de tout ça dans le build Capacitor ni dans une WebView native.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Script from "next/script";
import { usePathname } from "next/navigation";
import {
  EVT_CHANGEMENT, EVT_OUVRIR, ecrireConsentement, lireConsentement,
} from "@/lib/meta/consentement";
import { envoyerEvenementMeta, estWebNavigateur } from "@/lib/meta/suivi";
import {
  INSCRIPTION_COOKIE, META_PIXEL_ID, ROLES_META, estRoutePublique, urlSansIdentifiant,
  type ConsentValue, type RoleMeta,
} from "@/lib/meta/regles";

const EVT_PRET = "nx-fbq-pret";

declare global {
  interface Window { __nxDernierPV?: string }
}

// Stub officiel de Meta (file d'attente fbq + chargement asynchrone de
// fbevents.js), suivi de NOS réglages — jamais de PageView ici.
const SNIPPET = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq.disablePushState=true;
fbq('set','autoConfig',false,'${META_PIXEL_ID}');
fbq('init','${META_PIXEL_ID}');
window.dispatchEvent(new Event('${EVT_PRET}'));`;

function consommerInscriptionOAuth(): RoleMeta | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${INSCRIPTION_COOKIE}=([^;]*)`));
  if (!m) return null;
  document.cookie = `${INSCRIPTION_COOKIE}=; Max-Age=0; Path=/`;
  const v = decodeURIComponent(m[1]);
  return (ROLES_META as readonly string[]).includes(v) ? (v as RoleMeta) : null;
}

function abonnerConsentement(cb: () => void) {
  window.addEventListener(EVT_CHANGEMENT, cb);
  return () => window.removeEventListener(EVT_CHANGEMENT, cb);
}
function abonnerPret(cb: () => void) {
  window.addEventListener(EVT_PRET, cb);
  return () => window.removeEventListener(EVT_PRET, cb);
}
const sansAbonnement = () => () => {};

export default function MetaPixel() {
  const pathname = usePathname();
  // Côté serveur : web=false, consentement=undefined → rien n'est rendu,
  // donc aucun écart d'hydratation et aucun flash du bandeau.
  const web = useSyncExternalStore(
    sansAbonnement, () => Boolean(META_PIXEL_ID) && estWebNavigateur(), () => false,
  );
  const consentement = useSyncExternalStore<ConsentValue | null | undefined>(
    abonnerConsentement, lireConsentement, () => undefined,
  );
  const pret = useSyncExternalStore(abonnerPret, () => Boolean(window.fbq), () => false);
  const [rouvert, setRouvert] = useState(false);

  useEffect(() => {
    const surOuvrir = () => setRouvert(true);
    window.addEventListener(EVT_OUVRIR, surOuvrir);
    return () => window.removeEventListener(EVT_OUVRIR, surOuvrir);
  }, []);

  const accorde = web && consentement === "granted";

  // PageView : routes publiques seulement, URL sans identifiant, une fois
  // par chemin (pathname change = navigation App Router).
  useEffect(() => {
    if (!accorde || !window.fbq) return;
    if (!estRoutePublique(pathname) || !urlSansIdentifiant(location.href)) return;
    if (window.__nxDernierPV === pathname) return;
    window.__nxDernierPV = pathname;
    // trackSingle, pas track : fbevents ignore en silence tout
    // track('PageView') après le premier du document (constaté en test,
    // v2.9.415) — les navigations App Router n'auraient rien envoyé.
    window.fbq("trackSingle", META_PIXEL_ID, "PageView");
  }, [accorde, pathname, pret]);

  // Inscription OAuth signalée par /auth/callback.
  useEffect(() => {
    if (!accorde) return;
    const role = consommerInscriptionOAuth();
    if (role) envoyerEvenementMeta("CompleteRegistration", role);
  }, [accorde, pret]);

  if (!web) return null;

  const choisir = (v: ConsentValue) => {
    const avait = consentement === "granted" && Boolean(window.fbq);
    ecrireConsentement(v);
    setRouvert(false);
    if (v === "denied" && avait) {
      // Le script déjà chargé ne se décharge pas : on repart d'une page propre.
      try { window.fbq?.("consent", "revoke"); } catch { /* rien */ }
      location.reload();
    }
  };

  const montrerBandeau = rouvert || (consentement === null && estRoutePublique(pathname));

  return (
    <>
      {accorde && (
        <Script id="nx-meta-pixel" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: SNIPPET }} />
      )}
      {montrerBandeau && <BandeauTemoins onChoix={choisir} />}
    </>
  );
}

function BandeauTemoins({ onChoix }: { onChoix: (v: ConsentValue) => void }) {
  // « Refuser » et « Accepter » : même taille, même style, même poids.
  const bouton =
    "flex-1 sm:flex-none sm:min-w-[120px] h-11 px-5 rounded-lg border border-white/20 bg-white/5 text-white text-sm font-semibold hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 transition-colors";
  return (
    <section
      aria-label="Témoins de mesure"
      className="fixed inset-x-0 bottom-0 z-[150] p-4 pointer-events-none"
    >
      <div className="pointer-events-auto max-w-3xl mx-auto bg-[#1A1D24] border border-[#2D3748] rounded-xl shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 font-sans">
        <p className="text-sm text-[#D1D5DB] leading-relaxed flex-1">
          On utilise des témoins de mesure pour améliorer Nexus et nos publicités.{" "}
          <Link href="/confidentialite#cookies" className="underline text-white hover:text-[#E63946]">
            Politique de confidentialité
          </Link>
        </p>
        <div className="flex gap-3">
          <button type="button" className={bouton} onClick={() => onChoix("denied")}>Refuser</button>
          <button type="button" className={bouton} onClick={() => onChoix("granted")}>Accepter</button>
        </div>
      </div>
    </section>
  );
}
