#!/usr/bin/env bash
# Génère docs/cegep-lot-a/prod/rejeu-blanc-<date>.sql : le gabarit, avec la migration et le
# rollback du lot A embarqués tels quels et leurs md5. Usage : scripts/cegep-lot-a-rejeu-blanc.sh 20261025
set -euo pipefail
cd "$(dirname "$0")/.."
DATE="${1:?date AAAAMMJJ}"
MIG=supabase/migrations/20261020190000_cegep_lot_a_base.sql
RB=supabase/rollback/20261020190000_rollback_cegep_lot_a_base.sql
GAB=docs/cegep-lot-a/prod/rejeu-blanc.gabarit.sql
OUT=docs/cegep-lot-a/prod/rejeu-blanc-$DATE.sql

for f in "$MIG" "$RB"; do
  if grep -q -e '\$nexus_mig\$' -e '\$nexus_rb\$' "$f"; then echo "délimiteur présent dans $f" >&2; exit 1; fi
done

MIG="$MIG" RB="$RB" \
MD5M="$(md5sum "$MIG" | cut -d' ' -f1)" MD5R="$(md5sum "$RB" | cut -d' ' -f1)" \
node -e '
  const fs = require("fs");
  const e = process.env;
  let g = fs.readFileSync(process.argv[1], "utf8");
  // Remplacements par fonction : aucun motif « $& » interprété dans les textes embarqués.
  g = g.replace("@@MIGRATION@@", () => fs.readFileSync(e.MIG, "utf8"))
       .replace("@@ROLLBACK@@", () => fs.readFileSync(e.RB, "utf8"))
       .replace("@@MD5_MIGRATION@@", () => e.MD5M)
       .replace("@@MD5_ROLLBACK@@", () => e.MD5R);
  if (/@@[A-Z_]+@@/.test(g)) { console.error("marqueur non remplacé"); process.exit(1); }
  fs.writeFileSync(process.argv[2], g);
' "$GAB" "$OUT"

echo "$OUT"
echo "migration $(md5sum "$MIG" | cut -d' ' -f1)  rollback $(md5sum "$RB" | cut -d' ' -f1)  généré $(md5sum "$OUT" | cut -d' ' -f1)"
