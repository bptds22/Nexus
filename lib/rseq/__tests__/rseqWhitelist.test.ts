/* Suite — la LIGNE ROUGE de la veille RSEQ.

   Ce que ces cas verrouillent, et qui n'est vérifiable ni à l'œil ni par tsc :
   le payload GetLeagueDiffusion porte 459 clés racine, dont 60 contenant
   « Stats », 23 « Player », 17 « Athlete », et les courriels nominatifs
   `LeagueCoordinator` / `LeagueStatistician`. Rien de tout cela ne doit
   franchir retenirWhitelist(). Un import qui se met à ramasser des stats
   d'athlètes ne casserait aucun type, ne lèverait aucune erreur HTTP, et ne
   se verrait qu'une fois en base.

   QUATRE FAMILLES DE CAS
     A — le filtre rend EXACTEMENT les 4 clés retenues, ni plus ni moins.
     B — aucune clé racine suspecte du payload réel ne survit, et les champs
         *DiffusionHtml ne survivent pas non plus à la normalisation.
     U — l'UNION Teams[] + participants des matchs (correctif du 2026-09-02).
         Teams[] n'est pas le registre des participants d'une ligue : 312
         lignes déclarées pour 334 équipes qui jouent réellement, sur les 38
         ligues collégiales. U1 verrouille l'exclusion du gabarit de tableau
         (UUID nul), U2 verrouille la détection d'une équipe connue des seuls
         matchs — et le fait qu'elle arrive SANS InstitutionId.
     N — fidélité de la normalisation au premier chargement.
     C — DÉRIVE AMONT (réseau, désactivé par défaut). Compare le jeu de clés
         racine servi AUJOURD'HUI par RSEQ à celui de la fixture : si RSEQ
         ajoute une clé, le cas rougit et quelqu'un va la regarder.
         Activation :  RSEQ_LIVE=1

   La fixture est un payload de production (Football C M D1 Provincial,
   2026-2027) dont les tableaux sont tronqués à 2 éléments — un match JOUÉ et
   un match NON JOUÉ, pour couvrir les deux branches de scoreDe().

   Lancement (le glob de `npm test` couvre lib/ **, celui-ci est donc inclus) :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/rseq/__tests__/*.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  CLES_RETENUES,
  MOTIFS_INTERDITS,
  retenirWhitelist,
  clesSuspectes,
  normaliserMatchs,
  normaliserClassement,
  normaliserEquipes,
  equipesADetecter,
  UUID_NUL,
  formatHeure,
  scoreDe,
  type MetaLigue,
} from "@/supabase/functions/_shared/rseqWhitelist";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const PAYLOAD = JSON.parse(
  readFileSync(path.join(ICI, "fixtures/leagueDiffusion.football-d1.json"), "utf-8"),
) as Record<string, unknown>;

const META: MetaLigue = {
  rseq_league_id: "357ee497-0d4f-4152-a7a4-b3a6a2c3cf8f",
  saison: "2026-2027",
  sector: "Collégial",
  sport: "Football",
  region: "Provincial",
  division: "D1",
  category: "Collégial",
  sex_type: "Masculin",
  league_name: "Football C M D1 Provincial (2026-2027)",
};

/* ── A. Le filtre rend exactement les 4 clés ───────────────────────────── */

test("A1 — la fixture est bien le monstre qu'on croit", () => {
  const racine = Object.keys(PAYLOAD);
  // Si ce cas tombe, c'est la fixture qui a été touchée, pas le filtre.
  assert.ok(racine.length > 400, `attendu >400 cles racine, vu ${racine.length}`);
  assert.ok(clesSuspectes(PAYLOAD).length > 100);
});

test("A2 — retenirWhitelist ne rend QUE les cles retenues", () => {
  const retenu = retenirWhitelist(PAYLOAD);
  assert.deepEqual(Object.keys(retenu).sort(), [...CLES_RETENUES].sort());
});

test("A3 — chaque cle retenue est un tableau, meme absente du payload", () => {
  const retenu = retenirWhitelist({ Teams: [{ TeamId: "x" }] });
  for (const c of CLES_RETENUES) assert.ok(Array.isArray(retenu[c]), `${c} n'est pas un tableau`);
  assert.equal(retenu.Standings.length, 0);
});

test("A4 — un payload qui n'est pas un objet leve, il ne rend pas un vide", () => {
  // Décisif : un 404 renvoyant du HTML ne doit pas se lire « ligue sans
  // match » — ce serait un effacement silencieux du calendrier.
  assert.throws(() => retenirWhitelist("<html>404</html>"), /NEXUS:/);
  assert.throws(() => retenirWhitelist(null), /NEXUS:/);
  assert.throws(() => retenirWhitelist([1, 2]), /NEXUS:/);
});

