"use client";

/* ═══════════════════════════════════════════════════════════════
   /app — la page qu'on voit quand le serveur n'a PAS redirigé :
   ordinateur, iPad (qui se déclare Mac), robot d'aperçu, ou navigateur
   intégré Instagram / Facebook. Voir app/app/page.tsx.

   Au montage, deux rattrapages que seul le client peut faire :
     • navigateur INTÉGRÉ : on TENTE l'ouverture du store — intention
       Android (ouvre l'app Play au lieu de la fiche web dans Instagram),
       lien App Store sur iOS. Si la vue intégrée bloque la navigation, les
       boutons restent : un tap de l'utilisateur est un geste, que la vue
       laisse passer là où elle bloque une redirection automatique.
     • iPad (vu « desktop » par le serveur) : redirection vers l'App Store.
   Le rendu initial est identique des deux côtés (detectDevice rend
   « desktop » sans navigator) : pas d'écart d'hydratation.
   ═══════════════════════════════════════════════════════════════ */

import Link from "next/link";
import { useEffect, useState } from "react";
import { detectDevice, type DeviceKind } from "@/lib/config/appStores";

type Props = {
  appStoreUrl: string;
  playStoreUrl: string;
  intentionAndroid: string | null;
  integre: boolean;
};

export default function AppLanding({ appStoreUrl, playStoreUrl, intentionAndroid, integre }: Props) {
  const [device, setDevice] = useState<DeviceKind>("desktop");

  useEffect(() => {
    const d = detectDevice();
    setDevice(d);
    if (integre) {
      if (d === "android") window.location.href = intentionAndroid ?? playStoreUrl;
      else if (d === "ios") window.location.href = appStoreUrl;
    } else if (d === "ios") {
      // iPad : le serveur l'a pris pour un Mac.
      window.location.replace(appStoreUrl);
    }
  }, [integre, appStoreUrl, playStoreUrl, intentionAndroid]);

  // Sur Android intégré, le bouton Play porte l'intention elle-même.
  const lienPlay = integre && device === "android" && intentionAndroid ? intentionAndroid : playStoreUrl;
  const ordre = device === "android" ? ["play", "apple"] : ["apple", "play"];

  return (
    // Fond TRANSPARENT : le #111317, le playbook et le halo sont posés par le
    // parent (app/app/page.tsx). Un fond ici masquerait le playbook.
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-12 text-white">
      <div className="w-full max-w-sm text-center">
        <img
          src="/brand/logo-white-red.png"
          alt="Nexus"
          width={1579}
          height={552}
          className="mx-auto h-auto w-44"
        />

        <h1 className="mt-8 font-head text-[26px] font-bold uppercase leading-tight tracking-tight">
          Télécharge l&apos;app
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-white/70">
          Fais-toi voir, fais-toi recruter. Le recrutement sportif au Québec, dans ta poche.
        </p>

        {integre && device !== "desktop" && (
          <p className="mt-6 rounded-xl border border-white/[0.08] bg-[#1A1D24] px-4 py-3 text-[13px] leading-relaxed text-white/70">
            Si le store ne s&apos;ouvre pas tout seul, touche le bouton ci-dessous.
          </p>
        )}

        <div className="mt-8 flex flex-col items-center gap-4">
          {ordre.map((store) =>
            store === "apple" ? (
              <a key="apple" href={appStoreUrl} className="block" aria-label="Télécharger dans l'App Store">
                <img
                  src="/carte/app-store-fr.png"
                  alt="Télécharger dans l'App Store"
                  width={3840}
                  height={1215}
                  className="h-14 w-auto"
                />
              </a>
            ) : (
              <a key="play" href={lienPlay} className="block" aria-label="Disponible sur Google Play">
                <img
                  src="/carte/google-play-fr.webp"
                  alt="Disponible sur Google Play"
                  className="h-14 w-auto"
                />
              </a>
            ),
          )}
        </div>

        <Link
          href="/auth?mode=signup"
          className="mt-10 inline-block text-[13px] font-semibold text-white/60 underline-offset-4 hover:text-white hover:underline"
        >
          Ou crée ton compte sur le web
        </Link>
      </div>
    </main>
  );
}
