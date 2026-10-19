/* Revue partenaire de BP (2026-10-18, section 6) : Mes athlètes fusionné, bandeau unique,
   aucun maximum, Accueil à 3 statistiques DU partenaire, Newsroom / Tendances / Classements
   sous un bouton « Filtres », Téléchargements avec aperçu de la vraie carte. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { calculerStatsAccueil, LIEN_STAT } from "@/lib/partenaires/accueilStats";
import { adresseVue, estReclameeVisible, lireVue, reclameesHorsListe, PASTILLES_MES_ATHLETES, TEXTE_BANDEAU_VISIBILITE } from "@/lib/partenaires/vueMesAthletes";
import { debutPeriode, debutSaison, lirePeriode, PASTILLES_PERIODE } from "@/lib/partenaires/periodeExploration";
import { FORMATS_CARTE, libelleFormat } from "@/lib/partenaires/carteAthlete";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const params = (q: string) => new URLSearchParams(q);

/* ── 6.1 fusion ─────────────────────────────────────────────── */

test("6.1 : deux pastilles, adresse lisible, « Mes évaluations » par défaut", () => {
  assert.deepEqual(PASTILLES_MES_ATHLETES.map((p) => p.label), ["En attente", "Mes évaluations"]);
  assert.deepEqual(lireVue(params("")), { vue: "evaluations", propositions: false });
  assert.deepEqual(lireVue(params("vue=attente")), { vue: "attente", propositions: false });
  assert.deepEqual(lireVue(params("vue=attente&filtre=propositions")), { vue: "attente", propositions: true });
  // Le filtre « propositions » n'a de sens que dans « En attente ».
  assert.deepEqual(lireVue(params("vue=evaluations&filtre=propositions")), { vue: "evaluations", propositions: false });
  assert.equal(adresseVue("attente", true), "/partenaire/mes-athletes?vue=attente&filtre=propositions");
  assert.equal(adresseVue("evaluations", true), "/partenaire/mes-athletes?vue=evaluations");
});

test("6.1 : une carte réclamée dont le jeune est visible passe dans « Mes évaluations », sans doublon", () => {
  const t = (issue: string, profilVisible: boolean, athleteId: string | null) => ({ issue, profilVisible, athleteId }) as never;
  assert.equal(estReclameeVisible(t("RECLAMEE", true, "a1")), true);
  assert.equal(estReclameeVisible(t("RECLAMEE", false, null)), false);
  assert.equal(estReclameeVisible(t("EXPIREE", false, null)), false);
  const liste = reclameesHorsListe([t("RECLAMEE", true, "a1"), t("RECLAMEE", true, "a2"), t("RECLAMEE", true, "a2"), t("EXPIREE", false, null)], new Set(["a1"]));
  assert.deepEqual(liste.map((x: { athleteId: string }) => x.athleteId), ["a2"]);
});

test("6.1 : une seule entrée « Mes athlètes » (menu web, barre de l'appli, Accueil) ; l'ancienne adresse redirige", () => {
  const barre = lire("app/_components/mobile/MobileTabBar.tsx");
  const debut = barre.indexOf("const PARTENAIRE_TABS");
  const onglets = barre.slice(debut, barre.indexOf("];", debut));
  assert.deepEqual([...onglets.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]), ["Accueil", "Recherche", "Mes athlètes"]);
  assert.ok(onglets.includes('activeMatch: "/partenaire/mes-athletes|/partenaire/prospects"'));
  const menu = lire("app/partenaire/_components/PartnerSidebar.tsx");
  assert.ok(!menu.includes('href: "/partenaire/prospects"'));
  assert.ok(!menu.includes('label: "Mes évaluations"'));
  const accueil = lire("components/partenaire/mobile/AccueilPartenaireMobile.tsx");
  assert.ok(accueil.includes('{ titre: "Mes athlètes", href: "/partenaire/mes-athletes"'));
  assert.ok(!accueil.includes('{ titre: "Mes évaluations"'));
  assert.ok(lire("app/partenaire/prospects/page.tsx").includes('router.replace(adresseVue("attente"))'));
});

