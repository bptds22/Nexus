#!/usr/bin/env bash
# Génère un fichier prod du lot C0 cégep à partir de son gabarit : docs/cegep-lot-c0/prod/<type>.gabarit.sql
# → docs/cegep-lot-c0/prod/<type>-<date>.sql, migration et rollback embarqués tels quels (fins de ligne
# ramenées à LF), avec leurs md5. Même méthode que scripts/cegep-lot-b3/generer.sh.
# Usage : scripts/cegep-lot-c0/generer.sh 20261027 [rejeu-blanc|apply|rollback]
set -euo pipefail
cd "$(dirname "$0")/../.."
DATE="${1:?date AAAAMMJJ}"
TYPE="${2:-rejeu-blanc}"
VERSION=20261027210000
MIG=supabase/migrations/${VERSION}_cegep_lot_c0_base.sql
RB=supabase/rollback/${VERSION}_rollback_cegep_lot_c0_base.sql
GAB=docs/cegep-lot-c0/prod/$TYPE.gabarit.sql
OUT=docs/cegep-lot-c0/prod/$TYPE-$DATE.sql

for f in "$MIG" "$RB"; do
  if grep -q -e '\$nexus_mig\$' -e '\$nexus_rb\$' "$f"; then echo "délimiteur présent dans $f" >&2; exit 1; fi
done

MIG="$MIG" RB="$RB" VERSION="$VERSION" DATE="$DATE" node -e '
  const fs = require("fs");
  const crypto = require("crypto");
  const e = process.env;
  const lf = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");
  const mig = lf(e.MIG), rb = lf(e.RB);
  let g = lf(process.argv[1]);
  g = g.split("@@MD5_MIGRATION@@").join(md5(mig))
       .split("@@MD5_ROLLBACK@@").join(md5(rb))
       .split("@@VERSION@@").join(e.VERSION)
       .split("@@DATE@@").join(e.DATE);
  g = g.replace("@@MIGRATION@@", () => mig).replace("@@ROLLBACK@@", () => rb);
  if (/@@[A-Z_0-9]+@@/.test(g.replace(mig, "").replace(rb, ""))) { console.error("marqueur non remplacé"); process.exit(1); }
  fs.writeFileSync(process.argv[2], g);
  console.log("migration " + md5(mig) + "  rollback " + md5(rb) + "  généré " + md5(g));
' "$GAB" "$OUT"
echo "$OUT"
