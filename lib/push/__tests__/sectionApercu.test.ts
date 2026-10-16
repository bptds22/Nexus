/* A5 — clic sur un push « badge » ou « évaluation » : l'aperçu amène la
   section à l'écran. Relevé émulateur 1.4.5 : `a` change de référence avant
   la fin du délai, le minuteur est annulé ; le drapeau « fait » doit donc être
   posé APRÈS le défilement, jamais avant. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(process.cwd(), "components/shared/AthleteRecruiterProfileBodyMobile.tsx"), "utf8");

test("aperçu : sectionFaiteRef posé dans le minuteur, après avoir trouvé la cible", () => {
  const debut = src.indexOf("const sectionFaiteRef = useRef(false);");
  assert.ok(debut > 0);
  const bloc = src.slice(debut, src.indexOf("}, [section, a]);", debut));
  const minuteur = bloc.indexOf("window.setTimeout(");
  const pose = bloc.indexOf("sectionFaiteRef.current = true;");
  assert.ok(minuteur > 0 && pose > minuteur, "le drapeau est posé dans le minuteur");
  assert.ok(bloc.indexOf("if (!cible) return;") < pose, "pas de drapeau sans cible");
  assert.ok(bloc.indexOf("cible.scrollIntoView(") > pose);
});
