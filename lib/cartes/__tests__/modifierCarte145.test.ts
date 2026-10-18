/* « Modifier la carte » (1.4.5, demande BP) : toute l'info d'une carte prospect se modifie,
   web ET appli, par un bouton visible ; l'établissement aussi (migration NON appliquée) ;
   une carte n'écrit jamais dans `athletes`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHAMPS_MODIFIABLES_CARTE } from "@/lib/cartes/carteProspect";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("la liste blanche d'écriture contient TOUTE l'info de la carte", () => {
  for (const k of ["prenom", "nom", "schoolId", "teamId", "positionId", "numero", "promotion", "taillePieds", "taillePouces", "poidsLbs", "lienVideo"]) {
    assert.ok(CHAMPS_MODIFIABLES_CARTE.includes(k), `VERS_COLONNE sans ${k}`);
  }
  // Les clés d'invitation / de coordonnées gardent leurs lignes dédiées.
  for (const k of ["courriel", "telephone", "parentNom", "parentCourriel"]) assert.ok(CHAMPS_MODIFIABLES_CARTE.includes(k));
});

test("une carte n'écrit JAMAIS dans athletes : ni l'écriture ni le formulaire", () => {
  assert.doesNotMatch(lire("components/recruteur/cartes/ModifierCarte.tsx"), /from\("athletes"\)/);
  const ecriture = lire("lib/cartes/carteProspect.ts");
  const bloc = ecriture.slice(ecriture.indexOf("export async function ecrireCarte"), ecriture.indexOf("export async function retirerCarte"));
  assert.match(bloc, /from\("cartes_prospect"\)\.update\(/);
  assert.doesNotMatch(bloc, /athletes/);
});

test("le bouton « Modifier la carte » est dans Infos, partagé web et appli, et caché en lecture seule", () => {
  const panneau = lire("components/recruteur/cartes/PanneauCarte.tsx");
  assert.match(panneau, /data-testid="bouton-modifier-carte"/);
  assert.match(panneau, /Modifier la carte/);
  assert.match(panneau, /\{!lectureSeule && \(\s*<div>\s*<button/);
  assert.match(lire("app/recruteur/pipeline/page.tsx"), /<OngletInfosCarte card=\{carte\} lectureSeule=\{lectureSeule\} \/>/);
  assert.match(lire("components/shared/RecruteurPipelineMobile.tsx"), /<OngletInfosCarte card=\{card\} lectureSeule=\{lectureSeule\} \/>/);
});

test("le formulaire : tous les champs, astérisques, Enregistrer / Annuler avec confirmation", () => {
  const f = lire("components/recruteur/cartes/ModifierCarte.tsx");
  for (const id of ["prenom", "nom", "etablissement", "equipe", "position", "numero", "promotion", "taille", "poids", "video"]) {
    assert.match(f, new RegExp(`modifier-carte-${id}`), id);
  }
  assert.match(f, /Prénom <span className="text-\[#E63946\]">\*<\/span>/);
  assert.match(f, /Abandonner tes modifications \?/);
  assert.match(f, /mise à jour\./);
  assert.match(f, /lireTaille\(taille\)/);
  assert.match(f, /lireLien\(video\)/);
  // Au toucher : 44 px et 16 px (pas de zoom iOS).
  assert.match(f, /min-h-\[44px\]/);
  assert.match(f, /text-\[16px\]/);
});

test("migration établissement : corps relevé, ACL comparée, rollback exact — et NON appliquée par le code", () => {
  const m = lire("supabase/migrations/20261017130000_carte_etablissement_modifiable.sql");
  // Garde sur l'empreinte RÉELLE de la prod (corps stocké sans commentaires), pas celle d'un texte.
  assert.match(m, /is distinct from '90b079257971091e31a03f366cbf5aed'/);
  assert.doesNotMatch(m, /177e99f1c2f6dbc620aaa810ecf0d0dc/);
  assert.match(m, /l''établissement suit l''équipe — change l''équipe/);
  assert.match(m, /cet établissement a une équipe de ce sport — choisis-la/);
  assert.match(m, /_acl_avant/);
  assert.match(m, /security definer/);
  assert.match(m, /end \$\$;/);
  const r = lire("supabase/rollback/20261017130000_rollback_carte_etablissement_modifiable.sql");
  assert.match(r, /38b55d113bd5d27f7cfded1e82f38076/);
  assert.match(r, /new\.school_id := old\.school_id;/);
});
