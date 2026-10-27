#!/usr/bin/env bash
# Génère les deux fichiers du crochet bleu des cégépiens déjà ancrés (lot C1, décision BP 2026-10-27) :
# docs/cegep-lot-c1/prod/c1c-crochet-existant-{rejeu-blanc,apply}-<date>.sql. LF.
# Usage : scripts/cegep-lot-c1/generer-crochet.sh 20261027 [attendu=1]
set -euo pipefail
cd "$(dirname "$0")/../.."
DATE="${1:?date AAAAMMJJ}"
ATTENDU="${2:-1}"
GAB=docs/cegep-lot-c1/prod/c1c-crochet-existant.gabarit.sql
for MODE in rejeu-blanc apply; do
  OUT=docs/cegep-lot-c1/prod/c1c-crochet-existant-$MODE-$DATE.sql
  MODE="$MODE" ATTENDU="$ATTENDU" node -e '
    const fs = require("fs");
    const e = process.env;
    const apply = e.MODE === "apply";
    const adm = apply ? [
      "insert into public.admin_operations (operation, motif, details, par)",
      "select \x27CEGEP_CROCHET_AUTO_EXISTANTS\x27,",
      "       \x27Chantier cégep, lot C1 : crochet bleu auto_cegep au(x) cégépien(s) déjà ancré(s) avant C1b (GO BP 2026-10-27)\x27,",
      "       jsonb_build_object(\x27fiches\x27, (select count(*) from _cibles), \x27methode\x27, \x27auto_cegep\x27,",
      "                          \x27fichier\x27, \x27docs/cegep-lot-c1/prod/c1c-crochet-existant-apply-" + process.argv[3] + ".sql\x27,",
      "                          \x27voie\x27, \x27psql (session pooler)\x27),",
      "       (select id from public.users where id = \x27f51384b5-a2c2-4827-9137-8aa8d29a1fe0\x27);  -- BP ; NULL hors prod",
    ].join("\n") : "-- rejeu à blanc : rien n\x27est inscrit dans admin_operations.";
    let g = fs.readFileSync(process.argv[1], "utf8").replace(/\r\n/g, "\n");
    g = g.split("@@MODE@@").join(e.MODE).split("@@ATTENDU@@").join(e.ATTENDU)
         .split("@@ADMIN_OPERATIONS@@").join(adm)
         .split("@@FIN@@").join(apply ? "commit" : "rollback")
         .split("@@ECHO@@").join(apply ? "COMMIT fait : crochet bleu auto_cegep posé." : "ROLLBACK fait : rien n\x27\x27est appliqué.");
    if (/@@[A-Z_]+@@/.test(g)) { console.error("marqueur non remplacé"); process.exit(1); }
    fs.writeFileSync(process.argv[2], g);
  ' "$GAB" "$OUT" "$DATE"
  md5sum "$OUT"
done
