/* Carte des matchs dans l'appli (§77) — recruteur ET partenaire.
   Rien de recopié : l'état vient de lib/carteMatchs/useCarteMatchsEtat (celui du
   web), la coquille de components/carte-mobile/CarteMobile (celle de la carte
   cégep des joueurs, RechercheMobile). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hauteurSousOnglets, ZONE_ONGLETS } from "@/lib/mobile/zoneOnglets";
import { libelleCtaCalendrier, noteCalendrier, noteProfilsNonNommes, titreBoutonCalendrier } from "@/lib/carteMatchs/carteMatchs";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("hauteur : le web garde son calcul à l'identique, l'appli retire la barre d'onglets", () => {
  assert.equal(hauteurSousOnglets(212.4, false), "calc(100dvh - 212px)");
  assert.equal(hauteurSousOnglets(-5, false), "calc(100dvh - 0px)");
  assert.equal(hauteurSousOnglets(212.4, true), "calc(100dvh - 212px - calc(env(safe-area-inset-bottom) + 88px))");
  // La même zone que les layouts de l'appli réservent sous leur contenu.
  assert.equal(ZONE_ONGLETS, "calc(env(safe-area-inset-bottom) + 88px)");
  for (const l of ["app/recruteur/layout.tsx", "app/partenaire/layout.tsx"]) {
    assert.ok(lire(l).includes(`"${ZONE_ONGLETS}"`), l);
  }
});

test("libellés du « + » et du panneau : les textes du web, une seule source", () => {
  assert.equal(titreBoutonCalendrier("partenaire", "AJOUTE"), "Dans mon agenda — retirer");
  assert.equal(titreBoutonCalendrier("partenaire", "LIBRE"), "Ajouter à mon agenda");
  assert.equal(titreBoutonCalendrier("recruteur", "SUIVI"), "Au calendrier : un athlète suivi par ton unité y joue");
  assert.equal(titreBoutonCalendrier("recruteur", "AJOUTE"), "Au calendrier de ton unité — retirer");
  assert.equal(titreBoutonCalendrier("recruteur", "LIBRE"), "Ajouter au calendrier de ton unité");
  assert.equal(libelleCtaCalendrier("partenaire", "LIBRE"), "+ Ajouter à mon agenda");
  assert.equal(libelleCtaCalendrier("recruteur", "LIBRE"), "+ Ajouter à mon calendrier");
  assert.equal(libelleCtaCalendrier("recruteur", "AJOUTE"), "✓ Dans mon calendrier — retirer");
  assert.equal(libelleCtaCalendrier("recruteur", "SUIVI"), "✓ Au calendrier");
  assert.equal(noteCalendrier("recruteur", "LIBRE"), "Le calendrier est partagé avec ton unité.");
  assert.match(noteCalendrier("recruteur", "SUIVI"), /déjà au Calendrier\.$/);
  assert.equal(noteProfilsNonNommes(3, 3), null);
  assert.equal(noteProfilsNonNommes(2, 0), "Ces athlètes n'ont pas rendu leur profil visible aux partenaires.");
  // C2 (1.4.5) : aucun compte de joueurs.
  assert.equal(noteProfilsNonNommes(3, 2), "Un autre athlète n'a pas rendu son profil visible aux partenaires.");
  assert.equal(noteProfilsNonNommes(5, 2), "D'autres athlètes n'ont pas rendu leur profil visible aux partenaires.");
});

test("cadre propre à la carte des matchs : « Trouve ton cégep » ne le lit pas (décision BP)", () => {
  const rm = lire("components/cegep-search/RechercheMobile.tsx");
  assert.ok(!rm.includes("carte-mobile"), "RechercheMobile ne dépend pas de CarteMobile");
  assert.match(rm, /const SHEET_MS = 280;/); // son cadre à lui, intact
  const sh = lire("components/carte-mobile/CarteMobile.tsx");
  // Le cadre ne dépend que de la carte (MapPane), jamais de l'écran cégep.
  assert.doesNotMatch(sh, /from "@\/components\/cegep-search\/(RechercheMobile|CegepSearch)"/);
  assert.match(sh, /const MapPane = dynamic\(\(\) => import\("@\/components\/cegep-search\/MapPane"\), \{ ssr: false \}\);/);
  assert.match(sh, /"--tabzone": IS_CAPACITOR \? ZONE_ONGLETS : "env\(safe-area-inset-bottom\)"/);
  assert.match(sh, /document\.body\.classList\.toggle\("nx-rm-sheet-tall", tall\);/);
  assert.match(sh, /\.rm \.listscroll \.pad\{height:calc\(var\(--tabzone\) \+ 88px\)\}/);
});

test("état partagé : le web et l'appli lisent useCarteMatchsEtat, la recherche n'est appelée qu'ici", () => {
  const web = lire("components/carte-matchs/CarteMatchs.tsx");
  const mob = lire("components/carte-matchs/CarteMatchsMobile.tsx");
  const hook = lire("lib/carteMatchs/useCarteMatchsEtat.ts");
  assert.match(web, /\} = useCarteMatchsEtat\(mode\);/);
  assert.match(mob, /const e = useCarteMatchsEtat\(mode\);/);
  assert.match(mob, /const etat = useCarteMobile<CleFiltre>\(\);/);
  for (const [nom, src] of [["web", web], ["appli", mob]] as const) {
    assert.doesNotMatch(src, /useMatchsRecherche\(/, nom);
    assert.doesNotMatch(src, /useProfilsMatchs\(/, nom);
    assert.match(src, /useDetailsMatch\(mode, m, suivis, actif\)/, nom);
  }
  assert.match(hook, /useMatchsRecherche\(/);
  // Le web garde sa hauteur sous la barre d'onglets.
  assert.match(web, /setHauteur\(hauteurSousOnglets\(top, IS_CAPACITOR\)\);/);
  // L'appli : liens externes dans le navigateur intégré, fiches par la route de l'app.
  assert.match(mob, /ouvrirDansLApp\(ev, lienItineraire\(t\.lat, t\.lon\)\)/);
  assert.match(mob, /partenaire \? `\/partenaire\/athletes\/\$\{id\}` : `\/recruteur\/athletes\/\$\{id\}`/);
});

test("routes : appli → CarteMatchsMobile, web → CarteMatchs ; recruteur derrière la porte Pro", () => {
  const rec = lire("app/recruteur/carte-matchs/page.tsx");
  assert.doesNotMatch(rec, /router\.replace\("\/recruteur\/calendrier"\)/);
  assert.match(rec, /<FeatureGate feature="recruiting_calendar" requiredTier="pro">\s*\{IS_CAPACITOR \? <CarteMatchsMobile mode="recruteur" \/> : <CarteMatchs mode="recruteur" \/>\}\s*<\/FeatureGate>/);
  const par = lire("app/partenaire/carte-matchs/page.tsx");
  assert.match(par, /return IS_CAPACITOR \? <CarteMatchsMobile mode="partenaire" \/> : <CarteMatchs mode="partenaire" \/>;/);
  // L'en-tête « Espace partenaire » ne passe pas par-dessus l'écran plein.
  const lay = lire("app/partenaire/layout.tsx");
  assert.match(lay, /const pleinEcran = normalizeTabPath\(pathname\) === "\/partenaire\/carte-matchs";/);
  assert.match(lay, /\{!pleinEcran && \(\n\s*<div\n\s*className="sticky top-0 z-30/);
});

test("menu « Plus » recruteur : Carte des matchs après Calendrier, sans verrou", () => {
  const src = lire("app/_components/mobile/MorePanel.tsx");
  const cal = src.indexOf('{ key: "calendrier", label: "Calendrier", href: "/recruteur/calendrier"');
  const carte = src.indexOf('{ key: "carte-matchs", label: "Carte des matchs", href: "/recruteur/carte-matchs", icon: Icons.calendar }');
  assert.ok(cal > 0 && carte > cal, "après Calendrier");
  assert.doesNotMatch(src.slice(carte, src.indexOf("\n", carte)), /requiredTier/);
  // Le partenaire garde la sienne.
  assert.match(src, /\{ key: "carte-matchs", label: "Carte des matchs", href: "\/partenaire\/carte-matchs", icon: Icons\.calendar \}/);
});

test("ligne compacte (appli) : heure/date, équipes, catégorie · division · lieu, « + » ; la source va dans la fiche", () => {
  const mob = lire("components/carte-matchs/CarteMatchsMobile.tsx");
  const debut = mob.indexOf("const ligne = (m: MatchRecherche) => {");
  const corps = mob.slice(debut, mob.indexOf("\n  };", debut));
  assert.ok(debut > 0);
  assert.doesNotMatch(corps, /<Source /, "pas de source dans la ligne");
  assert.match(corps, /<span className="cm-titre">\{titreMatch\(m\)\}<\/span>/);
  assert.match(corps, /\{groupeMatch\(m\) \? `\$\{groupeMatch\(m\)\} · ` : ""\}\{m\.terrain \|\| LIEU_NON_PRECISE\}/);
  assert.match(corps, /<BoutonCalendrier /);
  // La fiche du match garde tout le détail (source, description, calendrier officiel).
  assert.match(mob.slice(mob.indexOf("function Apercu(")), /<Source m=\{m\} sources=\{sources\} \/>/);
  // « + » : zone de 44 px, et un toucher sur lui n'ouvre jamais la fiche.
  assert.match(mob, /\.rm\.cm-mobile \.cm-plus\{width:44px;height:44px;/);
  assert.match(mob, /onClick=\{\(ev\) => \{ ev\.stopPropagation\(\); void tap\(\); onClick\(\); \}\}/);
  // « + » parasite : la fiche s'ouvre par un VRAI bouton (sinon le WebView aimante le toucher sur le « + ») ;
  // l'<article> n'a plus de onClick, dans la liste comme dans « Autres matchs à ce terrain ».
  assert.match(corps, /<button type="button" className="cm-ouvrir" data-testid="ouvrir-match"[^>]*\n\s*onClick=\{\(\) => ouvrirMatch\(m\)\}>/);
  assert.doesNotMatch(mob, /<article[^>]*onClick=/);
  assert.equal((mob.match(/className="rowright cm-zone-plus"/g) || []).length, 2);
});
