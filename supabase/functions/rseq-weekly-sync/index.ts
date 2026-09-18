// rseq-weekly-sync : veille RSEQ hebdomadaire, COLLÉGIAL et SECONDAIRE.
// ============================================================================
// DEUX MODES, UN SECTEUR TOUJOURS EXPLICITE
//
//   ?secteur=Collégial | ?secteur=Secondaire      OBLIGATOIRE, sans défaut.
//     Décision BP 2026-09-18 : le secteur est explicite partout (?secteur=,
//     p_secteur des RPC, colonne `mode` du journal). Un appel sans secteur est
//     refusé (400) — un défaut « Collégial » referait en silence le défaut que
//     le lot 1 corrige (le secteur écrit en dur).
//
//   (sans ?mode)          PASSE : GetLeagueDiffusion pour chaque ligue du
//                         secteur (vue rseq_ligues_a_appeler filtrée), puis
//                         matchs / classement / détections. ~38 ligues au
//                         collégial (~35 s), ~164 au secondaire (~2 min 45 s).
//   ?mode=decouverte      DÉCOUVERTE : GetSchoolYearList -> GetRegionSports ->
//                         GetLeagueList pour la saison courante, ne garde que
//                         le secteur demandé, écrit le catalogue via
//                         rseq_decouverte_upsert. Secondaire SEULEMENT (le
//                         collégial est couvert par games) : ?secteur=Collégial
//                         est refusé en mode découverte. ~190 appels, ~2 min 40 s.
//                         Portage de scripts/rseq-discover.mjs.
//
// Les deux passes et la découverte sont des INVOCATIONS SÉPARÉES (cron
// distincts) : ensemble elles dépasseraient le plafond de 400 s.
//
// POLITESSE — les deux modes : 800 ms entre deux appels au RSEQ, QUEL QU'EN
// SOIT LE TYPE (un seul minuteur par invocation), et un User-Agent unique
// « Nexus-Veille/1.0 ». diffusion.s1.rseq.ca est un service public gratuit ;
// on passe de ~38 à ~390 appels par semaine, et un blocage de notre IP
// couperait AUSSI la veille collégiale.
//
// FUSIBLE — 330 s. Avant chaque appel au RSEQ, si la passe a dépassé 330 s,
// elle s'arrête proprement : journal en PARTIAL, alerte PASSE_PARTIELLE, et
// les étapes de fin (familles, mapping, journal) ont encore ~40 s devant le
// plafond de 400 s, même au pire : passé 300 s, chaque appel n'a plus droit
// qu'à UNE tentative (voir SEUIL_TENTATIVE_UNIQUE_MS). Sans lui, l'edge function serait tuée au plafond et le
// journal resterait RUNNING pour toujours, sans aucun signal. Quand il saute
// régulièrement (basketball et futsal en octobre), c'est le déclencheur du
// lot « tranches ».
//
// AUTH — en-tête `x-rseq-secret`, comparé DANS la base par
// `rseq_verifie_secret(candidat)` (booléen, jamais le secret). Une seule
// source, le Vault : ni le cron ni la fonction ne voient la valeur.
// Pas de JWT (verify_jwt = false) : l'appelant est pg_cron, pas un usager.
//
// LE TIMEOUT pg_net — piège déjà payé une fois.
//   pg_net coupe à 5 s par défaut (docs/push-pgnet-timeout-20260823.md). On
//   répond 202 TOUT DE SUITE et on travaille dans EdgeRuntime.waitUntil.
//   `?wait=1` force le mode SYNCHRONE et renvoie le bilan — pour la recette
//   LOCALE seulement : en prod, une requête de plus de 150 s d'inactivité
//   risque d'être coupée alors que la passe, elle, réussirait. Recette prod =
//   mode cron (202) + lecture du journal.
//
// CE QUE CETTE FONCTION NE FAIT PAS
//   Elle n'écrit ni dans `schools`, ni dans `teams`. Elle ne supprime rien.
//   Écritures : les RPC rseq_* (lots du 2026-09-02 et du 2026-09-18), le
//   journal rseq_sync_runs, et l'alerte PASSE_PARTIELLE / DECOUVERTE_VIDE.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  retenirWhitelist,
  normaliserMatchs,
  normaliserClassement,
  equipesADetecter,
  type MetaLigue,
} from "../_shared/rseqWhitelist.ts";

