"use client";

/* ═══════════════════════════════════════════════════════════════
   Panneau d'une CARTE PROSPECT (lot C) — onglets Infos et Historique, et le
   marqueur « Pas encore sur Nexus ».

   Infos : SEULEMENT ce que la carte porte. Les sections d'une fiche Nexus
   que la carte n'a pas (cote du coach, faits saillants, parcours, profil
   scolaire) sont montrées GRISÉES, avec la raison : elles apparaîtront quand
   l'athlète rejoindra Nexus. Aucun lien vers un profil complet — il n'y en a
   pas.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import Link from "next/link";
import { lireTelephone, formaterTelephone, lireNomParent, lireCourrielParent, lireCourriel, type Lecture } from "@/lib/cartes/saisie";
import { mentionInvitation, MENTION_INVITATION_NON_ENVOYEE, type InvitationEtat } from "@/lib/cartes/invitationEtat";
import {
  gesteCourriel, texteConfirmation, messageApresAjout, AIDE_COURRIEL_CHANGE, REGLE_RETRAIT, TITRE_CONFIRMATION,
} from "@/lib/cartes/courrielCarte";
import { doublonsCourriel, type DoublonCarte } from "@/lib/cartes/doublonsCarte";
import { texteRenvoi, phraseRenvoi } from "@/lib/cartes/renvoiInvitation";
import { etatRappel, libelleRappelIndisponible, messageReponse, RAPPELS_MAX, type ReponseRappel } from "@/lib/cartes/rappelInvitation";
import { useAuteursUnite, nomAuteur } from "@/lib/queries/recruiter/useProcessusUnite";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useJournalCarte, type GesteCarte } from "@/lib/cartes/useCartes";
import { joursAvantPurge, AVIS_JOURS, ecrireCarte, libelleEquipeComplet, type CarteKanban } from "@/lib/cartes/carteProspect";
import { leagueOf } from "@/lib/config/team-taxonomy";
import { KANBAN_COLUMNS } from "@/app/recruteur/pipeline/_data/mockKanbanData";
import { ligneSignee } from "@/lib/historique/signature";

/* MARQUEUR D'UNE CARTE (retours BP) : plus de pastille dans les listes —
   un FOND ROUGE LÉGER (#E63946 à 11 %) sur TOUTE la ligne du tableau (colonne
   Nom figée comprise) et sur TOUTE la carte du kanban (bandeau photo
   compris), expliqué par une légende en haut de la vue, à côté des filtres.
   Le panneau garde une mention en toutes lettres.
   11 % : à 5 %, la carte ne se distinguait pas d'une vraie ; au-delà de 12 %,
   le rouge se lit comme une alerte. */

/** #E63946 à 11 % — en calque, pour les fonds transparents (lignes). */
export const FOND_PROSPECT = "rgba(230,57,70,0.11)";
/** Le même, posé sur la surface #1A1D24, en couleur OPAQUE : la colonne figée
 *  du tableau et le dégradé de la photo du kanban doivent le connaître. */
export const SURFACE_PROSPECT = "#302028";
/** Le même, posé sur le bandeau photo du kanban (#2F3440). */
export const BANDEAU_PROSPECT = "#433541";

/** Légende, en haut de la vue, affichée seulement s'il y a des cartes. */
export function LegendeProspect() {
  return (
    <p className="flex items-center gap-2 text-[12px] text-[#6b7280]" data-testid="legende-prospect">
      <span aria-hidden="true" className="inline-block w-3.5 h-3.5 rounded border border-[#E63946]/25" style={{ backgroundColor: SURFACE_PROSPECT }} />
      Fond rouge = pas encore sur Nexus
    </p>
  );
}

/** Mention en tête du panneau d'une carte, et ce qu'il en est de l'invitation :
 *  partie (avec la date), écartée (mention neutre, sans la raison), ou rien. */
export function MentionProspect({ inviteeLe, invitationEtat }: { inviteeLe?: string | null; invitationEtat?: InvitationEtat | null }) {
  const m = mentionInvitation(inviteeLe, invitationEtat);
  return (
    <>
      <p className="text-[13px] text-[#E5A0A6]">
        Pas encore sur Nexus — carte prospect de ton unité.
      </p>
      {m?.type === "ENVOYEE" && (
        <p className="text-[12px] text-[#9CA3AF] mt-0.5" data-testid="invitation-envoyee">
          Invitation envoyée le {dateInvitation(m.le)}
        </p>
      )}
      {m?.type === "NON_ENVOYEE" && (
        <p className="text-[12px] text-[#9CA3AF] mt-0.5" data-testid="invitation-non-envoyee">
          {m.texte}
        </p>
      )}
    </>
  );
}

/** Le recruteur connecté et son cégep : la signature du texte à copier. */
function useSignatureRecruteur() {
  const { data: currentUser } = useCurrentUser();
  const profil = currentUser?.profile;
  const { data: cegep = null } = useQuery({
    queryKey: ["ecole-nom", profil?.school_id],
    enabled: !!profil?.school_id,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await createClient().from("schools").select("name").eq("id", profil!.school_id!).maybeSingle();
      return (data?.name as string | undefined) ?? null;
    },
  });
  return { recruteur: [profil?.first_name, profil?.last_name].filter(Boolean).join(" "), cegep, sportId: profil?.sport_id ?? null };
}

