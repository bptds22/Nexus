#!/usr/bin/env bash
# Génère un fichier prod du lot C1 cégep à partir de son gabarit :
# docs/cegep-lot-c1/prod/<lot>-<type>.gabarit.sql → docs/cegep-lot-c1/prod/<lot>-<type>-<date>.sql,
# migration et rollback embarqués tels quels (fins de ligne ramenées à LF), avec leurs md5. Même méthode
# que scripts/cegep-lot-c0/generer.sh.
# Usage : scripts/cegep-lot-c1/generer.sh c1a|c1b 20261027 [rejeu-blanc|apply|rollback]
set -euo pipefail
cd "$(dirname "$0")/../.."
LOT="${1:?lot c1a|c1b}"
DATE="${2:?date AAAAMMJJ}"
TYPE="${3:-rejeu-blanc}"
VERSION_C1A=20261027230000
case "$LOT" in
  c1a) VERSION=$VERSION_C1A; NOM=cegep_lot_c1a_methode_auto_cegep; RB="" ;;
  c1b) VERSION=20261027230100; NOM=cegep_lot_c1b_verification_auto_cegep
       RB=supabase/rollback/${VERSION}_rollback_${NOM}.sql ;;
  *) echo "lot inconnu : $LOT" >&2; exit 1 ;;
esac
MIG=supabase/migrations/${VERSION}_${NOM}.sql
GAB=docs/cegep-lot-c1/prod/$LOT-$TYPE.gabarit.sql
OUT=docs/cegep-lot-c1/prod/$LOT-$TYPE-$DATE.sql

for f in "$MIG" ${RB:+"$RB"}; do
  if grep -q -e '\$nexus_mig\$' -e '\$nexus_rb\$' "$f"; then echo "délimiteur présent dans $f" >&2; exit 1; fi
done

MIG="$MIG" RB="$RB" VERSION="$VERSION" VERSION_C1A="$VERSION_C1A" DATE="$DATE" node -e '
  const fs = require("fs");
  const crypto = require("crypto");
  const e = process.env;
  const lf = (f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");
  const mig = lf(e.MIG), rb = e.RB ? lf(e.RB) : "";
  let g = lf(process.argv[1]);
  g = g.split("@@MD5_MIGRATION@@").join(md5(mig))
       .split("@@MD5_ROLLBACK@@").join(md5(rb))
       .split("@@VERSION_C1A@@").join(e.VERSION_C1A)
       .split("@@VERSION@@").join(e.VERSION)
       .split("@@DATE@@").join(e.DATE);
  g = g.replace("@@MIGRATION@@", () => mig).replace("@@ROLLBACK@@", () => rb);
  if (/@@[A-Z_0-9]+@@/.test(g.replace(mig, "").replace(rb, ""))) { console.error("marqueur non remplacé"); process.exit(1); }
  fs.writeFileSync(process.argv[2], g);
  console.log("migration " + md5(mig) + "  rollback " + (rb ? md5(rb) : "·") + "  généré " + md5(g));
' "$GAB" "$OUT"
echo "$OUT"