const BASE = "https://diffusion.s1.rseq.ca/";
const API_LIGUE = BASE + "api/LeagueApi/GetLeagueDiffusion/?leagueId=";

const DELAI_MS = 800;
const TIMEOUT_MS = 30_000;
const TENTATIVES = 2;
// RSEQ_FUSIBLE_S ne peut qu'ABAISSER le fusible (plafonné à 330). Elle n'existe
// que pour la recette locale : provoquer un PARTIAL contre la vraie API sans
// attendre qu'octobre le fasse. Non définie en prod.
const FUSIBLE_MS = Math.min(330, Number(Deno.env.get("RSEQ_FUSIBLE_S")) || 330) * 1000;

// Passé ce seuil (300 s en prod), UNE seule tentative par appel. Sinon un appel
// lancé juste avant le fusible, dont les deux tentatives vont au bout du
// délai (2 × 30 s + 1,5 s), pousserait la fin de passe vers 400 s — le plafond
// où le runtime tue la fonction et laisse le journal en RUNNING. Avec une
// seule tentative : 330 + 30 = 360 s au pire, ~40 s pour les étapes de fin.
const SEUIL_TENTATIVE_UNIQUE_MS = FUSIBLE_MS - TIMEOUT_MS;

const ENTETES = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Nexus-Veille/1.0; veille hebdomadaire pour nexussports.ca)",
  "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.5",
};

const SECTEURS = ["Collégial", "Secondaire"] as const;
type Secteur = (typeof SECTEURS)[number];
type Mode = "passe" | "decouverte";

// Régions RSEQ : liste STATIQUE du site (#regionSelect), 14 = Provincial.
// Recopiée de scripts/rseq-discover.mjs — les noms sont ceux que porte
// games.region, la vue s'appuie dessus pour l'agrégation sport × région.
const REGIONS: ReadonlyArray<[number, string]> = [
  [0, "Abitibi-Témiscamingue"],
  [1, "Cantons-de-l'Est"],
  [2, "Côte-Nord"],
  [3, "Est-du-Québec"],
  [4, "GMAA"],
  [5, "Lac-Saint-Louis"],
  [6, "Laurentides-Lanaudière"],
  [7, "Laval"],
  [8, "Mauricie"],
  [9, "Montérégie"],
  [10, "Montréal"],
  [11, "Outaouais"],
  [12, "Québec-Chaudière-Appalaches"],
  [13, "Saguenay-Lac-Saint-Jean"],
  [14, "Provincial"],
];

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const dodo = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Saison scolaire courante. L'année RSEQ bascule en juillet. */
function saisonCourante(d = new Date()): string {
  const a = d.getUTCFullYear();
  return d.getUTCMonth() + 1 >= 7 ? `${a}-${a + 1}` : `${a - 1}-${a}`;
}

const motifDe = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Accès poli au RSEQ, un par invocation. TOUS les appels passent par lui :
 * 800 ms minimum entre deux requêtes, quel que soit l'endpoint, et le fusible
 * est consulté AVANT chaque appel.
 */
class Rseq {
  private dernier = 0;
  readonly t0 = Date.now();
  appels = 0;

  fusibleSaute(): boolean {
    return Date.now() - this.t0 > FUSIBLE_MS;
  }

