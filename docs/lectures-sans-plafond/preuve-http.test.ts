/* Preuve HTTP LOCALE — lectures sans plafond (20261016080000). Pas dans « npm test » : exige la pile Supabase
   locale (Docker) migrée. Lecture seule : aucune écriture.

     $env:SUPABASE_URL="http://127.0.0.1:54321"; $env:SUPABASE_ANON_KEY="…"; $env:SUPABASE_JWT_SECRET="…"
     node --experimental-strip-types --import ./lib/evaluations/__tests__/register-alias.mjs --test docs/lectures-sans-plafond/preuve-http.test.ts

   Ce qu'elle prouve, à travers le VRAI PostgREST (max-rows = 1000) et le vrai code client :
   1. le défaut : l'ancien .in() dans l'adresse est refusé au-delà de quelques centaines d'identifiants, et une
      lecture de plus de 1000 lignes est coupée à 1000 sans erreur ;
   2. le correctif : les fonctions « par identifiants » + lireTout rendent TOUTES les lignes, avec les tables
      imbriquées, sous la RLS de l'appelant ;
   3. construireCalendrier (le calendrier recruteur) rend tous les matchs à venir de 1259 équipes. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { lireTout } from "@/lib/supabase/lireTout";
import { construireCalendrier, type CalendarTarget } from "@/lib/queries/recruiter/useRecruitingCalendar";
import { fetchRecruiterAthleteCards } from "@/lib/queries/shared/recruiterAthleteCards";
import { lireCartesParIds, lireCartes } from "@/lib/cartes/carteProspect";

const URL_API = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_ANON_KEY ?? "";
const SECRET = process.env.SUPABASE_JWT_SECRET ?? "";
const RECRUTEUR_LAUREATS = "7e570000-0000-4000-8000-00000000a001"; // recruteur.laureats.test@demo.local (952 cartes)

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jeton(sub: string, role = "authenticated"): string {
  const corps = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, role, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 600 })}`;
  return `${corps}.${createHmac("sha256", SECRET).update(corps).digest("base64url")}`;
}
function client(sub: string): SupabaseClient {
  return createClient(URL_API, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jeton(sub)}` } },
  });
}
const aujourdhui = () => new Date().toISOString().slice(0, 10);

async function toutesLesEquipes(sb: SupabaseClient): Promise<string[]> {
  const r = await lireTout<{ id: string }>((de, a) => sb.from("teams").select("id", { count: "exact" }).order("id").range(de, a));
  return r.map((t) => t.id);
}

test("préalables : variables d'environnement et volume local suffisant (> 1000 équipes)", async () => {
  assert.ok(ANON && SECRET, "SUPABASE_ANON_KEY et SUPABASE_JWT_SECRET requis");
  const equipes = await toutesLesEquipes(client(RECRUTEUR_LAUREATS));
  assert.ok(equipes.length > 1000, `il faut plus de 1000 équipes (${equipes.length})`);
});

test("le DÉFAUT : .in() de 1000+ identifiants refusé (adresse) ; lecture > 1000 lignes coupée sans erreur", async () => {
  const sb = client(RECRUTEUR_LAUREATS);
  const equipes = await toutesLesEquipes(sb);
  const enAdresse = await sb.from("teams").select("id").in("id", equipes);
  assert.ok(enAdresse.error, "l'adresse de 1000+ identifiants devait être refusée");
  const coupee = await sb.from("teams").select("id");
  assert.equal(coupee.error, null);
  assert.equal(coupee.data!.length, 1000, "PostgREST coupe à 1000 sans erreur");
});

test("teams_par_ids : identifiants dans le corps, TOUTES les lignes (> 1000), aucun doublon", async () => {
  const sb = client(RECRUTEUR_LAUREATS);
  const equipes = await toutesLesEquipes(sb);
  const lues = await lireTout<{ id: string; name: string }>((de, a) => sb
    .rpc("teams_par_ids", { p_ids: equipes }, { count: "exact" }).select("id, name").order("id").range(de, a));
  assert.equal(lues.length, equipes.length);
  assert.equal(new Set(lues.map((t) => t.id)).size, equipes.length);
});

test("games_des_equipes : tous les matchs à venir des 1259 équipes = la même lecture faite en direct, page par page", async () => {
  const sb = client(RECRUTEUR_LAUREATS);
  const equipes = await toutesLesEquipes(sb);
  const parFonction = await lireTout<{ id: string; game_date: string }>((de, a) => sb
    .rpc("games_des_equipes", { p_equipes: equipes, p_depuis: aujourdhui() }, { count: "exact" })
    .select("id, game_date").order("game_date").order("id").range(de, a));
  const direct = await lireTout<{ id: string }>((de, a) => sb
    .from("games").select("id", { count: "exact" })
    .or("home_team_id.not.is.null,visitor_team_id.not.is.null").gte("game_date", aujourdhui()).order("id").range(de, a));
  assert.ok(parFonction.length > 1000, `plus de 1000 matchs attendus (${parFonction.length})`);
  assert.equal(parFonction.length, direct.length);
  assert.deepEqual(new Set(parFonction.map((g) => g.id)), new Set(direct.map((g) => g.id)));
});

test("construireCalendrier (calendrier recruteur) : 1259 équipes ciblées → tous les matchs à venir, adversaires nommés", async () => {
  const sb = client(RECRUTEUR_LAUREATS);
  const equipes = await toutesLesEquipes(sb);
  const cibles = equipes.map((teamId, i) => ({ athleteId: `c${i}`, teamId, teamName: "" }) as unknown as CalendarTarget);
  const r = await construireCalendrier(sb, [], new Map(), new Map(), cibles, []);
  assert.ok(r.games.length > 1000, `plus de 1000 matchs attendus (${r.games.length})`);
  assert.equal(new Set(r.games.map((g) => g.id)).size, r.games.length);
  assert.ok(r.games.every((g) => g.homeName && g.visitorName));
});

test("embed sur fonction : athletes_par_ids garde les tables imbriquées (sports, schools)", async () => {
  const sb = client(RECRUTEUR_LAUREATS);
  const { data: ath } = await sb.from("athletes").select("id");
  const ids = (ath ?? []).map((a) => a.id as string);
  const lus = await lireTout<{ id: string; sports: unknown }>((de, a) => sb
    .rpc("athletes_par_ids", { p_ids: ids }, { count: "exact" })
    .select("id, sports!sport_id(nom), schools!school_id(region)").order("id").range(de, a));
  assert.equal(lus.length, ids.length, "la RLS de l'appelant : exactement ce qu'il lit en direct");
  assert.ok(lus.some((l) => l.sports !== null));
});

test("recruiter_athlete_cards par pages : même résultat qu'un appel unique sous 1000", async () => {
  const sb = client(RECRUTEUR_LAUREATS);
  const { data: ath } = await sb.from("athletes").select("id");
  const ids = (ath ?? []).map((a) => a.id as string);
  const cartes = await fetchRecruiterAthleteCards(sb, ids);
  const { data: brut, error } = await sb.rpc("recruiter_athlete_cards", { p_athlete_ids: ids });
  assert.equal(error, null);
  assert.equal(cartes.size, (brut as unknown[]).length);
});

test("cartes_par_ids : les 952 cartes Lauréats = processus_cartes (même format, même accès)", async () => {
  const sb = client(RECRUTEUR_LAUREATS);
  const toutes = await lireCartes(sb, { cegepId: "dfad9036-0d54-4304-906f-91f19542a882", sportId: null, toutLeCegep: true });
  assert.ok(toutes.length > 900);
  const parIds = await lireCartesParIds(sb, toutes.map((c) => c.id));
  assert.equal(parIds.length, toutes.length);
  const trie = (l: { id: string }[]) => [...l].sort((x, y) => x.id.localeCompare(y.id));
  assert.deepEqual(trie(parIds), trie(toutes));
  // Un autre recruteur (autre cégep) ne lit AUCUNE de ces cartes par identifiants.
  const autre = await lireCartesParIds(client("d3a00000-0000-4000-8000-0000000b9001"), toutes.map((c) => c.id));
  assert.equal(autre.length, 0);
});

test("construireCalendrier avec des CIBLES Nexus : team_athletes_par_athletes + recruiter_athlete_cards s'exécutent (sans erreur PostgREST)", async () => {
  // Régression attrapée en local : sur le résultat d'une fonction, PostgREST refuse de trier sur une colonne
  // non sélectionnée (select("athlete_id").order("id") → 400). Ici le chemin des athlètes Nexus est exercé.
  const sb = client(RECRUTEUR_LAUREATS);
  const { data: ath, error } = await sb.from("athletes").select("id");
  assert.equal(error, null);
  const ids = (ath ?? []).map((a) => a.id as string);
  assert.ok(ids.length > 0);
  const r = await construireCalendrier(sb, ids, new Map(), new Map(), [], []);
  assert.ok(Array.isArray(r.targets) && Array.isArray(r.games));
});
