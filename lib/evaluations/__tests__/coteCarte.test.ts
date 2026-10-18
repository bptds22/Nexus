/* Cote partenaire sur la carte du joueur (2026-10-16) : coach d'abord, sinon
   partenaire TOUJOURS libellé « Évaluation {organisation} », la plus récente
   s'il y en a plusieurs ; lecture par lot déléguée à W2. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chargerCotesPartenaires,
  coteCarte,
  coteCarteDepuisEvaluations,
  deuxCotes,
  libelleCotePartenaire,
  retenirCotePartenaire,
  type CotePartenaire,
} from "@/lib/evaluations/coteCarte";
import { coteAffichee } from "@/lib/queries/recruiter/useAthleteSearch";

// Fins de ligne normalisées : une extraction Windows (autocrlf) rend des CRLF.
const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const ev = (id: string, cote: number, updatedAt: string, organisation = "Org " + id): CotePartenaire =>
  ({ id, athleteId: "a1", organisation, cote, updatedAt });

test("coteCarte : le coach d'abord, sinon le partenaire avec son organisation, sinon rien", () => {
  assert.deepEqual(coteCarte(4, { cote: 2, organisation: "Club" }), { valeur: 4, organisation: null });
  assert.deepEqual(coteCarte(0, { cote: 3.5, organisation: "Club" }), { valeur: 3.5, organisation: "Club" });
  assert.deepEqual(coteCarte(null, { cote: 3, organisation: null }), { valeur: 3, organisation: "Partenaire" });
  assert.deepEqual(coteCarte(null, { cote: 0, organisation: "Club" }), { valeur: 0, organisation: null });
  assert.deepEqual(coteCarte(undefined, null), { valeur: 0, organisation: null });
});

test("libellé : « Évaluation {organisation} »", () => {
  assert.equal(libelleCotePartenaire("L'Esprit Sportif"), "Évaluation L'Esprit Sportif");
});

test("plusieurs partenaires : la plus récente, départage stable, cotes nulles ignorées", () => {
  assert.equal(retenirCotePartenaire([ev("a", 4, "2026-10-01T00:00:00Z"), ev("b", 2, "2026-10-05T00:00:00Z")])?.id, "b");
  assert.equal(retenirCotePartenaire([ev("b", 2, "2026-10-05T00:00:00Z"), ev("a", 4, "2026-10-01T00:00:00Z")])?.id, "b");
  assert.equal(retenirCotePartenaire([ev("a", 4, "2026-10-05T00:00:00Z"), ev("c", 3, "2026-10-05T00:00:00Z")])?.id, "c");
  assert.equal(retenirCotePartenaire([ev("a", 0, "2026-10-09T00:00:00Z"), ev("b", 3, "2026-10-01T00:00:00Z")])?.id, "b");
  assert.equal(retenirCotePartenaire([]), null);
  assert.equal(retenirCotePartenaire(undefined), null);
  assert.deepEqual(
    coteCarteDepuisEvaluations(0, [ev("a", 4, "2026-10-01T00:00:00Z", "A"), ev("b", 2, "2026-10-05T00:00:00Z", "B")]),
    { valeur: 2, organisation: "B" });
  assert.deepEqual(coteCarteDepuisEvaluations(3.5, [ev("a", 4, "2026-10-01T00:00:00Z")]), { valeur: 3.5, organisation: null });
});

test("coteAffichee (recherche, B3 mobile) : comportement inchangé, même règle", () => {
  assert.deepEqual(coteAffichee({ stars: 4, starsPartenaire: 2, starsPartenaireOrg: "Club" }), { valeur: 4, organisation: null });
  assert.deepEqual(coteAffichee({ stars: 0, starsPartenaire: 3.5, starsPartenaireOrg: "Club" }), { valeur: 3.5, organisation: "Club" });
  assert.deepEqual(coteAffichee({ stars: 0, starsPartenaire: 3, starsPartenaireOrg: null }), { valeur: 3, organisation: "Partenaire" });
  assert.deepEqual(coteAffichee({ stars: 0, starsPartenaire: null, starsPartenaireOrg: null }), { valeur: 0, organisation: null });
});

test("chargerCotesPartenaires : un seul appel au lot, trié par id, total exact, groupé par athlète", async () => {
  const appels: { fn: string; args: unknown; opts: unknown; order?: string; range?: [number, number] }[] = [];
  const lignes = [
    { id: "e1", athlete_id: "a1", organisation: "A", cote_globale: "4.00", updated_at: "2026-10-01" },
    { id: "e2", athlete_id: "a1", organisation: "B", cote_globale: 3, updated_at: "2026-10-02" },
    { id: "e3", athlete_id: "a2", organisation: null, cote_globale: 2.5, updated_at: "2026-10-03" },
  ];
  const supabase = {
    rpc(fn: string, args: unknown, opts: unknown) {
      const a: (typeof appels)[number] = { fn, args, opts };
      appels.push(a);
      const b = {
        select: () => b,
        order: (c: string) => { a.order = c; return b; },
        range: (de: number, f: number) => { a.range = [de, f]; return Promise.resolve({ data: lignes, error: null, count: lignes.length }); },
      };
      return b;
    },
  };
  const m = await chargerCotesPartenaires(supabase as never, ["a2", "a1", "a1", null, ""]);
  assert.equal(appels.length, 1);
  assert.equal(appels[0].fn, "cotes_partenaires_athletes");
  assert.deepEqual(appels[0].args, { p_athlete_ids: ["a1", "a2"] });
  assert.deepEqual(appels[0].opts, { count: "exact" });
  assert.equal(appels[0].order, "id");
  assert.deepEqual(m.get("a1")?.map((c) => [c.organisation, c.cote]), [["A", 4], ["B", 3]]);
  assert.deepEqual(m.get("a2")?.map((c) => [c.organisation, c.cote]), [["Partenaire", 2.5]]);
  assert.equal((await chargerCotesPartenaires(supabase as never, [])).size, 0);
  assert.equal(appels.length, 1, "lot vide : aucun appel réseau");
});

test("migration : le lot DÉLÈGUE à W2 (INVOKER), aucune règle propre", () => {
  const sql = lire("supabase/migrations/20261016170000_cote_partenaire_carte_mes_athletes.sql");
  const corps = sql.slice(sql.indexOf("create function public.cotes_partenaires_athletes"), sql.indexOf("comment on function public.cotes_partenaires_athletes"));
  assert.match(corps, /security invoker/);
  assert.doesNotMatch(corps, /security definer|row_security/);
  assert.match(corps, /cross join lateral public\.evaluations_partenaires_athlete\(i\.athlete_id\)/);
  assert.doesNotMatch(corps, /partner_evaluations|media_partners/, "le lot ne lit jamais la table lui-même");
});

test("surfaces web : recherche, favoris, fiche/aperçu passent par la règle et le libellé", () => {
  const recherche = lire("app/recruteur/recherche/page.tsx");
  assert.equal((recherche.match(/\{libelleCotePartenaire\(cote\.organisation\)\}/g) ?? []).length, 2, "grille et ligne");
  assert.match(recherche, /· \{libelleCotePartenaire\(cote\.organisation\)\}/);
  assert.equal((recherche.match(/data-cote-partenaire/g) ?? []).length, 2);

  const favoris = lire("app/recruteur/favoris/page.tsx");
  assert.match(favoris, /useCotesPartenaires\(favorisBruts\.map\(\(a\) => a\.id\)\)/);
  assert.match(favoris, /coteCarteDepuisEvaluations\(a\.stars, cotesPartenaires\?\.get\(a\.id\)\)/);
  assert.equal((favoris.match(/data-cote-partenaire/g) ?? []).length, 2);
  assert.doesNotMatch(favoris, /fill=\{a\.stars >=/, "plus d'étoiles lues directement sur la cote du coach");
  assert.match(favoris, /a\.cote\.valeur >= parseFloat\(minRating\)/);

  const fiche = lire("components/shared/AthleteRecruiterProfileBody.tsx");
  assert.match(fiche, /const ratingValue = cote\.valeur;/);
  assert.match(fiche, /const evaluationsPartenaires = useEvaluationsPartenaires\(id\);/);
  assert.match(fiche, /\? \{ valeur: a\.overallRating, organisation: null \}/, "coach évalué : la carte inchangée");
  assert.match(fiche, /data-cote-partenaire/);
  // Une seule lecture W2 par fiche : la ligne et la section reçoivent les évaluations.
  assert.equal((fiche.match(/evaluations=\{evaluationsPartenaires\}/g) ?? []).length, 3);
});

test("appli (1.4.5) : la cote partenaire sur les cartes, comme le web", () => {
  // Recherche : le libellé du web, jamais le nom brut de l'organisation.
  const rech = lire("components/shared/RecruteurRechercheMobile.tsx");
  assert.equal((rech.match(/\{libelleCotePartenaire\(cote\.organisation\)\}/g) ?? []).length, 2);
  assert.doesNotMatch(rech, /· \{cote\.organisation\}/);
  // Favoris : même lecture groupée et même règle que app/recruteur/favoris.
  const fav = lire("components/shared/RecruteurFavorisMobile.tsx");
  assert.match(fav, /useCotesPartenaires\(athletes\.map\(\(a\) => a\.id\)\)/);
  assert.match(fav, /starsPartenaire: retenirCotePartenaire\(cotesPartenaires\?\.get\(a\.id\)\)\?\.cote \?\? null/);
  // Fiche : coach d'abord, sinon partenaire ; libellé sous les étoiles.
  const fiche = lire("components/shared/AthleteRecruiterProfileBodyMobile.tsx");
  assert.match(fiche, /const ratingValue = cote \? cote\.valeur : a\.overallRating;/);
  assert.match(fiche, /\? \{ valeur: a\.overallRating, organisation: null \}/, "coach évalué : la carte inchangée");
  assert.match(fiche, /: coteCarteDepuisEvaluations\(null, evaluationsPartenaires\.map/);
  assert.match(fiche, /\{libelleCotePartenaire\(cote\.organisation\)\}/);
});

test("deuxCotes : le coach ET le partenaire côte à côte, rien n'est caché derrière l'autre (1.4.5)", () => {
  const e = [ev("a", 4, "2026-10-01T00:00:00Z", "L'Esprit Sportif")];
  assert.deepEqual(deuxCotes(3.5, e), { coach: 3.5, partenaire: { valeur: 4, organisation: "L'Esprit Sportif" } });
  // Partenaire seul : plus de « Pas encore évalué ».
  assert.deepEqual(deuxCotes(0, e), { coach: 0, partenaire: { valeur: 4, organisation: "L'Esprit Sportif" } });
  assert.deepEqual(deuxCotes(null, e).coach, 0);
  // Coach seul, ou personne : rien du partenaire (Loi 25 : sans opt-in la lecture est vide).
  assert.deepEqual(deuxCotes(4.2, []), { coach: 4.2, partenaire: null });
  assert.deepEqual(deuxCotes(undefined, undefined), { coach: 0, partenaire: null });
});

test("les cartes de pipeline et la fiche mobile n'affichent « Pas encore évalué » que sans AUCUNE évaluation (1.4.5)", () => {
  for (const f of ["app/recruteur/pipeline/page.tsx", "components/shared/RecruteurPipelineMobile.tsx", "components/shared/AthleteRecruiterProfileBodyMobile.tsx"]) {
    assert.match(lire(f), /deuxCotes\(/, f);
    assert.match(lire(f), /CotesEvaluations|libelleCotePartenaire/, f);
  }
  assert.doesNotMatch(lire("components/shared/AthleteRecruiterProfileBodyMobile.tsx"), /\) : <span className="text-\[16px\] text-\[#6B7280\] font-normal">Pas encore évalué<\/span>/);
});