  /**
   * GET -> JSON, seconde tentative sur échec de transport ou 5xx — sauf passé
   * SEUIL_TENTATIVE_UNIQUE_MS, où l'on n'a plus le temps d'en offrir deux.
   */
  async json(url: string): Promise<unknown> {
    let derniere = "";
    const tentatives =
      Date.now() - this.t0 > SEUIL_TENTATIVE_UNIQUE_MS ? 1 : TENTATIVES;
    for (let essai = 1; essai <= tentatives; essai++) {
      const attente = this.dernier + DELAI_MS - Date.now();
      if (attente > 0) await dodo(attente);
      this.dernier = Date.now();
      this.appels++;

      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(url, { headers: ENTETES, signal: ctrl.signal });
        if (res.ok) return await res.json();
        derniere = `HTTP ${res.status}`;
        // Un 4xx ne s'améliore pas en réessayant : c'est le GUID qui est mort.
        if (res.status >= 400 && res.status < 500) break;
      } catch (e) {
        derniere = motifDe(e);
      } finally {
        clearTimeout(t);
        this.dernier = Date.now();
      }
      if (essai < tentatives) await dodo(1500);
    }
    throw new Error(derniere || "echec inconnu");
  }
}

/** Ouvre la ligne de journal. `mode` et `secteur` toujours écrits. */
async function ouvrirJournal(declencheur: string, saison: string, secteur: Secteur, mode: Mode) {
  const { data: run, error } = await supabase
    .from("rseq_sync_runs")
    .insert({ declencheur, saison, secteur, mode, statut: "RUNNING" })
    .select("id")
    .single();
  if (error || !run) throw new Error(`NEXUS: ouverture du journal impossible — ${error?.message}`);
  return run.id as string;
}

/**
 * Alerte hors RPC (fusible, découverte vide). Une seule OUVERTE par clé
 * (index unique partiel) : une passe qui saute chaque semaine ne s'empile pas,
 * l'alerte reste ouverte jusqu'à ce qu'on la traite. Rend 1 si créée.
 */
async function leverAlerte(
  runId: string, type: string, cle: string, resume: string, payload: Record<string, unknown>,
): Promise<number> {
  const { error } = await supabase.from("rseq_sync_alerts")
    .insert({ run_id: runId, type, cle, resume, payload });
  if (!error) return 1;
  if (error.code === "23505") return 0; // déjà ouverte
  console.error(`NEXUS: alerte ${type} non levee —`, error.message);
  return 0;
}

// ─── PASSE ──────────────────────────────────────────────────────────────────

type Bilan = {
  run_id: string;
  mode: "passe";
  secteur: Secteur;
  saison: string;
  statut: string;
  ligues_visees: number;
  ligues_ok: number;
  ligues_ko: number;
  ligues_non_traitees: number;
  matchs_vus: number;
  matchs_inseres: number;
  matchs_maj: number;
  classements_vus: number;
  classements_inseres: number;
  classements_maj: number;
  alertes_levees: number;
  appels: number;
  erreurs: { league_id: string; motif: string }[];
  duree_s: number;
};

