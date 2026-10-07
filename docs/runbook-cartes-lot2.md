# Runbook — lot 2 cartes (web) — 2026-10-07

Branche `feat/cartes-lot2-web`. **Rien en prod sans le GO explicite de BP.**
Prérequis : lot 1 en prod (`20261007193918`, fait le 2026-10-07).

> **BASE EXÉCUTÉE le 2026-10-07** (~20:15 UTC, GO BP) — version enregistrée
> **`20261007201544`**. AVANT : `9282c3a4…`, ACL `{authenticated,postgres,service_role}`.
> APRÈS : `7b7ca7b0…` (= fichier), même ACL, empreinte agrégée des 353 autres
> fonctions `public` identique avant/après (`d5ac08f4…`). Lecture seule : 2 cartes
> prod sans courriel ni téléphone restent refusées (22023), 3 cartes téléphone
> seulement deviennent acceptées. **Web : merge dans `main` local, à pousser et
> promouvoir par BP.**

## Ordre
1. **Base** : `apply_migration` de
   `supabase/migrations/20261007201544_carte_renvoi_telephone.sql`, puis renommer
   le fichier (et son rollback) à la version enregistrée.
2. **Web** : merge, push et promotion Vercel par BP. L'ordre compte : le web
   d'avant n'appelle jamais la RPC pour une carte sans courriel ; le web
   d'après, sur une base non migrée, verrait la copie d'une carte téléphone
   seulement répondre « La copie n'a pas pu être notée à l'historique »
   (le texte est copié quand même).

## Avant (lecture seule)
```sql
select md5(pg_get_functiondef('public.journaliser_renvoi_invitation(uuid)'::regprocedure)) brut,
       (select proacl::text from pg_proc where oid = 'public.journaliser_renvoi_invitation(uuid)'::regprocedure) acl;
-- attendu (2026-10-07) : 9282c3a429ab53f46c3931106e8e7a04 |
--   {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```

## Après
```sql
-- Même requête : brut 7b7ca7b0bc844c715281adadaf6ca1f1 si le fichier est appliqué
-- tel quel (commentaires du corps compris) ; sinon comparer sans commentaires.
-- ACL : liste complète triée {authenticated,postgres,service_role} (le bloc DO
-- de la migration lève sinon).
```

## Vérification à la main (web, compte recruteur Pro)
1. Carte sans courriel → Infos → Courriel « Ajouter » → fenêtre « Envoyer
   l'invitation ? » → « Annuler » : rien d'enregistré.
2. Même chose → « Enregistrer et inviter » : message « Nexus envoie
   l'invitation à … » (ou la mention neutre). **Un vrai courriel part : seulement
   avec le GO d'envoi de BP.**
3. Carte avec courriel → « Modifier » : ligne d'aide, pas de fenêtre.
4. Carte téléphone seulement → en-tête du panneau : « Copier le texte », pas de
   « Renvoyer l'invitation » ; Historique : « a renvoyé l'invitation par ton
   propre canal ».
5. « Ajouter un prospect » avec téléphone seulement → « Carte créée » + encadré.

## Rollback
`supabase/rollback/20261007201544_rollback_carte_renvoi_telephone.sql` —
republie la fonction prod d'avant (`9282c3a4…`, testé en transaction). Le web
du lot 2 continue de fonctionner : seule la trace d'une copie téléphone seulement
échoue (message « n'a pas pu être notée »).
