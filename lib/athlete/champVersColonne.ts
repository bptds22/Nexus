/* ═══════════════════════════════════════════════════════════════
   champVersColonne — écrire un champ de profil athlète EN DIRECT.

   ── POURQUOI CE MODULE EXISTE ───────────────────────────────────
   Jusqu'ici, l'athlète « proposait » : le wizard insérait dans
   `athlete_suggestions`, et la fonction SQL `apply_approved_suggestion`
   traduisait le libellé français en colonne au moment de l'approbation.

   La décision du 2026-09-09 rend ces champs modifiables DIRECTEMENT.
   Le client doit donc faire lui-même ce que faisait le moteur — et le
   faire À L'IDENTIQUE, sinon on écrit dans la mauvaise colonne, en
   silence, sur le profil d'un mineur.

   ── CE FICHIER EST UN MIROIR, PAS UNE RÉÉCRITURE ────────────────
   Chaque branche cite le SQL qu'elle reproduit. Si le moteur change,
   la citation ne correspondra plus et ça se verra à la lecture. Le
   moteur reste en place pour les vieux clients (trigger de transition,
   à retirer en 1.4.2) : les deux chemins doivent écrire pareil tant
   qu'ils coexistent.

   ── CE QU'IL NE FAIT PAS, ET POURQUOI ───────────────────────────
   `Cote globale` et `Distinctions` n'y sont pas : elles appartiennent
   à l'entraîneur, décision produit du 2026-09-09. Le trigger de
   transition les REJETTE avec un motif ; ce module ne les connaît pas
   du tout, ce qui est plus sûr — on ne peut pas écrire par erreur un
   champ qu'on n'a pas.

   `Sport secondaire` / `Position secondaire` non plus : le moteur les
   traite en NO-OP (« champs RETIRÉS, remplacés par parcours_equipes »).
   Les porter ici dirait « enregistré » sans rien enregistrer.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ResultatEcriture =
  | { ok: true }
  | { ok: false; motif: string };

/** Les champs que l'athlète écrit DIRECTEMENT. Miroir de
 *  `champs_profil_athlete()` en base, MOINS les deux champs retirés que le
 *  moteur traite en NO-OP. */
export const CHAMPS_DIRECTS = [
  "Taille", "Poids", "Envergure", "Taille mains",
  "Main dominante", "Pied dominant",
  "40 yards", "Saut vertical", "Saut longueur", "Développé couché",
  "Navette", "Sprint 100m",
  "Sport principal", "Position", "Numéro",
] as const;

export type ChampDirect = (typeof CHAMPS_DIRECTS)[number];

export function estChampDirect(champ: string): champ is ChampDirect {
  return (CHAMPS_DIRECTS as readonly string[]).includes(champ);
}

/** Les champs à colonne TEXTE, écrits tels quels.
 *  SQL miroir : `UPDATE athletes SET <col> = NEW.valeur_proposee`. */
const COLONNE_TEXTE: Readonly<Record<string, string>> = Object.freeze({
  "Envergure":        "envergure",
  "Taille mains":     "taille_mains",
  "Main dominante":   "main_dominante",
  "Pied dominant":    "pied_dominant",
  "40 yards":         "test_40_verges",
  "Saut vertical":    "saut_vertical",
  "Saut longueur":    "saut_longueur",
  "Développé couché": "developpe_couche",
  "Navette":          "navette_agilite",
  "Sprint 100m":      "sprint_100m",
});

/** Taille : « 6'2" » → pieds 6, pouces 2.
 *  SQL miroir :
 *    taille_pieds  = NULLIF(split_part(replace(v,'"',''), '''', 1), '')::int
 *    taille_pouces = NULLIF(split_part(replace(v,'"',''), '''', 2), '')::int
 *  `split_part` rend '' quand la partie manque — d'où le NULLIF, reproduit
 *  ici par le `|| null`. Une saisie sans apostrophe donne donc pieds seuls. */
