// rseq-weekly-sync : veille RSEQ hebdomadaire des ligues COLLÉGIALES.
// ============================================================================
// Une passe = 38 appels à GetLeagueDiffusion (saison 2026-2027), ~7,4 Mo,
// ~35 s avec 800 ms de politesse entre les appels. Pour chaque ligue :
// whitelist -> normalisation -> 3 RPC (matchs, classement, détection).
//
// AUTH — en-tête `x-rseq-secret`, comme send-push / send-announcement, mais
// avec une différence de fond : le secret N'EST PAS une variable
// d'environnement de cette fonction. Il vit dans le Vault de la base, généré
// par elle (migration 20260902210100), et la comparaison se fait LÀ-BAS :
// `rseq_verifie_secret(candidat)` rend un booléen, jamais le secret.
//
// Une seule source, donc. Le cron lit le Vault pour composer son en-tête, la
// fonction redemande au Vault si l'en-tête est bon — et personne, humain ou
// agent, n'a jamais eu la valeur sous les yeux. La variable d'environnement
// RSEQ_SYNC_SECRET a été retirée : la garder aurait fait deux sources, donc
// deux occasions de diverger.
//
// Pas de JWT (verify_jwt = false) : l'appelant est pg_cron, pas un usager.
//
// LE TIMEOUT pg_net — piège déjà payé une fois.
//   pg_net coupe à 5 s par défaut (docs/push-pgnet-timeout-20260823.md). Une
//   passe de 35 s le dépasserait et pg_cron consignerait un échec sur un
//   travail qui, lui, réussit. Donc, comme send-announcement : on répond 202
//   TOUT DE SUITE et on travaille dans EdgeRuntime.waitUntil.
//
//   Sauf en recette : `?wait=1` force le mode SYNCHRONE et renvoie le bilan
//   complet dans le corps de la réponse. C'est ce mode qu'on utilise pour le
//   premier passage manuel et pour la preuve d'idempotence — on veut voir le
//   journal, pas un 202.
//
// CE QUE CETTE FONCTION NE FAIT PAS
//   Elle n'écrit ni dans `schools`, ni dans `teams`. Elle ne supprime rien.
//   Les seules écritures passent par les RPC de la migration
//   20260902090000, qui n'ont pas de chemin vers ces tables.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  retenirWhitelist,
  normaliserMatchs,
  normaliserClassement,
  equipesADetecter,
  type MetaLigue,
} from "../_shared/rseqWhitelist.ts";

const API = "https://diffusion.s1.rseq.ca/api/LeagueApi/GetLeagueDiffusion/?leagueId=";

// Politesse : 800 ms entre deux appels, comme les scripts de chargement.
// diffusion.s1.rseq.ca est un service public gratuit ; 38 appels par semaine
// à ce rythme, c'est moins qu'un visiteur qui navigue.
const DELAI_MS = 800;
const TIMEOUT_MS = 30_000;
const TENTATIVES = 2;

const ENTETES = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Nexus-Veille/1.0; veille hebdomadaire pour nexussports.ca)",
  "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.5",
};

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

type Bilan = {
  run_id: string;
  saison: string;
  ligues_visees: number;
  ligues_ok: number;
  ligues_ko: number;
  matchs_vus: number;
  matchs_inseres: number;
  matchs_maj: number;
  classements_vus: number;
  classements_inseres: number;
  classements_maj: number;
  alertes_levees: number;
  erreurs: { league_id: string; motif: string }[];
  duree_s: number;
};

/** Un appel, avec seconde tentative sur échec de transport. */
async function lireLigue(leagueId: string): Promise<unknown> {
  let derniere = "";
  for (let essai = 1; essai <= TENTATIVES; essai++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(API + leagueId, { headers: ENTETES, signal: ctrl.signal });
      if (!res.ok) {
        derniere = `HTTP ${res.status}`;
        // Un 4xx ne s'améliore pas en réessayant : c'est le GUID qui est mort.
        if (res.status >= 400 && res.status < 500) break;
      } else {
        return await res.json();
      }
    } catch (e) {
      derniere = e instanceof Error ? e.message : String(e);
    } finally {
      clearTimeout(t);
    }
    if (essai < TENTATIVES) await dodo(1500);
  }
  throw new Error(derniere || "echec inconnu");
}