async function passe(declencheur: string, secteur: Secteur): Promise<Bilan> {
  const rseq = new Rseq();
  const saison = saisonCourante();
  const runId = await ouvrirJournal(declencheur, saison, secteur, "passe");

  const { data: ligues, error: eL } = await supabase
    .from("rseq_ligues_a_appeler")
    .select("rseq_league_id, saison, sector, sport, region, division, category, sex_type, league_name, family_key")
    .eq("sector", secteur);
  if (eL) throw new Error(`NEXUS: liste des ligues illisible — ${eL.message}`);

  const b: Bilan = {
    run_id: runId, mode: "passe", secteur, saison, statut: "RUNNING",
    ligues_visees: ligues?.length ?? 0,
    ligues_ok: 0, ligues_ko: 0, ligues_non_traitees: 0,
    matchs_vus: 0, matchs_inseres: 0, matchs_maj: 0,
    classements_vus: 0, classements_inseres: 0, classements_maj: 0,
    alertes_levees: 0, appels: 0, erreurs: [], duree_s: 0,
  };

  const muette = async (leagueId: string, motif: string) => {
    b.ligues_ko++;
    b.erreurs.push({ league_id: leagueId, motif });
    // Une ligue qui ne répond plus n'est pas un incident technique : c'est
    // le signal du changement annuel de GUID. Elle part en revue.
    const { data } = await supabase.rpc("rseq_sync_signal_ligue_muette", {
      p_run_id: runId, p_league_id: leagueId, p_saison: saison, p_motif: motif,
    });
    b.alertes_levees += Number(data ?? 0);
  };

  for (const [i, L] of (ligues ?? []).entries()) {
    if (rseq.fusibleSaute()) {
      b.ligues_non_traitees = (ligues?.length ?? 0) - i;
      break;
    }
    const leagueId = L.rseq_league_id as string;

    let brut: unknown;
    try {
      brut = await rseq.json(API_LIGUE + leagueId);
    } catch (e) {
      await muette(leagueId, motifDe(e));
      continue;
    }

    let retenu;
    try {
      retenu = retenirWhitelist(brut);
    } catch (e) {
      await muette(leagueId, motifDe(e));
      continue;
    }

    const meta: MetaLigue = {
      rseq_league_id: leagueId,
      saison: (L.saison as string) ?? saison,
      // La vue est filtrée sur `secteur` : L.sector === secteur. On écrit la
      // valeur demandée, pas un repli en dur.
      sector: secteur,
      sport: L.sport as string | null,
      region: L.region as string | null,
      division: L.division as string | null,
      category: L.category as string | null,
      sex_type: L.sex_type as string | null,
      league_name: L.league_name as string | null,
    };

    const matchs = normaliserMatchs(retenu, meta);
    const classement = normaliserClassement(retenu);
    // UNION Teams[] + participants des matchs, UUID nul exclu. Teams[] seul
    // rate 22 des 334 equipes reelles de la saison — voir equipesADetecter.
    const equipes = equipesADetecter(retenu);

    // Une ligue qui répond 200 mais ne porte NI match NI classement est une
    // coquille vide : on la traite comme muette plutôt que de conclure
    // « rien à faire » sur une source qui a peut-être changé de forme.
    if (matchs.length === 0 && classement.length === 0) {
      await muette(leagueId, "payload sans match ni classement");
      continue;
    }

    const { data: rg, error: eg } = await supabase.rpc("rseq_sync_apply_games", {
      p_run_id: runId, p_league_id: leagueId, p_games: matchs,
    });
    if (eg) {
      b.ligues_ko++;
      b.erreurs.push({ league_id: leagueId, motif: `matchs: ${eg.message}` });
      continue;
    }
    const g = Array.isArray(rg) ? rg[0] : rg;
    b.matchs_vus += Number(g?.vus ?? 0);
    b.matchs_inseres += Number(g?.inseres ?? 0);
    b.matchs_maj += Number(g?.maj ?? 0);

    // MATCH_RETIRE : ce que la base porte et que cette passe n'a PAS vu. Juste
    // après l'upsert, avec la liste exacte des identifiants servis — c'est le
    // seul moment où on la connaît. Détection seule : rien n'est supprimé.
    const { data: rr, error: er } = await supabase.rpc("rseq_sync_detect_matchs_retires", {
      p_run_id: runId, p_league_id: leagueId, p_saison: meta.saison,
      p_vus: matchs.map((m) => m.rseq_game_id as string),
    });
    if (er) b.erreurs.push({ league_id: leagueId, motif: `retires: ${er.message}` });
    else b.alertes_levees += Number(rr ?? 0);

    const { data: rs, error: es } = await supabase.rpc("rseq_sync_apply_standings", {
      p_run_id: runId, p_league_id: leagueId, p_saison: meta.saison, p_secteur: secteur,
      p_standings: classement,
    });
    if (es) {
      b.ligues_ko++;
      b.erreurs.push({ league_id: leagueId, motif: `classement: ${es.message}` });
      continue;
    }
    const s = Array.isArray(rs) ? rs[0] : rs;
    b.classements_vus += Number(s?.vus ?? 0);
    b.classements_inseres += Number(s?.inseres ?? 0);
    b.classements_maj += Number(s?.maj ?? 0);

    // Collégial : une alerte NOUVELLE_EQUIPE par équipe. Secondaire : une
    // alerte NOUVELLES_EQUIPES par sport × région (agrégation côté base).
    const { data: ra, error: ea } = await supabase.rpc("rseq_sync_detect_teams", {
      p_run_id: runId, p_league_id: leagueId,
      p_family_key: L.family_key as string, p_saison: meta.saison, p_secteur: secteur,
      p_teams: equipes,
    });
    if (ea) {
      b.erreurs.push({ league_id: leagueId, motif: `detection: ${ea.message}` });
    } else {
      b.alertes_levees += Number(ra ?? 0);
    }

    b.ligues_ok++;
  }

  // Familles dormantes : une seule fois par passage, à la fin, quand la vue
  // reflète ce qui a été publié. Limité au secteur de la passe.
  const { data: rf, error: ef } = await supabase.rpc("rseq_sync_detect_familles", {
    p_run_id: runId, p_saison: saison, p_secteur: secteur,
  });
  if (ef) b.erreurs.push({ league_id: "-", motif: `familles: ${ef.message}` });
  else b.alertes_levees += Number(rf ?? 0);

  // Dérive de mapping, cas A (équipe pontée absente de toute ligue). Le
  // jugement porte sur l'ensemble de la saison, pas sur une ligue.
  const { data: rm, error: em } = await supabase.rpc("rseq_sync_detect_mapping", {
    p_run_id: runId, p_saison: saison, p_secteur: secteur,
  });
  if (em) b.erreurs.push({ league_id: "-", motif: `mapping: ${em.message}` });
  else b.alertes_levees += Number(rm ?? 0);

  b.duree_s = Math.round((Date.now() - rseq.t0) / 100) / 10;
  b.appels = rseq.appels;

  if (b.ligues_non_traitees > 0) {
    b.alertes_levees += await leverAlerte(
      runId, "PASSE_PARTIELLE", `${secteur}|passe|${saison}`,
      `Passe ${secteur.toLowerCase()} arretee par le fusible (${FUSIBLE_MS / 1000} s) : ` +
        `${b.ligues_non_traitees} ligue(s) sur ${b.ligues_visees} non traitee(s). ` +
        `Si ca se repete, c'est le moment du lot « tranches ».`,
      {
        secteur, mode: "passe", saison,
        ligues_visees: b.ligues_visees, ligues_non_traitees: b.ligues_non_traitees,
        duree_s: b.duree_s, fusible_s: FUSIBLE_MS / 1000,
      },
    );
  }

  // Une ligue muette n'est pas une erreur de la passe : la passe a fait son
  // travail et l'a signalée. ERROR est réservé à un échec généralisé ;
  // PARTIAL au fusible.
  b.statut = b.ligues_ok === 0 ? "ERROR" : b.ligues_non_traitees > 0 ? "PARTIAL" : "DONE";

  await supabase.from("rseq_sync_runs").update({
    finished_at: new Date().toISOString(),
    ligues_visees: b.ligues_visees,
    ligues_ok: b.ligues_ok,
    ligues_ko: b.ligues_ko,
    matchs_vus: b.matchs_vus,
    matchs_inseres: b.matchs_inseres,
    matchs_maj: b.matchs_maj,
    classements_vus: b.classements_vus,
    classements_inseres: b.classements_inseres,
    classements_maj: b.classements_maj,
    alertes_levees: b.alertes_levees,
    statut: b.statut,
    erreurs: b.erreurs,
    detail: {
      appels: b.appels,
      ...(b.ligues_non_traitees > 0
        ? { ligues_non_traitees: b.ligues_non_traitees, fusible_s: FUSIBLE_MS / 1000 }
        : {}),
    },
  }).eq("id", runId);

  return b;
}

