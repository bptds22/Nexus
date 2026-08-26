/* ═══════════════════════════════════════════════════════════════
   Lecture et écriture des badges d'un athlète — partagé par les 7 surfaces.

   Une seule définition du DÉCOUPAGE entre ce qu'un écran peut éditer et ce
   qu'il ne fait que montrer. Le refaire à la main sept fois garantirait
   qu'une surface finisse par diverger, et une divergence ici fait mentir
   l'écran : une case décochée que la base ne retire pas.

   Ce découpage épouse EXACTEMENT la portée de appliquer_badges_saisie, qui
   épouse elle-même la policy UPDATE de athlete_badges. Les trois doivent
   rester d'accord ; si vous en changez un, changez les trois.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BadgeEntry } from "@/lib/config/badgeCatalogue";

export interface BadgesAthlete {
  /** Éditables par l'appelant : origine 'saisie' et attribués par lui
   *  (ou tous ceux de saisie s'il est admin). C'est ce qui part dans
   *  `value` du picker, et EXACTEMENT ce qui part dans la RPC. */
  miens: BadgeEntry[];
  /** Montrés, pas édités : ceux d'un autre coach, ceux issus d'une
   *  suggestion, ceux repris de l'ancien format. Ils comptent au plafond. */
  autres: BadgeEntry[];
}

export const BADGES_VIDES: BadgesAthlete = Object.freeze({ miens: [], autres: [] });

interface LigneBadge {
  contexte: string | null;
  attribue_par: string | null;
  origine: string;
  badges: { code: string; libelle: string } | { code: string; libelle: string }[] | null;
}

/** PostgREST rend l'embed tantôt objet, tantôt tableau selon la version. */
function badgeDe(l: LigneBadge): { code: string; libelle: string } | null {
  const b = Array.isArray(l.badges) ? l.badges[0] : l.badges;
  return b?.code ? b : null;
}

/* ═══════════════════════════════════════════════════════════════
   VOIE 2 — les badges viennent de athlete_badges, pas de la colonne
   dérivée evaluations.distinctions.

   POURQUOI PAR L'EMBED ET PAS PAR UNE REQUÊTE
   mapToAthleteProfile et mapToRecruiterView sont SYNCHRONES et appelées
   depuis neuf endroits. Les rendre asynchrones, ou leur ajouter un
   paramètre, aurait imposé neuf modifications d'appelants pour une donnée
   d'affichage. L'embed la fait arriver par `raw`, et les deux mappeurs se
   servent — sans changer de signature.

   CE QUE ÇA CHANGE POUR L'ÉCRAN
   distinctions ne portait que les codes ayant un équivalent hérité : Caron
   y avait 3 badges sur 7, et un athlète dont tous les badges sont
   spécifiques au sport n'en avait AUCUN. L'embed les rend tous, avec le
   libellé du catalogue — c'est lui qui part dans la prop `libelle` de
   DistinctionBadge.

   Les badges RETIRÉS sont exclus ICI, pas en base : retire_le documente un
   retrait, il ne supprime pas la ligne.
═══════════════════════════════════════════════════════════════ */
interface LigneBadgeAffichee {
  contexte: string | null;
  /* La date d'attribution est created_at. Il n'existe PAS de attribue_le :
     attribue_par est l'AUTEUR, retire_le la date de RETRAIT. */
  created_at?: string | null;
  retire_le: string | null;
  badges: { code: string; libelle: string } | { code: string; libelle: string }[] | null;
}

export interface BadgeAffiche {
  badge: string;
  detail?: string;
  libelle: string;
  attribueLe?: string | null;
}

export function badgesDepuisRaw(raw: Record<string, unknown>): BadgeAffiche[] {
  const brut = raw.athlete_badges;
  if (!Array.isArray(brut)) return [];
  return (brut as LigneBadgeAffichee[])
    .filter((l) => !l.retire_le)
    .map((l): BadgeAffiche | null => {
      const b = Array.isArray(l.badges) ? l.badges[0] : l.badges;
      if (!b?.code) return null;
      return {
        badge: b.code,
        detail: l.contexte ?? undefined,
        libelle: b.libelle,
        attribueLe: l.created_at ?? null,
      };
    })
    .filter((e): e is BadgeAffiche => e !== null);
}

