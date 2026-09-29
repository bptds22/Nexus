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

import { useAuteursUnite, nomAuteur } from "@/lib/queries/recruiter/useProcessusUnite";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useJournalCarte, type GesteCarte } from "@/lib/cartes/useCartes";
import { joursAvantPurge, AVIS_JOURS, type CarteKanban } from "@/lib/cartes/carteProspect";
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

/** Mention en tête du panneau d'une carte, et l'invitation si elle est partie. */
export function MentionProspect({ inviteeLe }: { inviteeLe?: string | null }) {
  return (
    <>
      <p className="text-[13px] text-[#E5A0A6]">
        Pas encore sur Nexus — carte prospect de ton unité.
      </p>
      {inviteeLe && (
        <p className="text-[12px] text-[#9CA3AF] mt-0.5" data-testid="invitation-envoyee">
          Invitation envoyée le {dateInvitation(inviteeLe)}
        </p>
      )}
    </>
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

function SectionGrisee({ titre }: { titre: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#2D3748] bg-[#13151a]/60 px-4 py-3 opacity-60" aria-disabled="true">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">{titre}</p>
      <p className="text-[12px] text-[#6b7280] mt-1">Disponible quand l&apos;athlète sera sur Nexus.</p>
    </div>
  );
}

export function OngletInfosCarte({ card }: { card: CarteKanban }) {
  const c = card.carte;
  const taille = card.taille_pieds ? `${card.taille_pieds}'${card.taille_pouces ?? 0}"` : null;
  const creeLe = new Date(c.creeLe).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#2D3748] bg-[#13151a] px-4 py-2">
        <Ligne libelle="Équipe" valeur={c.teamNom ?? <span className="text-[#6b7280]">Équipe retirée</span>} />
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
        <Ligne libelle="Courriel" valeur={c.courriel ?? <span className="text-[#6b7280]">—</span>} />
        {c.inviteeLe && <Ligne libelle="Invitation" valeur={`Envoyée le ${dateInvitation(c.inviteeLe)}`} />}
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

export function phraseGesteCarte(g: GesteCarte): string {
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
    case "INVITATION": return "a invité l'athlète par courriel (envoi automatique à la création)";
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
              const l = ligneSignee(!!g.acteur && g.acteur === moi, nomAuteur(g.acteur ? auteurs[g.acteur] : undefined), phraseGesteCarte(g));
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
