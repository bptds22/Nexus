/* P2 (1.4.5) — « Mes athlètes » du partenaire devient « Mes évaluations » : cartes compactes, fiche au
   toucher, filtre Distinctions conservé, badges selon la règle R3 (CarteBadges, lecture groupée). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("6.1 (2026-10-18) : « Mes évaluations » devient une PASTILLE de « Mes athlètes » (route /partenaire/mes-athletes)", () => {
  const fusion = lire("components/partenaire/MesAthletesPartenaire.tsx");
  assert.ok(fusion.includes('<EnTetePartenaire titre="Mes athlètes"'));
  assert.ok(fusion.includes(": <MesEvaluationsWeb />}"));
  assert.ok(lire("lib/partenaires/vueMesAthletes.ts").includes('{ key: "evaluations", label: "Mes évaluations" }'));
  assert.ok(lire("app/partenaire/_components/PartnerSidebar.tsx").includes('label: "Mes athlètes",\n    href: "/partenaire/mes-athletes",'));
  assert.ok(!lire("app/partenaire/_components/PartnerSidebar.tsx").includes('label: "Mes évaluations"'));
  assert.ok(lire("app/_components/mobile/MobileTabBar.tsx").includes('{ key: "mes-athletes", label: "Mes athlètes", href: "/partenaire/mes-athletes"'));
});

test("P2 : cartes compactes — fiche au toucher, badges R3 groupés, Évaluer sur la carte", () => {
  const page = lire("components/partenaire/MesEvaluationsWeb.tsx");
  for (const extrait of [
    "<PartenaireCartesProvider>",
    "const ref = useDeclarerCarteVisible(a.athleteId);",
    "<Link href={`/partenaire/athletes/${a.athleteId}`} data-fiche-au-toucher",
    "after:absolute after:inset-0",
    '<CarteBadges athleteId={a.athleteId} coach={vignette?.badgesCoach} variante="ligne"',
    "relative z-10 shrink-0 ${classesBouton(\"principal\", true)}",
    "setVignettes(await chargerVignettesMesAthletes(supabase, liste.map((x) => x.athleteId)));",
  ]) assert.ok(page.includes(extrait), extrait);
  // Le retrait d'un badge vit sur la fiche (BadgesPartenaire), plus sur la liste.
  assert.ok(!page.includes("retirerBadgePartenaire"));
});

test("P2 : photo et badges coach lus dans top_athletes_view (la vue de la recherche partenaire), par paquets", () => {
  const lib = lire("lib/partenaires/mesAthletes.ts");
  assert.ok(lib.includes('supabase.from("top_athletes_view").select("id, photo_url, badges").in("id", uniques.slice(i, i + 200))'));
  assert.ok(lib.includes("badgesCoach: pastillesBadges(r.badges).map((d) => ({ badgeId: d.code, label: textePastille(d) })),"));
});

test("P3 / 6.1 : les cartes prospects sont la pastille « En attente » ; /partenaire/prospects redirige ; pas de puce « Ouverte »", () => {
  const page = lire("components/partenaire/CartesEnAttenteWeb.tsx");
  assert.ok(!page.includes(">Ouverte<") && !page.includes("\"Ouverte\""), "aucune puce « Ouverte » rendue");
  assert.ok(lire("app/partenaire/prospects/page.tsx").includes('router.replace(adresseVue("attente"))'));
  assert.ok(lire("lib/partenaires/vueMesAthletes.ts").includes('{ key: "attente", label: "En attente" }'));
  assert.ok(!lire("app/_components/mobile/MobileTabBar.tsx").includes('{ key: "prospects"'));
});