// ─── DÉCOUVERTE ─────────────────────────────────────────────────────────────

type BilanDecouverte = {
  run_id: string;
  mode: "decouverte";
  secteur: Secteur;
  saison: string;
  statut: string;
  ligues_vues: number;
  nouvelles: number;
  modifiees: number;
  hors_secteur: number;
  regions_traitees: number;
  appels: number;
  appels_ko: number;
  par_sport: Record<string, number>;
  alertes_levees: number;
  erreurs: { etape: string; motif: string }[];
  duree_s: number;
};

const sansEspaces = (s: unknown) => String(s ?? "").replace(/\s+/g, "");

/** Une ligne GetLeagueList -> ligne du catalogue (noms de colonnes SQL). */
function versCatalogue(
  L: Record<string, unknown>, region: string, saison: string, schoolYearId: string,
  sportNom: string, sportCode: string,
) {
  return {
    rseq_league_id: L.LeagueId ?? null,
    saison,
    secteur: L.Sector ?? null,
    // GetLeagueList ne porte que le code du sport ; le nom vient de GetRegionSports.
    sport: (L.SportName as string | undefined) ?? sportNom,
    sport_code: L.Sport ?? (Number(sportCode) || null),
    region,
    region_code: L.Region ?? null,
    division: L.Division ?? null,
    category: L.Category ?? null,
    sex_type: L.SexType ?? null,
    league_name: L.LeagueName ?? null,
    team_count: L.TeamCount ?? null,
    is_master_league: L.IsMasterLeague ?? null,
    school_year_id: L.SchoolYearId ?? schoolYearId,
  };
}

