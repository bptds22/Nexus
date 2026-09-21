"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  chargerTableau, revendiquer, basculerBadge, monLien, regenererLien, urlInvitation,
  MESSAGES, MESSAGE_COURRIEL_REQUIS, PALIERS,
  type TableauAmbassadeur, type LigneRevendication,
} from "@/lib/queries/athlete/ambassadeur";
import { partagerLien } from "@/lib/partage/partagerLien";

/* ═══════════════════════════════════════════════════════════════════════════
   /athlete/ambassadeur — l'athlète INVITE ses coéquipiers par un lien.

   ── DEPUIS LE 2026-09-22 (décisions BP du 2026-09-21) ──────────────────────
   Le chemin principal est le LIEN PERSONNEL : « Inviter mes coéquipiers »
   ouvre la feuille de partage. Une recrue compte à la fin de son inscription
   (consentements passés). La déclaration n'est plus qu'un SECOURS, au second
   plan, par COURRIEL EXACT — la recherche par nom, école ou équipe n'existe
   plus côté serveur.

   ── GABARIT ─────────────────────────────────────────────────────────────────
   Calqué sur /athlete/transfert : un `page.tsx` seul, aucune branche
   IS_CAPACITOR, `pb-8` + `nx-safe-top` sur le header (le layout athlète ne
   pose AUCUN padding-top en Capacitor — chaque page gère son haut). La garde
   d'accès est entièrement héritée du layout : session, rôle, onboarding,
   désactivation, maintenance. Rien à écrire ici.

   ⚠ ET `nx-mobile-pb-tabbar` SUR LES DEUX CONTENEURS RACINES (2026-09-16).
   Sans branche IS_CAPACITOR, cette page rend son markup web sur l'appareil —
   où la MobileTabBar est en position fixe par-dessus. `pb-8` (32px) ne suffit
   pas à la dégager. La classe (app/globals.css, miroir JS TABBAR_HEIGHT dans
   lib/config/mobileTokens.ts) réserve `64px + safe-area-inset-bottom`.
   LES DEUX COHABITENT, ce n'est pas un doublon : la classe dégage la barre,
   `pb-8` donne la respiration au-dessus. Même combinaison que
   /athlete/visibilite:71. Ne jamais écrire le 64 en dur ici.

   ── CE QUE CET ÉCRAN NE MONTRE JAMAIS ───────────────────────────────────────
   · Le JETON du lien : il part dans la feuille de partage (ou le
     presse-papier), il ne s'affiche pas.
   · L'identité des recrues au-delà du PRÉNOM (décision BP) — la projection
     `ambassadeur_mon_tableau()` ne rend rien d'autre.
   · Ce que la base sait d'une adresse refusée : « deja_parrainee » ne dit pas
     « quelqu'un d'autre l'a déclarée ».

   ── LE BADGE N'EST JAMAIS IMPOSÉ ────────────────────────────────────────────
   Au palier 5, il se pose tout seul s'il reste une place ; sinon il devient
   DISPONIBLE. La bascule est ici, et elle est le seul chemin : le catalogue
   porte `ambassadeur` en `actif = false`, donc aucun picker ne le propose.
   ═══════════════════════════════════════════════════════════════════════════ */

const OR = "#F59E0B";

/* Le lien de la story (palier 3). ABSOLU et en dur, pas `location.origin` :
   il finit dans une bio Instagram, collé depuis un téléphone qui a très bien
   pu ouvrir l'app par une préproduction ou une adresse LAN. */
const MA_STORY = "https://nexussports.ca/ma-story";

const TITRE_PARTAGE = "Rejoins-moi sur Nexus";
const TEXTE_PARTAGE =
  "Crée ton profil d'athlète sur Nexus et fais-toi voir des recruteurs des cégeps. C'est gratuit.";

