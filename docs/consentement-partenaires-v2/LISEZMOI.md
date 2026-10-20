# Consentement partenaires v2 — vidéos et réseaux sociaux (1.4.5)

Décision BP 2026-10-19. Migration `20261018150000_athlete_reseaux_sociaux` (réécrite : elle n'était
pas en prod) + rollback. Branche `feat/1.4.5-reseaux`.

## La règle

| Situation de l'athlète | Le partenaire voit |
|---|---|
| aucun accord | rien (comme avant) |
| accord v1 (carte) | la fiche comme avant, **sans** vidéos ni réseaux |
| accord v2 | la fiche **avec** les 5 liens vidéo et les 4 réseaux |
| retrait | rien (comme avant) |

- Un accord v2 ne vaut que s'il est **au moins aussi récent** que le dernier accord : un retrait puis
  un nouvel accord sur un client 1.4.4 (texte v1) fait retomber en v1.
- **Qui pose la v2 : la base.** Tout accord `image_partenaire` journalisé dans `consent_audit_trail`
  avec la politique `2026-10-v2` vaut v2 (déclencheur `trg_consentement_partenaire_v2_sur_audit`),
  quel que soit le chemin : athlète, parent (portail), carte plein écran, paramètres, inscription.
- **Surfaces « carte seule »** (bloc de la carte de prospect, « Accepter » d'une notification, lien
  courriel du parent, reprise d'une inscription commencée avant la v2) : elles ne montrent que la
  carte, elles journalisent `2026-10-v2+carte` — **pas** v2. On ne lie pas le partage des vidéos au
  fait de recevoir une évaluation.
- La ligne `athletes` n'est **jamais** écrite pour la v2 (table `consentement_partenaire_v2`) : aucun
  des 22 déclencheurs d'`athletes` ne part (ni activité recruteur, ni newsroom, ni avis au parent).

## La demande (BP : « carte plein écran, pas un bandeau »)

- **Qui** : tout athlète inscrit (onboarding terminé), ACTIF ou EN_ATTENTE, sans v2 valide — accord
  v1, jamais répondu, ou « Non » avant. « Non » à la carte v2 = plus jamais relancé.
- **Quand** : à l'ouverture (web : connexion ou rechargement ; appli : lancement et retour au premier
  plan), si `consentement_partenaire_v2_etat().a_afficher`.
- **« Plus tard »** : revient après au moins 3 jours, 3 fois au plus ; ensuite seulement dans les
  paramètres (« Partager aussi mes vidéos et mes réseaux »).
- **Moins de 14 ans** : « Oui » envoie la demande au parent (notification `CHILD_PARTNER_VISIBILITY_REQUEST`,
  texte v2) ; le parent accorde dans son portail (texte v2 → v2).
- **« Non »** ne retire **rien** : un accord v1 reste (la carte), seules les vidéos et les réseaux restent cachés.
  Journalisé (`REFUSED`, `consent_version: 2`).

## Le push unique (hors heures calmes)

À lancer **après la sortie de la 1.4.5 dans les deux magasins** (une 1.4.4 ouvrirait l'accueil, sans carte) :

```sql
select public.consentement_partenaire_v2_pousser(null);           -- aperçu : nombre de cibles, heures calmes ?
select public.consentement_partenaire_v2_pousser('ENVOYER N');    -- N = le nombre EXACT de l'aperçu
```

Refusé entre 21 h et 8 h (heure du Québec). Un athlète ne le reçoit qu'une fois (`push_le`). Respecte la
désactivation des « Rappels ». Le toucher ouvre `/athlete/consentement-partenaires` (carte sans « Plus tard »).
Exécutable par `postgres` et `service_role` seulement.

## Compteur admin

`/admin/loi25` → Consentements : « Ont accepté la v2 », « Ont refusé », « Pas encore répondu »
(dont v1, dont « Plus tard » épuisés), « Attente du parent », push envoyés.
RPC `admin_consentement_partenaire_stats()` (admin seulement).

## Textes

Source unique : `lib/legal/partnerMediaCopy.ts` — `PARTNER_MEDIA_COPY` (v2) et `PARTNER_MEDIA_COPY_V1`
(historique, encore affiché sur les surfaces « carte seule »). Carte plein écran : `TEXTES_V2` dans
`lib/partenaires/consentementV2.ts`.

**Politique de confidentialité, section 7.5 : PAS modifiée** (« ne PAS modifier sans accord BP +
counsel »). Proposition à valider — voir le rapport de session. Tant qu'elle n'est pas appliquée, la
page affiche « Version 2026-10-v2 » avec le texte 7.5 de la v1.

## Tests faits (base jetable, copie de la locale, état prod reproduit)

- Empreintes d'avant = prod (relevé 2026-10-19) : `delete_my_account` 2c1ad094…,
  `partner_athlete_profile` 496104a7…, `top_athletes_view` 1a4bd466….
- Application → rollback (empreintes retrouvées) → réapplication : OK.
- 34 étapes par rôle (JWT réels, transaction annulée) : v1 → vidéos/réseaux masqués ; OUI v2 → visibles
  (fiche ET `top_athletes_view`) ; retrait → 0 ligne ; nouvel accord v1 → masqués de nouveau ; NON journalisé,
  rien retiré ; « Plus tard » ×3 et règle des 3 jours ; moins de 14 ans → parent avisé → accord parental v2 ;
  anon / athlète refusés sur l'état, la table, le push, les stats ; push : mauvais nombre refusé, heures
  calmes refusées, envoi puis 0 cible au second aperçu.
- Sauvegardes (point 3) : athlète (une colonne à la fois et groupé) et coach — aucune erreur ; `http://` refusé
  par la contrainte (le client écrit toujours `https://`).
- `check-view-hardening.sql` : 0 écart.

## Appliquer en prod (BP, psql)

Fichiers (md5 de la copie de travail, CRLF) :
- `supabase/migrations/20261018150000_athlete_reseaux_sociaux.sql` — `d8601cdf3f890cc0ce8e93fb7bb2dca3`
- `supabase/rollback/20261018150000_rollback_athlete_reseaux_sociaux.sql` — `17cb84de091e83ebac3d45cf59ea1ecb`

En une transaction (`psql -v ON_ERROR_STOP=1 -1 -f …`) ; les gardes de tête refusent toute base qui n'a pas
les corps relevés. Le fichier ne s'inscrit pas dans `schema_migrations` (comme les précédentes du lot).

**Ordre** : migration en prod → push du code web (main) → AAB/IPA 1.4.5 → après la sortie : le push.

**Base locale de BP** : elle porte l'ANCIENNE version de `20261018150000` (colonnes, sans v2). Pour passer à
la nouvelle : l'ancien rollback (copie : historique git de ce fichier), puis la nouvelle migration — à faire
quand personne ne teste sur la base locale.
