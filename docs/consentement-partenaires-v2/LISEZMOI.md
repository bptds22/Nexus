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

## Avis au parent d'un 14–17 ans (BP 2026-10-19)

`avis_parent_partenaires.portee` dit ce qui a été accordé, et le courriel `send-avis-parent-partenaires`
l'écrit :

| Portée | Quand | Courriel |
|---|---|---|
| `CARTE` | accord « carte » (client 1.4.4, surfaces carte seule) | texte d'avant |
| `V2` | premier accord, donné en v2 | carte + vidéos + réseaux ; réseaux publics |
| `EXTENSION_V2` | accord carte déjà donné, étendu par le jeune | « partage aussi ses vidéos et ses réseaux » |

L'extension avise le parent **même si c'est lui qui avait accordé la carte** (il n'a pas accordé les
vidéos). Au plus un avis d'extension par 24 h ; mêmes exclusions qu'avant (moins de 14 ou 18 et plus,
sans courriel parent, désabonné). Aperçu des 3 courriels : `mode: "test"` de la fonction, avec
`portee: "V2"` ou `"EXTENSION_V2"`.

## Textes

Source unique : `lib/legal/partnerMediaCopy.ts` — `PARTNER_MEDIA_COPY` (v2, validé BP) et
`PARTNER_MEDIA_COPY_V1` (historique, encore affiché sur les surfaces « carte seule »). Carte plein écran :
`TEXTES_V2` dans `lib/partenaires/consentementV2.ts`.

**Politique de confidentialité 2026-10-v2** (validée BP + avocat, 2026-10-19) : section 7.5,
`content/legal/confidentialite.ts`. Le PDF de l'appli (`assets/legal/confidentialite.pdf`) est régénéré ;
il doit être téléversé (étape b2 ci-dessous), sinon l'appli montre l'ancienne politique.

## Aussi dans ce lot : la demande d'accès Loi 25 (migration `20261019230000`)

Le bouton « Demander » des paramètres recruteur insérait dans `admin_notifications` (RLS sans policy) :
refus à chaque fois, et l'écran disait « envoyée ». Désormais `demander_acces_mes_donnees()` inscrit la
demande dans `loi25_portability_requests` (onglet Portabilité de `/admin/loi25`, échéance 30 jours,
pas de doublon). L'écran ne dit « envoyée » qu'en cas de succès.

## Tests faits (base jetable, copie de la locale, état prod reproduit)

- Empreintes d'avant = prod (relevé 2026-10-19) : `delete_my_account` 2c1ad094…,
  `partner_athlete_profile` 496104a7…, `top_athletes_view` 1a4bd466….
- `20261018150000` : application → rollback (empreintes retrouvées, `portee` retirée) → réapplication : OK.
  `20261019230000` : application → rollback → réapplication : OK.
- 34 étapes par rôle (JWT réels, transaction annulée) : v1 → vidéos/réseaux masqués ; OUI v2 → visibles
  (fiche ET `top_athletes_view`) ; retrait → 0 ligne ; nouvel accord v1 → masqués de nouveau ; NON journalisé,
  rien retiré ; « Plus tard » ×3 et règle des 3 jours ; moins de 14 ans → parent avisé → accord parental v2 ;
  anon / athlète refusés sur l'état, la table, le push, les stats ; push : mauvais nombre refusé, heures
  calmes refusées, envoi puis 0 cible au second aperçu.
- Avis au parent : accord v1 → `CARTE` ; extension → `+ EXTENSION_V2` ; premier accord v2 → un seul avis `V2` ;
  carte parentale puis extension par le jeune → `EXTENSION_V2`. Deux requêtes pg_net en file, annulées.
- Demande d'accès : inscrite (`access`, `pending`, échéance +30 j), redemande → `deja`, anon refusé.
- Sauvegardes : athlète (une colonne à la fois et groupé) et coach — aucune erreur ; `http://` refusé par la
  contrainte (le client écrit toujours `https://`).
- `check-view-hardening.sql` : 0 écart.

## Mise en ligne — ORDRE (BP 2026-10-19)

**a. Migrations en prod — BP, par psql.** Les deux fichiers dans UNE transaction (une garde qui échoue
annule tout). Ils ne s'inscrivent pas dans `schema_migrations` (comme les précédentes du lot).

```powershell
# Depuis la racine du dépôt (branche feat/visites-mode-match, après la fusion). Fichiers testés ?
Get-FileHash -Algorithm MD5 supabase\migrations\20261018150000_athlete_reseaux_sociaux.sql, supabase\migrations\20261019230000_demande_acces_donnees.sql
#   20261018150000_athlete_reseaux_sociaux.sql  @@MD5_150@@
#   20261019230000_demande_acces_donnees.sql    @@MD5_230@@

$env:PGCLIENTENCODING = "UTF8"
psql "<chaîne de connexion session pooler, comme pour W2/W3>" -v ON_ERROR_STOP=1 -1 `
  -f supabase/migrations/20261018150000_athlete_reseaux_sociaux.sql `
  -f supabase/migrations/20261019230000_demande_acces_donnees.sql
```

Sortie attendue : `DO`, `ALTER TABLE`, `CREATE …` — **aucune ERROR**. Une ERROR = rien n'est écrit.
Vérification après (lecture seule) : `select to_regclass('public.consentement_partenaire_v2'),
to_regprocedure('public.demander_acces_mes_donnees()');` → deux valeurs non nulles.
Rollbacks : `supabase/rollback/20261018150000_…` puis `20261019230000_…` (même commande, `-f` du rollback).

**a2. Juste après a (GO BP) : déployer la fonction `send-avis-parent-partenaires`.** Elle lit la nouvelle
colonne `portee` : la déployer AVANT la migration la ferait échouer ; la laisser à l'ancienne version
enverrait le texte « carte » pour une extension.

**b. Merge dans `main`, puis Promote Vercel** — le web avec la 7.5 et la v2, ensemble.

**b2. Avec b (GO BP) : téléverser la politique en PDF** pour l'appli — `node scripts/upload-legal-pdfs.mjs`
(`.env.local` de prod). Sans cela, l'appli montre l'ancienne politique.

**c. 1.4.5 dans les deux magasins.**

**d. Push v2 aux athlètes — BP, à la main, APRÈS la sortie de c** (voir « Le push unique »), jamais entre
21 h et 8 h.

**Base locale de BP** : elle porte l'ANCIENNE version de `20261018150000` (colonnes, sans v2). Pour passer à
la nouvelle : l'ancien rollback (historique git de ce fichier, commit `f481d45b`), puis les deux migrations —
quand personne ne teste sur la base locale.