test("6.1 : « En attente » — cartes ROUGES comme chez le recruteur, Accepter / Refuser, filtre propositions", () => {
  for (const f of ["components/partenaire/CartesEnAttenteWeb.tsx", "components/partenaire/mobile/MesAthletesMobile.tsx"]) {
    const src = lire(f);
    assert.ok(src.includes('import { SURFACE_PROSPECT } from "@/components/recruteur/cartes/PanneauCarte";'), f);
    assert.ok(src.includes("backgroundColor: SURFACE_PROSPECT"), f);
    assert.ok(src.includes("border-[#E63946]/25"), f);
    assert.ok(src.includes("<FenetreRapprochementsPartenaire"), f);
    assert.ok(src.includes("propositionsSeulement ? cartes.filter((c) => (nbParCarte.get(c.id) ?? 0) > 0) : cartes"), f);
    assert.ok(src.includes("!estReclameeVisible(t)"), f);
  }
});

/* ── 6.2 bandeau ────────────────────────────────────────────── */

test("6.2 : le message de visibilité s'affiche UNE fois, en bandeau qu'on ferme — plus en sous-titre ni au bas", () => {
  assert.ok(TEXTE_BANDEAU_VISIBILITE.startsWith("Un athlète qui retire sa visibilité partenaire disparaît de cette liste."));
  const bandeau = lire("components/partenaire/BandeauVisibilite.tsx");
  assert.ok(bandeau.includes('aria-label="Fermer"') && bandeau.includes("fermerBandeau()"));
  for (const f of ["components/partenaire/MesEvaluationsWeb.tsx", "components/partenaire/mobile/MesEvaluationsMobile.tsx"]) {
    const src = lire(f);
    assert.equal(src.split("<BandeauVisibilite").length - 1, 1, f);
    assert.ok(!src.includes("disparaît de cette liste"), `${f} : plus de copie du message`);
  }
  // Le stockage peut manquer (navigation privée) : jamais d'exception.
  const lib = lire("lib/partenaires/vueMesAthletes.ts");
  assert.ok(lib.includes("try { return window.localStorage.getItem(CLE_BANDEAU) === \"1\"; } catch { return false; }"));
});

/* ── 6.3 aucun maximum ──────────────────────────────────────── */

test("6.3 : plus aucun « / 50 », « max » ni plafond de cartes ou d'évaluations côté partenaire", () => {
  const dossiers = ["app/partenaire", "components/partenaire", "lib/partenaires"];
  const fichiers: string[] = [];
  const parcourir = (d: string) => {
    for (const e of readdirSync(join(process.cwd(), d), { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== "__tests__") parcourir(p); }
      else if (/\.tsx?$/.test(e.name)) fichiers.push(p);
    }
  };
  dossiers.forEach(parcourir);
  for (const f of fichiers) {
    const src = lire(f);
    assert.doesNotMatch(src, /LIMITE_CARTES|cartes actives|\/ 5[04]\b|maximum d.évaluations/, f);
  }
  // Les lectures passent par pages (lireTout) : aucun plafond de 1 000 lignes.
  for (const [f, rpc] of [
    ["lib/partenaires/mesAthletes.ts", "partenaire_mes_athletes"],
    ["lib/partenaires/prospects.ts", "partenaire_prospects_mes_cartes"],
    ["lib/partenaires/prospects.ts", "partenaire_prospects_terminees"],
    ["lib/partenaires/rapprochements.ts", "partenaire_rapprochements"],
  ] as const) {
    assert.ok(lire(f).includes(`.rpc("${rpc}", {}, { count: "exact" }).select("*")`), `${f} : ${rpc}`);
  }
});

test("6.3 : la migration retire le plafond serveur mot pour mot, avec gardes ; le rollback le remet", () => {
  const m = lire("supabase/migrations/20261019103000_partenaire_cartes_sans_plafond.sql");
  assert.ok(m.includes("md5(v_src) <> 'f5bef21b6e03bdab879904c315dd1238'"));
  assert.ok(m.includes("md5(v_src) <> '38a6a81e3bb47e193d1645f89b1bb890'"));
  assert.ok(m.includes("array['authenticated=X/postgres', 'postgres=X/postgres', 'service_role=X/postgres']"));
  assert.ok(m.includes("raise exception 'NEXUS: 20261019103000 déjà appliquée"));
  const r = lire("supabase/rollback/20261019103000_rollback_partenaire_cartes_sans_plafond.sql");
  assert.ok(r.includes("md5(v_src) <> '38a6a81e3bb47e193d1645f89b1bb890'") && r.includes("md5(v_src) <> 'f5bef21b6e03bdab879904c315dd1238'"));
});

