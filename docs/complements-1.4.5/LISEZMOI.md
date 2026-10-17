# Compléments 1.4.5 — `20261017010000` (2026-10-16)

Deux corrections serveur, un seul lot, une seule transaction.

## A. Période de non-contact sur les cartes prospect partenaire (point 5)

**Aujourd'hui** : les périodes de non-contact se règlent dans `/admin/blackouts` (« Périodes de
silence », table `blackout_periods` : libellé, sport ou tous, promotions min/max, dates incluses,
actif). Elles ne bloquent que l'écriture **recruteur ↔ athlète** (triggers sur `conversations` et
`messages`, RLS « contactable », boutons de la fiche et des fils). Les cartes prospect partenaire
n'étaient pas couvertes.

**Ajout** :
- `non_contact_carte(sport, promotion) → (date_fin, libelle)` — la règle de `get_active_blackout`
  (actif, date de Montréal, sport nul = tous, bornes de promotion ; promotion nulle = couverte).
- `partenaire_prospect_lien` refuse de créer ou de remplacer le lien pendant la période :
  `NEXUS: Période de non-contact jusqu'au {date}` (42501), **avant** toute écriture.
- Écran (web et appli, même page) : « Envoyer par texto », « Nouveau lien » grisés avec
  « Période de non-contact jusqu'au {date} » ; dans la feuille d'envoi, texto, partage et copies
  grisés.

## B. « Autre équipe » ≠ « mon effectif » (point 10)

`lookup_invitable_athletes_by_email` : un athlète déjà dans l'effectif du coach (avec compte) ne lève
plus `exists_exact` (« Il fait partie d'une autre équipe ») ; nouveau drapeau `exists_mine`, sans PII.
Écran de création (web `/coach/athletes/create`, appli `AthleteWizardMobile`) : « Cet athlète est
déjà dans ton effectif », création bloquée (pas de doublon). Colonne de retour ajoutée → DROP +
CREATE, droits rétablis à l'identique ; l'appli 1.4.4 ignore la colonne.

## Point 9 (coach choisi) : option A, côté écran seulement — hors migration

Le coach choisi est remplacé par l'entraîneur-chef **par conception** : doctrine T3 du 2026-09-09
(`20260909133830_responsable_equipe_vague2`) — `athletes.coach_id` est le **responsable** de l'équipe,
recalculé par `trg_team_athletes_referent` à chaque arrivée et par `trg_team_coaches_referent` à chaque
changement de staff. Corriger `_apply_team_attachment_core` seul ne sert à rien (le trigger repose le
chef juste après — banc B2 en échec).

**Décision BP du 2026-10-17 (option A)** : on garde la doctrine. La LISTE « Mon coach » est retirée
partout où l'athlète la voyait — onboarding web (`/athlete/onboarding`), paramètres web
(`/athlete/parametres` : plus de « Changer », « Retirer », « Sélectionner un coach »), onboarding et
paramètres de l'appli. À la place, en lecture seule : « Ton entraîneur-chef : X », seulement si cet
entraîneur-chef est nommable (`coachs_nommables_equipe`) ; sinon, rien. Règle partagée :
`lib/athlete/entraineurChef.ts` ; ligne : `components/athlete/EntraineurChefLecture.tsx`. **Aucun
changement en base ni à l'aiguillage des recruteurs.**

## Fichiers

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20261017010000_complements_1_4_5.sql` | la migration (md5 `d95f608347271299b8e66eabc5c32669`, LF, sans BOM) |
| `supabase/rollback/20261017010000_rollback_complements_1_4_5.sql` | remet les deux fonctions d'origine, retire `non_contact_carte` et la version |
| `tests-complements-1-4-5.sql` + `-resultats.txt` | banc local, transaction annulée : **20 ok / 0 échec** |
| `enregistrer-local.sql` | enregistrer la version dans l'historique LOCAL après un `psql -f` |
| `prod/empreinte-objets.sql` | empreinte des trois fonctions (corps, config, droits) |
| `prod/construire-lot.mjs` | construit `lot-prod.sql` et `lot-preuve-garde-fausse.sql` |
| `prod/lot-prod.sql` | **le lot de prod** (md5 `762ad1c2dce9d4146003db7bdc0a116a`) — empreinte attendue `d27ddde2d5470cb0474760351e5be455` (3 éléments) |
| `prod/preuve-locale.txt` | garde fausse → tout annulé ; lot réel → appliqué, md5 = fichier ; second envoi refusé ; banc 20/0 ; rollback puis ré-application → OK |

## Mise en prod (sur GO de BP seulement)

Relevé avant (lecture seule, fait le 2026-10-16) : les deux fonctions remplacées ont, en prod, la
même empreinte qu'en local (`4f00ff22…`, `5b5b9089…`) et les mêmes droits ; `non_contact_carte` absente.
Par le connecteur Supabase (`execute_sql`, pas `apply_migration` : le lot enregistre lui-même sa
version), `prod/lot-prod.sql` **tel quel, en un seul appel**, après vérification de son md5. Puis, en
lecture seule : les fonctions, leurs droits et l'empreinte. **Avant le push du code** (sinon l'écran
lit une fonction absente — sans casse : aucune période affichée, et le lien reste créé comme avant).