async function passe(declencheur: string): Promise<Bilan> {
  const t0 = Date.now();
  const saison = saisonCourante();

  const { data: run, error: eRun } = await supabase
    .from("rseq_sync_runs")
    .insert({ declencheur, saison, secteur: "Collégial", statut: "RUNNING" })
    .select("id")
    .single();
  if (eRun || !run) throw new Error(`NEXUS: ouverture du journal impossible — ${eRun?.message}`);
  const runId = run.id as string;

  const { data: ligues, error: eL } = await supabase
    .from("rseq_ligues_a_appeler")
    .select("rseq_league_id, saison, sector, sport, region, division, category, sex_type, league_name, family_key");
  if (eL) throw new Error(`NEXUS: liste des ligues illisible — ${eL.message}`);

  const b: Bilan = {
    run_id: runId, saison,
    ligues_visees: ligues?.length ?? 0,
    ligues_ok: 0, ligues_ko: 0,
    matchs_vus: 0, matchs_inseres: 0, matchs_maj: 0,
    classements_vus: 0, classements_inseres: 0, classements_maj: 0,
    alertes_levees: 0, erreurs: [], duree_s: 0,
  };

  for (const [i, L] of (ligues ?? []).entries()) {
    if (i > 0) await dodo(DELAI_MS);
    const leagueId = L.rseq_league_id as string;

    let brut: unknown;
    try {
      brut = await lireLigue(leagueId);
    } catch (e) {
      const motif = e instanceof Error ? e.message : String(e);
      b.ligues_ko++;
      b.erreurs.push({ league_id: leagueId, motif });
      // Une ligue qui ne répond plus n'est pas un incident technique : c'est
      // le signal du changement annuel de GUID. Elle part en revue.
      const { data } = await supabase.rpc("rseq_sync_signal_ligue_muette", {
        p_run_id: runId, p_league_id: leagueId, p_saison: saison, p_motif: motif,
      });
      b.alertes_levees += Number(data ?? 0);
      continue;
    }

    let retenu;
    try {
      retenu = retenirWhitelist(brut);
    } catch (e) {
      const motif = e instanceof Error ? e.message : String(e);
      b.ligues_ko++;
      b.erreurs.push({ league_id: leagueId, motif });
      const { data } = await supabase.rpc("rseq_sync_signal_ligue_muette", {
        p_run_id: runId, p_league_id: leagueId, p_saison: saison, p_motif: motif,
      });
      b.alertes_levees += Number(data ?? 0);
      continue;
    }

    const meta: MetaLigue = {
      rseq_league_id: leagueId,
      saison: (L.saison as string) ?? saison,
      sector: (L.sector as string) ?? "Collégial",
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
      b.ligues_ko++;
      const motif = "payload sans match ni classement";
      b.erreurs.push({ league_id: leagueId, motif });
      const { data } = await supabase.rpc("rseq_sync_signal_ligue_muette", {
        p_run_id: runId, p_league_id: leagueId, p_saison: saison, p_motif: motif,
      });
      b.alertes_levees += Number(data ?? 0);
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

    const { data: rs, error: es } = await supabase.rpc("rseq_sync_apply_standings", {
      p_run_id: runId, p_league_id: leagueId, p_saison: meta.saison, p_standings: classement,
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

    const { data: ra, error: ea } = await supabase.rpc("rseq_sync_detect_teams", {
      p_run_id: runId, p_league_id: leagueId,
      p_family_key: L.family_key as string, p_saison: meta.saison, p_teams: equipes,
    });
    if (ea) {
      b.erreurs.push({ league_id: leagueId, motif: `detection: ${ea.message}` });
    } else {
      b.alertes_levees += Number(ra ?? 0);
    }

    b.ligues_ok++;
  }

  // Familles dormantes : une seule fois par passage, à la fin, quand la vue
  // reflète ce qui a été publié.
  const { data: rf, error: ef } = await supabase.rpc("rseq_sync_detect_familles", {
    p_run_id: runId, p_saison: saison,
  });
  if (ef) b.erreurs.push({ league_id: "-", motif: `familles: ${ef.message}` });
  else b.alertes_levees += Number(rf ?? 0);

  b.duree_s = Math.round((Date.now() - t0) / 100) / 10;

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
    // Une ligue muette n'est pas une erreur de la passe : la passe a fait son
    // travail et l'a signalée. ERROR est réservé à un échec généralisé.
    statut: b.ligues_ok === 0 ? "ERROR" : "DONE",
    erreurs: b.erreurs,
  }).eq("id", runId);

  return b;
}

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

  const attendre = new URL(req.url).searchParams.get("wait") === "1";

  if (attendre) {
    // Mode recette : on bloque et on rend le bilan complet.
    try {
      const b = await passe("manual");
      return Response.json(b);
    } catch (e) {
      return Response.json(
        { erreur: e instanceof Error ? e.message : String(e) },
        { status: 500 },
      );
    }
  }

  // Mode cron : 202 immédiat, travail en arrière-plan (pg_net ne peut pas
  // couper ce qu'il n'attend pas).
  // @ts-expect-error EdgeRuntime est fourni par le runtime Supabase, pas par tsc.
  EdgeRuntime.waitUntil(
    passe("cron").catch((e) => console.error("NEXUS: passe RSEQ echouee —", e)),
  );
  return Response.json({ accepte: true }, { status: 202 });
});