/* ── 6.4 Accueil : 3 statistiques DU partenaire ─────────────── */

test("6.4 : statistiques calculées sur les seules listes du partenaire ; 0 propre", () => {
  const maintenant = new Date(2026, 9, 18, 12);
  const s = calculerStatsAccueil({
    cartes: [{ statut: "ENVOYEE" }, { statut: "ENVOYEE" }, { statut: "A_ENVOYER" }, { statut: "CORRESPONDANCE_POSSIBLE" }],
    rapprochements: [{ carteId: "c1" }, { carteId: "c1" }],
    terminees: [
      { issue: "RECLAMEE", termineeLe: new Date(2026, 9, 2).toISOString() },
      { issue: "RECLAMEE", termineeLe: new Date(2026, 8, 30).toISOString() },
      { issue: "EXPIREE", termineeLe: new Date(2026, 9, 5).toISOString() },
    ],
    mesAthletes: [{ evaluationId: "e1", coteGlobale: 4 }, { evaluationId: null, coteGlobale: null }, { evaluationId: "e3", coteGlobale: 3 }],
  }, maintenant);
  assert.deepEqual(s, { enAttente: 2, aConfirmer: 2, reclameesCeMois: 1, evaluationsTotal: 2 });
  assert.deepEqual(calculerStatsAccueil({ cartes: [], rapprochements: [], terminees: [], mesAthletes: [] }, maintenant),
    { enAttente: 0, aConfirmer: 0, reclameesCeMois: 0, evaluationsTotal: 0 });
  assert.equal(LIEN_STAT.aConfirmer, "/partenaire/mes-athletes?vue=attente&filtre=propositions");
});

