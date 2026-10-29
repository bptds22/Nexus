#!/bin/sh
# Lance le web du worktree contre la pile Docker LOCALE (jamais le cloud), avec la clé de carte MapTiler.
#   sh docs/cegep-lot-d/tests/lancer-local.sh          → next dev   sur http://localhost:${PORT:-3110}
#   sh docs/cegep-lot-d/tests/lancer-local.sh build    → next build puis next start (build de production)
#
# Lot E7 : le worktree n'a pas de .env.local ; sans NEXT_PUBLIC_MAPTILER_KEY la carte affiche « Invalid key ».
# On reprend UNIQUEMENT cette variable du .env.local de l'arbre partagé (lecture seule). Ce fichier pointe le
# CLOUD : aucune autre variable n'en est lue, et la clé n'est jamais affichée.
ARBRE=/c/Users/bptds/Documents/Nexus
RACINE=$(cd "$(dirname "$0")/../../.." && pwd)
PORT=${PORT:-3110}

eval "$(cd "$ARBRE" && npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
[ "$API_URL" = "http://127.0.0.1:54321" ] || { echo "pile locale introuvable (supabase start dans $ARBRE)"; exit 1; }
export NEXT_PUBLIC_SUPABASE_URL="$API_URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"

CLE=$(grep -E '^NEXT_PUBLIC_MAPTILER_KEY=' "$ARBRE/.env.local" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"\r')
if [ -n "$CLE" ]; then
  export NEXT_PUBLIC_MAPTILER_KEY="$CLE"
  echo "clé MapTiler : reprise de l'arbre partagé (${#CLE} caractères)"
else
  echo "clé MapTiler absente de $ARBRE/.env.local — la carte affichera « Invalid key »"
fi
unset CLE

cd "$RACINE" || exit 1
if [ "$1" = "build" ]; then
  npx next build || exit $?
  exec npx next start -p "$PORT"
fi
exec npx next dev -p "$PORT"
