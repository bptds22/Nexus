/* ═══════════════════════════════════════════════════════════════
   /consentement-partenaires — le lien du courriel envoyé au PARENT
   (relance « visibilité partenaires », 2026-09-29, registre §48).

   SANS CONNEXION : un parent n'a en général pas de compte. C'est le jeton
   (aléatoire, 32 octets, usage unique, 60 jours, stocké HACHÉ en base) qui
   prouve que le lien sort de notre courriel.

   La page LIT, elle n'écrit pas : Accepter / Refuser postent sur
   /api/consentement-partenaires (les passerelles de sécurité des messageries
   ouvrent les liens — un GET qui écrit donnerait des réponses que personne n'a
   données). Les deux réponses sont journalisées, avec policy_version.

   Lecture côté SERVEUR (service_role) : aucune fonction n'est exposée à anon.
   Rien d'autre que le prénom de l'athlète n'est affiché — un lien transféré
   n'apprend rien de plus.

   `?t=apercu` : rendu de démonstration (le lien du courriel de TEST), boutons
   inactifs, aucune écriture possible.

   WEB SEULEMENT (HIDE_PATTERNS, mobile-excluded-routes, notFound()).
═══════════════════════════════════════════════════════════════ */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NexusLogo from "@/components/ui/NexusLogo";
import { createServiceClient } from "@/lib/supabase/service";
import { partnerResponsibilityText } from "@/lib/legal/partnerMediaCopy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Visibilité auprès des partenaires — Nexus" },
  robots: { index: false, follow: false },
};

const CONFIDENTIALITE = "confidentialite@nexussports.ca";

type Etat =
  | { etat: "valide"; prenom: string | null }
  | { etat: "utilise"; prenom: string | null; decision: "ACCEPTE" | "REFUSE" }
  | { etat: "majeur"; prenom: string | null }
  | { etat: "expire" | "invalide" };

async function lireEtat(t: string | undefined): Promise<Etat> {
  if (!t || !/^[0-9a-f]{64}$/.test(t)) return { etat: "invalide" };
  const { data, error } = await createServiceClient().rpc(
    "consentement_partenaire_jeton_etat" as never,
    { p_jeton: t } as never,
  );
  if (error || !data) {
    if (error) console.error("[consentement-partenaires] lecture :", error.code ?? "?", error.message);
    return { etat: "invalide" };
  }
  return data as unknown as Etat;
}

/** « de Marc » / « d’Alex » — élision devant voyelle ou h. */
function de(nom: string): string {
  return /^[aeiouyhàâäéèêëîïôöûüœ]/i.test(nom) ? `d’${nom}` : `de ${nom}`;
}

function Titre({ children }: { children: React.ReactNode }) {
  return <h1 className="font-head text-[22px] font-bold uppercase tracking-tight text-white">{children}</h1>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[14px] leading-relaxed text-white/60">{children}</p>;
}
function Ecrire() {
  return (
    <a href={`mailto:${CONFIDENTIALITE}`} className="text-[#E63946] underline underline-offset-2">{CONFIDENTIALITE}</a>
  );
}

function Explication({ prenom }: { prenom: string }) {
  return (
    <div className="mt-5 text-left">
      <p className="text-[14px] leading-relaxed text-white/70">
        Nexus collabore avec des partenaires médias approuvés — journalistes sportifs, pages de contenu
        sportif, balados, camps spécialisés. Avec votre accord, ils peuvent télécharger la carte
        officielle Nexus {de(prenom)} pour la publier dans leurs articles, leurs publications sur les
        réseaux sociaux ou d&apos;autres contenus.
      </p>
      <p className="mt-3 text-[14px] leading-relaxed text-white/70">
        <span className="font-bold text-white">Ce qui apparaît sur la carte :</span> son nom, son école,
        sa cote, sa position et sa photo.
      </p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-relaxed text-white/70">
        <li>Aucun partenaire ne peut contacter {prenom} directement.</li>
        <li>Les partenaires sont vérifiés par l&apos;équipe Nexus et s&apos;engagent par contrat à un usage éditorial responsable.</li>
        <li>Cette autorisation est distincte de la visibilité auprès des recruteurs des cégeps. Refuser ne change rien au reste de son profil.</li>
      </ul>
      <p className="mt-4 border-t border-white/[0.06] pt-4 text-[12px] leading-relaxed text-white/50">
        {partnerResponsibilityText("child")}
      </p>
    </div>
  );
}

