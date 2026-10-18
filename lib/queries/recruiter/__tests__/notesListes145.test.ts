/* Notes dans « Mes listes » (1.4.5) : DEUX niveaux, comme avant 8f108751 / e131d05d.
   · la note GÉNÉRALE de la liste (recruiter_list_notes) ;
   · les notes PAR JOUEUR : le fil de Mon processus (recruiter_notes), sans doublon. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("web : la note de liste s'écrit et se supprime (les siennes), signée", () => {
  const src = lire("app/recruteur/listes/page.tsx");
  assert.match(src, /function NotesDeListe\(/);
  assert.match(src, /from\("recruiter_list_notes"\)\.insert\(\{ list_id: listId, recruiter_id: moi/);
  assert.match(src, /from\("recruiter_list_notes"\)\.delete\(\)\.eq\("id", id\)/);
  assert.match(src, /<NotesDeListe listId=\{list\.id\}/);
  assert.doesNotMatch(src, /depuis l&apos;app/);
});

test("web : le fil du joueur dans une liste reçoit les mêmes options que Mon processus", () => {
  const src = lire("app/recruteur/listes/page.tsx");
  assert.match(src, /lecture=\{modeUnite \|\| prospect \? "unite" : "siennes"\}/);
  assert.match(src, /bloque=\{demoGratuit\}/);
  assert.match(src, /onTease=\{/);
  const pipeline = lire("app/recruteur/pipeline/page.tsx");
  assert.match(pipeline, /lecture=\{modeUnite \|\| carte \? "unite" : "siennes"\}/);
  assert.match(pipeline, /bloque=\{isFreeDemoMode\}/);
});

test("appli : onglet « Notes » de la liste ET bulle par joueur (même fil que Mon processus)", () => {
  const src = lire("components/shared/RecruteurListeDetailMobile.tsx");
  assert.match(src, /function ListNotesPanel\(/);
  assert.match(src, /<SegmentsListe vue=\{vue\}/);
  assert.match(src, /from\("recruiter_list_notes"\)\.insert\(/);
  assert.match(src, /<FilNotesSuiviMobile/);
});

test("aucune migration : la table recruiter_list_notes et sa RLS d'écriture n'ont pas bougé", () => {
  const base = lire("supabase/migrations/20260417120000_baseline.sql");
  assert.match(base, /CREATE POLICY "Recruiters manage their own list notes" ON "public"\."recruiter_list_notes"/);
});
