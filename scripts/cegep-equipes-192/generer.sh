#!/usr/bin/env bash
# Génère un fichier prod du lot « 192 équipes cégep » à partir de son gabarit :
# docs/cegep-equipes-192/prod/<type>.gabarit.sql → docs/cegep-equipes-192/prod/<type>-<date>.sql, avec
# l'opération (creer.sql) et/ou son rollback (retirer.sql) embarqués tels quels (fins de ligne ramenées à
# LF), et leurs md5.
# Usage : scripts/cegep-equipes-192/generer.sh 20261026 [rejeu-blanc|apply|rollback]
set -euo pipefail
cd "$(dirname "$0")/../.."
DATE="${1:?date AAAAMMJJ}"
TYPE="${2:-rejeu-blanc}"
OP=scripts/cegep-equipes-192/creer.sql
RB=scripts/cegep-equipes-192/retirer.sql
GAB=docs/cegep-equipes-192/prod/$TYPE.gabarit.sql
OUT=docs/cegep-equipes-192/prod/$TYPE-$DATE.sql

for f in "$OP" "$RB"; do
  if grep -q -e '\$nexus_op\$' -e '\$nexus_rb\$' "$f"; then echo "délimiteur présent dans $f" >&2; exit 1; fi
done

OP="$OP" RB="$RB" DATE="$DATE" node -e '
  const fs = require("fs");
  const crypto = require("crypto");
  const e = process.env;
  const lf = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");
  const op = lf(e.OP), rb = lf(e.RB);
  let g = lf(process.argv[1]);
  g = g.split("@@MD5_OPERATION@@").join(md5(op))
       .split("@@MD5_ROLLBACK@@").join(md5(rb))
       .split("@@DATE@@").join(e.DATE);
  g = g.replace("@@OPERATION@@", () => op).replace("@@ROLLBACK@@", () => rb);
  if (/@@[A-Z_0-9]+@@/.test(g.replace(op, "").replace(rb, ""))) { console.error("marqueur non remplacé"); process.exit(1); }
  fs.writeFileSync(process.argv[2], g);
  console.log("operation " + md5(op) + "  rollback " + md5(rb) + "  généré " + md5(g));
' "$GAB" "$OUT"
echo "$OUT"