function Boutons({ t, inactif }: { t: string; inactif?: boolean }) {
  const base = "w-full rounded-2xl px-4 py-4 font-head text-[13px] font-bold uppercase tracking-widest";
  return (
    <form method="post" action="/api/consentement-partenaires" className="mt-6 flex flex-col gap-3">
      <input type="hidden" name="t" value={t} />
      <button type="submit" name="decision" value="accepte" disabled={inactif}
        className={`${base} bg-[#E63946] text-white disabled:opacity-40`}>
        J&apos;accepte
      </button>
      <button type="submit" name="decision" value="refuse" disabled={inactif}
        className={`${base} border border-white/15 bg-transparent text-white/80 disabled:opacity-40`}>
        Je refuse
      </button>
      <p className="mt-1 text-[12px] leading-relaxed text-white/45">
        Vous pourrez changer d&apos;avis en tout temps en écrivant à <Ecrire />.
      </p>
    </form>
  );
}

export default async function ConsentementPartenairesPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; etat?: string }>;
}) {
  if (process.env.CAPACITOR_BUILD === "true") notFound();
  const { t, etat } = await searchParams;

  let contenu: React.ReactNode;

  if (etat === "accepte" || etat === "refuse") {
    contenu = (
      <>
        <Titre>Merci, c&apos;est noté</Titre>
        <P>
          {etat === "accepte"
            ? "Votre accord est enregistré. La carte Nexus de votre enfant pourra être utilisée par nos partenaires médias approuvés."
            : "Votre refus est enregistré. La carte Nexus de votre enfant ne sera pas communiquée à nos partenaires médias."}
        </P>
        <P>Vous pourrez changer d&apos;avis en tout temps en écrivant à <Ecrire />.</P>
      </>
    );
  } else if (etat === "erreur") {
    contenu = (
      <>
        <Titre>Un problème est survenu</Titre>
        <P>Votre réponse n&apos;a pas pu être enregistrée. Réessayez depuis le lien du courriel, ou écrivez-nous à <Ecrire />.</P>
      </>
    );
  } else if (etat === "deja_utilise") {
    // Second envoi du même lien (double clic, retour arrière) : la première
    // réponse fait foi.
    contenu = (
      <>
        <Titre>Réponse déjà enregistrée</Titre>
        <P>Une réponse a déjà été donnée avec ce lien. Pour changer d&apos;avis, écrivez-nous à <Ecrire />.</P>
      </>
    );
  } else if (t === "apercu") {
    contenu = (
      <>
        <p className="mb-4 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2 text-[12px] text-[#F59E0B]">
          Aperçu — lien de test. Aucune réponse ne peut être enregistrée.
        </p>
        <Titre>Une autorisation pour Alex</Titre>
        <Explication prenom="Alex" />
        <Boutons t="apercu" inactif />
      </>
    );
  } else {
    // Retour du POST avec un refus de la base (expire, majeur, invalide) : on
    // n'a plus le jeton, on affiche l'état rendu. Sinon on lit le jeton.
    const e: Etat = etat === "expire" || etat === "invalide"
      ? { etat }
      : etat === "majeur"
        ? { etat: "majeur", prenom: null }
        : await lireEtat(t);
    const prenom = "prenom" in e && e.prenom ? e.prenom : "votre enfant";

    if (e.etat === "valide" && t) {
      contenu = (
        <>
          <Titre>Une autorisation pour {prenom}</Titre>
          <Explication prenom={prenom} />
          <Boutons t={t} />
        </>
      );
    } else if (e.etat === "utilise") {
      contenu = (
        <>
          <Titre>Réponse déjà enregistrée</Titre>
          <P>
            Vous avez déjà {e.decision === "ACCEPTE" ? "accepté" : "refusé"} l&apos;utilisation de la carte {de(prenom)}{" "}
            par nos partenaires. Pour changer d&apos;avis, écrivez-nous à <Ecrire />.
          </P>
        </>
      );
    } else if (e.etat === "majeur") {
      contenu = (
        <>
          <Titre>{prenom} a maintenant 18 ans</Titre>
          <P>C&apos;est désormais à {prenom} de décider, depuis ses paramètres Nexus. Ce lien n&apos;a plus d&apos;effet.</P>
        </>
      );
    } else {
      contenu = (
        <>
          <Titre>{e.etat === "expire" ? "Ce lien a expiré" : "Ce lien n'est pas valide"}</Titre>
          <P>Écrivez-nous à <Ecrire /> et nous prendrons votre réponse.</P>
        </>
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#111317] px-5 py-10 flex flex-col items-center">
      <NexusLogo variant="white" height={32} priority />
      <div className="mt-8 w-full max-w-md rounded-2xl border border-white/[0.06] bg-[#1A1D24] p-6 text-center">
        {contenu}
      </div>
    </main>
  );
}
