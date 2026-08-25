/* ═══════════════════════════════════════════════════════════════
   useCegepPrograms — le catalogue partagé des programmes collégiaux.

   TROIS COUCHES (cf. migration 20260825144345) :
     cegep_programs        183 entrées — LA CLÉ DE MATCHING (code MEQ)
     cegep_program_labels  228 libellés — CE QUE L'ATHLÈTE VOIT
     athletes.programmes_vises uuid[] → cegep_program_labels.id, max 3

   L'athlète porte un LIBELLÉ, pas un code. Sa fiche rejoue donc
   exactement ce qu'il a choisi (« Sciences humaines — Psychologie »)
   pendant que le matching passe par program_id (300.M1, offert par
   38 cégeps). Une jointure sépare les deux — jamais l'affichage.

   POURQUOI staleTime INFINI
   228 lignes de données de référence qui ne bougent qu'au rythme
   d'un import de catalogue (une fois par an au mieux). Les recharger
   à chaque montage du sélecteur serait du gaspillage pur.
═══════════════════════════════════════════════════════════════ */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CegepProgramLabel {
  /** cegep_program_labels.id — CE QUE STOCKE athletes.programmes_vises. */
  id: string;
  label: string;
  /** Combien d'établissements nomment le programme AINSI. */
  nbEcoles: number;
  /** Le libellé le plus répandu de son programme : la liste au repos
   *  n'affiche que ceux-là (une entrée par code, zéro doublon visuel). */
  isVedette: boolean;
  /** cegep_programs.id — LA CLÉ DE MATCHING. */
  programId: string;
  /** Code MEQ, null pour les 5 entrées hors nomenclature. */
  code: string | null;
  nomCanonique: string;
  type: "preuniversitaire" | "technique";
  horsNomenclature: boolean;
  /** Combien de cégeps offrent LE PROGRAMME (≠ nbEcoles, qui compte
   *  ceux qui l'appellent ainsi). C'est la seconde moitié de la ligne
   *  de portée : « 2 cégeps le nomment ainsi · offert par 38 ». */
  cegepsOffrant: number;
}

export const MAX_PROGRAMMES_VISES = 3;

/** Déaccentuation + minuscules. Même normalisation que scoring.ts —
 *  un ado tape « criminologie » sans accent et sans majuscule. */
