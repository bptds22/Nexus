"use client";

/* ═══════════════════════════════════════════════════════════════
   /join/[code] — page PUBLIQUE d'un code d'adhésion d'équipe.

   Point d'entrée du transfer portal : un entraîneur dicte un code au gymnase
   ou l'envoie par message, l'athlète atterrit ici SANS COMPTE. La page ne
   rattache rien — elle nomme l'équipe derrière le code et oriente vers le bon
   canal (app iOS, signup web), en mémorisant le code au passage.

   RÉSOLUTION EN ANON. resolve_team_join_token est la seule fonction du portail
   ouverte à `anon`. Elle renvoie soit AUCUNE ligne (code inexistant), soit une
   ligne dont TOUS les détails sont null si le code est invalide. Les deux cas
   reçoivent ici la MÊME copie générique : rétablir la distinction côté client
   redonnerait l'oracle d'énumération que le serveur prend soin de ne pas offrir.

   LE CODE EST AFFICHÉ EN GROS, dans les trois branches. C'est le seul canal de
   transport fiable : sessionStorage ne survit pas à un lien de confirmation
   ouvert dans un autre navigateur, et l'app native ne partage pas le stockage
   du navigateur. Si l'athlète ne retient qu'une chose de cet écran, c'est son
   code.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import NexusLogo from "@/components/ui/NexusLogo";
import { createClient } from "@/lib/supabase/client";
import {
  resolveTeamJoinToken,
  normalizeJoinCode,
  isPlausibleJoinCode,
  stashJoinCode,
  type ResolvedJoinTeam,
} from "@/lib/queries/athlete/teamAttachment";
import { APP_STORE_URL, PLAY_STORE_URL, detectDevice, type DeviceKind } from "@/lib/config/appStores";

type State =
  | { phase: "loading" }
  | { phase: "invalid" }
  | { phase: "valid"; team: ResolvedJoinTeam };

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const raw = Array.isArray(params?.code) ? params.code[0] : params?.code ?? "";
  const code = normalizeJoinCode(decodeURIComponent(raw));

  const [state, setState] = useState<State>({ phase: "loading" });
  // "desktop" au premier rendu des DEUX côtés (detectDevice n'a pas de
  // navigator sur le serveur) → pas de divergence d'hydratation ; l'affinage
  // se fait au montage.
  const [device, setDevice] = useState<DeviceKind>("desktop");
  const [reveal, setReveal] = useState(false);

  useEffect(() => { setDevice(detectDevice()); }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isPlausibleJoinCode(code)) { setState({ phase: "invalid" }); return; }
      const team = await resolveTeamJoinToken(createClient(), code);
      if (!alive) return;
      if (!team || !team.isValid) { setState({ phase: "invalid" }); return; }
      // Mémorisé DÈS la résolution : l'athlète peut partir vers le signup par
      // n'importe quel bouton, le code doit déjà être en poche.
      stashJoinCode(code);
      setState({ phase: "valid", team });
    })();
    return () => { alive = false; };
  }, [code]);

  useEffect(() => {
    if (state.phase === "loading") return;
    const t = setTimeout(() => setReveal(true), 40);
    return () => clearTimeout(t);
  }, [state.phase]);

  return (
    <main className="min-h-screen bg-[#111317] px-5 py-10 flex flex-col items-center">
      <NexusLogo variant="white" height={32} priority />

      <div
        className="w-full max-w-md mt-8"
        style={{ opacity: reveal ? 1 : 0, transition: "opacity 400ms ease-out" }}
      >
        {state.phase === "loading" && <LoadingCard />}
        {state.phase === "invalid" && <InvalidCard />}
        {state.phase === "valid" && (
          <ValidCard team={state.team} code={code} device={device} />
        )}
      </div>
    </main>
  );
}

/* ── États ─────────────────────────────────────────────────── */

function LoadingCard() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#1A1D24] p-6">
      <div className="h-4 w-32 rounded bg-white/10" />
      <div className="mt-4 h-7 w-52 rounded bg-white/10" />
      <div className="mt-3 h-4 w-40 rounded bg-white/[0.06]" />
    </div>
  );
}

/** Copie STRICTEMENT générique : ni la raison (révoqué / expiré / quota
 *  atteint / équipe inactive), ni le nom de l'équipe. Le serveur masque déjà
 *  tout ça ; l'écran ne doit pas le reconstituer. */
function InvalidCard() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#1A1D24] p-6 text-center">
      {/* Même traitement que le repli de la carte valide : l'icône Nexus
          plutôt qu'un emoji. Volontairement en niveaux de gris ici — le rouge
          de marque sur un écran d'échec se lirait comme un signal d'erreur,
          alors que le code peut simplement être expiré. */}
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04]">
        <NexusLogo variant="white" iconOnly height={24} className="opacity-40 grayscale" />
      </div>
      <h1 className="font-head mt-4 text-[20px] font-bold uppercase tracking-tight text-white">
        Ce code n&apos;est plus valide
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-white/55">
        Demande un nouveau code à ton entraîneur — il peut en générer un en
        quelques secondes.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block text-[13px] font-semibold text-[#E63946] underline underline-offset-2"
      >
        Retour à l&apos;accueil
      </Link>
    </div>
  );
}

