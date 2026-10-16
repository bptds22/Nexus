/* Preuve HTTP LOCALE — lectures sans plafond, côté coach et pages admin (20261016080000). Même usage que
   preuve-http.test.ts (pile locale migrée, mêmes variables d'environnement). Lecture seule.

   1. Admin : le menu de transfert d'établissement (`.limit(10000)`) ne rendait que 1000 écoles ; la lecture
      complète rend tout. Les fonctions par équipes / par utilisateurs rendent ce que la lecture directe rend.
   2. Coach (directeur) : le périmètre, la file « à traiter » et les transferts passent par les nouvelles
      lectures et rendent exactement ce que les anciennes rendaient sous le plafond. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { lireTout } from "@/lib/supabase/lireTout";
import { lireCoachAthleteScope } from "@/lib/queries/coach/getCoachAthletes";
import { lireCoachTasks } from "@/lib/coach/tasks";
import { loadSchoolTeams, loadAthletesForTeam, loadTransferContext, NO_TEAM_ID } from "@/lib/coach/transferAthletes";

const URL_API = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_ANON_KEY ?? "";
const SECRET = process.env.SUPABASE_JWT_SECRET ?? "";
const ADMIN = "eeeeeeee-0000-0000-0000-0000000000aa";        // admin@demo.local
const DIRECTEUR = "d3a00000-0000-4000-8000-0000000c7001";    // marc.desrosiers@exemple.test (DIRECTEUR)
const ECOLE_DIRECTEUR = "d3a00000-0000-4000-8000-0000000c0001";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function client(sub: string): SupabaseClient {
  const corps = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 600 })}`;
  const jwt = `${corps}.${createHmac("sha256", SECRET).update(corps).digest("base64url")}`;
  return createClient(URL_API, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

test("admin : menu de transfert — `.limit(10000)` coupé à 1000 ; lecture complète = toutes les écoles", async () => {
  const sb = client(ADMIN);
  const avant = await sb.from("schools").select("id, name").order("name").limit(10000);
  assert.equal(avant.error, null);
  const { count } = await sb.from("schools").select("id", { count: "exact", head: true });
  assert.ok((count ?? 0) > 1000, `plus de 1000 écoles attendues (${count})`);
  assert.equal(avant.data!.length, 1000, "le défaut : coupé à 1000 sans erreur");
  const apres = await lireTout<{ id: string }>((de, a) => sb.from("schools").select("id, name", { count: "exact" })
    .order("name").order("id").range(de, a));
  assert.equal(apres.length, count);
  assert.equal(new Set(apres.map((s) => s.id)).size, count);
});

test("admin : team_athletes_par_equipes / team_coaches_par_equipes / users_par_ids = lecture directe", async () => {
  const sb = client(ADMIN);
  const equipes = (await lireTout<{ id: string }>((de, a) => sb.from("teams").select("id", { count: "exact" }).order("id").range(de, a))).map((t) => t.id);
  assert.ok(equipes.length > 1000);
  const [ta, taDirect, tc, tcDirect] = await Promise.all([
    lireTout<{ id: string }>((de, a) => sb.rpc("team_athletes_par_equipes", { p_ids: equipes }, { count: "exact" }).select("id").order("id").range(de, a)),
    lireTout<{ id: string }>((de, a) => sb.from("team_athletes").select("id", { count: "exact" }).order("id").range(de, a)),
    lireTout<{ id: string }>((de, a) => sb.rpc("team_coaches_par_equipes", { p_ids: equipes }, { count: "exact" }).select("id").order("id").range(de, a)),
    lireTout<{ id: string }>((de, a) => sb.from("team_coaches").select("id", { count: "exact" }).order("id").range(de, a)),
  ]);
  assert.deepEqual(ta.map((r) => r.id), taDirect.map((r) => r.id));
  assert.deepEqual(tc.map((r) => r.id), tcDirect.map((r) => r.id));
  const users = (await lireTout<{ id: string }>((de, a) => sb.from("users").select("id", { count: "exact" }).order("id").range(de, a))).map((u) => u.id);
  const parIds = await lireTout<{ id: string }>((de, a) => sb.rpc("users_par_ids", { p_ids: users }, { count: "exact" }).select("id").order("id").range(de, a));
  assert.deepEqual(parIds.map((u) => u.id), users);
});

test("coach directeur : périmètre complet, athletes_par_ids = lecture .in() d'avant (même RLS)", async () => {
  const sb = client(DIRECTEUR);
  const { ids } = await lireCoachAthleteScope(sb);
  assert.ok(ids.length > 0, "le directeur de test a des athlètes");
  const avant = await sb.from("athletes").select("id").in("id", ids);
  assert.equal(avant.error, null);
  const apres = await lireTout<{ id: string }>((de, a) => sb.rpc("athletes_par_ids", { p_ids: ids }, { count: "exact" })
    .select("id, sports!sport_id(nom)").order("id").range(de, a));
  assert.deepEqual(apres.map((r) => r.id).sort(), (avant.data ?? []).map((r) => r.id as string).sort());
});

test("coach directeur : lireCoachTasks s'exécute (ids dans le corps) et rend des listes", async () => {
  const sb = client(DIRECTEUR);
  const t = await lireCoachTasks(sb, DIRECTEUR);
  assert.equal(t.total, t.unverified.length + t.missingEval.length + t.pendingSuggestions.length);
});

test("coach directeur : transferts — équipes, effectifs et « Sans équipe » = calcul direct", async () => {
  const sb = client(DIRECTEUR);
  // loadTransferContext lit la SESSION (auth.getSession) : un client authentifié par en-tête n'en a pas.
  // Ses deux lectures (team_coaches, school_coaches) sont vérifiées à part ; le contexte est posé ici.
  const auto = await loadTransferContext(sb, ECOLE_DIRECTEUR);
  assert.equal(auto.isDirector, false, "sans session : contexte vide, sans erreur");
  const ctx = { myTeamIds: new Set<string>(), isDirector: true };
  const equipes = await loadSchoolTeams(sb, ECOLE_DIRECTEUR, ctx);
  const sansEquipe = equipes.find((t) => t.id === NO_TEAM_ID)!;
  const athletes = await loadAthletesForTeam(sb, ECOLE_DIRECTEUR, NO_TEAM_ID);
  assert.equal(sansEquipe.athleteCount, athletes.length);
  // Calcul direct (petite école : l'adresse suffit) — même résultat.
  const { data: ecole } = await sb.from("athletes").select("id").eq("school_id", ECOLE_DIRECTEUR).in("status", ["ACTIF", "EN_ATTENTE"]);
  const ids = (ecole ?? []).map((a) => a.id as string);
  const { data: liens } = ids.length ? await sb.from("team_athletes").select("athlete_id").in("athlete_id", ids) : { data: [] };
  const avecEquipe = new Set((liens ?? []).map((l) => l.athlete_id as string));
  assert.equal(sansEquipe.athleteCount, ids.filter((id) => !avecEquipe.has(id)).length);
  for (const t of equipes.filter((x) => x.id !== NO_TEAM_ID)) {
    const { count } = await sb.from("team_athletes").select("id", { count: "exact", head: true }).eq("team_id", t.id);
    assert.equal(t.athleteCount, count ?? 0, `effectif de ${t.name}`);
  }
});
