# Écran mural — /admin/ecran (preuves locales, 2026-10-22)

Base Docker locale, serveur de production du worktree (`next build` + `next start -p 3010`),
navigateur Playwright SANS INTERFACE. Aucune capture d'écran du poste de BP.

| Fichier | Contenu |
|---|---|
| `ecran-3440x1440.png` | La page à 3440×1440 : 1440 px de haut, aucun défilement, aucun menu ni barre. |
| `ecran-1920x1080.png` | La page à 1920×1080 : 1080 px de haut, aucun défilement. |
| `reponse-api-admin.json` | Réponse exacte de `GET /api/admin/ecran` pour l'admin : des nombres, l'heure du calcul et des libellés de semaine. |
| `acces-journal.txt` | Admin (deux tailles), coach (redirigé vers `/`, API 403) et anonyme (redirigé vers `/auth`, API 401), avec le corps exact. |
| `controle-main.sql` | Chaque chiffre recalculé à la main en SQL, sans le code de la route, à l'instant du calcul, `timezone = America/Toronto`. |
| `controle-main-resultat.txt` | Sa sortie : identique à la réponse de l'API, chiffre pour chiffre. |

## Données personnelles dans la réponse de l'API

Balayage de la réponse : `@` = 0, UUID = 0, courriels = 0. Sur les valeurs seules (sans
les clés JSON) : 0 prénom, 0 nom. Avec les clés, deux faux positifs : des comptes de test
locaux s'appellent « Coach » et « Parent », mots présents dans les clés `valide_coach`
et `invitations_parent`.

Le reste de la page (fournisseurs globaux de l'app, pas l'écran) lit toujours le compte
de l'admin connecté lui-même : `/auth/v1/user` et `/rest/v1/users?id=eq.<lui-même>`.

## Définitions retenues

- 7 derniers jours = `[maintenant − 7 jours, maintenant)` à la même heure murale de Montréal.
- Semaines du lundi 00:00, heure de Montréal ; la semaine en cours est plus pâle.
- Mouvements dans le processus = `recruiter_activity_log`, `action_type = 'PIPELINE_CHANGED'`.
- Suivi des cartes prospect = `cartes_prospect_journal` sans `CREEE`, `NOTE`, `MODIFIEE`.
- Notes de match et messages : ceux écrits par un compte RECRUTEUR.
- Recruteurs actifs = au moins une de ces actions dans la fenêtre : vue, favori, mouvement,
  message, note de match, suivi de carte.
- Consentements v2 = `admin_consentement_partenaire_stats()` : « Sans réponse » compte les
  athlètes admissibles sans réponse v2, pas seulement les lignes de la table.
- Clé de service (après la garde) : `cartes_prospect_journal`, `parent_invitations`,
  `deletion_requests`, `match_notes` — aucune règle d'accès admin sur ces 4 tables.