function ValidCard({ team, code, device }: { team: ResolvedJoinTeam; code: string; device: DeviceKind }) {
  const meta = [team.schoolName, team.sportName, team.season].filter(Boolean).join(" · ");

  return (
    <>
      {/* ── Équipe ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/[0.06] bg-[#1A1D24] p-6 text-center">
        {team.schoolLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={team.schoolLogoUrl}
            alt=""
            className="mx-auto h-16 w-16 rounded-xl object-contain"
          />
        ) : (
          // Pas de logo d'école (schools.logo_url NULL — le cas de la majorité
          // des écoles MEQ) : on retombe sur l'icône Nexus, pas sur un emoji.
          // Même boîte 64px que le logo réel, pour que la carte garde la même
          // hauteur d'une école à l'autre.
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-white/[0.04]">
            <NexusLogo variant="white" iconOnly height={32} />
          </div>
        )}

        <p className="mt-4 text-[12px] font-bold uppercase tracking-wider text-white/40">
          Tu rejoins
        </p>
        <h1 className="font-head mt-1 text-[24px] font-bold uppercase leading-tight tracking-tight text-white">
          {team.teamName}
        </h1>
        {meta ? <p className="mt-2 text-[14px] text-white/55">{meta}</p> : null}
      </div>

      {/* ── Le code, EN GROS ───────────────────────────────── */}
      <div className="mt-4 rounded-2xl border border-[#E63946]/25 bg-[#E63946]/[0.07] p-5 text-center">
        <p className="text-[12px] font-bold uppercase tracking-wider text-white/50">
          Ton code d&apos;équipe
        </p>
        <p className="mt-2 font-mono text-[34px] font-bold leading-none tracking-[0.18em] text-white break-all">
          {code}
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-white/60">
          Retiens ton code — tu l&apos;entreras à l&apos;étape « Ton équipe ».
        </p>
      </div>

      {/* ── Orientation selon l'appareil ───────────────────── */}
      <div className="mt-4 space-y-3">
        {device === "ios" && (
          <>
            <StoreButton href={APP_STORE_URL} label="Télécharger sur l'App Store" />
            <Hint>Installe l&apos;app, crée ton compte, puis entre ton code.</Hint>
            <SecondaryLink />
          </>
        )}

        {device === "android" && (
          PLAY_STORE_URL ? (
            <>
              <StoreButton href={PLAY_STORE_URL} label="Télécharger sur Google Play" />
              <Hint>Installe l&apos;app, crée ton compte, puis entre ton code.</Hint>
              <SecondaryLink />
            </>
          ) : (
            <>
              {/* L'app Android n'est pas encore publiée. Plutôt qu'un lien mort
                  vers une fiche Play inexistante, on envoie sur le web — qui
                  fait exactement le même travail. */}
              <PrimaryLink href="/auth?mode=signup" label="Créer mon compte" />
              <Hint>
                L&apos;app Android arrive bientôt. En attendant, tout fonctionne
                depuis ce navigateur.
              </Hint>
            </>
          )
        )}

        {device === "desktop" && (
          <>
            {/* `?mode=signup` seul : usePartialSignup ne LIT pas `?role=`
                (l'effet de sync de /auth ne fait que l'écrire), donc l'athlète
                choisit son rôle au premier écran. */}
            <PrimaryLink href="/auth?mode=signup" label="Créer mon compte" />
            <Hint>
              Ton code est déjà retenu — il sera proposé à l&apos;étape « Ton équipe ».
            </Hint>
          </>
        )}
      </div>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-white/35">
        Tu as déjà un compte ?{" "}
        <Link href="/auth" className="text-[#E63946] underline underline-offset-2">
          Connecte-toi
        </Link>{" "}
        et entre ton code depuis tes paramètres.
      </p>
    </>
  );
}

/* ── Briques ───────────────────────────────────────────────── */

function StoreButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full rounded-2xl bg-[#E63946] px-4 py-4 text-center font-head text-[13px] font-bold uppercase tracking-widest text-white"
    >
      {label}
    </a>
  );
}

function PrimaryLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block w-full rounded-2xl bg-[#E63946] px-4 py-4 text-center font-head text-[13px] font-bold uppercase tracking-widest text-white"
    >
      {label}
    </Link>
  );
}

function SecondaryLink() {
  return (
    <Link
      href="/auth?mode=signup"
      className="block w-full rounded-2xl border border-white/[0.08] px-4 py-3.5 text-center text-[13px] font-semibold text-white/70"
    >
      Continuer dans le navigateur
    </Link>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="px-1 text-center text-[12px] leading-relaxed text-white/40">{children}</p>;
}
