# Handoff — 3 grosses features (session fraîche)

> Écrit par CC à la fin de la passe UI solo (#8/#9/#11 livrés + poussés sur
> `feat/messaging-athlete-coach`, commit `942c81a`). Les 3 features ci-dessous
> ont été **décidées** avec BP mais reportées à une session fraîche : elles
> touchent des flux de données non triviaux (édition parcours + RLS, partage
> natif, sélecteur riche multi-contexte) et méritent chacune leur propre passe
> avec build + preuve. Ordre suggéré : #7 (isolé, UI pure) → #6 (natif, isolé)
> → #5 (le plus lourd, RLS).

---

## #7 — Sélecteur d'athlète riche (compose messaging)

**Intent.** Dans les composeurs de message, remplacer le choix d'athlète
texte/dropdown par des **cartes tappables** : photo + nom + position + étoiles
(cote_globale_entraineur) + sport. Réutiliser le pattern visuel `AthleteInfoCard`.

**Portée (2 contextes).**
- **coach → recruteur** : quand un coach écrit à un recruteur *au sujet d'un
  athlète*, il sélectionne l'athlète via la grille de cartes.
- **coach → coach** : idem quand la conversation est au sujet d'un athlète.

**Specs décidées.**
- Carte = pattern `AthleteInfoCard` (photo `AthletePhotoFill` + fallback
  initiales, nom, pill position, 5 étoiles gold `#F59E0B`/`#4a4d56`, sport).
- Source de données = les athlètes du coach courant (`coach_id = self`), même
  requête que le roster (`app/coach/athletes`). Pas de nouvel appel réseau si
  on peut réutiliser le hook roster.
- État sélectionné : bordure `#E63946` + fond `#E63946]/10` (cohérent avec la
  sélection dans `TransfertAthletesMobile`).
- Mobile + web. Mobile prioritaire (cible QA Capacitor).

**Fichiers de départ.**
- Composeurs : `app/coach/messages/nouveau` (ou l'équivalent compose coach→X ;
  vérifier le vrai chemin — messaging a bougé). `grep -rn "nouveau" app/coach`.
- Carte de référence : `grep -rn "AthleteInfoCard" components` pour le pattern.
- Roster query réutilisable : `app/coach/athletes/_data/loadAthleteFromSupabase.ts`.

**Risque.** Faible (UI pure, pas de schéma). Le seul piège : brancher la valeur
sélectionnée au bon champ de la conversation (`athlete_id`) au submit.

---

## #6 — Visite planifiée : « Ajouter au calendrier » (mobile natif)

**Intent.** Sur une visite planifiée (statut `VISITE_PLANIFIEE`), un bouton
**« Ajouter au calendrier »** génère un `.ics` et l'ouvre via la **feuille de
partage native** Capacitor.

**Specs décidées.**
- Générer le `.ics` **en mémoire** (string VCALENDAR/VEVENT) — pas d'écriture
  serveur. Champs : `SUMMARY` (Visite — {athlète} / {école}), `DTSTART`/`DTEND`
  (date de la visite), `LOCATION` (école/cégep), `DESCRIPTION`.
- Partage : `@capacitor/share` est **déjà installé** (vu dans `cap sync` :
  `@capacitor/share@8.0.1`). Écrire le `.ics` dans un fichier temp via
  `@capacitor/filesystem` (aussi installé, `8.1.2`) puis `Share.share({ url })`
  → feuille native → « Ajouter au calendrier » y apparaît.
- Web (non-Capacitor) : fallback `Blob` + `<a download>` classique. Gater sur
  `IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true"`.

**Fichiers de départ.**
- Là où le statut `VISITE_PLANIFIEE` s'affiche côté athlète/coach/recruteur :
  `grep -rn "VISITE_PLANIFIEE" components app`.
- Helper `.ics` : nouveau `lib/utils/buildIcs.ts` (fonction pure, testable).
- Plugins déjà présents — voir la liste `cap sync` (share + filesystem).

**Risque.** Faible-moyen. Piège : format de date `.ics` (UTC `YYYYMMDDTHHMMSSZ`)
+ écriture Filesystem sur iOS (utiliser `Directory.Cache`). Tester sur iPhone
réel : la feuille de partage ne se teste pas au simulateur de façon fiable.

---

## #5 — Coach édite le parcours (historique d'équipe de SES athlètes)

**Intent.** Un coach peut éditer l'**historique de parcours / team-history**
d'un athlète dont il est responsable. Le directeur (is_school_admin) inclus via
l'autorité d'école. Web + mobile.

**Specs décidées.**
- Édition complète du parcours (les entrées d'historique d'équipe de l'athlète),
  pas seulement l'équipe courante.
- **Autorité** : coach `coach_id = self` sur l'athlète **OU** directeur
  (`is_school_admin = true`) dont l'école = `athletes.school_id`. Cette 2e voie
  passe par l'autorité d'école, pas par `coach_id`.
- **⚠️ RLS À VÉRIFIER AVANT DE CODER L'UI.** La table du parcours doit
  autoriser UPDATE/INSERT/DELETE pour ces deux rôles. Confirmer la table réelle
  (`teams` ? une table `athlete_team_history` ? `league_teams` ?) et ses
  policies AVANT. Suivre la MIGRATION SAFETY CHECKLIST du CLAUDE.md :
  diagnostic-first, RLS via `SECURITY DEFINER` helper (jamais un subquery `users`
  brut dans la policy), preuve par-rôle (`SET ROLE authenticated` + allow/deny/
  cross-tenant). **Local d'abord ; prod seulement sur GO explicite de BP.**
- Web + mobile ; réutiliser le pattern du wizard `modifier` coach si l'édition
  parcours y a déjà une étape.

**Fichiers de départ.**
- Où le parcours s'affiche : `grep -rn "parcours\|team.history\|historique" components app`.
- Table réelle : `grep -rn "athlete_team_history\|league_teams\|teams" lib supabase`
  puis confirmer contre la prod live (list_tables) — ne pas se fier à un snapshot.
- Wizard existant : `app/coach/athletes/[id]/modifier/`.

**Risque.** ÉLEVÉ — c'est la seule des trois qui touche la DB + RLS + prod.
Ne PAS bundler la migration avec du code app avant preuve par-rôle locale.
Traiter en dernier, dans sa propre session, avec les deux builds verts avant commit.

---

### État du build de test au moment du handoff
- Branche `feat/messaging-athlete-coach`, commit `942c81a` poussé.
- `.env.local` → CLOUD (`nrloizyemulbhujrqhgx`). Prod SAINE (crise RLS close).
- Bundle iOS (`ios/App/App/public/`) synchronisé, custody 3/3 signatures OK.
- Reste à faire côté BP : Run Xcode sur iPhone réel + checklist 7 points
  (4 clics routing vague 1 + les 3 fixes de cette passe).