/** « Copier le texte » : le recruteur envoie l'invitation de son propre
 *  téléphone ou courriel ; Nexus n'envoie RIEN, la trace seule est écrite
 *  (journaliser_renvoi_invitation — courriel OU téléphone depuis le lot 2).
 *  Sans courriel, le lien mène à l'inscription sans adresse pré-remplie.
 *  `encadre` : la variante en boîte, avec son explication, montrée juste
 *  après la création d'une carte téléphone seulement ou l'ajout d'un numéro. */
export function CopierTexteInvitation({ carteId, prenom, courriel, encadre = false }: {
  carteId: string; prenom: string | null; courriel: string | null; encadre?: boolean;
}) {
  const queryClient = useQueryClient();
  const { recruteur, cegep } = useSignatureRecruteur();
  const [copie, setCopie] = useState<{ type: "ok" | "erreur" | "manuel"; texte: string } | null>(null);
  const texte = texteRenvoi({ prenom, recruteur, cegep, courriel });

  const journaliserCopie = async (confirmation: string) => {
    const { error } = await createClient().rpc("journaliser_renvoi_invitation", { p_carte: carteId });
    if (error) { setCopie({ type: "erreur", texte: `${confirmation} La copie n'a pas pu être notée à l'historique.` }); return; }
    setCopie({ type: "ok", texte: confirmation });
    void queryClient.invalidateQueries({ queryKey: ["pipeline-historique", "carte", carteId] });
    void invaliderTableauBlanc(queryClient);
  };
  const copier = async () => {
    setCopie(null);
    try {
      await navigator.clipboard.writeText(texte);
    } catch {
      setCopie({ type: "manuel", texte });
      return;
    }
    await journaliserCopie("Texte copié — colle-le dans ton courriel ou tes messages.");
  };

  const retours = (
    <>
      {copie?.type === "ok" && <p className="text-[12px] text-[#86EFAC] mt-1" role="status">{copie.texte}</p>}
      {copie?.type === "erreur" && <p className="text-[12px] text-[#F59E0B] mt-1" role="status">{copie.texte}</p>}
      {copie?.type === "manuel" && (
        <div className="mt-1.5">
          <p className="text-[12px] text-[#9CA3AF] mb-1">Copie ce texte à la main, puis envoie-le :</p>
          <textarea readOnly value={copie.texte} rows={4} onFocus={(e) => e.currentTarget.select()} autoFocus
            className="w-full p-2 rounded-lg bg-[#0d0f13] border border-[#2D3748] text-[12px] text-white" />
          <button type="button" onClick={() => void journaliserCopie("C'est noté.")}
            className="mt-1 text-[12px] font-bold text-[#9CA3AF] hover:text-white">Je l&apos;ai envoyé</button>
        </div>
      )}
    </>
  );

  if (encadre) {
    return (
      <div className="rounded-lg border border-[#2D3748] bg-[#13151a] px-4 py-3" data-testid="encadre-copier-texte">
        <p className="text-[13px] text-white font-bold">Invite-le toi-même</p>
        <p className="text-[12px] text-[#9CA3AF] mt-0.5">
          Nexus n&apos;envoie rien à un numéro de téléphone. Copie ce texte et envoie-le de ton téléphone :
        </p>
        <p className="mt-2 p-2 rounded-lg bg-[#0d0f13] border border-[#2D3748] text-[12px] text-[#e0e0e0] break-words" data-testid="texte-a-copier">{texte}</p>
        <button type="button" onClick={() => void copier()} data-testid="copier-texte"
          className="mt-2 px-3 h-8 rounded-lg bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold">
          Copier le texte
        </button>
        {retours}
      </div>
    );
  }
  return (
    <>
      <button type="button" onClick={() => void copier()} data-testid="copier-texte"
        className="block mt-1 text-[11px] text-[#9CA3AF] underline underline-offset-2 hover:text-white">
        Copier le texte
      </button>
      {retours}
    </>
  );
}

/** « Renvoyer l'invitation » (décisions BP 2026-09-30).
 *  · Le BOUTON fait envoyer un rappel PAR NEXUS (demander_rappel_invitation) :
 *    seulement si l'invitation automatique de cette carte est partie ; sinon
 *    « Impossible d'envoyer à cette adresse », sans raison. 7 jours d'écart,
 *    3 rappels au plus.
 *  · Le LIEN « Copier le texte », dessous, est là quand la carte a un
 *    courriel — et, depuis le lot 2 (BP 2026-10-07), quand elle n'a qu'un
 *    téléphone (COPIE_SEULE : le lien seul, jamais le bouton d'envoi). */