/* ── B. Rien de suspect ne survit ──────────────────────────────────────── */

test("B1 — aucune cle racine suspecte ne franchit le filtre", () => {
  const suspectes = clesSuspectes(PAYLOAD);
  assert.ok(suspectes.length > 0, "la fixture devrait contenir des cles suspectes");
  const retenu = retenirWhitelist(PAYLOAD) as unknown as Record<string, unknown>;
  for (const k of suspectes) {
    assert.ok(!(k in retenu), `la cle interdite « ${k} » a survecu au filtre`);
  }
});

test("B2 — les courriels du personnel RSEQ ne sont nulle part dans le retenu", () => {
  // La raison d'etre de la whitelist positive : ces clés-la ne contiennent
  // ni « Stats » ni « Athlete », une blacklist naive les laisserait passer.
  assert.ok("LeagueCoordinator" in PAYLOAD);
  assert.ok("LeagueStatistician" in PAYLOAD);
  const serialise = JSON.stringify(retenirWhitelist(PAYLOAD));
  assert.ok(!serialise.includes("@rseq.ca"), "un courriel RSEQ a fuite dans le retenu");
});

test("B3 — la normalisation ne laisse passer aucun champ *Html ni *Stats", () => {
  const retenu = retenirWhitelist(PAYLOAD);
  const sorti = JSON.stringify({
    matchs: normaliserMatchs(retenu, META),
    classement: normaliserClassement(retenu),
    equipes: normaliserEquipes(retenu),
  });
  const cles = new Set<string>();
  const visiter = (o: unknown) => {
    if (Array.isArray(o)) return o.forEach(visiter);
    if (o && typeof o === "object") {
      for (const [k, v] of Object.entries(o)) { cles.add(k); visiter(v); }
    }
  };
  visiter(JSON.parse(sorti));
  const fautives = [...cles].filter((k) => MOTIFS_INTERDITS.test(k));
  assert.deepEqual(fautives, [], `champs interdits dans la sortie : ${fautives.join(", ")}`);
});

test("B4 — les equipes ne portent QUE l'identite et le rattachement", () => {
  const equipes = normaliserEquipes(retenirWhitelist(PAYLOAD));
  assert.ok(equipes.length > 0);
  for (const e of equipes) {
    assert.deepEqual(Object.keys(e).sort(), [
      "rseq_institution_id", "team_code", "team_name", "team_pseudonym", "rseq_team_id",
    ].sort());
  }
});

/* ── U. L'union Teams[] + participants (correctif du 2026-09-02) ───────── */

test("U1 — le gabarit de tableau (UUID nul) n'est JAMAIS une equipe", () => {
  /* La fixture porte 4 cases de bracket en PostSeasonGames — « 3e position »,
     « 4e position », « 5e position », « 6e position » — toutes sous l'UUID
     nul. Les compter comme des equipes inventerait 4 fausses alertes par
     ligue et par passage, et la file de revue serait inutilisable. */
  const retenu = retenirWhitelist(PAYLOAD);
  const brackets = retenu.PostSeasonGames.filter(
    (g) => g.HomeTeamId === UUID_NUL || g.VisitingTeamId === UUID_NUL,
  );
  assert.ok(brackets.length > 0, "la fixture doit contenir des cases de bracket");

  const equipes = equipesADetecter(retenu);
  assert.ok(!equipes.some((e) => e.rseq_team_id === UUID_NUL), "l'UUID nul est passe");
  // Et les libelles de rang ne doivent pas non plus se retrouver en equipe.
  assert.ok(!equipes.some((e) => /position|gagnant|perdant/i.test(e.team_name ?? "")));
});

test("U2 — un participant absent de Teams[] est quand meme detecte, sans institution", () => {
  /* LE cas qui a fait rater 22 equipes reelles. Dans la fixture, Garneau joue
     un match mais n'est pas declare dans Teams[] — exactement la situation de
     Alma, Jonquiere ou Thetford en Soccer D2 Nord-Est. */
  const retenu = retenirWhitelist(PAYLOAD);
  const declarees = new Set(retenu.Teams.map((t) => t.TeamId));
  assert.ok(!declarees.has("660a03cf-b785-432c-8c92-b74009c2a98f"), "Garneau ne doit PAS etre dans Teams[]");

  const equipes = equipesADetecter(retenu);
  const garneau = equipes.find((e) => e.rseq_team_id === "660a03cf-b785-432c-8c92-b74009c2a98f");

  assert.ok(garneau, "Garneau doit etre detecte via les matchs");
  assert.equal(garneau!.team_name, "Garneau");
  assert.equal(garneau!.vu_dans_teams, false);
  // Le point qui compte pour la revue : aucun InstitutionId n'existe pour
  // elle. L'alerte doit dire « a etablir a la main », pas rapprocher un nom.
  assert.equal(garneau!.rseq_institution_id, null);

  // Celles qui viennent bien de Teams[] gardent leur preuve de rattachement.
  const grasset = equipes.find((e) => e.rseq_team_id === "25c41afb-a403-43cf-9b85-2121580eafbe");
  assert.equal(grasset!.vu_dans_teams, true);
  assert.equal(grasset!.rseq_institution_id, "75709f32-1600-4641-96c3-f56fa5469302");

  // L'union est bien une union : Teams[] (2) + participants inedits (1).
  assert.equal(equipes.length, 3);
});

