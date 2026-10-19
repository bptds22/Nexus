/* P1 (1.4.5) — « Athlètes » du partenaire devient « Recherche », sur le modèle recruteur : feuille de
   filtres, cartes natives, fiche au toucher, adaptateur sur top_athletes_view (aucune donnée nouvelle). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { nombreFiltresActifs, versCarteRecherche } from "@/lib/partenaires/recherche";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("P1 : l'adaptateur ne garde que ce que la vue porte, sans rien inventer", () => {
  const c = versCarteRecherche({
    id: "a1", first_name: "Léa", last_name: "Roy", cote_globale_entraineur: null, annee_diplomation: 2028,
    photo_url: null, sport_name: "Football", position_name: "QB", school_name: "École X",
    badges: [{ code: "qi", libelle: "IQ", contexte: null }, { code: "nu" }],
  });
  assert.equal(c.firstName, "Léa");
  assert.equal(c.stars, 0, "pas de cote : 0, affiché « non évalué »");
  assert.equal(c.photo, "");
  assert.deepEqual(c.badges, [{ badgeId: "qi", label: "IQ" }], "badge sans libellé écarté");
  assert.equal(c.isVerified, false, "la vue ne porte pas la validation : pas de coche inventée");
  assert.equal(c.jersey, "");
  assert.equal(c.identityVisible, true);
});

test("P1 : le nombre de filtres actifs (pastille du bouton « Filtres »)", () => {
  const vide = { sport: "", position: "", promotion: "", region: "", orgType: "", genre: "", minRating: "", withSportBadge: false, withVideoOnly: false, sortBy: "cote_desc" };
  assert.equal(nombreFiltresActifs(vide), 0);
  assert.equal(nombreFiltresActifs({ ...vide, sport: "s", withVideoOnly: true, sortBy: "name_asc" }), 3);
});

test("P1 : téléphone et appli — feuille du recruteur, cartes natives, fiche partenaire au toucher", () => {
  const src = lire("components/partenaire/PartnerAthletesSearch.tsx");
  for (const extrait of [
    'titre="Recherche"',
    "() => IS_CAPACITOR || window.matchMedia(REQUETE_PETIT).matches,",
    "<FiltresRechercheFeuille",
    "open={petit && feuilleOuverte}",
    "<AthleteCardMobile key={a.id} a={versCarteRecherche(a)} favDisabled onToggleFav={() => {}}",
    "favoritesCount={0} profileHref={`/partenaire/athletes/${a.id}`}",
    "<PartenaireCartesProvider>",
    '<CarteBadges athleteId={a.id} coach={coach} variante="grille"',
    'supabase.from("top_athletes_view").select("*")',
  ]) assert.ok(src.includes(extrait), extrait);
  const feuille = lire("components/partenaire/recherche/FiltresRechercheFeuille.tsx");
  assert.ok(feuille.includes('import { FilterBottomSheetShell, FilterRow, TogglePill } from "@/components/shared/filters/FilterBottomSheetShell";'));
  assert.ok(feuille.includes('poser(picker === "sport" ? { sport: valeur, position: "" }'));
});

test("P1 : « Recherche » dans le menu, l'onglet de l'appli et le tableau de bord (route inchangée)", () => {
  assert.ok(lire("app/partenaire/_components/PartnerSidebar.tsx").includes('label: "Recherche",\n    href: "/partenaire/athletes",'));
  assert.ok(lire("app/_components/mobile/MobileTabBar.tsx").includes('{ key: "athletes", label: "Recherche", href: "/partenaire/athletes", icon: Icons.search'));
  assert.ok(lire("app/partenaire/page.tsx").includes('{ titre: "Recherche", href: "/partenaire/athletes",'));
});

test("P6 : les trois onglets de la 1.4.5 passent par le kit partagé (en-tête, surfaces, boutons, états)", () => {
  const kit = lire("components/partenaire/kit/KitPartenaire.tsx");
  assert.ok(kit.includes("bg-[#1A1D24]") && kit.includes("bg-[#E63946]"), "thème du recruteur : navy et rouge");
  // 6.1 : les deux listes sont des pastilles ; l'en-tête est posé par la fusion.
  assert.ok(lire("components/partenaire/MesAthletesPartenaire.tsx").includes("<EnTetePartenaire"));
  for (const f of ["components/partenaire/PartnerAthletesSearch.tsx", "components/partenaire/MesEvaluationsWeb.tsx", "components/partenaire/CartesEnAttenteWeb.tsx"]) {
    const src = lire(f);
    assert.ok(src.includes('from "@/components/partenaire/kit/KitPartenaire";'), f);
    if (f.includes("Search")) assert.ok(src.includes("<EnTetePartenaire"), f);
    assert.ok(src.includes("<EtatVide"), f);
    assert.ok(src.includes("classesSurface("), f);
    assert.ok(!src.includes("animate-spin"), `${f} : le chargement passe par <Chargement />`);
  }
});
