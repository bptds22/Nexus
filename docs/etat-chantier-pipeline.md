# État du chantier pipeline recruteur — 2026-09-04

Document de passation. Écrit à la fin de la session qui a livré le Lot 2
(grade recruteur) et le Lot 2b (filtres à facettes).

---

## 1. Ce qui attend d'être poussé

**Un seul commit local non poussé : `55f01e9`** (Lot 2b).

⚠️ **`13c6ab1` (Lot 2) est DÉJÀ POUSSÉ.** Il n'a pas été poussé
délibérément : une autre session a poussé `main` en cours de journée, et
pousser une branche pousse tous ses ancêtres. `origin/main` est à `c9a51ae`,
six commits plus loin que le Lot 2.

**Conséquence pour le prochain push :** plusieurs sessions travaillent sur
`main` en parallèle. Vérifier `git log --oneline origin/HEAD..HEAD` avant de
pousser, et ne jamais supposer que la pile locale ne contient que son propre
travail.

L'arbre porte trois modifications qui ne sont **à personne dans ce chantier** :
`android/app/capacitor.build.gradle` et `android/capacitor.settings.gradle`
(bump keyboard, à BP), `tsconfig.json` (chemins `.next-verif*` ajoutés
automatiquement par les builds d'une autre session).

---

## 2. Web pipeline — FAIT

Tout le chantier web est livré et validé à l'écran par BP.

| Livré | Où |
|---|---|
| Table `recruiter_athlete_grades` (A+ → D, propriétaire seul) | `supabase/migrations/20260904022136_…` — **appliquée en prod** |
| Écriture/suppression du grade | `lib/queries/recruiter/useUpsertAthleteGrade.ts` |
| Source unique des 7 valeurs | `lib/config/grades.ts` (contrat avec le `CHECK` SQL) |
| Puce + picker, **gradation violette** | `components/shared/GradeChip.tsx` |
| Tri partagé, 5 modes | `lib/pipeline/sortPipelineCards.ts` |
| Facettes, recherche par nom, chips rapides | `lib/pipeline/filterPipelineCards.ts` |
| Barre alignée sur la page Recherche | `app/recruteur/pipeline/page.tsx` |
| Bandeau récapitulatif filtré (« 6 sur 15 ») | `FunnelSummary` dans le même fichier |
| `flagged` retiré de l'UI web + du tri | `page.tsx`, `sortPipelineCards.ts` |

**Vérifié empiriquement en prod :** poser, relire et retirer un grade
n'écrit **aucune** ligne d'activité. `PIPELINE_CHANGED` est resté à 68 et le
total des activités à 353 après 4 écritures, 2 suppressions et 2 bascules de
priorité. La promesse « aucun journal, aucune notification » du mirror est
mesurée, pas seulement écrite.

**Teinte réservée :** violet `#8B5CF6` = grade privé recruteur, **sur les
cartes pipeline uniquement**. Consigné dans `docs/mobile-design-system.md`,
section « Teintes réservées PAR SURFACE ». Ailleurs dans l'app, `#8B5CF6`
veut dire « groupe / diffusion » — c'est assumé.

---

## 3. EN ATTENTE — lot mobile (un seul bloc)

**Ne démarre que sur déclaration explicite de BP « le web est terminé »**
(protocole web-d'abord, voir §5).

À traiter ensemble, dans un lot dédié :

1. **Le branchement 2b mobile est écrit mais NON TESTÉ ni buildé.**
   `components/shared/RecruteurPipelineMobile.tsx` porte les facettes en
   chips dans la feuille ⋮. Aucun `build:mobile`, aucun `cap sync` n'a été
   lancé dessus.
2. **Il embarque le bug de pilule corrigé côté web.** Le mobile appelle
   encore `isFacetUseful(options)` pour décider si une facette s'affiche ;
   le web est passé à `isFacetOffered(cards, key, filters)`. Symptôme :
   sélectionner un sport à faible effectif fait **disparaître** les pilules
   Promotion et Région de la barre — et une facette qui disparaît avec une
   sélection active continue de filtrer sans rien afficher. Une ligne à
   changer, mais elle doit être vue à l'écran.
3. **Retirer le toggle « Prioritaire »** du bottom sheet
   (`RecruteurPipelineMobile.tsx`, section priorité) et le **liseré gauche
   coloré** des cartes (`getBorderLeftStyle`), par cohérence avec le web.
4. **Nettoyer `lib/queries/recruiter/useTogglePipelinePriority.ts`** — plus
   aucun importeur web, encore importé par le mobile seul. Il vit
   uniquement pour lui.
5. **Écart assumé à juger à ce moment-là :** le mobile utilise des **chips**
   et non `MobilePicker`. Raison : `MobilePicker` est mono-valeur
   (`onChange(v: string | null)`) et partagé par d'autres écrans ; le rendre
   multi-sélection aurait été une chirurgie sur un composant commun pour un
   besoin local.
6. **TEST ÉMULATEUR OBLIGATOIRE au gate** (exigence héritée du Lot 1,
   transférée à ce lot) : poser un grade → cold start → relire ; trier par
   grade ; les facettes ; **et la relance du Lot 1 sur le même écran** (poser
   une date, relire, pilule de retard en gold).

⚠️ Rappel d'environnement pour ce lot : `build:mobile` **bake le `.env.local`
présent**. Il pointe aujourd'hui sur le Supabase **cloud de prod**
(`nrloizyemulbhujrqhgx`), ce qui est le bon réglage pour le test émulateur —
mais à vérifier avant de builder.

---

## 4. Points ouverts

**`NextActionPopover` — la bascule « Marquer urgent »**
(`app/recruteur/pipeline/page.tsx`). Elle écrit toujours
`recruiter_pipeline.flagged` via `handleSaveAction`. Elle relève de l'axe
RELANCE du Lot 1, pas de la priorité, et n'était donc pas dans le périmètre
du retrait — mais elle écrit désormais une valeur que **plus rien n'affiche
côté web**. Trois sorties : la retirer, la découpler de `flagged`, ou assumer
qu'elle ne sert plus qu'à la visibilité admin. Consigné en P3.

**Sort final de la colonne `recruiter_pipeline.flagged`.** Conservée en base,
**aucune migration**. Le portail admin l'affiche
(`app/admin/pipeline/[id]/PageClient.tsx`, « ⚑ Signalé »). La supprimer
retirerait une information visible côté admin **sans équivalent** : le grade
est propriétaire seul, aucune surface admin ne peut le lire. Décision au lot
mobile.

**Lot A partenaire — PARKÉ.** Le mirror
`20260904130334_partner_athlete_profile_perimetre_elargi.sql` a été appliqué
en prod et commité (`f570bd6`) par une autre session, alors que BP l'avait
gelé dans le fil pipeline. BP arbitre le périmètre **dans le fil partenaire**,
pas ici. Vérifié le 2026-09-04 : la fonction vivante projette 61 colonnes et
**aucune** de la liste interdite. Dette connue : `ouvert_cegep_*` manque au
tableau du garde-fou `DO $$` — consigné en P3.

**Dettes P3 consignées** dans `docs/post-launch-bugs.md` pendant ce chantier :
- les 6 FK nues des 3 tables recruteur (aucun `ON DELETE CASCADE`) ;
- `ouvert_cegep_*` absent du garde-fou partenaire ;
- retour anticipé avant les hooks dans `page.tsx:979`
  (`if (IS_CAPACITOR) return …`) → **35 violations `rules-of-hooks`**, refactor
  dédié requis. Inoffensif en pratique (`IS_CAPACITOR` est une constante de
  build), mais il rend le fichier illisible au lint : une vraie violation
  d'ordre de hooks y passerait inaperçue ;
- `flagged` : donnée conservée, UI recruteur retirée, nettoyage mobile à venir.

**Piège de signature à connaître :** `user_has_pro(uid uuid default auth.uid())`
**accepte un argument et l'ignore** — son corps appelle `get_user_tier()`, qui
teste `auth.uid()`. Ne jamais écrire `user_has_pro(recruiter_id)` en croyant
interroger ce recruteur-là. Même défaut que `is_approved_partner`.

---

## 5. Règles de travail en vigueur

**PROTOCOLE WEB-D'ABORD** (`CLAUDE.md`, section « RÈGLES TRANSVERSES DE
SESSION »). Tout chantier se construit et se valide sur le **web uniquement**.
Aucun code mobile, aucun `build:mobile`, aucun `cap sync`, aucun émulateur
tant que BP n'a pas déclaré le chantier web **terminé**. Le tronc partagé
(`lib/`) est permis ; son branchement mobile attend le lot mobile.

**BP pousse.** Les commits se font en local, jamais de `git push`. La pile
part en une fois, sur décision de BP — et elle peut contenir des commits
d'autres sessions (voir §1).

**Toute DDL passe par un mirror + un gate.** Le fichier de migration est
écrit et présenté **en entier** à BP avant `apply_migration` ; après
application, il est renommé sur le timestamp assigné par MCP, puis vérifié en
lecture seule (schéma, contraintes, `pg_policies`, triggers, RLS), sortie
brute au rapport.

**Encodage.** `Set-Content` est interdit (double encodage CP1252 silencieux).
Balayer le mojibake après chaque écriture — et aussi les **caractères
invisibles**, qui sont un piège distinct.

Pendant ce chantier, une regex de normalisation d'accents a reçu de vraies
marques combinantes Unicode à la place de la séquence d'échappement qui
devait les désigner. Le fichier restait valide, `tsc` passait, le balayage
mojibake ne voyait rien — et la classe de caractères était devenue
illisible pour un humain. Corrigé en passant à la classe Unicode nommée
`p{Diacritic}`, qui s'écrit en ASCII pur et se relit.

**Le contrôle à faire après chaque écriture de fichier** : signaler tout
caractère dont le point de code vérifie `ord(c) < 9`, `13 < ord(c) < 32`,
`0x0300 <= ord(c) <= 0x036F`, ou `ord(c) in (0x200B, 0xFEFF)`.

Deux causes vues, à connaître : une séquence d'échappement mal transmise
(un niveau d'antislash est mangé au passage par le shell — écrire ce genre
de contenu avec l'outil fichier, pas par heredoc), et un copier-coller de
texte accentué décomposé. Ce document lui-même a déclenché l'alerte à sa
première écriture, dans la phrase qui décrit le piège.

**Git destructif interdit** sur l'arbre partagé : jamais `stash`,
`checkout --`, `reset`, `clean`, `restore`. En cas de doute : STOP et demander.
