# Lot D1 — les universités seront-elles visibles ? (audit du 2026-10-28)

Question de BP : les 12 universités et 84 équipes du lot D1 doivent rester invisibles pour tous les
utilisateurs actuels, web prod ET mobile 1.4.5 déjà installé (qui lit la base directement).

**Réponse : NON, pas sans fermeture.** Sans rien de plus, elles apparaîtraient dans plusieurs listes (web et
mobile) et sur la page publique /college. Fermeture proposée : **D1a** (base, policies RESTRICTIVE) + **correctif
web /college**, tous deux AVANT l'apply D1.

## Méthode
- **Base (prod, lecture seule)** : policies de `schools` / `teams`, les 70 fonctions non trigger et 19 triggers
  qui les lisent, les vues, les tâches cron.
- **Code** : toutes les lectures `.from("schools" | "teams")` de `app/`, `components/`, `lib/` sur origin/main
  (web, 152 lectures) et sur f481d45b (binaires 1.4.5, 151 lectures), classées : écriture (12), par identifiant (86),
  filtrée par type (26, toutes en liste blanche `eq` / `in`, aucune en `neq`), **liste ouverte (27)** relues à la main.
  Les fonctions edge ne lisent ni l'une ni l'autre table.
- **Preuve D1a** : matrice « ce que chaque rôle voit » avec une université témoin, avant / après la migration, en
  local puis en prod (rejeu à blanc).

## Le fond du problème (base)
- `schools public read` = `true` pour tous les rôles, anonyme compris : toute lecture d'écoles sans filtre de type
  rend les universités.
- `Recruiters see teams` : un RECRUTEUR lit TOUTES les équipes. Les autres rôles ne lisent les équipes que par
  liste blanche de types (SECONDAIRE, CEGEP, LIGUE_CIVILE) : UNIVERSITE n'y est pas.
- Matrice mesurée AVANT D1a, une université témoin en base : anonyme, athlète, parent, coach, recruteur,
  partenaire voient tous l'école ; le recruteur voit aussi son équipe.

## Endroit par endroit (sans D1a → avec D1a)

| Endroit | Lecture | Sans D1a | Avec D1a |
|---|---|---|---|
| Inscription athlète web — sélecteur d'école | `SchoolSelect` filterType SECONDAIRE (+ CEGEP sous ON) | filtré par type | invisible |
| Inscription athlète mobile 1.4.5 | copies locales de la recherche sur `schools` | à risque (lecture de toutes les écoles) | invisible |
| Inscription coach (école, civil) | wizard filtré par contexte ; `finish_coach_*` valident le type | filtré par type | invisible |
| Inscription recruteur (web, mobile) | `.eq("type","CEGEP")` ; `finish_recruiter_onboarding` exige CEGEP | filtré par type | invisible |
| Transfert / Mon équipe (web et mobile) | `loadSchools()` + `SchoolSelect` sans filterType | **visible** | invisible |
| Coach — modifier une fiche (liste d'écoles) | `.from("schools").select("id, name")` toutes | **visible** | invisible |
| Recruteur — paramètres, profil | `useSchoolsList` / liste complète | **visible** | invisible |
| Listes d'équipes, recherche d'équipe (recruteur) | `teams` lisible en entier par un recruteur | **visible** | invisible |
| Listes d'équipes (athlète, coach, parent, partenaire) | policies par type | filtré par type | invisible |
| Trouve ton cégep, cartes prospect | `.in("type", …)` liste blanche | filtré par type | invisible |
| Filtres Région (partenaire) | valeurs de `region` seulement | rien de nouveau (régions déjà présentes) | invisible |
| Page publique `/college/[école]` et `/college/[école]/[équipe]` | **clé service** (contourne RLS), par id OU par nom (`ilike`) | **visible par URL** | **visible par URL → correctif web** |
| Sitemap | liste statique de pages | absent | absent |
| Classements, matchs, carte des matchs, calendrier recruteur | partent des matchs ; la veille ne charge pas le secteur Universitaire ; 0 match relié | invisible | invisible |
| `matchs_suggestions`, `matchs_recherche`, agenda partenaire / unité | partent des matchs à venir | invisible | invisible |
| Code d'équipe (`create_team_join_token`, `resolve_*_token`) | exige un coach de l'équipe ; aucun coach ne peut s'y rattacher (porte B + verrou D0) | invisible | invisible |
| Newsroom (`partner_newsroom_events`) | événements de fiches athlètes ; aucune fiche universitaire possible (verrou D0) | invisible | invisible |
| Notifications | aucun trigger d'avis sur `teams` / `schools` (seulement resync du sport, porte coach) | aucune | aucune |
| Recherche / fiches / favoris / pipeline recruteur, partenaire | partent des fiches athlètes | invisible | invisible |
| Vues `top_athletes_view`, `trending_athletes_view` | fiches athlètes | invisible | invisible |
| Admin (listes, fiches) | `is_admin()` | visible (voulu) | visible (voulu) |
| `deactivate_stale_orphan_teams` | ne vise que les saisons passées ; pas en cron | sans effet | sans effet |

## La fermeture
1. **D1a — `20261028010000_cegep_lot_d1a_universites_masquees`** : `ids_universites()` (lue sans RLS) et deux
   policies RESTRICTIVE `universites_masquees` en SELECT sur `schools` et `teams` : une ligne universitaire n'est
   lisible que par un admin. Couvre TOUTE lecture directe, web et mobile 1.4.5, sans toucher au code installé.
   Rejeu : après D1a, 0 / 0 pour anonyme, athlète, parent, coach, recruteur, partenaire ; 1 / 1 pour l'admin ;
   mêmes nombres d'écoles et d'équipes ordinaires pour chaque rôle ; lecture la plus large (recruteur, toutes les
   équipes) inchangée en temps.
2. **Correctif web** (clé service) : `loadSchoolPageForRender` exclut UNIVERSITE ; `loadTeamPageForRender` rend
   « introuvable » pour une équipe universitaire. Vérifié en local : 404 pour l'université témoin (par id, par nom,
   par équipe), 200 pour un cégep. À fusionner ET promouvoir avant D1.
3. **Ordre** : D1a (apply) → correctif web (merge + promotion) → D1 (apply).
4. **D2** élargira les deux policies (recruteur universitaire, sous `lancement_universitaire`) et devra ajouter un
   filtre de type aux listes ouvertes ci-dessus avant ON.

Écarté : importer avec un état caché (`is_active = false`). La plupart des fonctions et des listes ignorent
`is_active`, et `schools` n'a pas d'état équivalent.