async function decouverte(declencheur: string, secteur: Secteur): Promise<BilanDecouverte> {
  const rseq = new Rseq();
  const saison = saisonCourante();
  const runId = await ouvrirJournal(declencheur, saison, secteur, "decouverte");

  const b: BilanDecouverte = {
    run_id: runId, mode: "decouverte", secteur, saison, statut: "RUNNING",
    ligues_vues: 0, nouvelles: 0, modifiees: 0, hors_secteur: 0,
    regions_traitees: 0, appels: 0, appels_ko: 0, par_sport: {},
    alertes_levees: 0, erreurs: [], duree_s: 0,
  };
  let regionsNonTraitees = 0;
  const vues = new Set<string>(); // les ligues maîtresses reviennent d'une région à l'autre

  // Voir saisonCourante() : « 2026-2027 » ; l'API écrit « 2026 - 2027 ».
  let schoolYearId: string | null = null;
  try {
    const annees = await rseq.json(BASE + "api/SchoolYearApi/GetSchoolYearList");
    const a = (Array.isArray(annees) ? annees : []).find(
      (y: Record<string, unknown>) => sansEspaces(y.SchoolYear) === saison,
    ) as Record<string, unknown> | undefined;
    schoolYearId = (a?.SchoolYearId as string | undefined) ?? null;
    if (!schoolYearId) b.erreurs.push({ etape: "annees", motif: `saison ${saison} absente de GetSchoolYearList` });
  } catch (e) {
    b.appels_ko++;
    b.erreurs.push({ etape: "annees", motif: motifDe(e) });
  }

  if (schoolYearId) {
    for (const [ri, [regionCode, regionNom]] of REGIONS.entries()) {
      if (rseq.fusibleSaute()) { regionsNonTraitees = REGIONS.length - ri; break; }

      let sports: Record<string, string> = {};
      try {
        const d = await rseq.json(
          BASE + "api/HomeApi/GetRegionSports/?" +
            new URLSearchParams({ schoolYearId, region: String(regionCode) }),
        ) as { Sports?: Record<string, string> } | null;
        sports = d && typeof d.Sports === "object" && d.Sports ? d.Sports : {};
      } catch (e) {
        // Le script de recherche avalait cette erreur ({}) : ici elle se voit.
        b.appels_ko++;
        b.erreurs.push({ etape: `sports ${regionNom}`, motif: motifDe(e) });
        continue;
      }

      const lot: ReturnType<typeof versCatalogue>[] = [];
      let coupe = false;
      for (const [sportCode, sportNom] of Object.entries(sports)) {
        if (rseq.fusibleSaute()) { coupe = true; break; }
        let ligues: unknown;
        try {
          ligues = await rseq.json(
            BASE + "api/LeagueApi/GetLeagueList/?" +
              new URLSearchParams({ schoolYearId, region: String(regionCode), sport: sportCode }),
          );
        } catch (e) {
          b.appels_ko++;
          b.erreurs.push({ etape: `ligues ${regionNom} / ${sportNom}`, motif: motifDe(e) });
          continue;
        }
        for (const L of (Array.isArray(ligues) ? ligues : []) as Record<string, unknown>[]) {
          const id = L.LeagueId as string | undefined;
          if (!id || vues.has(id)) continue;
          vues.add(id);
          if (L.Sector !== secteur) { b.hors_secteur++; continue; }
          const ligne = versCatalogue(L, regionNom, saison, schoolYearId, sportNom, sportCode);
          lot.push(ligne);
          b.par_sport[ligne.sport] = (b.par_sport[ligne.sport] ?? 0) + 1;
        }
      }

      // Écriture PAR RÉGION : si le fusible saute plus loin, ce qui a été lu
      // est déjà au catalogue.
      if (lot.length > 0) {
        const { data, error } = await supabase.rpc("rseq_decouverte_upsert", { p_ligues: lot });
        if (error) {
          b.erreurs.push({ etape: `catalogue ${regionNom}`, motif: error.message });
        } else {
          const r = Array.isArray(data) ? data[0] : data;
          b.ligues_vues += Number(r?.vues ?? 0);
          b.nouvelles += Number(r?.nouvelles ?? 0);
          b.modifiees += Number(r?.modifiees ?? 0);
        }
      }
      if (coupe) { regionsNonTraitees = REGIONS.length - ri; break; }
      b.regions_traitees++;
    }
  }

  b.duree_s = Math.round((Date.now() - rseq.t0) / 100) / 10;
  b.appels = rseq.appels;

  if (regionsNonTraitees > 0) {
    b.alertes_levees += await leverAlerte(
      runId, "PASSE_PARTIELLE", `${secteur}|decouverte|${saison}`,
      `Decouverte ${secteur.toLowerCase()} arretee par le fusible (${FUSIBLE_MS / 1000} s) : ` +
        `${regionsNonTraitees} region(s) sur ${REGIONS.length} non parcourue(s). ` +
        `Le catalogue garde ce qui a ete lu ; la vue appellera quand meme les ligues deja connues.`,
      {
        secteur, mode: "decouverte", saison,
        regions_non_traitees: regionsNonTraitees, duree_s: b.duree_s, fusible_s: FUSIBLE_MS / 1000,
      },
    );
  }

  // Zéro ligue pour le secteur en pleine saison : l'API a changé de forme, ou
  // la saison n'est pas ouverte. Dans les deux cas, quelqu'un doit regarder.
  if (b.ligues_vues === 0) {
    b.alertes_levees += await leverAlerte(
      runId, "DECOUVERTE_VIDE", `${secteur}|decouverte-vide|${saison}`,
      `Decouverte ${secteur.toLowerCase()} ${saison} : AUCUNE ligue au catalogue ` +
        `(${b.appels} appel(s), ${b.appels_ko} en echec). API modifiee, ou saison pas encore ouverte.`,
      { secteur, saison, appels: b.appels, appels_ko: b.appels_ko, erreurs: b.erreurs.slice(0, 10) },
    );
  }

  b.statut = b.ligues_vues === 0 ? "ERROR" : regionsNonTraitees > 0 ? "PARTIAL" : "DONE";

  // Les colonnes de passe sont réutilisées au sens le plus proche :
  // ligues_visees = ligues du secteur lues, ligues_ok = écrites au catalogue,
  // ligues_ko = appels en échec. Le reste dans `detail`.
  await supabase.from("rseq_sync_runs").update({
    finished_at: new Date().toISOString(),
    ligues_visees: vues.size - b.hors_secteur,
    ligues_ok: b.ligues_vues,
    ligues_ko: b.appels_ko,
    alertes_levees: b.alertes_levees,
    statut: b.statut,
    erreurs: b.erreurs,
    detail: {
      appels: b.appels, appels_ko: b.appels_ko,
      nouvelles: b.nouvelles, modifiees: b.modifiees, hors_secteur: b.hors_secteur,
      regions_traitees: b.regions_traitees, par_sport: b.par_sport,
      ...(regionsNonTraitees > 0
        ? { regions_non_traitees: regionsNonTraitees, fusible_s: FUSIBLE_MS / 1000 }
        : {}),
    },
  }).eq("id", runId);

  return b;
}

