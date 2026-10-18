/* Badges d'une carte (1.4.5) : 5 au TOTAL, coach et partenaire confondus, puis « +N ».
   Priorité : badge personnalisé du partenaire, autres badges du partenaire, coach. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { badgesDeCarte, limiterBadgesFiche } from "@/lib/badges/carteBadges";
import { MAX_BADGES_CARTE } from "@/lib/config/badges";
import type { BadgePartenaire } from "@/lib/badges/partenaire";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const bp = (id: string, estNexus = false, estMasque = false): BadgePartenaire => ({
  id, badgeId: "b" + id, libelle: "P" + id, organisation: "L'Esprit Sportif", iconeUrl: null,
  poseLe: "2026-10-01T00:00:00Z", estMasque, estLeMien: false, peutMasquer: false, estNexus, codeNexus: estNexus ? "vitesse" : null,
});
const bc = (n: number) => Array.from({ length: n }, (_, i) => ({ badgeId: "c" + i, label: "C" + i }));

test("le plafond est de 5", () => assert.equal(MAX_BADGES_CARTE, 5));

test("5 badges au total, coach et partenaire confondus, puis +N", () => {
  const r = badgesDeCarte(bc(4), [bp("1"), bp("2")]);
  assert.equal(r.visibles.length, 5);
  assert.equal(r.reste.length, 1);
  assert.equal(badgesDeCarte(bc(3), [bp("1")]).reste.length, 0);
  assert.equal(badgesDeCarte(bc(9), []).visibles.length, 5);
  assert.equal(badgesDeCarte(bc(9), []).reste.length, 4);
});

test("priorité : badge personnalisé du partenaire, puis ses autres badges, puis le coach", () => {
  const r = badgesDeCarte(bc(2), [bp("n1", true), bp("p1"), bp("n2", true), bp("p2")], 4);
  assert.deepEqual(r.visibles.map((b) => b.label), ["Pp1", "Pp2", "Pn1", "Pn2"]);
  assert.deepEqual(r.reste.map((b) => b.label), ["C0", "C1"]);
});

test("un badge masqué ne s'affiche jamais sur une carte ; rien du partenaire sans lecture (Loi 25)", () => {
  assert.equal(badgesDeCarte([], [bp("1", false, true)]).visibles.length, 0);
  assert.deepEqual(badgesDeCarte(bc(1), undefined).visibles.map((b) => b.genre), ["coach"]);
  assert.deepEqual(badgesDeCarte(null, null), { visibles: [], reste: [] });
});

test("limiterBadgesFiche : même règle, ordre d'origine gardé, reste = le +N", () => {
  const p = [bp("n1", true), bp("p1")];
  const c = ["a", "b", "c", "d"];
  const r = limiterBadgesFiche(p, c);
  assert.deepEqual(r.partenaire.map((b) => b.id), ["n1", "p1"]);
  assert.deepEqual(r.coach, ["a", "b", "c"]);
  assert.equal(r.reste, 1);
  const tous = limiterBadgesFiche([], ["a", "b"]);
  assert.deepEqual(tous, { partenaire: [], coach: ["a", "b"], reste: 0 });
  // Plus de 5 partenaire : les personnalisés d'abord.
  const six = [bp("n1", true), bp("n2", true), bp("p1"), bp("p2"), bp("p3"), bp("n3", true)];
  const l6 = limiterBadgesFiche(six, ["x"]);
  assert.deepEqual(l6.partenaire.map((b) => b.id).sort(), ["n1", "p1", "p2", "p3", "n2"].sort());
  assert.equal(l6.reste, 2);
});

test("toutes les cartes passent par <CarteBadges> : plus de pastilles dessinées à la main", () => {
  for (const f of ["app/recruteur/recherche/page.tsx", "app/recruteur/favoris/page.tsx", "app/recruteur/pipeline/page.tsx",
    "app/recruteur/listes/page.tsx", "components/shared/RecruteurRechercheMobile.tsx", "components/shared/RecruteurFavorisMobile.tsx",
    "components/shared/RecruteurPipelineMobile.tsx", "components/shared/RecruteurListeDetailMobile.tsx"]) {
    assert.match(lire(f), /CarteBadges|PartenaireCartesProvider/, f);
  }
  assert.doesNotMatch(lire("app/recruteur/recherche/page.tsx"), /a\.badges\.map\(/);
  assert.doesNotMatch(lire("app/recruteur/favoris/page.tsx"), /a\.badges\.slice\(0, 2\)/);
});

test("lecture groupée : une RPC par lot, toutes les pages, aucun appel par carte", () => {
  const src = lire("lib/badges/partenaire.ts");
  assert.match(src, /rpc\("badges_partenaires_athletes", \{ p_athlete_ids: ids \}, \{ count: "exact" \}\)/);
  assert.match(src, /lireTout</);
  const sql = lire("supabase/migrations/20261017120000_badges_partenaires_athletes_lot.sql");
  assert.match(sql, /security invoker/);
  assert.match(sql, /lateral public\.badges_partenaires_athlete\(i\.athlete_id\)/);
  assert.match(sql, /array\['authenticated', 'postgres', 'service_role'\]/);
  assert.doesNotMatch(lire("components/shared/CarteBadges.tsx"), /chargerBadgesPartenaires\(/);
});

test("lecture PAR PAQUETS d'environ 50, au fil du défilement — jamais tous les résultats d'un coup (1.4.5)", () => {
  const src = lire("components/shared/PartenaireCartesProvider.tsx");
  assert.match(src, /export const TAILLE_PAQUET = 50;/);
  assert.match(src, /IntersectionObserver/);
  assert.match(src, /rootMargin: "300px 0px"/);
  for (const f of ["app/recruteur/recherche/page.tsx", "app/recruteur/favoris/page.tsx", "app/recruteur/pipeline/page.tsx", "app/recruteur/listes/page.tsx",
    "components/shared/RecruteurRechercheMobile.tsx", "components/shared/RecruteurFavorisMobile.tsx", "components/shared/RecruteurPipelineMobile.tsx", "components/shared/RecruteurListeDetailMobile.tsx"]) {
    assert.doesNotMatch(lire(f), /<PartenaireCartesProvider ids=/, `${f} : plus d'identifiants en bloc`);
  }
});

test("processus : les badges du coach des cartes liées à un vrai athlète passent par la même règle des 5", () => {
  assert.match(lire("lib/queries/recruiter/useProcessusUnite.ts"), /badges: badgesCoachDepuisEvaluations\(/);
  assert.match(lire("lib/queries/recruiter/usePipelineCards.ts"), /badges: badgesCoachDepuisEvaluations\(/);
  assert.match(lire("app/recruteur/pipeline/page.tsx"), /<CarteBadges athleteId=\{card\.id\} coach=\{card\.badges\}/);
  assert.match(lire("components/shared/RecruteurPipelineMobile.tsx"), /<CarteBadges athleteId=\{card\.id\} coach=\{card\.badges\}/);
});
