#!/usr/bin/env bash
# Génère un fichier prod du lot A à partir de son gabarit : docs/cegep-lot-a/prod/<type>.gabarit.sql
# → docs/cegep-lot-a/prod/<type>-<date>.sql, avec la migration et le rollback embarqués tels quels,
# leurs md5 et la version d'enregistrement.
# Usage : scripts/cegep-lot-a-rejeu-blanc.sh 20261025 [rejeu-blanc|apply|rollback]
set -euo pipefail
cd "$(dirname "$0")/.."
DATE="${1:?date AAAAMMJJ}"
TYPE="${2:-rejeu-blanc}"
VERSION=20261026030400
MIG=supabase/migrations/${VERSION}_cegep_lot_a_base.sql
RB=supabase/rollback/${VERSION}_rollback_cegep_lot_a_base.sql
GAB=docs/cegep-lot-a/prod/$TYPE.gabarit.sql
OUT=docs/cegep-lot-a/prod/$TYPE-$DATE.sql

for f in "$MIG" "$RB"; do
  if grep -q -e '\$nexus_mig\$' -e '\$nexus_rb\$' "$f"; then echo "délimiteur présent dans $f" >&2; exit 1; fi
done

MIG="$MIG" RB="$RB" VERSION="$VERSION" \
MD5M="$(md5sum "$MIG" | cut -d' ' -f1)" MD5R="$(md5sum "$RB" | cut -d' ' -f1)" \
node -e '
  const fs = require("fs");
  const e = process.env;
  let g = fs.readFileSync(process.argv[1], "utf8");
  // Remplacements par fonction : aucun motif « $& » interprété dans les textes embarqués.
  // Marqueurs courts d abord : les textes embarqués ne sont plus relus ensuite.
  g = g.split("@@MD5_MIGRATION@@").join(e.MD5M)
       .split("@@MD5_ROLLBACK@@").join(e.MD5R)
       .split("@@VERSION@@").join(e.VERSION);
  g = g.replace("@@MIGRATION@@", () => fs.readFileSync(e.MIG, "utf8"))
       .replace("@@ROLLBACK@@", () => fs.readFileSync(e.RB, "utf8"));
  if (/@@[A-Z_0-9]+@@/.test(g.replace(fs.readFileSync(e.MIG, "utf8"), "").replace(fs.readFileSync(e.RB, "utf8"), ""))) {
    console.error("marqueur non remplacé"); process.exit(1);
  }
  fs.writeFileSync(process.argv[2], g);
' "$GAB" "$OUT"

echo "$OUT"
echo "migration $(md5sum "$MIG" | cut -d' ' -f1)  rollback $(md5sum "$RB" | cut -d' ' -f1)  généré $(md5sum "$OUT" | cut -d' ' -f1)"