test("6.4 (C2) : jamais un total de la plateforme — seules les fonctions « du partenaire » sont lues", () => {
  const lib = lire("lib/partenaires/accueilStats.ts");
  assert.doesNotMatch(lib, /\.from\(|count: "exact", head|top_athletes_view|athletes_count|\.rpc\(/);
  for (const x of ["chargerMesCartes(supabase)", "chargerRapprochements(supabase)", "chargerCartesTerminees(supabase)", "chargerMesAthletes(supabase)"]) {
    assert.ok(lib.includes(x), x);
  }
  for (const f of ["app/partenaire/page.tsx", "components/partenaire/mobile/AccueilPartenaireMobile.tsx"]) {
    const src = lire(f);
    assert.ok(src.includes("chargerStatsAccueil(supabase)"), f);
    assert.ok(src.includes('"En attente"') && src.includes('"À confirmer"') && src.includes('"Réclamées ce mois"'), f);
    assert.ok(src.includes("évaluation") && src.includes("au total"), f);
  }
  // À confirmer en rouge quand > 0 (KpiCard « alerte » dans l'appli).
  assert.ok(lire("components/partenaire/mobile/AccueilPartenaireMobile.tsx").includes("alerte: (stats?.aConfirmer ?? 0) > 0"));
  assert.ok(lire("components/shared/dashboard/KpiCard.tsx").includes('${alerte ? "text-[#E63946]" : "text-white"}'));
});

test("6.4 : « Ton espace » = Recherche + Mes athlètes ; Explorer intact ; marge sous la barre d'onglets", () => {
  const app = lire("components/partenaire/mobile/AccueilPartenaireMobile.tsx");
  const espace = app.slice(app.indexOf('titre: "Ton espace"'), app.indexOf('titre: "Explorer"'));
  assert.deepEqual([...espace.matchAll(/titre: "([^"]+)", href/g)].map((m) => m[1]), ["Recherche", "Mes athlètes"]);
  for (const x of ["Newsroom", "Classements", "Tendances", "Téléchargements"]) assert.ok(app.includes(`{ titre: "${x}"`), x);
  assert.ok(app.includes('paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)"'));
  assert.ok(app.includes("Parcours les athlètes, télécharge leurs cartes officielles"));
});

/* ── 6.5 Newsroom, Tendances, Classements ───────────────────── */

test("6.5 : périodes Cette semaine · Ce mois · Saison ; la saison part du 1er août", () => {
  assert.deepEqual(PASTILLES_PERIODE.map((p) => p.label), ["Cette semaine", "Ce mois", "Saison"]);
  assert.equal(lirePeriode("bidon"), "30d");
  assert.equal(lirePeriode("all"), "all");
  assert.equal(debutSaison(new Date(2026, 9, 18)).getTime(), new Date(2026, 7, 1).getTime());
  assert.equal(debutSaison(new Date(2027, 2, 3)).getTime(), new Date(2026, 7, 1).getTime());
  assert.equal(debutPeriode("all"), null);
  const now = new Date(2026, 9, 18);
  assert.equal(debutPeriode("7d", now), new Date(now.getTime() - 7 * 86_400_000).toISOString());
});

test("6.5 : un seul bouton « Filtres » à côté du titre sur les trois écrans ; Tendances en rangées défilantes", () => {
  for (const f of ["app/partenaire/newsroom/page.tsx", "app/partenaire/tendances/page.tsx", "app/partenaire/classements/page.tsx"]) {
    const src = lire(f);
    assert.ok(src.includes("<EnTeteExploration"), f);
    assert.ok(!src.includes('<h1 className="font-head'), `${f} : le titre est porté par l'en-tête commun`);
  }
  const entete = lire("app/partenaire/_components/EnTeteExploration.tsx");
  assert.ok(entete.includes("data-bouton-filtres") && entete.includes("Filtres") && entete.includes("data-pastilles-periode"));
  const tend = lire("app/partenaire/tendances/page.tsx");
  for (const t of ["Plus de vues cette semaine", "Plus de likes cette semaine", 'titre="Engagements"']) assert.ok(tend.includes(t), t);
  assert.ok(tend.includes("overflow-x-auto") && tend.includes("snap-x"));
  assert.ok(tend.includes('p_event_type:  "COMMITMENT"'));
  // Classements : top 25, sans période (le classement se fait à la cote).
  const cl = lire("app/partenaire/classements/page.tsx");
  assert.ok(cl.includes('.limit(25)') && !cl.includes("periode="));
});

/* ── 6.6 Téléchargements ────────────────────────────────────── */

test("6.6 : toucher une ligne ouvre l'aperçu de la VRAIE carte — Enregistrer, Partager, Voir le profil", () => {
  const liste = lire("components/partenaire/ListeTelechargements.tsx");
  assert.ok(liste.includes("onClick={() => setApercu({ athleteId: d.athleteId!, format: d.format })}"));
  assert.ok(!liste.includes("href={`/partenaire/athletes/"), "plus de lien direct vers la fiche depuis la ligne");
  const apercu = lire("components/partenaire/ApercuCarte.tsx");
  for (const x of ['rpc("partner_athlete_profile"', "<AthletePlayerCard a={athlete} format={format}", "toPng(node, options)",
    ">\n            {occupe === \"enregistrer\" ? \"…\" : \"Enregistrer\"}", "Voir le profil", "journaliserTelechargement(createClient(), athleteId, format)", "createPortal("]) {
    assert.ok(apercu.includes(x), x);
  }
  const partage = lire("lib/partage/partagerImage.ts");
  assert.ok(partage.includes("nav.canShare?.({ files: [fichier] })"));
  assert.ok(partage.includes('return enregistrerImage({ ...opts, dialogue: "Partager la carte" });'));
});

test("6.6 : libellés de format clairs, aux tailles RÉELLES des PNG", () => {
  assert.equal(libelleFormat("publication"), "Publication — 1080×1350 (portrait 4:5)");
  assert.equal(libelleFormat("story"), "Story — 1080×1920 (plein écran 9:16)");
  assert.equal(FORMATS_CARTE.story.ratio, 1080 / 1920);
});