// ─── ENTRÉE ─────────────────────────────────────────────────────────────────

/**
 * L'en-tête reçu est-il le secret ? La comparaison se fait DANS la base : on
 * envoie le candidat, on reçoit un booléen. Un en-tête absent est refusé sans
 * même déranger la base.
 */
async function secretValide(req: Request): Promise<boolean> {
  const recu = req.headers.get("x-rseq-secret");
  if (!recu) return false;
  const { data, error } = await supabase.rpc("rseq_verifie_secret", { p_candidat: recu });
  if (error) {
    console.error("NEXUS: verification du secret impossible —", error.message);
    return false;
  }
  return data === true;
}

Deno.serve(async (req) => {
  if (!(await secretValide(req))) {
    return new Response("forbidden", { status: 403 });
  }

  const q = new URL(req.url).searchParams;

  const secteur = q.get("secteur");
  if (!SECTEURS.includes(secteur as Secteur)) {
    return Response.json(
      { erreur: `?secteur= obligatoire : ${SECTEURS.join(" | ")} (recu : ${secteur ?? "rien"})` },
      { status: 400 },
    );
  }

  const modeBrut = q.get("mode");
  if (modeBrut !== null && modeBrut !== "decouverte") {
    return Response.json(
      { erreur: `?mode= inconnu : « ${modeBrut} ». Valeur admise : decouverte (sans ?mode : passe)` },
      { status: 400 },
    );
  }
  const mode: Mode = modeBrut === "decouverte" ? "decouverte" : "passe";

  if (mode === "decouverte" && secteur !== "Secondaire") {
    return Response.json(
      { erreur: "?mode=decouverte n'existe que pour ?secteur=Secondaire (le collegial est couvert par games)" },
      { status: 400 },
    );
  }

  const travail = (declencheur: string) =>
    mode === "decouverte"
      ? decouverte(declencheur, secteur as Secteur)
      : passe(declencheur, secteur as Secteur);

  if (q.get("wait") === "1") {
    // Recette LOCALE : on bloque et on rend le bilan complet.
    try {
      return Response.json(await travail("manual"));
    } catch (e) {
      return Response.json({ erreur: motifDe(e) }, { status: 500 });
    }
  }

  // Mode cron : 202 immédiat, travail en arrière-plan (pg_net ne peut pas
  // couper ce qu'il n'attend pas).
  // @ts-expect-error EdgeRuntime est fourni par le runtime Supabase, pas par tsc.
  EdgeRuntime.waitUntil(
    travail("cron").catch((e) => console.error(`NEXUS: ${mode} RSEQ ${secteur} echouee —`, e)),
  );
  return Response.json({ accepte: true, mode, secteur }, { status: 202 });
});