/**
 * Charge les badges VIVANTS d'un athlète, déjà découpés.
 *
 * `moi` : l'utilisateur courant. `estAdmin` : un admin édite tous les badges
 * de saisie, pas seulement les siens — comme la RPC et comme la policy.
 */
export type ModeBadges = "saisie" | "suggestion";

export async function chargerBadgesAthlete(
  supabase: SupabaseClient,
  athleteId: string,
  moi: string | null,
  estAdmin = false,
  mode: ModeBadges = "saisie",
): Promise<BadgesAthlete> {
  const { data, error } = await supabase
    .from("athlete_badges")
    .select("contexte, attribue_par, origine, badges(code, libelle)")
    .eq("athlete_id", athleteId)
    .is("retire_le", null);

  if (error) {
    /* On ne rend PAS un objet vide en silence : le picker croirait que
       l'athlète n'a aucun badge, et le premier enregistrement retirerait
       tout ce qu'il ne « voit » pas. Mieux vaut propager. */
    throw new Error(`NEXUS: lecture des badges impossible — ${error.message}`);
  }

  const miens: BadgeEntry[] = [];
  const autres: BadgeEntry[] = [];
  for (const l of (data ?? []) as unknown as LigneBadge[]) {
    const b = badgeDe(l);
    if (!b) continue;
    /* Le libellé voyage avec l'entrée : ces écrans chargent déjà les badges
       pour le picker, ils peuvent donc aussi les AFFICHER sans seconde
       requête. C'est ce qui rend le lot 2 gratuit en aller-retours. */
    const e: BadgeEntry = { code: b.code, contexte: l.contexte, libelle: b.libelle };
    /* Le périmètre éditable dépend du CHEMIN, parce que chaque RPC borne le
       sien de la même façon :
         · 'saisie'     → appliquer_badges_saisie ne remplace que les badges
                          de saisie de l'appelant (tous si admin) ;
         · 'suggestion' → appliquer_distinctions_suggerees ne remplace que
                          les badges issus de suggestions. L'athlète n'en est
                          pas l'auteur — c'est l'approbateur — donc aucun
                          test sur attribue_par ici.
       Un badge posé par un coach n'est donc jamais retirable par une
       suggestion, et l'écran ne le laisse pas croire. */
    const editable = mode === "suggestion"
      ? l.origine === "suggestion"
      : l.origine === "saisie" && (estAdmin || l.attribue_par === moi);
    (editable ? miens : autres).push(e);
  }
  return { miens, autres };
}

/**
 * Enregistre le jeu de badges de saisie, EN UNE TRANSACTION.
 *
 * `entrees` ne doit contenir que les badges éditables (le `miens` ci-dessus,
 * tel que le picker l'a modifié). Y ajouter ceux des autres ne les
 * retirerait pas — la RPC borne sa portée — et l'écran mentirait.
 */
export async function enregistrerBadgesSaisie(
  supabase: SupabaseClient,
  athleteId: string,
  entrees: BadgeEntry[],
): Promise<void> {
  const { error } = await supabase.rpc("appliquer_badges_saisie", {
    p_athlete_id: athleteId,
    p_entrees: entrees.map((e) => ({ code: e.code, contexte: e.contexte ?? null })),
  });
  if (error) throw new Error(error.message);
}

/**
 * Sérialise pour le chemin SUGGESTION (surfaces athlète).
 *
 * Ancienne forme `{badge, detail}` avec les NOUVEAUX codes :
 * apply_approved_suggestion → appliquer_distinctions_suggerees passe déjà
 * chaque code par code_badge_catalogue, qui accepte les deux vocabulaires.
 * Aucun SQL à toucher, et une suggestion soumise avant la bascule reste
 * approuvable après.
 */
export function versSuggestion(entrees: BadgeEntry[]): string {
  return JSON.stringify(
    entrees.map((e) => (e.contexte ? { badge: e.code, detail: e.contexte } : { badge: e.code })),
  );
}

/** Relit une suggestion déjà soumise (ou l'état courant) vers la forme du
 *  picker. Tolère les deux vocabulaires de clés. */
