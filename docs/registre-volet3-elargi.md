# Registre — volet 3 ÉLARGI : rendre l'intérim visible côté serveur

**Statut : RÉDIGÉ ICI, NON ÉCRIT, NON APPLIQUÉ.** Aucun fichier
`supabase/migrations/*`. Le volet 3 attend le déblocage D6 comme les volets 5
et 6 — `supabase db reset` échoue à 324 migrations, quatre migrations portent
des assertions sur des données de prod, quatre empreintes `md5(prosrc)`
divergent local↔prod.

---

## ⚠️ À LIRE AVANT TOUT — ce que ce volet ne règle PAS

Le diagnostic du 2026-09-13 a établi, preuves en base, que **les trois
symptômes rapportés n'ont PAS pour cause la non-reconnaissance de l'intérim** :

| Symptôme rapporté | Ce que la base montre |
|---|---|
| L'intérim ne reçoit jamais les messages de l'athlète | Le message EST dans le fil `b686c8f2` ; push parti `sent:2, failed:0` |
| Les messages de l'intérim ne produisent aucune push | Push parti `sent:3, failed:1, removed:1` — FCM a accepté |
| Les propositions n'arrivent pas dans « À traiter » | 0 suggestion `EN_ATTENTE` : elles sont REJETÉES dans la même microseconde, note système « Édition directe (transition vieux client mobile) » |

`notify_on_message` résout `ATHLETE_COACH` par `array[c.coach_id,
v_athlete_user]` et **n'énumère aucun rôle**. `get_coach_athletes` joint
`team_coaches` **sans filtrer le rôle**. L'intérim passe déjà dans les deux.

**Ne pas présenter ce volet comme le correctif de ces symptômes.** Il corrige
des limitations réelles, mais d'un autre ordre.

---

## Ce que le volet 3 corrige réellement

### 1. `is_team_head_coach` → REFERENT_ROLES

```sql
-- aujourd'hui
AND tc.role = 'head_coach'
-- après
AND tc.role IN ('head_coach', 'head_coach_interim')
```

**Périmètre EXACT : deux policies, pas une de plus.** `is_team_head_coach` n'a
que deux appelants, tous deux sur `team_coaches` — `team_coaches scoped insert`
et `team_coaches scoped update`. Ce que ça débloque : **un intérim peut gérer
le staff de son équipe** (ajouter, retirer, changer un rôle). Aujourd'hui il ne
peut pas. C'est tout ce que cette fonction gouverne.

### 2. `_apply_team_attachment_core`

Énumère `head_coach` sans l'intérim. Gouverne le rattachement d'un athlète à
une équipe. À élargir sur la même liste.

### 3. `finish_coach_school_onboarding` et `finish_coach_civil_onboarding`

Mêmes énumérations, à l'onboarding. Un coach promu intérimaire avant d'avoir
terminé son onboarding retombe dans un chemin qui ne le reconnaît pas.

### 4. `is_coach_of_athlete` — LE morceau structurel

```sql
-- aujourd'hui : le propriétaire, et RIEN d'autre
select exists (select 1 from athletes a
                where a.id = target_athlete and a.coach_id = auth.uid())
```

Aucun chemin par l'équipe. **Un coach rattaché par équipe seulement — le geste
même qu'on met en avant à l'athlète sans entraîneur — a ses suggestions
filtrées en silence.**

C'est exactement le « bloc restant à rédiger » que la passation range sous le
volet 6. **À écrire en l'ALIGNANT sur `get_coach_athletes`** (owner ∪ équipe ∪
école), pas en réinventant la condition — sinon deux définitions du périmètre
coexisteront et divergeront.

Ce défaut ne mord pas sur le compte de test actuel : l'intérim y est AUSSI
`athletes.coach_id`. Il mordra sur tout intérim rattaché uniquement par
l'équipe.

---

## Le tableau de référence

| Objet | Intérim | Gouverne |
|---|---|---|
| `fn_resolve_team_referent` | ✅ | Résolution du référent |
| `trg_team_coaches_referent` | ✅ | Trigger de référent |
| `get_coach_athletes` | ✅ (joint sans filtrer le rôle) | Périmètre athlètes |
| `notify_on_message` | ✅ (n'énumère aucun rôle) | Push |
| `is_team_head_coach` | ❌ | 2 policies `team_coaches` |
| `team_coaches scoped insert` / `update` | ❌ | Gestion du staff |
| `_apply_team_attachment_core` | ❌ | Rattachement d'équipe |
| `finish_coach_school_onboarding` | ❌ | Onboarding école |
| `finish_coach_civil_onboarding` | ❌ | Onboarding civil |
| `is_coach_of_athlete` | ⚠️ owner seulement | RLS des suggestions |

---

## Vérification après apply

```sql
-- 1. aucune fonction ne doit plus exclure l'intérim
select p.proname,
       case when pg_get_functiondef(p.oid) ilike '%head_coach_interim%'
            then 'OK' else 'EXCLUT ENCORE' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and pg_get_functiondef(p.oid) ilike '%head_coach%';

-- 2. is_coach_of_athlete doit désormais couvrir le chemin ÉQUIPE
--    (à jouer sous l'identité d'un intérim rattaché SANS être athletes.coach_id)
```

Puis, sur appareil : l'intérim doit pouvoir ouvrir le staff de son équipe et y
agir.

---

## Passe 1.4.2 — CLIENT, sans migration

Six filtres `role === "head_coach"` excluent l'intérim. Ce sont des
**affichages** et un choix de destinataire — aucun n'est en cause dans les
symptômes ci-dessus, mais tous mentent sur qui dirige l'équipe :

| Fichier | Ligne | Effet |
|---|---|---|
| `app/coach/ecole/page.tsx` | 267 | `headIds` — l'intérim n'est pas compté comme chef |
| `app/coach/ecole/page.tsx` | 283 | `find(role === 'head_coach')` — chef d'équipe affiché vide |
| `app/coach/equipes/page.tsx` | 405 | `headCoach` du libellé d'équipe |
| `components/shared/AthleteOnboardingMobile.tsx` | 799 | **Choix du coach destinataire** — retombe sur `teamCoaches[0]` |
| `components/shared/teams/TeamPickerSheet.tsx` | 50 | « Nom du coach-chef, ou null » |
| `app/admin/schools/[id]/PageClient.tsx` | 407 | Promotion de rôle côté admin |

Le plus significatif est `AthleteOnboardingMobile:799` : il choisit à qui
l'athlète est rattaché à l'inscription. Le repli `?? teamCoaches[0]` le sauve
d'un `null`, mais l'ordre est arbitraire — un intérim peut ne pas être choisi
alors qu'il dirige l'équipe.

`app/coach/equipes/page.tsx:271` et `CoachEquipesMobile.tsx:152` traitent DÉJÀ
l'intérim correctement — ne pas les toucher.
