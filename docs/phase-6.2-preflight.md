# Phase 6.2 — Pré-flight discovery

**Date** : 2026-05-11
**État** : post-Bloc 1+2 (Phase 6.1 complete, 6 commits livrés : 684eeb8 + 5a6bcb0 + ec5d0a2 + c563423 + 181e725 + 206d474)
**Méthode** : `Grep` ripgrep sur `app/`, `components/`, `lib/` + `Read` ciblés

---

## 1. coach/athletes/create breakdown

**Fichier principal** : [app/coach/athletes/create/page.tsx](../app/coach/athletes/create/page.tsx) — **1599 lignes, monolithique** (pas de sous-composants).

**Champ email** :
- Type def : [page.tsx:38](../app/coach/athletes/create/page.tsx#L38) — `email: string;` dans le type `IdentityForm`
- Initial state : [page.tsx:182](../app/coach/athletes/create/page.tsx#L182) — `phone: "", email: ""`
- Input rendered : [page.tsx:748-749](../app/coach/athletes/create/page.tsx#L748) — `<input type="email" value={d.email} onChange={...} placeholder="athlete@email.com" />`
- Validator : aucun explicite (zod/regex). Seulement le `type="email"` natif HTML.
- Submit usage : [page.tsx:500](../app/coach/athletes/create/page.tsx#L500) — `email: form.identity.email || null`

**Submit handler** : [page.tsx:435](../app/coach/athletes/create/page.tsx#L435) — `async function handleSubmit()`.

**League team query** (civil branch) : [page.tsx:310](../app/coach/athletes/create/page.tsx#L310) — `.from("league_teams")` (1 ref `league_team_id`, à migrer en Phase 6.2.c).

**Refacto requis pour la greffe invitation par email** :
- Pre-submit hook : lookup `users` (et `athletes`) par email avant `handleSubmit()` (nouveau, ~30 lignes)
- Branching modal si match trouvé (nouveau, ~80 lignes — utiliser pattern UpgradeModal cf. §3)
- Submit standard si pas de match (handleSubmit existant, inchangé pour le path nominal)

**Estimation greffe seule** : **3-4h** (lookup + modal + branching + handler tests).

---

## 2. `/coach/decouvrir` — refs entrantes à cleanup

**Fichier à supprimer** :
- [app/coach/decouvrir/page.tsx](../app/coach/decouvrir/page.tsx) — **655 lignes**, civil-only orphan-search page (5.5e-ii + 5.5e-iv-a)

**Refs entrantes** :
- [CoachSidebar.tsx:80-84](../app/coach/components/CoachSidebar.tsx#L80) — `DECOUVRIR_ITEM` defined
- [CoachSidebar.tsx:89](../app/coach/components/CoachSidebar.tsx#L89) — used in `CIVIL_ITEMS` array
- Aucune autre référence externe (page se référence elle-même via mot "découvrir" dans son propre texte UI à la ligne 383 — irrelevant)

**Estimation cleanup** : **30 min** (DELETE page + retirer DECOUVRIR_ITEM + retirer de CIVIL_ITEMS).

---

## 3. Modals — pattern à réutiliser

**Pas de shadcn `Dialog`/`Sheet`** dans le codebase. Nexus utilise des modals **custom** stylés directement.

**Pattern dominant** (10 fichiers utilisent ce pattern) :
```tsx
<div className="fixed inset-0 z-[200] flex items-center justify-center px-4" onClick={onClose}>
  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
  <div className="relative bg-[#1A1D24] border border-[#E63946]/30 rounded-2xl ..."
       onClick={(e) => e.stopPropagation()}>
    {/* content */}
  </div>
</div>
```

**Référence canonique** : [components/ui/UpgradeModal.tsx](../components/ui/UpgradeModal.tsx) (180 lignes) — bonne base avec props typés, close button, backdrop click handler, escape gracieux si `!open`.

**Autres exemples** où ce pattern apparaît (à mimer/réutiliser pour la greffe invitation) :
- `app/coach/equipes/[teamId]/page.tsx` (Add Athlete + Add Coach modals)
- `app/coach/decouvrir/page.tsx` (Invite confirm modal — qu'on va supprimer, mais le code est un bon modèle pour la greffe)

**Recommandation pour 6.2.c** : créer un composant inline (style UpgradeModal) ou un nouveau `components/coach/AthleteEmailLookupModal.tsx` réutilisable.

---

## 4. Refs aux tables legacy — état actuel vs audit 6.0

| Pattern | Audit 6.0 | Actuel | Delta |
|---|---|---|---|
| `from('leagues')` | 5 | 5 | 0 (stable) |
| `from('league_coaches')` | 8 | 8 | 0 (stable) |
| `from('league_teams')` + `league_teams!` embed | ~15 | 15 | 0 (stable) |
| `from('league_team_athletes')` | 3 | 3 | 0 (stable) |
| `league_team_id` (colonne refs) | ~90 | **71** | -19 (compte plus précis) |
| `coach_league` (fichiers) | 5 | 4 | -1 (mock admin peut-être moins peuplé) |
| `'ligue_civile'` (refs) | ~45 | **48** | +3 (mineur) |
| `isCivil`/`isLeagueCoach` (fichiers) | ~10 | 8 | -2 |

**Verdict** : les counts sont **stables vs audit 6.0**. Aucun code applicatif touché depuis l'audit (Bloc 1+2 = DB only). L'effort estimé 12-15h reste **confirmé**.

**Détail des 19 fichiers avec `league_team_id` refs** :
- `app/onboarding/page.tsx` (7)
- `app/coach/decouvrir/page.tsx` (11) → ces refs disparaissent quand on supprime le fichier en 6.2.b
- `app/athlete/onboarding/page.tsx` (10) → wizard refacto en 6.2.a
- `components/shared/AthleteRecruiterProfileBody.tsx` (7) → composant cross-portail
- `app/coach/equipes/[teamId]/page.tsx` (5) → civil branch refacto en 6.2.e
- `app/athlete/profil/page.tsx` (4)
- `app/coach/equipes/page.tsx` (4)
- `app/athlete/parametres/page.tsx` (3)
- `app/athlete/notifications/_components/PendingInvitations.tsx` (3) → déjà connu (greffé en 5.5e-iv-b)
- `app/coach/athletes/_data/loadAthleteFromSupabase.ts` (3)
- `app/recruteur/pipeline/page.tsx` (3)
- `lib/utils/profileCompletion.ts` (2)
- `app/recruteur/favoris/page.tsx` (2)
- `app/recruteur/recherche/page.tsx` (2)
- `app/athlete/layout.tsx` (1)
- `app/coach/ecole/analytics/page.tsx` (1)
- `app/coach/athletes/create/page.tsx` (1)
- `app/coach/components/CoachSidebar.tsx` (1)
- `components/coach/CivilCoachPicker.tsx` (1)

---

## 5. Wizard paths confirmés

| Path | Lignes | Notes |
|---|---|---|
| [app/onboarding/page.tsx](../app/onboarding/page.tsx) | **2381** | Wizard coach/recruteur — monolithique, énorme. Branchings sur `onboardingRole === 'coach_league'` + `context === 'ligue_civile'` |
| [app/athlete/onboarding/page.tsx](../app/athlete/onboarding/page.tsx) | 1018 | Wizard athlete + inline `CivilTeamPicker` |
| [app/athlete/onboarding/layout.tsx](../app/athlete/onboarding/layout.tsx) | (existe) | Layout léger |
| [app/auth/page.tsx](../app/auth/page.tsx) | (existe) | Signup principal + context selector |
| [app/auth/pro/page.tsx](../app/auth/pro/page.tsx) | (existe) | Pro signup form (scolaire/collegial/ligue_civile) |
| [app/auth/pending/page.tsx](../app/auth/pending/page.tsx) | (existe) | Post-signup waiting (branchings sur `coach_league`) |
| [lib/supabase/auth.actions.ts](../lib/supabase/auth.actions.ts) | (existe) | Server actions — context param |

**Pas de dossier `app/onboarding/steps/` ni `app/onboarding/components/`** — tout est inline dans le monolithe.

---

## 6. `findOrCreateLeague` callers

**Fichier helper** : [lib/onboarding/findOrCreateLeague.ts](../lib/onboarding/findOrCreateLeague.ts) (91 lignes)

**Callers** (1 seul) :
- [app/onboarding/page.tsx:10](../app/onboarding/page.tsx#L10) — import statement
- [app/onboarding/page.tsx:2087](../app/onboarding/page.tsx#L2087) — invocation `await findOrCreateLeague({ ... })`

**Plan** :
- (a) **DELETE le fichier** + retirer l'import + remplacer l'invocation par un `findOrCreateSchool` unifié (LIGUE_CIVILE type) qui devra être créé.
- (b) Alternative : inliner la logique dans le caller (90 lignes → moins de file count).

Mon vote : **(a)** — pattern `findOrCreateSchool({ name, type, ... })` unifié sera utile aussi pour les écoles si on simplifie le wizard plus tard.

---

## 7. Composants `Civil*` — état actuel

### 7.1 Composants existant en fichier dédié

| Composant | Path | Lignes | Usage |
|---|---|---|---|
| `CivilCoachPicker` | [components/coach/CivilCoachPicker.tsx](../components/coach/CivilCoachPicker.tsx) | 224 | Importé dans [app/athlete/parametres/page.tsx:7](../app/athlete/parametres/page.tsx#L7), rendu à `parametres/page.tsx:712` (section "Mon coach" civil athletes) |

### 7.2 Composants inline (dans monolithes)

- `CivilTeamPicker` inline dans [app/athlete/onboarding/page.tsx:73](../app/athlete/onboarding/page.tsx#L73) — sera à fusionner avec le sélecteur école dans 6.2.a
- `CivilTeamRow` type inline dans le même fichier
- `CivilLeagueRow` type inline dans [app/onboarding/page.tsx:1773](../app/onboarding/page.tsx#L1773)
- `CivilAthlete` + `CivilTeamHeader` types inline dans [app/coach/equipes/[teamId]/page.tsx:47, 65](../app/coach/equipes/[teamId]/page.tsx#L47)
- `CivilTeam` interface inline dans [app/coach/equipes/page.tsx:27](../app/coach/equipes/page.tsx#L27)

### 7.3 Actions proposées

| Composant | Action | Justification |
|---|---|---|
| `CivilCoachPicker` (fichier) | **Refactor** : query → `team_coaches` + `school_coaches` (unifié) au lieu de `league_coaches`; rename → `TeamCoachPicker` ou `CoachSelector` | Composant cross-context post-unification. La logique du picker reste valable, juste change la source de données. |
| `CivilTeamPicker` inline | **Fusionner** avec le sélecteur école | Wizard 6.2.a |
| Types `CivilTeamRow`, `CivilLeagueRow`, `CivilAthlete`, `CivilTeamHeader`, `CivilTeam` | **Rename** → `TeamRow`, `LeagueRow`, `Athlete*`, `TeamHeader`, `Team` | Suppression du préfixe Civil — le modèle est unifié |
| `isCivil` state + branching | **Garde le boolean** comme dérivation de `schools.type === 'LIGUE_CIVILE'`, simplifie les branches | UI terminologie context-aware reste — c'est T1=ligue, T2=nom seul, T3=Établissement |

---

## 8. Surprises / risques nouveaux post-Bloc 1+2

### 8.1 Counts stables vs audit 6.0

Aucune surprise majeure. Le code applicatif n'a pas été touché entre l'audit 6.0 et maintenant (Bloc 1+2 = DB only). Les ~165 refs estimées tiennent.

### 8.2 Monolithes massifs à refactor

Surprise modeste : **3 fichiers > 1000 lignes** à toucher :
- `app/onboarding/page.tsx` (2381 lignes) — wizard coach/recruteur
- `app/coach/athletes/create/page.tsx` (1599 lignes) — création athlète + greffe invitation
- `app/athlete/onboarding/page.tsx` (1018 lignes) — wizard athlete

Le refacto de ces 3 fichiers représente probablement **50% de l'effort Phase 6.2**. Risque de régression école élevé sur les 2 premiers — tests manuels essentiels.

### 8.3 Pas de shadcn Dialog usage

Toutes les modals sont **custom** (pattern `fixed inset-0` + backdrop blur). Pas un risque mais une convention à respecter pour la greffe invitation en 6.2.c.

### 8.4 Données civiles seedées dépendantes du modèle

Le seed 6.1.d a créé des rows pour Coach 1 + Coach 2 (`00000000-0000-4000-b000-000000000001/2`) qui n'ont pas de mot de passe `auth.users` → **login impossible sans création manuelle via Studio**. Ça impacte les tests UI : si on veut tester en navigateur le flow coach civil après Phase 6.2, soit on utilise `testsignup@gmail.com` (legacy mais valide), soit Bruno crée les seed coaches dans Studio Auth UI.

### 8.5 `league_team_athletes` legacy trigger drop oublié dans 6.1.e ?

Vérifié : en 6.1.e on a `DROP TRIGGER reset_athlete_anchor_on_team_remove ON public.league_team_athletes` — déjà fait. Pas de surprise.

### 8.6 `coach/ecole/analytics` lit `league_team_id`

Trouvé une ref orpheline : [app/coach/ecole/analytics/page.tsx:134](../app/coach/ecole/analytics/page.tsx#L134) lit `league_team_id` dans son SELECT alors que c'est une page **école-only**. Probablement un copy/paste qui ne sert à rien post-unification. À cleanup en 6.2 (low priority).

---

## 9. Plan d'attaque finalisé pour 6.2.a-g

Découpage proposé pour ~12-15h en 7 sous-commits :

| Sub-commit | Scope | Effort | Risque |
|---|---|---|---|
| **6.2.a** | Wizard onboarding civil/école unifié (`app/onboarding/page.tsx` + `app/athlete/onboarding/page.tsx` + `auth.actions.ts`) — fusionner les 2 wizards autour de `schools.type` | 4-5h | **High** (régression école) |
| **6.2.b** | DELETE `/coach/decouvrir` page + retirer DECOUVRIR_ITEM de sidebar + remplacer par le flow invitation par email dans `/coach/athletes/create` | 30min | Low |
| **6.2.c** | Greffe invitation par email dans `coach/athletes/create` (lookup + modal + branching) | 3-4h | Medium (nouveau flow) |
| **6.2.d** | Refactor `app/coach/equipes/[teamId]/page.tsx` civil branch → unified (lit `teams` + `team_coaches` + `team_athletes` peu importe le `schools.type`) | 2h | Medium (régression école) |
| **6.2.e** | Refactor `app/coach/equipes/page.tsx` civil branch + `CoachSidebar.tsx` CIVIL_ITEMS unifié | 1-2h | Medium |
| **6.2.f** | Refactor `CivilCoachPicker` + `AthleteRecruiterProfileBody` + recruteur (`recherche` / `favoris` / `pipeline` / `partenaire`) | 2-3h | Medium (cross-portail) |
| **6.2.g** | Cleanup final : DELETE `findOrCreateLeague` + `lib/utils/profileCompletion.ts` adjustments + `lib/mock/admin.ts` + suppression `coach_league` role transient + cleanup `coach/ecole/analytics` orphan ref | 1h | Low |

**Total estimé** : **13-17h** (légèrement au-dessus de l'estimation initiale 12-15h, surtout à cause du wizard monolithe 2381 lignes).

**Ordre obligatoire** :
- 6.2.a en premier (sinon les nouveaux signups civils ne fonctionnent plus)
- 6.2.b avant 6.2.c (la greffe invitation par email remplace le flow Découvrir)
- 6.2.d-e après 6.2.a (les pages equipes lisent les rows que le wizard crée)
- 6.2.f indépendant (peut être fait en parallèle de d/e)
- 6.2.g en dernier (cleanup)

---

**Pré-flight complete.** Aucun fichier modifié.