export default function AthleteAmbassadeurPage() {
  const [tableau, setTableau] = useState<TableauAmbassadeur | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [jeton, setJeton] = useState<string | null>(null);
  const [partage, setPartage] = useState(false);
  const [confirmerRegen, setConfirmerRegen] = useState(false);
  const [regen, setRegen] = useState(false);

  const [courriel, setCourriel] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [bascule, setBascule] = useState(false);

  const montrer = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4200); };

  const recharger = useCallback(async () => {
    try {
      setTableau(await chargerTableau());
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { recharger(); }, [recharger]);

  /* ── Inviter ───────────────────────────────────────────────────────────
     Le jeton est demandé au PREMIER clic, pas au chargement : ambassadeur_
     mon_lien crée le lien s'il n'existe pas, et un athlète qui ne fait que
     passer n'a pas à en recevoir un. Ensuite il est gardé en mémoire. */
  const inviter = async () => {
    if (partage) return;
    setPartage(true);
    try {
      const j = jeton ?? await monLien();
      setJeton(j);
      const issue = await partagerLien({ url: urlInvitation(j), titre: TITRE_PARTAGE, texte: TEXTE_PARTAGE });
      if (issue === "copie") montrer("Lien copié — colle-le dans un message à tes coéquipiers.");
      else if (issue === "echec") montrer("Impossible de partager ou de copier le lien sur cet appareil.");
      // "partage" : la feuille s'est occupée de tout ; "annule" : rien à dire.
    } catch (e) {
      montrer(e instanceof Error ? e.message : "Réessaie dans un instant.");
    } finally {
      setPartage(false);
    }
  };

  const regenerer = async () => {
    setRegen(true);
    try {
      setJeton(await regenererLien());
      setConfirmerRegen(false);
      montrer("Nouveau lien créé. L'ancien ne fonctionne plus.");
    } catch (e) {
      montrer(e instanceof Error ? e.message : "Réessaie dans un instant.");
    } finally {
      setRegen(false);
    }
  };

  /* ── Déclarer (secours) ────────────────────────────────────────────────── */
  const courrielPlausible = /\S+@\S+\.\S+/.test(courriel.trim());
  const declarer = async () => {
    if (!courrielPlausible || envoi) return;
    setEnvoi(true);
    try {
      const r = await revendiquer(courriel);
      if (r.motif_precis === "courriel_requis") {
        montrer(MESSAGE_COURRIEL_REQUIS);
      } else if (r.ok) {
        montrer(r.prenom ? `C'est confirmé — ${r.prenom} compte dans tes recrues.` : MESSAGES.confirmee);
        setCourriel("");
        window.dispatchEvent(new Event("notifications-updated"));
      } else {
        montrer(MESSAGES[r.motif] ?? "Réessaie dans un instant.");
      }
    } catch (e) {
      montrer(e instanceof Error ? e.message : "Réessaie dans un instant.");
    } finally {
      /* Un refus consomme quand même un essai (borne d'énumération) : on
         rafraîchit pour que « il te reste N essais » ne mente pas. */
      await recharger();
      setEnvoi(false);
    }
  };

  const changerBadge = async (actif: boolean) => {
    setBascule(true);
    try {
      const r = await basculerBadge(actif);
      if (r.ok) {
        montrer(actif ? "Badge ajouté à ta fiche." : "Badge retiré de ta fiche.");
      } else if (r.motif === "plafond") {
        montrer("Ta ligne de badges est pleine (5). Retires-en un depuis ton profil, puis reviens.");
      } else if (r.motif === "palier_non_atteint") {
        montrer("Il te faut 5 recrues confirmées.");
      } else {
        montrer("Impossible pour l'instant.");
      }
      await recharger();
    } catch (e) {
      montrer(e instanceof Error ? e.message : "Impossible pour l'instant.");
    } finally {
      setBascule(false);
    }
  };

  const atteint = useCallback(
    (p: number) => (tableau?.paliers ?? []).includes(p),
    [tableau],
  );

  /* COPIE du lien de story — `navigator.clipboard` n'existe QUE sur une
     origine sécurisée ; sans repli, le bouton ne ferait rien en http sur une
     adresse LAN. D'où le textarea + execCommand, et un dernier repli qui
     AFFICHE l'adresse (elle ne porte aucun jeton, elle). */
  const copierLienStory = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(MA_STORY);
        montrer("Lien copié — colle-le dans ta bio.");
        return;
      }
      const z = document.createElement("textarea");
      z.value = MA_STORY;
      z.setAttribute("readonly", "");
      z.style.position = "fixed";
      z.style.opacity = "0";
      document.body.appendChild(z);
      z.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(z);
      montrer(ok ? "Lien copié — colle-le dans ta bio." : MA_STORY);
    } catch {
      montrer(MA_STORY);
    }
  }, []);

  const prochain = useMemo(() => {
    const n = tableau?.confirmes ?? 0;
    return PALIERS.find((p) => n < p) ?? null;
  }, [tableau]);

  if (chargement) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-8 nx-mobile-pb-tabbar">
        <div className="h-40 flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const n = tableau?.confirmes ?? 0;
  const clics = tableau?.lien?.clics_30j ?? 0;
  const parLien = tableau?.lien?.inscriptions ?? 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-8 nx-mobile-pb-tabbar">
      <header className="mb-6 nx-safe-top">
        <h1 className="font-head text-[26px] font-black text-white uppercase tracking-tight">
          Ambassadeur
        </h1>
        <p className="text-[13px] text-[#9CA3AF] mt-1">
          Invite tes coéquipiers avec ton lien personnel. Chaque ami qui s&apos;inscrit compte dans tes recrues.
        </p>
      </header>

      {erreur && (
        <div className="mb-5 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3">
          <p className="text-[13px] text-[#FCA5A5]">{erreur}</p>
        </div>
      )}

      {/* ── Compteur + paliers ─────────────────────────────────── */}
      <section className="rounded-xl border border-[#2D3748] bg-[#1A1D24] p-5 mb-5">
        <div className="flex items-end gap-3 flex-wrap">
          <span className="font-head text-[42px] leading-none font-black" style={{ color: OR }}>{n}</span>
          <span className="text-[13px] text-[#9CA3AF] pb-1.5">
            {n <= 1 ? "recrue confirmée" : "recrues confirmées"}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          {PALIERS.map((p) => {
            const ok = (tableau?.paliers ?? []).includes(p);
            return (
              <div
                key={p}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-center transition-colors ${
                  ok ? "border-[#F59E0B]/45 bg-[#F59E0B]/10" : "border-[#2D3748] bg-[#111317]"
                }`}
              >
                <div className="font-head text-[17px] font-black" style={{ color: ok ? OR : "#4a4d56" }}>
                  {p}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7280] mt-0.5">
                  {p === 3 ? "Ta story" : p === 5 ? "Le badge" : "Élite"}
                </div>
              </div>
            );
          })}
        </div>

        {prochain && (
          <p className="text-[12px] text-[#6b7280] mt-3">
            Encore {prochain - n} pour le palier {prochain}.
          </p>
        )}
      </section>

      {/* ── Inviter — L'ACTION PRINCIPALE ──────────────────────────
          Avant les récompenses : c'est ce qui fait avancer le compteur. */}
      <section className="rounded-xl border border-[#E63946]/35 bg-[#E63946]/[0.06] p-5 mb-5">
        <h2 className="font-head text-[15px] font-black uppercase tracking-tight text-white">
          Ton lien d&apos;invitation
        </h2>
        <p className="text-[12px] text-[#9CA3AF] mt-1">
          Envoie-le à tes coéquipiers. Quand l&apos;un d&apos;eux crée son compte avec ton lien,
          il compte dans tes recrues.
        </p>

        <button
          type="button"
          onClick={inviter}
          disabled={partage}
          className="mt-4 w-full sm:w-auto px-5 py-3 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-[0.14em] hover:brightness-110 disabled:opacity-50 transition"
        >
          {partage ? "..." : "Inviter mes coéquipiers"}
        </button>

        <p className="text-[12px] text-[#6b7280] mt-3">
          {clics === 0 && parLien === 0
            ? "Personne n'a encore ouvert ton lien."
            : `${clics} ouverture${clics > 1 ? "s" : ""} de ton lien ces 30 derniers jours · ${parLien} inscription${parLien > 1 ? "s" : ""} grâce à lui.`}
        </p>

        {/* Régénérer — en deux temps : un lien déjà envoyé cessera de
            marcher, ce n'est pas un geste à faire par mégarde. Confirmation
            en ligne plutôt qu'une boîte window.confirm. */}
        {!confirmerRegen ? (
          <button
            type="button"
            onClick={() => setConfirmerRegen(true)}
            className="mt-3 text-[12px] text-[#9CA3AF] underline underline-offset-2 hover:text-white"
          >
            Régénérer mon lien
          </button>
        ) : (
          <div className="mt-3 rounded-lg border border-[#2D3748] bg-[#111317] px-4 py-3">
            <p className="text-[12px] text-[#9CA3AF]">
              Ton lien actuel cessera de fonctionner, y compris pour ceux à qui tu l&apos;as déjà envoyé.
              Tes recrues déjà comptées restent.
            </p>
            <div className="mt-3 flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={regenerer}
                disabled={regen}
                className="px-4 py-2 rounded-lg bg-[#E63946] text-white text-[11px] font-bold uppercase tracking-[0.12em] disabled:opacity-50"
              >
                {regen ? "..." : "Régénérer"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmerRegen(false)}
                className="px-4 py-2 rounded-lg border border-[#2D3748] text-[#9CA3AF] text-[11px] font-bold uppercase tracking-[0.12em] hover:text-white"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── Les récompenses ────────────────────────────────────────
          Dans l'ordre des paliers, et PERMANENTES : une carte apparue ne
          disparaît plus. Un palier ne se défait pas en base. */}
      {atteint(3) && (
        <CarteRecompense
          icone={<IconeStory />}
          titre="Tes stories d'ambassadeur"
          texte="Crée des stories aux couleurs de ton équipe et partage-les — chaque story amène du monde."
          actions={
            <>
              <a
                href={MA_STORY}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-lg bg-[#F59E0B] text-[#111317] text-[12px] font-bold uppercase tracking-[0.12em] hover:brightness-110 transition"
              >
                Créer ma story
              </a>
              <button
                type="button"
                onClick={copierLienStory}
                className="px-4 py-2.5 rounded-lg border border-[#2D3748] text-[#9CA3AF] text-[12px] font-bold uppercase tracking-[0.12em] hover:text-white transition-colors"
              >
                Copier le lien
              </button>
            </>
          }
        />
      )}

      {tableau?.badge_debloque && (
        <CarteRecompense
          /* eslint-disable-next-line @next/next/no-img-element */
          icone={<img src="/badges/badge-ambassadeur.svg" alt="" width={56} height={56} />}
          titre="Badge Ambassadeur"
          texte="Il prend une des cinq places de ta ligne de badges. À toi de voir."
          actions={
            <button
              type="button"
              onClick={() => changerBadge(!tableau.badge_porte)}
              disabled={bascule}
              className={`px-4 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-50 ${
                tableau.badge_porte
                  ? "border border-[#2D3748] text-[#9CA3AF] hover:text-white"
                  : "bg-[#F59E0B] text-[#111317] hover:brightness-110"
              }`}
            >
              {bascule ? "..." : tableau.badge_porte ? "Retirer" : "L'afficher"}
            </button>
          }
        />
      )}

      {atteint(10) && (
        <CarteRecompense
          icone={<IconeTrophee />}
          titre="Ambassadeur Élite 🏆"
          /* « Écris-nous ton @ » plutôt que « surveille ton IG » : on n'a PAS
             son handle Instagram, donc on ne peut pas le joindre là-bas. */
          texte="Félicitations — tu fais partie des meilleurs ambassadeurs Nexus. Écris-nous ton @ Instagram par le chat de ton compte : on prépare ton post sur @nexussportsca."
        />
      )}

      {/* ── Mes recrues ────────────────────────────────────────── */}
      <section className="rounded-xl border border-[#2D3748] bg-[#1A1D24] p-5 mb-5">
        <h2 className="font-head text-[15px] font-black uppercase tracking-tight text-white mb-3">
          Mes recrues
        </h2>
        {(tableau?.revendications.length ?? 0) === 0 ? (
          <p className="text-[13px] text-[#6b7280]">Rien encore — envoie ton lien.</p>
        ) : (
          <ul className="divide-y divide-[#2D3748]/60">
            {tableau!.revendications.map((r) => <Ligne key={r.id} r={r} />)}
          </ul>
        )}
      </section>

      {/* ── Déclarer — le SECOURS, au second plan ──────────────────
          Replié par défaut : le chemin normal est le lien. Il reste pour
          l'ami qui s'est inscrit sans le lien — dans l'app (qui n'a pas accès
          au lien), ou avant qu'on le lui envoie. */}
      <details className="rounded-xl border border-[#2D3748] bg-[#1A1D24] p-5 group">
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
          <span className="text-[14px] font-bold text-white">Ton ami s&apos;est inscrit sans ton lien ?</span>
          <span className="text-[#6b7280] text-[12px] group-open:rotate-180 transition-transform">▾</span>
        </summary>
        <p className="text-[12px] text-[#6b7280] mt-3">
          Entre le courriel de son compte Nexus. S&apos;il s&apos;est inscrit avec Apple ou Google, c&apos;est
          l&apos;adresse de ce compte-là.
          {typeof tableau?.recherches_restantes === "number" && (
            <> {" · "}Il te reste {tableau.recherches_restantes} essai
              {tableau.recherches_restantes === 1 ? "" : "s"} aujourd&apos;hui.</>
          )}
        </p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <label className="flex-1 block">
            <span className="sr-only">Courriel de ton ami</span>
            <input
              type="email"
              value={courriel}
              onChange={(e) => setCourriel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") declarer(); }}
              placeholder="alex@exemple.com"
              className="w-full rounded-lg bg-[#111317] border border-[#2D3748] px-3 py-2.5 text-[14px] text-white placeholder:text-[#4a4d56] focus:border-[#4a4d56] outline-none"
            />
          </label>
          <button
            type="button"
            onClick={declarer}
            disabled={!courrielPlausible || envoi}
            className="px-5 py-2.5 rounded-lg border border-[#2D3748] text-white text-[12px] font-bold uppercase tracking-[0.14em] hover:border-[#4a4d56] disabled:opacity-40 transition"
          >
            {envoi ? "..." : "Déclarer"}
          </button>
        </div>
      </details>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] max-w-[92vw] rounded-lg bg-[#1A1D24] border border-[#2D3748] px-5 py-3 shadow-lg">
          <span className="text-[13px] font-bold text-white">{toast}</span>
        </div>
      )}
    </div>
  );
}

/* ── Primitives ──────────────────────────────────────────────── */

/* ── Le gabarit des cartes de récompense ──────────────────────────────────
   Un seul châssis pour les trois paliers. `actions` est optionnel — le
   palier 10 n'a rien à cliquer, c'est une reconnaissance, pas une tâche. */
function CarteRecompense({ icone, titre, texte, actions }: {
  icone: React.ReactNode; titre: string; texte: string; actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/[0.07] p-5 mb-5">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="shrink-0 w-14 h-14 flex items-center justify-center">{icone}</span>
        <div className="flex-1 min-w-[180px]">
          <h2 className="font-head text-[15px] font-black uppercase tracking-tight text-white">
            {titre}
          </h2>
          <p className="text-[12px] text-[#9CA3AF] mt-0.5">{texte}</p>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>
    </section>
  );
}

function IconeStory() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={OR} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="17" cy="7" r="1.1" fill={OR} stroke="none" />
    </svg>
  );
}

function IconeTrophee() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={OR} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 010-5C7 4 7 7 7 7" />
      <path d="M18 9h1.5a2.5 2.5 0 000-5C17 4 17 7 17 7" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
      <path d="M18 2H6v7a6 6 0 0012 0V2Z" />
    </svg>
  );
}

const PASTILLE: Record<LigneRevendication["statut"], { t: string; c: string; b: string }> = {
  CONFIRMEE:  { t: "Confirmée",  c: "#22C55E", b: "rgba(34,197,94,0.14)" },
  EN_ATTENTE: { t: "On vérifie", c: "#F59E0B", b: "rgba(245,158,11,0.14)" },
  REJETEE:    { t: "Écartée",    c: "#9CA3AF", b: "rgba(156,163,175,0.12)" },
};

function Ligne({ r }: { r: LigneRevendication }) {
  const p = PASTILLE[r.statut];
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <span className="min-w-0 flex items-center gap-2">
        {/* PRÉNOM seulement (décision BP), lu sur le compte de la recrue. */}
        <span className="text-[14px] text-white truncate">{r.prenom}</span>
        <span className="shrink-0 text-[11px] text-[#6b7280]">
          {r.via === "lien" ? "par ton lien" : "déclarée"}
        </span>
      </span>
      <span
        className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.1em]"
        style={{ color: p.c, backgroundColor: p.b }}
      >
        {p.t}
      </span>
    </li>
  );
}
