# Runbook — mise en prod du lot 1 cartes (2026-10-07)

Branche `fix/cartes-lot1-base`. **Rien en prod sans le GO explicite de BP.**
Jamais un mardi ou un mercredi avant 5 h : au plus tôt **jeudi 2026-10-08, 5 h**.

Contenu :
- `supabase/migrations/20261005192511_carte_sport_athlete.sql` — DÉJÀ en prod
  (renommage du fichier seulement, rien à appliquer).
- `supabase/migrations/20261007190000_cartes_lot1_parent_prenom_invitation.sql`
  — à appliquer : COURRIEL_PARENT_CARTE restauré, `prenoms_proches`,
  invitation à l'ajout d'un courriel (`trg_carte_z_inviter_ajout`), une
  invitation par carte, colonne `cartes_prospect_invitations.signataire`,
  journal INVITATION au nom du signataire.
- `supabase/functions/send-invitation-carte/traiter.ts` — le nom du recruteur
  = `coalesce(invitation.signataire, carte.cree_par)`, lu à part.
- Rollback : `supabase/rollback/20261007190000_rollback_cartes_lot1_parent_prenom_invitation.sql`.

## 0. Avant (lecture seule)

```sql
-- État de départ attendu (relevé 2026-10-07)
select p.proname, md5(pg_get_functiondef(p.oid)) brut,
       md5(btrim(regexp_replace(regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g'), '\s+', ' ', 'g'))) norm,
       p.proacl::text
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('rapprochement_candidats','cartes_prospect_inviter','cartes_prospect_journaliser','prenoms_proches')
 order by 1;
```

| fonction | attendu AVANT |
|---|---|
| cartes_prospect_inviter | brut `dcdfcf1d5b1ac549b290780520957d2b` |
| cartes_prospect_journaliser | brut `d0c93b9009bb82bba84ad72c03ea7bde` |
| rapprochement_candidats | norm `38baae70b54ea47bed2dc4b991a1d616` |
| prenoms_proches | absente |
| ACL des trois | `{postgres=X/postgres,service_role=X/postgres}` |

Un écart = quelqu'un a touché la prod depuis le relevé : **arrêter**, relever,
réconcilier avant d'appliquer.

```sql
-- Aucune invitation en vol (sinon attendre qu'elle soit traitée)
select statut, count(*) from public.cartes_prospect_invitations group by 1;
```

## 1. Ordre de déploiement — BASE D'ABORD, puis l'edge function

Prouvé en local le 2026-10-07 (`scripts/cartes-lot1-preuves/7-preuve-signataire.mjs`) :

| ordre | ce qui se passe dans la fenêtre | dégât |
|---|---|---|
| **base puis edge** (retenu) | l'ancienne edge function ignore `signataire` : une invitation née d'un AJOUT part au nom du **créateur** ; le journal (base migrée) la signe déjà au nom du **collègue**. Écart cosmétique, limité aux ajouts de courriel faits pendant la fenêtre. | aucun |
| edge puis base | la nouvelle edge function lit `signataire` à part ; la colonne manque → erreur 42703 absorbée → nom du créateur. L'envoi part. | aucun |
| *(écarté)* lire `signataire` DANS le `select` de la réclamation | PostgREST rejette toute la requête (42703) : la ligne reste `A_ENVOYER`, l'invitation ne part pas. | invitation bloquée |

Les deux ordres sont donc sûrs avec le code livré ; « base d'abord » est
retenu parce que la nouvelle fonction a alors tout ce qu'elle lit dès son
premier appel. Déployer l'edge function **aussitôt après** l'apply.

## 2. Apply (MCP, jamais `db push`)

1. Renommer le fichier à la version que `apply_migration` enregistrera
   (`supabase/migrations/<version>_cartes_lot1_parent_prenom_invitation.sql`),
   et le nom du rollback en conséquence ; corriger l'en-tête (« APPLIQUÉE
   en prod le … sous cette version »).
2. `apply_migration` avec le contenu exact du fichier, nom
   `cartes_lot1_parent_prenom_invitation`. Le bloc `DO` final lève une
   exception — et annule tout — si une ACL, la colonne, les triggers ou les
   contrôles de sens de `prenoms_proches` ne sont pas conformes.

## 3. Vérifications post-apply (sorties brutes au rapport)