export function decouperTaille(valeur: string): { pieds: number | null; pouces: number | null } {
  const sansGuillemets = valeur.replace(/"/g, "");
  const [p1 = "", p2 = ""] = sansGuillemets.split("'");
  const enNombre = (s: string) => {
    const n = parseInt(s.trim(), 10);
    return Number.isFinite(n) ? n : null;
  };
  return { pieds: enNombre(p1), pouces: enNombre(p2) };
}

/** Poids : « 185 lbs » → 185.
 *  SQL miroir : `NULLIF(replace(v, ' lbs', ''), '')::numeric`. */
export function extraireePoids(valeur: string): number | null {
  const n = parseFloat(valeur.replace(" lbs", "").trim());
  return Number.isFinite(n) ? n : null;
}

/** Numéro : « #12 » → « 12 ». SQL miroir : `replace(v, '#', '')`. */
export function nettoyerNumero(valeur: string): string | null {
  const v = valeur.replace(/#/g, "").trim();
  return v || null;
}

/**
 * Écrit un champ de profil directement sur `athletes`.
 *
 * Rend un motif LISIBLE plutôt que de lever : l'appelant est un écran de
 * saisie, et un jeune doit comprendre pourquoi sa valeur n'est pas passée.
 * Les deux recherches de clé étrangère (sport, position) rendent le même
 * motif que le moteur, aux mêmes conditions.
 */
export async function ecrireChampAthlete(
  supabase: SupabaseClient,
  athleteId: string,
  champ: string,
  valeur: string,
): Promise<ResultatEcriture> {
  if (!estChampDirect(champ)) {
    return { ok: false, motif: `Champ « ${champ} » non modifiable directement.` };
  }

  const maj = async (patch: Record<string, unknown>): Promise<ResultatEcriture> => {
    const { error } = await supabase.from("athletes").update(patch).eq("id", athleteId);
    return error ? { ok: false, motif: error.message } : { ok: true };
  };

  /* Texte vide = effacement, comme partout ailleurs dans le wizard. */
  const vide = valeur.trim() === "";

  if (champ in COLONNE_TEXTE) {
    return maj({ [COLONNE_TEXTE[champ]]: vide ? null : valeur });
  }

  switch (champ) {
    case "Taille": {
      if (vide) return maj({ taille_pieds: null, taille_pouces: null });
      const { pieds, pouces } = decouperTaille(valeur);
      return maj({ taille_pieds: pieds, taille_pouces: pouces });
    }

    case "Poids":
      return maj({ poids_lbs: vide ? null : extraireePoids(valeur) });

    case "Numéro":
      return maj({ numero_jersey: vide ? null : nettoyerNumero(valeur) });

    case "Sport principal": {
      if (vide) return { ok: false, motif: "Choisis un sport." };
      /* SQL miroir : SELECT id FROM sports WHERE lower(nom) = lower(v),
         puis EXCEPTION si introuvable. */
      const { data } = await supabase
        .from("sports").select("id").ilike("nom", valeur.trim()).maybeSingle();
      if (!data?.id) return { ok: false, motif: `Sport « ${valeur} » introuvable.` };
      return maj({ sport_id: data.id });
    }

    case "Position": {
      if (vide) return maj({ position_id: null });
      /* SQL miroir : la position est cherchée DANS LE SPORT de l'athlète —
         `p.sport_id = a.sport_id`. Une position d'un autre sport est donc
         refusée, et c'est voulu : un ailier de hockey sur un profil de
         football n'est pas une donnée, c'est une faute de saisie. */
      const { data: ath } = await supabase
        .from("athletes").select("sport_id").eq("id", athleteId).maybeSingle();
      if (!ath?.sport_id) return { ok: false, motif: "Choisis d'abord ton sport principal." };
      const { data } = await supabase
        .from("positions").select("id")
        .eq("sport_id", ath.sport_id).ilike("nom", valeur.trim()).maybeSingle();
      if (!data?.id) return { ok: false, motif: `Position « ${valeur} » introuvable pour ton sport.` };
      return maj({ position_id: data.id });
    }

    default:
      /* Inatteignable : estChampDirect a déjà filtré. Gardé pour que l'ajout
         d'un champ à CHAMPS_DIRECTS sans branche ici échoue VISIBLEMENT. */
      return { ok: false, motif: `Champ « ${champ} » sans règle d'écriture.` };
  }
}
