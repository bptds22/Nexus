/* Loi 25 (retrait d'opt-in respecté partout) et demande de visibilité au jeune
   (2026-10-16). Le comportement est prouvé au banc SQL
   (docs/cote-partenaire-carte/tests-cote-partenaire.sql) ; ici : le client,
   et que la migration porte bien chaque verrou. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  accepterVisibilitePartenaire,
  etatDemande,
  messageRefusAcceptation,
  texteEtatDemande,
} from "@/lib/partenaires/demandeVisibilite";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const MIGRATION = "supabase/migrations/20261016170000_cote_partenaire_carte_mes_athletes.sql";

test("état d'une demande : défaut EN_ATTENTE, textes des états réglés", () => {
  assert.equal(etatDemande({}), "EN_ATTENTE");
  assert.equal(etatDemande(null), "EN_ATTENTE");
  assert.equal(etatDemande({ etat: "ACCEPTEE" }), "ACCEPTEE");
  assert.equal(etatDemande({ etat: "n'importe quoi" }), "EN_ATTENTE");
  assert.equal(texteEtatDemande("EN_ATTENTE"), null);
  assert.match(texteEtatDemande("DEMANDE_PARENT") ?? "", /parent/);
  assert.match(texteEtatDemande("CADUQUE") ?? "", /plus d'actualité/);
});

test("accepter : le serveur décide (activée, ou demande au parent) ; refus traduits", async () => {
  const faux = (data: unknown, error: unknown = null) => {
    const appels: unknown[] = [];
    return { appels, client: { rpc: (f: string, a: unknown) => { appels.push([f, a]); return Promise.resolve({ data, error }); } } };
  };
  let f = faux({ ok: true, etat: "ACCEPTEE" });
  assert.deepEqual(await accepterVisibilitePartenaire(f.client as never, "n1", "v1"), { ok: true, etat: "ACCEPTEE" });
  assert.deepEqual(f.appels, [["accepter_visibilite_partenaire", { p_notification: "n1", p_policy_version: "v1" }]]);
  f = faux({ ok: true, etat: "DEMANDE_PARENT" });
  assert.deepEqual(await accepterVisibilitePartenaire(f.client as never, "n1", "v1"), { ok: true, etat: "DEMANDE_PARENT" });
  f = faux({ ok: false, reason: "parent_absent" });
  assert.deepEqual(await accepterVisibilitePartenaire(f.client as never, "n1", "v1"), { ok: false, message: messageRefusAcceptation("parent_absent") });
  f = faux(null, { message: "boom" });
  assert.equal((await accepterVisibilitePartenaire(f.client as never, "n1", "v1")).ok, false);
});

test("migration — Loi 25 : les 4 lectures exigent l'opt-in actif, sauf pour l'admin", () => {
  const sql = lire(MIGRATION);
  const corps = (debut: string) => sql.slice(sql.indexOf(debut), sql.indexOf("$function$;", sql.indexOf(debut)));
  const ev = corps("CREATE OR REPLACE FUNCTION public.evaluations_partenaires_athlete");
  assert.match(ev, /coalesce\(public\.is_partner_eligible_athlete\(p_athlete_id\), false\) as admissible/);
  assert.match(ev, /and \(lecteur\.admin or lecteur\.admissible\)/);
  const ba = corps("CREATE OR REPLACE FUNCTION public.badges_partenaires_athlete");
  assert.match(ba, /and \(lecteur\.admin or lecteur\.admissible\)/);
  const ad = corps("CREATE OR REPLACE FUNCTION public.partenaire_badges_nexus_admissibles");
  assert.match(ad, /if not public\.is_admin\(\) and not coalesce\(public\.is_partner_eligible_athlete\(p_athlete_id\), false\) then/);
  const rs = corps("CREATE OR REPLACE FUNCTION public.recruiter_search_athletes");
  assert.match(rs, /WHERE pev\.athlete_id = a\.id\n\s+AND COALESCE\(public\.is_partner_eligible_athlete\(a\.id\), false\)/);
  assert.match(rs, /ORDER BY pev\.updated_at DESC, pev\.id DESC/, "la plus récente, départagée comme le client");
  // Le lot cartes délègue toujours à W2 : il hérite du verrou.
  assert.match(sql, /cross join lateral public\.evaluations_partenaires_athlete\(i\.athlete_id\) e/);
});

test("migration — demande : texte sans cote ni badge, dédoublonnage, une seule relance après retrait, push annulable", () => {
  const sql = lire(MIGRATION);
  assert.match(sql, /v_texte constant text := 'Accepte d''être visible des partenaires pour que ton évaluation s''affiche\.';/);
  assert.match(sql, /v_titre := coalesce\(nullif\(btrim\(v_org\), ''\), 'Un partenaire'\) \|\| ' t''a évalué\.';/);
  const demande = sql.slice(sql.indexOf("create function public.partenaire_demander_visibilite"), sql.indexOf("comment on function public.partenaire_demander_visibilite"));
  assert.doesNotMatch(demande, /cote_globale::text|libelle/, "jamais la cote ni le nom d'un badge dans le message");
  assert.match(demande, /n\.metadata->>'etat' in \('EN_ATTENTE', 'DEMANDE_PARENT'\)/);
  assert.match(demande, /n\.created_at >= v_ath\.partner_visibility_opted_in_at/);
  assert.match(demande, /n2\.type = 'PARTENAIRE_EVALUATION'/, "la proposition W4 est convertie, pas doublée");
  assert.match(sql, /f\.genre = 'VISIBILITE_PARTENAIRE'\n\s+and not exists \(/);
  assert.match(sql, /when p_genre = 'VISIBILITE_PARTENAIRE' then 'Accepte d''être visible/);
  assert.match(sql, /v_res := public\.set_my_partner_visibility\(true, p_policy_version\);/, "le chemin existant");
  assert.match(sql, /'CHILD_PARTNER_VISIBILITY_REQUEST', 'Demande de visibilité partenaires'/);
});

test("web : bouton « Accepter » hors du bouton de la ligne ; parent mené à Consentements", () => {
  const cloche = lire("app/athlete/notifications/page.tsx");
  const bloc = cloche.slice(cloche.indexOf("if (n.type === TYPE_DEMANDE_VISIBILITE) {"), cloche.indexOf("const target = n.metadata?.kind"));
  assert.match(bloc, /<div key=\{n\.id\} data-demande-visibilite=\{etat\}/);
  assert.match(bloc, /onClick=\{\(\) => void accepterDemande\(n\)\}/);
  assert.match(cloche, /PARTENAIRE_VISIBILITE_DEMANDE: "#F59E0B",/);
  assert.match(cloche, /"PARTENAIRE_EVALUATION", "PARTENAIRE_VISIBILITE_DEMANDE"\]\.includes\(n\.type\)/);
  const parent = lire("app/parent/(app)/notifications/page.tsx");
  assert.match(parent, /if \(n\.type === TYPE_DEMANDE_PARENT\) router\.push\("\/parent\/consentements"\)/);
});