```sql
-- Fonctions : empreintes normalisées = fichier, ACL en liste complète
select p.proname,
       md5(btrim(regexp_replace(regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g'), '\s+', ' ', 'g'))) norm,
       p.proacl::text, p.provolatile, p.proconfig::text
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('rapprochement_candidats','cartes_prospect_inviter','cartes_prospect_journaliser','prenoms_proches')
 order by 1;
-- attendu : 4 lignes, chaque proacl = {postgres=X/postgres,service_role=X/postgres}
-- norm attendues (base locale migrée, 2026-10-07 — valables tant que le
-- fichier n'a pas changé) :
--   cartes_prospect_inviter      ac643a1003688259ab950cea2d71b57c
--   cartes_prospect_journaliser  ddec7fd255c0633053307cb1bf65d044
--   prenoms_proches              270871285cec0357db39220b954f9f5b
--   rapprochement_candidats      34946548e0a73eec1b4a291cdea47391
-- (normalisées : carte_sport_athlete est arrivée en prod SANS ses commentaires,
--  d'où la comparaison sans eux ; si le fichier change, relever à nouveau en local)

-- ACL en liste triée (forme du gate)
select pr.proname, array_agg(t.g order by t.g)
  from pg_proc pr, lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') g
                              from unnest(pr.proacl::text[]) x) t
 where pr.pronamespace = 'public'::regnamespace
   and pr.proname in ('rapprochement_candidats','cartes_prospect_inviter','cartes_prospect_journaliser','prenoms_proches')
 group by 1 order by 1;
-- attendu : {postgres,service_role} × 4

-- Triggers
select tgname, pg_get_triggerdef(oid) from pg_trigger
 where tgrelid = 'public.cartes_prospect'::regclass and not tgisinternal order by tgname;
-- attendu : trg_carte_z_inviter (AFTER INSERT) ET trg_carte_z_inviter_ajout
--   (AFTER UPDATE OF courriel … WHEN ((COALESCE(btrim(old.courriel), '') = '')
--    AND (COALESCE(btrim(new.courriel), '') <> ''))), tous les autres inchangés

-- Colonne
select column_name, data_type, is_nullable from information_schema.columns
 where table_schema = 'public' and table_name = 'cartes_prospect_invitations' and column_name = 'signataire';
-- attendu : signataire | uuid | YES
select conname, confdeltype from pg_constraint
 where conrelid = 'public.cartes_prospect_invitations'::regclass and contype = 'f' and confrelid = 'public.users'::regclass;
-- attendu : une ligne, confdeltype = 'n' (on delete set null)

-- Migration enregistrée
select version, name from supabase_migrations.schema_migrations where version >= '20261007';
```

## 4. Edge function `send-invitation-carte`

1. `get_edge_function` : relever la version déployée et son `verify_jwt`
   (appelée par pg_net avec un secret d'en-tête — garder la valeur actuelle).
2. `deploy_edge_function` avec **tous** les fichiers : `index.ts`,
   `traiter.ts`, `email.ts`, `config.ts`, `../_shared/emailLayout.ts`,
   `../_shared/jetonDesabonnement.ts`, même `verify_jwt`.
3. `get_edge_function` à nouveau : version incrémentée, `traiter.ts` contient
   `lireSignataire`.

## 5. Vérification à blanc (lecture seule)

```sql
select r.critere, r.force, count(*) from public.rapprochement_candidats(null, null) r group by 1, 2;
-- relevé 2026-10-07 : 0 candidat (6 cartes, 0 avec parent_courriel). Tout
-- candidat qui apparaît : le lire paire par paire avant de conclure.
```

**Aucun envoi réel de courriel pour tester** sans un GO séparé de BP.

## 6. Ce que BP vérifie à la main sur le web

Avec un recruteur Pro de son unité et un collègue de la même unité :
1. **Ajout de courriel** : carte créée sans courriel ; le collègue ajoute le
   courriel dans Infos → Historique de la carte : « Modifiée » puis, après
   envoi, « Invitation » **au nom du collègue** ; l'invitation reçue nomme
   le collègue. *(Seulement avec le GO d'envoi réel : sinon s'arrêter à la
   ligne `A_ENVOYER` lue en SQL.)*
2. **Adresse déjà inscrite** ajoutée à une carte : mention neutre « non
   envoyée », aucune invitation.
3. **Courriel changé** après une invitation : rien ne part (une seule ligne
   dans `cartes_prospect_invitations` pour la carte).
4. **Rapprochement** : une carte « Mathis X » dans l'équipe d'un athlète
   « Mathys X » → proposition « Possiblement le même athlète », ligne
   « Prénom : Mathis sur la carte, Mathys sur Nexus » dans la fenêtre.
   *(Nécessite un tel athlète en prod — ne pas en fabriquer un.)*
5. Créer une carte AVEC courriel : comportement inchangé.

## 7. Rollback

Seulement si un défaut bloque. Ordre : la base, puis (facultatif)
l'edge function.

1. `apply_migration` (ou `execute_sql` dans une transaction) avec
   `supabase/rollback/<version>_rollback_cartes_lot1_parent_prenom_invitation.sql`.
   Il republie les définitions prod d'avant le lot (inviter et journaliser
   **octet pour octet**, rapprochement = `20261005192511`), retire le trigger
   d'ajout, `prenoms_proches` puis la colonne `signataire`, et repasse le
   gate d'ACL. Testé en local en transaction (`5-rollback-en-transaction.sql`)
   et pour de vrai.
2. Vérifier : section 0 (empreintes AVANT retrouvées), trigger d'ajout
   absent, colonne absente.
3. L'edge function nouvelle **peut rester** : sans la colonne, elle envoie
   au nom du créateur (prouvé, scénario « edge puis base »). La redéployer à
   l'ancienne n'est utile que pour revenir à l'identique.

Ce que le rollback ne défait pas : les invitations déjà parties, les lignes
de journal déjà écrites, les propositions déjà créées (leurs critères sont
valides avant comme après). La valeur `signataire` des invitations déjà nées
est perdue.