export function normProg(v: string): string {
  return v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function useCegepPrograms() {
  return useQuery<CegepProgramLabel[]>({
    queryKey: ["cegep-programs"],
    queryFn: async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("cegep_program_labels")
        .select(`
          id, label, nb_ecoles, is_vedette, program_id,
          cegep_programs!program_id(id, code, nom_canonique, type, hors_nomenclature)
        `)
        .order("label");
      if (error) throw error;
      if (!data) return [];

      // Portée du PROGRAMME (combien de cégeps l'offrent) — une seule
      // requête pour tout le catalogue, agrégée côté client. school_programs
      // est lisible par tout compte authentifié (policy programs_read).
      const { data: spRows } = await supabase
        .from("school_programs")
        .select("program_id, school_id")
        .eq("is_displayed", true);
      const offrePar = new Map<string, Set<string>>();
      for (const r of (spRows ?? []) as { program_id: string | null; school_id: string }[]) {
        if (!r.program_id) continue;
        if (!offrePar.has(r.program_id)) offrePar.set(r.program_id, new Set());
        offrePar.get(r.program_id)!.add(r.school_id);
      }

      return (data as Record<string, unknown>[]).map((r): CegepProgramLabel => {
        const rawP = r.cegep_programs;
        const p = (Array.isArray(rawP) ? rawP[0] : rawP) as Record<string, unknown> | null;
        const programId = (r.program_id as string) || "";
        return {
          id: r.id as string,
          label: r.label as string,
          nbEcoles: (r.nb_ecoles as number) ?? 0,
          isVedette: r.is_vedette === true,
          programId,
          code: (p?.code as string) ?? null,
          nomCanonique: (p?.nom_canonique as string) ?? (r.label as string),
          type: ((p?.type as string) === "technique" ? "technique" : "preuniversitaire"),
          horsNomenclature: p?.hors_nomenclature === true,
          cegepsOffrant: offrePar.get(programId)?.size ?? 0,
        };
      });
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/* ═══════════════════════════════════════════════════════════════
   resolveProgrammesVises — la fonction que TOUTES les surfaces de
   LECTURE appellent, et la seule qui connaisse la transition.

   Le contrat de sortie est `string[]` — exactement ce que les dix
   surfaces attendaient de programme_cegep_vise. Elles passent d'une
   normalisation inline à un appel, et rien d'autre ne bouge chez
   elles.

   L'ORDRE DES DEUX SOURCES N'EST PAS ARBITRAIRE
   La nouvelle colonne d'abord : dès qu'un athlète a refait son choix,
   c'est celui-là qui s'affiche, même si l'ancienne valeur traîne
   encore (elle n'est vidée qu'en T3). Le repli sur l'ancienne
   disparaît avec le vidage — même geste, même migration.
═══════════════════════════════════════════════════════════════ */
/** Résolution hors React — pour les data-loaders et les composants qui
 *  ne sont pas dans un contexte de hook. Une requête bornée aux ids
 *  demandés (≤ 3 par athlète), pas le catalogue entier.
 *
 *  Retourne les libellés DANS L'ORDRE CHOISI par l'athlète : PostgREST
 *  ne garantit pas l'ordre d'un `.in()`, et l'ordre de sélection est
 *  une information (le premier programme cité est le principal). */
export async function fetchProgrammeLabels(
  supabase: SupabaseClient,
  ids: string[],
): Promise<string[]> {
  if (!ids || ids.length === 0) return [];
  const { data } = await supabase.from("cegep_program_labels").select("id, label").in("id", ids);
  const byId = new Map(((data ?? []) as { id: string; label: string }[]).map((r) => [r.id, r.label]));
  return ids.map((id) => byId.get(id)).filter((x): x is string => !!x);
}

/** Résolution EN LOT pour les listes. Une seule requête pour toute la
 *  page, au lieu d'une par athlète — la liste « nouveau message » du
 *  recruteur peut porter des dizaines de lignes, et un N+1 y coûte cher.
 *  Rend une Map id → libellé, à passer à resolveProgrammesVisesMap(). */
export async function fetchProgrammeLabelMap(
  supabase: SupabaseClient,
  rows: { programmes_vises?: unknown }[],
): Promise<Map<string, string>> {
  const ids = [...new Set(rows.flatMap((r) =>
    Array.isArray(r?.programmes_vises) ? (r.programmes_vises as unknown[]).map(String) : []))].filter(Boolean);
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("cegep_program_labels").select("id, label").in("id", ids);
  return new Map(((data ?? []) as { id: string; label: string }[]).map((r) => [r.id, r.label]));
}

/** Version synchrone adossée à la Map ci-dessus. Même contrat de repli. */
export function resolveProgrammesVisesMap(
  programmesVises: unknown,
  legacy: unknown,
  byId: Map<string, string>,
): string[] {
  const ids = Array.isArray(programmesVises)
    ? (programmesVises as unknown[]).map(String).filter(Boolean)
    : [];
  if (ids.length > 0) return ids.map((id) => byId.get(id)).filter((x): x is string => !!x);
  return Array.isArray(legacy) ? (legacy as unknown[]).map(String).filter(Boolean) : [];
}

/** Le pendant asynchrone de resolveProgrammesVises, même contrat de repli. */
export async function resolveProgrammesVisesAsync(
  supabase: SupabaseClient,
  programmesVises: unknown,
  legacy: unknown,
): Promise<string[]> {
  const ids = Array.isArray(programmesVises)
    ? (programmesVises as unknown[]).map(String).filter(Boolean)
    : [];
  if (ids.length > 0) return fetchProgrammeLabels(supabase, ids);
  return Array.isArray(legacy) ? (legacy as unknown[]).map(String).filter(Boolean) : [];
}

export function resolveProgrammesVises(
  programmesVises: unknown,
  legacy: unknown,
  catalogue: CegepProgramLabel[] | undefined,
): string[] {
  const ids = Array.isArray(programmesVises)
    ? (programmesVises as unknown[]).map(String).filter(Boolean)
    : [];

  if (ids.length > 0) {
    // Catalogue pas encore chargé : on rend un tableau vide plutôt que
    // des uuid bruts. Un uuid affiché à un recruteur est pire qu'un blanc.
    if (!catalogue || catalogue.length === 0) return [];
    const byId = new Map(catalogue.map((l) => [l.id, l.label]));
    return ids.map((id) => byId.get(id)).filter((x): x is string => !!x);
  }

  return Array.isArray(legacy) ? (legacy as unknown[]).map(String).filter(Boolean) : [];
}

/* ═══════════════════════════════════════════════════════════════
   useMonCegepOffreDesProgrammes — le garde-fou des 9 cégeps.

   Neuf établissements de type CEGEP n'ont aucune ligne school_programs
   (sept réels — Charlevoix, Lanaudière, Chibougamau, Matapédie,
   Champlain, Ellis, Universel — et deux fixtures internes), et huit sur
   neuf ont des équipes : ils recrutent. Huit recruteurs sur vingt-quatre
   n'ont par ailleurs aucun school_id.

   Pour eux, « offert par mon cégep » rendrait ZÉRO résultat SANS ERREUR
   — la donnée absente lue comme un résultat vide, exactement la panne
   que ce chantier corrige ailleurs. La RPC lève désormais (marqueur
   NEXUS) ; ce hook permet de MASQUER le bouton en amont, plutôt que de
   l'offrir puis d'échouer.

   Le compteur admin est côté base : admin_cegeps_sans_programme().
═══════════════════════════════════════════════════════════════ */
export function useMonCegepOffreDesProgrammes() {
  return useQuery<boolean>({
    queryKey: ["mon-cegep-offre-des-programmes"],
    queryFn: async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return false;
      const { data: u } = await supabase
        .from("users").select("school_id").eq("id", auth.user.id).maybeSingle();
      const schoolId = (u as { school_id?: string } | null)?.school_id;
      if (!schoolId) return false;
      const { count } = await supabase
        .from("school_programs")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId);
      return (count ?? 0) > 0;
    },
    staleTime: Infinity,
  });
}
