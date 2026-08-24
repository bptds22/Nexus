/* Hook de résolution ESM : rend l'alias `@/…` de tsconfig.json utilisable par
   `node --test`. Deux règles, pas une de plus.

   1. `@/lib/supabase/client` → un stub. Les suites ne couvrent que des
      fonctions PURES ; grilles.ts importe le client Supabase au niveau module
      (pour le défaut de loadGrilles) mais ne l'appelle jamais dans ce qu'on
      teste. Charger le vrai client ferait entrer @supabase/ssr et la lecture
      des variables d'environnement dans une suite qui n'en a pas besoin.

   2. `@/*` → racine du dépôt, avec ajout de l'extension : ESM l'exige, alors
      que TypeScript l'omet. On tente .ts puis .tsx avant de laisser passer. */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = pathToFileURL(process.cwd()).href + "/";
const STUB = "lib/evaluations/__tests__/supabaseClient.stub.ts";

function withExtension(url) {
  if (/\.[cm]?[jt]sx?$/.test(url)) return url;
  for (const ext of [".ts", ".tsx", ".mjs", ".js"]) {
    if (existsSync(fileURLToPath(url + ext))) return url + ext;
  }
  return url;
}

export async function resolve(specifier, context, next) {
  if (specifier === "@/lib/supabase/client") {
    return next(new URL(STUB, ROOT).href, context);
  }
  if (specifier.startsWith("@/")) {
    return next(withExtension(new URL(specifier.slice(2), ROOT).href), context);
  }
  return next(specifier, context);
}