export function RenvoyerInvitation({ card }: { card: CarteKanban }) {
  const c = card.carte;
  const queryClient = useQueryClient();
  const [reponse, setReponse] = useState<{ ton: "ok" | "neutre" | "erreur"; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  const etat = etatRappel({
    courriel: c.courriel, telephone: c.telephone, invitationEtat: c.invitationEtat, inviteeLe: c.inviteeLe,
    renvoisInvitation: c.renvoisInvitation, dernierRenvoiLe: c.dernierRenvoiLe,
  });
  if (!etat) return null;

  const rafraichir = () => {
    void queryClient.invalidateQueries({ queryKey: ["pipeline-historique", "carte", card.id] });
    void invaliderTableauBlanc(queryClient);
  };

  const rappeler = async () => {
    setReponse(null);
    setEnCours(true);
    const { data, error } = await createClient().rpc("demander_rappel_invitation", { p_carte: card.id });
    setEnCours(false);
    if (error) { setReponse({ ton: "erreur", texte: "Le rappel n'a pas pu être demandé. Réessaie." }); return; }
    setReponse(messageReponse(data as ReponseRappel));
    if ((data as ReponseRappel).etat === "ENVOI_LANCE") {
      // L'envoi part en arrière-plan : la carte se relit quand il a eu le temps d'aboutir.
      window.setTimeout(rafraichir, 5000);
    }
  };

  const indisponible = libelleRappelIndisponible(etat);
  return (
    <div data-testid="renvoyer-invitation">
      {etat.type === "DISPONIBLE" && (
        <button type="button" onClick={() => void rappeler()} disabled={enCours || reponse?.ton === "ok"}
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#E63946] hover:text-white disabled:opacity-50 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 4h16v16H4z" /><path d="M4 6l8 7 8-7" />
          </svg>
          Renvoyer l&apos;invitation
        </button>
      )}
      {etat.type === "DISPONIBLE" && etat.renvois > 0 && (
        <p className="text-[11px] text-[#6b7280] mt-0.5">Rappels envoyés : {etat.renvois} sur {RAPPELS_MAX}</p>
      )}
      {indisponible && (
        <p className="text-[12px] text-[#9CA3AF]" data-testid="rappel-indisponible">{indisponible}</p>
      )}
      {reponse && (
        <p className={`text-[12px] mt-1 ${reponse.ton === "ok" ? "text-[#86EFAC]" : reponse.ton === "erreur" ? "text-[#F59E0B]" : "text-[#9CA3AF]"}`} role="status" data-testid="rappel-reponse">
          {reponse.texte}
        </p>
      )}

      <CopierTexteInvitation carteId={card.id} prenom={c.prenom} courriel={c.courriel} />
    </div>
  );
}

function dateInvitation(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}

/** « Supprimée le … faute d'activité » — affiché dans les 30 derniers jours. */
export function MarqueurExpiration({ carte }: { carte: CarteKanban }) {
  const jours = joursAvantPurge(carte.carte.expireLe);
  if (jours > AVIS_JOURS) return null;
  const date = new Date(carte.carte.expireLe).toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
  return (
    <span
      className="inline-flex items-center rounded-full border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-2 py-0.5 text-[10px] font-bold text-[#F59E0B] shrink-0"
      title="Sans activité (note, étape, relance…), la carte sera supprimée à cette date."
    >
      {jours <= 0 ? "Suppression imminente" : `Supprimée le ${date} sans activité`}
    </span>
  );
}

function Ligne({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-[#2D3748]/60 last:border-b-0">
      <span className="text-[12px] font-bold uppercase tracking-wider text-[#6b7280]">{libelle}</span>
      <span className="text-[13px] text-white text-right break-all">{valeur}</span>
    </div>
  );
}

/** Le téléphone de la carte, modifiable sur place (décision BP 2026-09-30).
 *  Format libre, normalisé ; la base a le dernier mot (10 chiffres). Le
 *  panneau lit un instantané de la carte : la valeur enregistrée est gardée
 *  ici, le reste du tableau blanc se relit. */
/** Une ligne de texte modifiable dans Infos (même geste que le téléphone). */
function LigneTexteCarte({ carteId, champ, libelle, initial, lire, courriel = false }: {
  carteId: string; champ: "parentNom" | "parentCourriel"; libelle: string; initial: string | null;
  lire: (brut: string) => Lecture<string | null>; courriel?: boolean;
}) {
  const queryClient = useQueryClient();
  const [valeur, setValeur] = useState(initial);
  const [edition, setEdition] = useState(false);
  const [brut, setBrut] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const id = `carte-${champ}-edition`;

  const enregistrer = async () => {
    const l = lire(brut);
    if (!l.ok) { setErreur(l.regle); return; }
    setEnCours(true);
    const err = await ecrireCarte(createClient(), carteId, { [champ]: l.valeur });
    setEnCours(false);
    if (err) { setErreur(`${libelle} : l'enregistrement a échoué. Réessaie.`); return; }
    setValeur(l.valeur);
    setEdition(false);
    void invaliderTableauBlanc(queryClient);
  };

  if (edition) {
    return (
      <div className="py-2 border-b border-[#2D3748]/60">
        <label htmlFor={id} className="text-[12px] font-bold uppercase tracking-wider text-[#6b7280]">{libelle}</label>
        <div className="flex gap-2 mt-1.5">
          <input id={id} type="text" inputMode={courriel ? "email" : "text"} autoFocus value={brut}
            onChange={(e) => { setBrut(e.target.value); setErreur(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") void enregistrer(); if (e.key === "Escape") setEdition(false); }}
            placeholder="Vide pour retirer" aria-invalid={!!erreur} aria-describedby={erreur ? `${id}-erreur` : undefined}
            className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[#0d0f13] border border-[#2D3748] text-[13px] text-white focus:border-[#E63946] outline-none" />
          <button type="button" onClick={() => void enregistrer()} disabled={enCours}
            className="px-3 h-9 rounded-lg bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 text-white text-[12px] font-bold">Enregistrer</button>
          <button type="button" onClick={() => setEdition(false)} className="px-2 h-9 text-[12px] font-bold text-[#9CA3AF] hover:text-white">Annuler</button>
        </div>
        {erreur && <p id={`${id}-erreur`} className="text-[12px] text-[#EF4444] mt-1">{erreur}</p>}
      </div>
    );
  }
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-[#2D3748]/60" data-testid={`ligne-${champ}`}>
      <span className="text-[12px] font-bold uppercase tracking-wider text-[#6b7280]">{libelle}</span>
      <span className="flex items-baseline gap-3 text-[13px] text-white text-right min-w-0">
        <span className="truncate">{valeur ?? <span className="text-[#6b7280]">—</span>}</span>
        <button type="button" onClick={() => { setBrut(valeur ?? ""); setErreur(null); setEdition(true); }}
          aria-label={`Modifier : ${libelle}`}
          className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white">Modifier</button>
      </span>
    </div>
  );
}

/** Le courriel de la carte, modifiable sur place (lot 2, décisions BP
 *  2026-10-07) — WEB seulement (l'app garde la ligne en lecture).
 *  · AJOUT → fenêtre « Envoyer l'invitation ? » ; la base envoie (lot 1),
 *    l'interface relit la carte et dit ce qui s'est passé. Annuler n'enregistre rien.
 *  · CHANGEMENT → aucune invitation, une ligne d'aide sous le champ.
 *  Mêmes validations qu'à la création : format (lireCourriel), puis les
 *  avertissements de doublon (doublonsCourriel) — avertir, jamais bloquer. */
function LigneCourriel({ card, valeur, onEnregistre }: {
  card: CarteKanban; valeur: string | null; onEnregistre: (courriel: string) => void;
}) {
  const queryClient = useQueryClient();
  const { sportId } = useSignatureRecruteur();
  const [edition, setEdition] = useState(false);
  const [brut, setBrut] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [avertissements, setAvertissements] = useState<DoublonCarte[] | null>(null);
  const [confirmer, setConfirmer] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<{ ton: "ok" | "neutre"; texte: string } | null>(null);
  const changement = !!valeur?.trim();

  const ouvrir = () => { setBrut(valeur ?? ""); setErreur(null); setAvertissements(null); setMessage(null); setEdition(true); };
  const fermer = () => { setEdition(false); setConfirmer(null); setAvertissements(null); };

  const ecrire = async (adresse: string, geste: "AJOUT" | "CHANGEMENT") => {
    setEnCours(true);
    const supabase = createClient();
    const err = await ecrireCarte(supabase, card.id, { courriel: adresse });
    if (err) { setEnCours(false); setErreur("Le courriel n'a pas pu être enregistré. Réessaie."); setConfirmer(null); return; }
    if (geste === "AJOUT") {
      // Le trigger a tranché dans la même transaction : la carte relue le dit.
      const { data } = await supabase.from("cartes_prospect").select("invitation_etat").eq("id", card.id).maybeSingle();
      setMessage(messageApresAjout(adresse, (data?.invitation_etat as InvitationEtat | null | undefined) ?? null));
    }
    setEnCours(false);
    onEnregistre(adresse);
    fermer();
    void queryClient.invalidateQueries({ queryKey: ["pipeline-historique", "carte", card.id] });
    void invaliderTableauBlanc(queryClient);
  };

  const enregistrer = async () => {
    const l = lireCourriel(brut);
    if (!l.ok) { setErreur(l.regle); return; }
    const geste = gesteCourriel(valeur, l.valeur);
    if (geste === "INCHANGE") { fermer(); return; }
    if (geste === "RETRAIT" || !l.valeur) { setErreur(REGLE_RETRAIT); return; }
    if (avertissements === null && sportId) {
      setEnCours(true);
      const trouves = await doublonsCourriel(createClient(), { courriel: l.valeur, sportId, exclureCarteId: card.id });
      setEnCours(false);
      if (trouves.length > 0) { setAvertissements(trouves); return; }
    }
    if (geste === "AJOUT") { setConfirmer(l.valeur); return; }
    await ecrire(l.valeur, "CHANGEMENT");
  };

  if (edition) {
    return (
      <div className="py-2 border-b border-[#2D3748]/60">
        <label htmlFor="carte-courriel-edition" className="text-[12px] font-bold uppercase tracking-wider text-[#6b7280]">Courriel</label>
        <div className="flex gap-2 mt-1.5">
          <input id="carte-courriel-edition" type="text" inputMode="email" autoComplete="off" autoFocus value={brut}
            onChange={(e) => { setBrut(e.target.value); setErreur(null); setAvertissements(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") void enregistrer(); if (e.key === "Escape") fermer(); }}
            placeholder="nom@exemple.com" aria-invalid={!!erreur}
            aria-describedby={erreur ? "erreur-courriel-edition" : changement ? "aide-courriel-edition" : undefined}
            className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[#0d0f13] border border-[#2D3748] text-[13px] text-white focus:border-[#E63946] outline-none" />
          <button type="button" onClick={() => void enregistrer()} disabled={enCours}
            className="px-3 h-9 rounded-lg bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 text-white text-[12px] font-bold">
            {avertissements && avertissements.length > 0 ? "Enregistrer quand même" : "Enregistrer"}
          </button>
          <button type="button" onClick={fermer} className="px-2 h-9 text-[12px] font-bold text-[#9CA3AF] hover:text-white">Annuler</button>
        </div>
        {erreur && <p id="erreur-courriel-edition" className="text-[12px] text-[#EF4444] mt-1">{erreur}</p>}
        {!erreur && changement && (
          <p id="aide-courriel-edition" className="text-[12px] text-[#9CA3AF] mt-1" data-testid="aide-courriel-change">{AIDE_COURRIEL_CHANGE}</p>
        )}
        {avertissements && avertissements.length > 0 && (
          <div role="alert" className="mt-2 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-2 space-y-1">
            {avertissements.map((a, i) => (
              <p key={i} className="text-[12px] text-[#F5D08B]">
                {a.texte}{" "}
                {a.lien && <Link href={a.lien} className="font-bold underline text-white">Voir sa fiche</Link>}
              </p>
            ))}
          </div>
        )}
        {confirmer && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="titre-envoyer-invitation">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmer(null)} />
            <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl" data-testid="fenetre-envoyer-invitation">
              <h3 id="titre-envoyer-invitation" className="font-head text-[18px] font-black text-white tracking-tight">{TITRE_CONFIRMATION}</h3>
              <p className="text-[13px] text-[#d1d5db] mt-2">{texteConfirmation(confirmer)}</p>
              <div className="flex items-center justify-end gap-3 mt-6">
                <button type="button" onClick={fermer} className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white">Annuler</button>
                <button type="button" onClick={() => void ecrire(confirmer, "AJOUT")} disabled={enCours}
                  className="px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 text-white text-[13px] font-bold rounded-lg">
                  {enCours ? "…" : "Enregistrer et inviter"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="py-2 border-b border-[#2D3748]/60" data-testid="ligne-courriel">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-bold uppercase tracking-wider text-[#6b7280]">Courriel</span>
        <span className="flex items-baseline gap-3 text-[13px] text-white text-right min-w-0">
          <span className="break-all">{valeur ?? <span className="text-[#6b7280]">—</span>}</span>
          <button type="button" onClick={ouvrir} aria-label="Modifier : Courriel"
            className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white">{valeur ? "Modifier" : "Ajouter"}</button>
        </span>
      </div>
      {message && (
        <p className={`text-[12px] mt-1 ${message.ton === "ok" ? "text-[#86EFAC]" : "text-[#9CA3AF]"}`} role="status" data-testid="message-ajout-courriel">
          {message.texte}
        </p>
      )}
    </div>
  );
}

function LigneTelephone({ carteId, initial, prenom, courriel }: {
  carteId: string; initial: string | null;
  /** Pour l'encadré « Copier le texte » quand un numéro est AJOUTÉ à une carte
   *  sans courriel (lot 2, web) ; absents sur l'app : rien ne change. */
  prenom?: string; courriel?: string | null;
}) {
  const queryClient = useQueryClient();
  const [valeur, setValeur] = useState(initial);
  const [edition, setEdition] = useState(false);
  const [brut, setBrut] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [encadre, setEncadre] = useState(false);

  const enregistrer = async () => {
    const l = lireTelephone(brut);
    if (!l.ok) { setErreur(l.regle); return; }
    setEnCours(true);
    const err = await ecrireCarte(createClient(), carteId, { telephone: l.valeur });
    setEnCours(false);
    if (err) { setErreur("Le téléphone n'a pas pu être enregistré. Réessaie."); return; }
    // Numéro AJOUTÉ (il n'y en avait pas) à une carte sans courriel : le texte à copier.
    setEncadre(prenom !== undefined && !valeur && !!l.valeur && !courriel?.trim());
    setValeur(l.valeur);
    setEdition(false);
    void invaliderTableauBlanc(queryClient);
  };

  if (edition) {
    return (
      <div className="py-2 border-b border-[#2D3748]/60">
        <label htmlFor="carte-telephone-edition" className="text-[12px] font-bold uppercase tracking-wider text-[#6b7280]">Téléphone</label>
        <div className="flex gap-2 mt-1.5">
          <input id="carte-telephone-edition" type="tel" inputMode="tel" autoFocus value={brut}
            onChange={(e) => { setBrut(e.target.value); setErreur(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") void enregistrer(); if (e.key === "Escape") setEdition(false); }}
            placeholder="438 555-0123 (vide pour retirer)" aria-invalid={!!erreur} aria-describedby={erreur ? "erreur-telephone-edition" : undefined}
            className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-[#0d0f13] border border-[#2D3748] text-[13px] text-white focus:border-[#E63946] outline-none" />
          <button type="button" onClick={() => void enregistrer()} disabled={enCours}
            className="px-3 h-9 rounded-lg bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 text-white text-[12px] font-bold">Enregistrer</button>
          <button type="button" onClick={() => setEdition(false)} className="px-2 h-9 text-[12px] font-bold text-[#9CA3AF] hover:text-white">Annuler</button>
        </div>
        {erreur && <p id="erreur-telephone-edition" className="text-[12px] text-[#EF4444] mt-1">{erreur}</p>}
      </div>
    );
  }
  return (
    <div className="py-2 border-b border-[#2D3748]/60" data-testid="ligne-telephone">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-bold uppercase tracking-wider text-[#6b7280]">Téléphone</span>
        <span className="flex items-baseline gap-3 text-[13px] text-white text-right">
          {valeur ? formaterTelephone(valeur) : <span className="text-[#6b7280]">—</span>}
          <button type="button" onClick={() => { setBrut(valeur ? formaterTelephone(valeur) : ""); setErreur(null); setEncadre(false); setEdition(true); }}
            className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white">Modifier</button>
        </span>
      </div>
      {encadre && prenom !== undefined && !courriel?.trim() && (
        <div className="mt-2"><CopierTexteInvitation carteId={carteId} prenom={prenom} courriel={null} encadre /></div>
      )}
    </div>
  );
}

interface TeamChoix {
  id: string;
  name: string;
  division: string | null;
  league: string | null;
  age_group: string | null;
  gender: string | null;
  rseq_team_id: string | null;
  schools: { type: string | null } | null;
}

/** L'équipe de la carte. Sans équipe (établissement sans équipe du sport,
 *  décision BP 2026-09-30) : rattachée à l'établissement, pas de matchs au
 *  calendrier — et « Préciser l'équipe » dès qu'un entraîneur en inscrit une. */
function LigneEquipe({ card }: { card: CarteKanban }) {
  const c = card.carte;
  const queryClient = useQueryClient();
  const [equipe, setEquipe] = useState<{ id: string; nom: string } | null>(c.teamId ? { id: c.teamId, nom: c.teamNom ?? "" } : null);
  const [choix, setChoix] = useState<TeamChoix[]>([]);
  const [selection, setSelection] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    // Les équipes DU SPORT DE L'ATHLÈTE (décision BP 2026-10-05) — jamais
    // celui de l'unité, qui peut différer depuis que l'athlète d'une carte
    // n'est plus limité au sport du tableau qui la contient.
    if (equipe || !c.schoolId || !c.sportAthleteId) return;
    let annule = false;
    void createClient().from("teams").select("id, name, division, league, age_group, gender, rseq_team_id, schools!school_id(type)")
      .eq("school_id", c.schoolId).eq("sport_id", c.sportAthleteId).order("name")
      .then(({ data }) => { if (!annule) setChoix((data ?? []) as unknown as TeamChoix[]); });
    return () => { annule = true; };
  }, [equipe, c.schoolId, c.sportAthleteId]);

  if (equipe) return <Ligne libelle="Équipe" valeur={equipe.nom || <span className="text-[#6b7280]">Équipe retirée</span>} />;
  if (!c.schoolId) return <Ligne libelle="Équipe" valeur={<span className="text-[#6b7280]">Équipe retirée</span>} />;

  // Même règle que versKanban (leagueOf) : une équipe d'école sans ligue
  // stockée est RSEQ par défaut — jamais teams.league brut.
  const libelleChoix = (t: TeamChoix) => {
    const ligue = leagueOf({ context: null, schoolType: null, teamDivision: t.division, teamLeague: t.league, teamIsRseq: !!t.rseq_team_id, hasTeam: true, teamSchoolType: t.schools?.type ?? null }) ?? "";
    return libelleEquipeComplet(c.sportAthleteNom, t, ligue);
  };

  const preciser = async () => {
    const t = choix.find((x) => x.id === selection);
    if (!t) return;
    setEnCours(true);
    const err = await ecrireCarte(createClient(), card.id, { teamId: t.id });
    setEnCours(false);
    if (err) { setErreur("L'équipe n'a pas pu être enregistrée. Réessaie."); return; }
    setEquipe({ id: t.id, nom: libelleChoix(t) });
    void invaliderTableauBlanc(queryClient);
  };

  return (
    <div className="py-2 border-b border-[#2D3748]/60" data-testid="ligne-equipe-carte">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-bold uppercase tracking-wider text-[#6b7280]">Équipe</span>
        <span className="text-[13px] text-white text-right">Aucune — rattachée à {c.schoolNom ?? "l'établissement"}</span>
      </div>
      <p className="text-[12px] text-[#9CA3AF] mt-1">Pas de matchs au calendrier : la carte n&apos;est liée à aucune équipe.</p>
      {choix.length > 0 && (
        <div className="flex gap-2 mt-2">
          <label htmlFor="carte-preciser-equipe" className="sr-only">Préciser l&apos;équipe</label>
          <select id="carte-preciser-equipe" value={selection} onChange={(e) => { setSelection(e.target.value); setErreur(null); }}
            className="flex-1 min-w-0 h-9 px-2 rounded-lg bg-[#0d0f13] border border-[#2D3748] text-[13px] text-white">
            <option value="">Préciser l&apos;équipe…</option>
            {choix.map((t) => <option key={t.id} value={t.id}>{libelleChoix(t)}</option>)}
          </select>
          <button type="button" onClick={() => void preciser()} disabled={!selection || enCours}
            className="px-3 h-9 rounded-lg bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 text-white text-[12px] font-bold">Enregistrer</button>
        </div>
      )}
      {erreur && <p className="text-[12px] text-[#EF4444] mt-1">{erreur}</p>}
    </div>
  );
}

function SectionGrisee({ titre }: { titre: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#2D3748] bg-[#13151a]/60 px-4 py-3 opacity-60" aria-disabled="true">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">{titre}</p>
      <p className="text-[12px] text-[#6b7280] mt-1">Disponible quand l&apos;athlète sera sur Nexus.</p>
    </div>
  );
}

/** Build de l'app (Capacitor) : le panneau est partagé avec RecruteurPipelineMobile.
 *  Le lot 2 (courriel modifiable, encadré « Copier le texte ») est WEB seulement
 *  — protocole web-d'abord : l'app garde exactement les lignes d'avant. */
const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

export function OngletInfosCarte({ card }: { card: CarteKanban }) {
  const c = card.carte;
  // Le courriel est remonté ici : la ligne Téléphone doit savoir s'il vient d'être ajouté.
  const [courriel, setCourriel] = useState(c.courriel);
  const taille = card.taille_pieds ? `${card.taille_pieds}'${card.taille_pouces ?? 0}"` : null;
  const creeLe = new Date(c.creeLe).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#2D3748] bg-[#13151a] px-4 py-2">
        {/* Le sport de L'ATHLÈTE (décision BP 2026-10-05) — `card.sport`
            porte désormais la même valeur (le kanban et les filtres du
            tableau le lisent), toujours affiché ici comme les autres
            champs de la carte. */}
        {c.sportAthleteNom && <Ligne libelle="Sport" valeur={c.sportAthleteNom} />}
        <LigneEquipe card={card} />
        <Ligne libelle="École" valeur={card.school || <span className="text-[#6b7280]">—</span>} />
        <Ligne libelle="Position" valeur={card.position || <span className="text-[#6b7280]">—</span>} />
        <Ligne libelle="Numéro" valeur={c.numero || <span className="text-[#6b7280]">—</span>} />
        <Ligne libelle="Promotion" valeur={c.promotion ?? <span className="text-[#6b7280]">—</span>} />
        <Ligne libelle="Taille" valeur={taille ?? <span className="text-[#6b7280]">—</span>} />
        <Ligne libelle="Poids" valeur={card.poids_lbs ? `${card.poids_lbs} lb` : <span className="text-[#6b7280]">—</span>} />
        <Ligne
          libelle="Vidéo"
          valeur={c.lienVideo
            ? <a href={c.lienVideo} target="_blank" rel="noopener noreferrer" className="font-bold text-white hover:text-[#E63946] underline">Ouvrir le lien</a>
            : <span className="text-[#6b7280]">—</span>}
        />
        {IS_CAPACITOR
          ? <Ligne libelle="Courriel" valeur={c.courriel ?? <span className="text-[#6b7280]">—</span>} />
          : <LigneCourriel card={card} valeur={courriel} onEnregistre={setCourriel} />}
        {IS_CAPACITOR
          ? <LigneTelephone carteId={card.id} initial={c.telephone} />
          : <LigneTelephone carteId={card.id} initial={c.telephone} prenom={c.prenom} courriel={courriel} />}
        {/* Le parent (décision BP 2026-09-30) : jamais exporté ; son courriel ne sert
            qu'au rapprochement — aucune invitation ne lui est envoyée. */}
        <LigneTexteCarte carteId={card.id} champ="parentNom" libelle="Nom du parent" initial={c.parentNom} lire={lireNomParent} />
        <LigneTexteCarte carteId={card.id} champ="parentCourriel" libelle="Courriel du parent" initial={c.parentCourriel} lire={lireCourrielParent} courriel />
        {c.inviteeLe && <Ligne libelle="Invitation" valeur={`Envoyée le ${dateInvitation(c.inviteeLe)}`} />}
        {!c.inviteeLe && c.invitationEtat === "NON_ENVOYEE" && <Ligne libelle="Invitation" valeur="Aucune envoyée depuis cette carte" />}
        <Ligne libelle="Carte créée" valeur={`${creeLe}${card.suivi_par_noms?.[0] ? ` · par ${card.suivi_par_noms[0]}` : ""}`} />
      </div>
      <SectionGrisee titre="Cote du coach" />
      <SectionGrisee titre="Faits saillants" />
      <SectionGrisee titre="Parcours" />
      <SectionGrisee titre="Profil scolaire" />
    </div>
  );
}

function libelleEtape(v: unknown): string {
  if (typeof v !== "string") return "";
  return KANBAN_COLUMNS.find((c) => c.id === v.toLowerCase())?.label ?? v;
}

export function phraseGesteCarte(g: GesteCarte, estMoi = false): string {
  const d = g.details ?? {};
  switch (g.action) {
    case "CREEE": return "a créé la carte prospect";
    case "ETAPE": return `a déplacé la carte vers ${libelleEtape(d.apres)}${d.avant ? ` (depuis ${libelleEtape(d.avant)})` : ""}`;
    case "GRADE": return d.apres ? `a donné le grade ${String(d.apres)}` : "a retiré le grade";
    case "RELANCE": return d.le ? "a fixé une relance" : "a retiré la relance";
    case "VISITE": return d.le ? "a planifié une visite" : "a retiré la visite";
    case "DRAPEAU": return d.drapeau ? "a signalé la carte" : "a retiré le signalement";
    case "MODIFIEE": return "a modifié les informations de la carte";
    case "NOTE": return "a ajouté une note de suivi";
    case "LISTE": return d.ajout
      ? `a ajouté la carte à la liste${d.liste ? ` « ${String(d.liste)} »` : ""}`
      : `a retiré la carte de la liste${d.liste ? ` « ${String(d.liste)} »` : ""}`;
    // Envoi automatique, à la création OU à l'ajout du courriel (lot 1) —
    // signé par le signataire de l'invitation.
    case "INVITATION": return "a invité l'athlète par courriel (envoi automatique)";
    case "INVITATION_NON_ENVOYEE": return MENTION_INVITATION_NON_ENVOYEE;
    case "INVITATION_REINITIALISEE": return `Invitation remise à zéro${typeof d.motif === "string" && d.motif ? ` (${d.motif})` : ""}`;
    case "INVITATION_RENVOYEE": return phraseRenvoi(estMoi);
    case "INVITATION_RAPPEL": return "a renvoyé l'invitation";
    default: return "a agi sur la carte";
  }
}

export function OngletHistoriqueCarte({ carteId }: { carteId: string }) {
  const { data: gestes = [], isLoading, isError } = useJournalCarte(carteId);
  const { data: auteurs = {} } = useAuteursUnite();
  const { data: currentUser } = useCurrentUser();
  const moi = currentUser?.authUser.id;
  if (isLoading) {
    return (
      <div className="py-16 flex justify-center" role="status" aria-label="Chargement de l'historique">
        <div className="w-6 h-6 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (isError) return <p className="py-12 text-center text-[13px] text-[#6b7280]">L&apos;historique est indisponible pour le moment.</p>;
  if (gestes.length === 0) return <p className="py-12 text-center text-[13px] text-[#6b7280]">Aucun geste enregistré sur cette carte.</p>;
  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-3">Historique de l&apos;unité</h3>
      <ol className="space-y-0">
        {gestes.map((g, i) => (
          <li key={g.id} className={`relative pl-5 pb-4 ml-1.5 ${i < gestes.length - 1 ? "border-l border-[#2D3748]" : "border-l border-transparent"}`}>
            <div className="absolute left-[-4px] top-1 w-2 h-2 rounded-full bg-[#9CA3AF]" />
            {(() => {
              // Constat système, pas un geste : la phrase seule, sans sujet.
              if (g.action === "INVITATION_NON_ENVOYEE" || g.action === "INVITATION_REINITIALISEE") {
                return <p className="text-[13px] text-[#9CA3AF] leading-snug" data-testid="historique-invitation-non-envoyee">{phraseGesteCarte(g)}</p>;
              }
              const estMoi = !!g.acteur && g.acteur === moi;
              const l = ligneSignee(estMoi, nomAuteur(g.acteur ? auteurs[g.acteur] : undefined), phraseGesteCarte(g, estMoi));
              return (
                <p className="text-[13px] text-[#e0e0e0] leading-snug">
                  <span className="font-bold text-white">{l.sujet}</span> {l.phrase}
                </p>
              );
            })()}
            <p className="text-[11px] text-[#6b7280] mt-0.5">
              {new Date(g.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })} ·{" "}
              {new Date(g.created_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