/* ── Normalisation : fidelite au premier chargement ────────────────────── */

test("N1 — formatHeure reproduit le format du premier chargement", () => {
  assert.equal(formatHeure(1170), "19:30");
  assert.equal(formatHeure(0), null);      // 0 = « pas d'heure », pas minuit
  assert.equal(formatHeure(-1), null);
  assert.equal(formatHeure(1440), null);
  assert.equal(formatHeure(null), null);
});

test("N2 — la sentinelle -999 devient null, jamais 0", () => {
  // Un -999 lu comme 0 inventerait un blanchissage 0-0 sur tout un calendrier.
  const pas = scoreDe({ HomeTeamScore: -999, VisitingTeamScore: -999 });
  assert.equal(pas.home_score, null);
  assert.equal(pas.visitor_score, null);
  assert.equal(pas.is_played, false);

  const joue = scoreDe({
    HomeTeamScore: 46, VisitingTeamScore: 0,
    GameResultFormatted: "0 - 46", IsHomeTeamForfeit: false, IsVisitingTeamForfeit: false,
  });
  assert.equal(joue.home_score, 46);
  assert.equal(joue.visitor_score, 0);
  assert.equal(joue.is_played, true);
  assert.equal(joue.result_formatted, "0 - 46");
});

test("N3 — un vrai 0-0 joue reste 0-0, pas null", () => {
  const nul = scoreDe({ HomeTeamScore: 0, VisitingTeamScore: 0, GameResultFormatted: "0 - 0" });
  assert.equal(nul.is_played, true);
  assert.equal(nul.home_score, 0);
});

test("N4 — la meta de ligue vient de la base, pas du payload", () => {
  // Sinon un changement de forme cote RSEQ ferait « bouger » 2 368 lignes au
  // premier passage et la recette d'idempotence ne prouverait plus rien.
  const m = normaliserMatchs(retenirWhitelist(PAYLOAD), META);
  assert.ok(m.length > 0);
  for (const g of m) {
    assert.equal(g.sport, "Football");
    assert.equal(g.division, "D1");
    assert.equal(g.sector, "Collégial");
    assert.equal(g.season, "2026-2027");
  }
});

test("N5 — le classement est copie tel quel, sans tri maison", () => {
  const c = normaliserClassement(retenirWhitelist(PAYLOAD));
  assert.ok(c.length > 0);
  const brut = (PAYLOAD.Standings as Record<string, unknown>[])[0];
  assert.equal(c[0].position, brut.Position);
  assert.equal(c[0].wins, brut.Wins);
  // La faute de frappe est chez RSEQ : on lit leur cle, on corrige la notre.
  assert.equal(c[0].points_against, brut.PointsAgaints);
  assert.ok(Object.keys(c[0].show_flags).length > 10, "les Standings_Show_* doivent etre conserves");
});

/* ── C. Derive amont (reseau, opt-in) ──────────────────────────────────── */

test("C — le jeu de cles racine servi par RSEQ n'a pas bouge", { skip: process.env.RSEQ_LIVE !== "1" ? "RSEQ_LIVE!=1" : false }, async () => {
  const res = await fetch(
    "https://diffusion.s1.rseq.ca/api/LeagueApi/GetLeagueDiffusion/?leagueId=" +
      META.rseq_league_id,
    { headers: { "User-Agent": "Nexus-Veille/1.0 (test de derive)" } },
  );
  assert.ok(res.ok, `HTTP ${res.status}`);
  const vif = await res.json();

  const attendues = new Set(Object.keys(PAYLOAD));
  const nouvelles = Object.keys(vif).filter((k) => !attendues.has(k));
  assert.deepEqual(
    nouvelles, [],
    `RSEQ a ajoute des cles racine : ${nouvelles.join(", ")} — relire la ligne rouge avant de laisser passer.`,
  );

  // Et la garantie de fond, sur la source vivante.
  const retenu = retenirWhitelist(vif) as unknown as Record<string, unknown>;
  for (const k of clesSuspectes(vif)) {
    assert.ok(!(k in retenu), `cle interdite « ${k} » survivante sur la source vivante`);
  }
});