export function depuisSuggestion(brut: unknown): BadgeEntry[] {
  if (!brut) return [];
  let arr: unknown = brut;
  if (typeof brut === "string") {
    try { arr = JSON.parse(brut); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x): BadgeEntry | null => {
      if (typeof x === "string") return { code: x, contexte: null };
      if (x && typeof x === "object") {
        const o = x as { code?: string; badge?: string; contexte?: string; detail?: string };
        const code = o.code ?? o.badge;
        if (code) return { code, contexte: o.contexte ?? o.detail ?? null };
      }
      return null;
    })
    .filter((e): e is BadgeEntry => e !== null);
}

/* ═══════════════════════════════════════════════════════════════
   Pastilles de badge des surfaces de fil et de carte.

   Ces écrans n'affichent pas l'emblème : ils rendent une pastille de
   texte à côté du nom de l'athlète. Ils portaient chacun leur PROPRE
   table de libellés en dur — deux vocabulaires de plus, qui se
   contredisaient entre eux et avec le catalogue :

     AthleteInfoCard        allstar → « Équipe d'étoiles »
     coach/demandes/[id]    allstar → « Étoile »
     BADGE_CONFIG           allstar → « Étoile provinciale »
     catalogue              equipe-etoiles → « Équipe d'étoiles »

   Et leur repli était `labels[code] || code` : un code non répertorié
   s'affichait BRUT. Tant que ces surfaces lisaient evaluations.distinctions
   elles ne voyaient que les 7 anciens codes, donc le repli ne se
   déclenchait jamais. La bascule voie 2 y fait arriver les 22 — « qi »,
   « clutch », « verrou » se seraient affichés tels quels dans une
   interface recruteur.

   RÈGLE : un code sans libellé n'affiche RIEN, et se journalise. Un badge
   absent est une lacune ; un code brut montré à un recruteur est une faute.
═══════════════════════════════════════════════════════════════ */

/** Une pastille prête à rendre. `libelle` est TOUJOURS présent — les
 *  entrées sans libellé sont écartées en amont par pastillesBadges(). */
export interface PastilleBadge {
  code: string;
  libelle: string;
  contexte?: string | null;
}

const dejaSignalesPastille = new Set<string>();

/**
 * Convertit les entrées projetées par les RPC (ou par badgesDepuisRaw) en
 * pastilles affichables, en ÉCARTANT tout ce qui n'a pas de libellé.
 *
 * Accepte les deux formes qui circulent : `{badge, detail, libelle}` (les
 * projections voie 2) et `{code, contexte, libelle}` (chargerBadgesAthlete).
 */
export function pastillesBadges(brut: unknown): PastilleBadge[] {
  if (!Array.isArray(brut)) return [];
  const out: PastilleBadge[] = [];
  for (const x of brut) {
    if (typeof x === "string") {
      /* Ancienne forme : un code nu, sans libellé possible. On n'invente
         pas — on écarte et on le dit une fois. */
      signalerPastille(x, "code nu sans libellé (ancienne forme string[])");
      continue;
    }
    if (!x || typeof x !== "object") continue;
    const o = x as { code?: string; badge?: string; libelle?: string; contexte?: string | null; detail?: string | null };
    const code = o.code ?? o.badge;
    if (!code) continue;
    if (!o.libelle) {
      signalerPastille(code, "aucun libellé fourni par la source");
      continue;
    }
    out.push({ code, libelle: o.libelle, contexte: o.contexte ?? o.detail ?? null });
  }
  return out;
}

function signalerPastille(code: string, raison: string): void {
  if (dejaSignalesPastille.has(code)) return;
  dejaSignalesPastille.add(code);
  console.warn(
    `NEXUS: badge « ${code} » non affiché en pastille — ${raison}. ` +
    `Un code brut montré à un recruteur serait pire qu'une absence : ` +
    `la source doit projeter le libellé du catalogue (badges.libelle).`,
  );
}

/** Le texte d'une pastille : le libellé, suivi du contexte s'il existe. */
export function textePastille(p: PastilleBadge): string {
  return p.contexte ? `${p.libelle} — ${p.contexte}` : p.libelle;
}
