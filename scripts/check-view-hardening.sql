-- ═══════════════════════════════════════════════════════════════════════════
-- check-view-hardening.sql — contrôle de conformité du durcissement des vues
--
-- ZÉRO LIGNE = CONFORME. Toute ligne rendue est un écart à corriger.
--
-- POURQUOI CE FICHIER EXISTE
-- --------------------------
-- `CREATE OR REPLACE VIEW` EFFACE les `reloptions` que la nouvelle définition
-- ne redéclare pas. Un `ALTER VIEW ... SET (security_invoker = true)` posé un
-- jour tombe donc SILENCIEUSEMENT à la première redéfinition ultérieure qui
-- omet la clause `WITH` — sans erreur, sans avertissement, sans log.
--
-- Mécanisme prouvé le 2026-08-19 (probe local, objet jetable) :
--
--   create view _probe as select 1 as x;
--   alter view _probe set (security_invoker = true);  -- {security_invoker=true}
--   create or replace view _probe as select 1 as x;   -- NULL  ← RÉINITIALISÉ
--
-- Cas réel : `top_athletes_view` a été durcie le 2026-07-07
-- (`harden_top_athletes_view`, `WITH (security_invoker = true)`), puis
-- réinitialisée le 2026-08-18 par `top_athletes_view_genre` — une migration
-- qui ne parlait que d'ajouter une colonne. Six semaines sans que rien ne le
-- signale.
--
-- Le linter Supabase porte bien une règle `security_definer_view`, mais elle
-- ne distingue pas le DEFINER VOULU du DEFINER ACCIDENTEL : elle signale aussi
-- `trending_athletes_view`, qui est conforme. Une alerte qui crie sur du
-- conforme finit ignorée. Ce contrôle-ci encode l'INTENTION, donc il ne parle
-- que quand quelque chose a vraiment bougé.
--
-- QUAND LE LANCER
-- ---------------
-- Après CHAQUE migration touchant une vue, en prod comme en local.
--
--   prod   : via l'outil SQL Supabase, ou psql sur la base distante
--   local  : docker cp scripts/check-view-hardening.sql supabase_db_Nexus:/tmp/ \
--            && docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus \
--                 psql -U postgres -d postgres -f /tmp/check-view-hardening.sql
--            (lancer le `docker exec` depuis PowerShell, pas git-bash —
--             MSYS réécrit /tmp/... en chemin Windows)
--
-- MAINTENANCE
-- -----------
-- Toute vue ajoutée au schéma `public` doit être inscrite dans `attendu`
-- ci-dessous, avec son intention. Une vue absente de cette liste n'est PAS
-- contrôlée — l'oubli est silencieux, comme la régression qu'on cherche à
-- prévenir.
--
-- La garde active (`assert_view_hardening()` levant une exception en fin de
-- migration) est volontairement REPORTÉE au chantier RLS partenaire : c'est là
-- que les attendus seront déclarés de toute façon.
-- ═══════════════════════════════════════════════════════════════════════════

with attendu(vue, invoker_attendu, motif) as (values
  -- INVOKER : la RLS des tables de base suffit, la vue ne doit rien contourner.
  ('athlete_view_details',     true,  'durcie 2026-06-16 (secure_athlete_view_details)'),
  ('athlete_coaches',          true,  'durcie 2026-07-07 (convert_low_risk_views_to_invoker)'),
  ('athlete_views_weekly',     true,  'durcie 2026-07-07 (convert_low_risk_views_to_invoker)'),
  ('athlete_visibility_stats', true,  'durcie 2026-07-07 (convert_low_risk_views_to_invoker)'),

  /* ── top_athletes_view : ATTENDU CHANGÉ LE 2026-08-19, INVOKER → DEFINER ──
     Elle a été INVOKER de juillet au 18 août (régression), restaurée en INVOKER
     le matin du 19, puis REMISE en DEFINER le soir — délibérément.

     LA RAISON, à ne pas re-litiger : INVOKER est la bonne posture quand la RLS
     de la table de base a la BONNE GRANULARITÉ. Pour `athletes`, elle ne l'a
     pas — la RLS est par LIGNE, l'exposition est COLONNAIRE. Tant qu'une
     politique partenaire existait sur `athletes`, les 87 colonnes des lignes
     visibles étaient lisibles en PostgREST direct : email 29/29,
     date_naissance 29/29 (mineurs compris), nom_parent 29/29 — mesuré en
     runtime sous JWT partenaire. Aucun GRANT colonne ne pouvait corriger ça :
     les partenaires partagent le rôle `authenticated` avec les entraîneurs et
     les recruteurs.

     Refermer a donc exigé de SUPPRIMER cette politique (point 5b du chantier
     RLS partenaire). Une vue INVOKER en dépendait : elle ne verrait plus
     aucune ligne. Pour le chemin partenaire, DEFINER avec gate interne est la
     posture FORTE — c'est elle qui permet de maîtriser la PROJECTION, ce que
     la RLS ne sait pas faire.

     Accès restreint par REVOKE anon + gate is_approved_partner(auth.uid())
     dans le WHERE : un non-partenaire authentifié lit 0 ligne. */
  ('top_athletes_view',        false, 'DEFINER assume 2026-08-19 (top_athletes_view_back_to_definer)'),

  -- DEFINER ASSUMÉ : ses CTE agrègent recruiter_athlete_views et
  -- recruiter_favorites, et AUCUNE de ces deux tables n'a de politique
  -- partenaire. En INVOKER, les CTE rendraient 0 ligne → tous les deltas à 0
  -- → le `.gt("views_delta", 0)` de la page filtrerait tout → /partenaire/
  -- tendances vide en permanence, sans erreur. L'accès est restreint par
  -- REVOKE anon + le gate is_approved_partner(auth.uid()) dans le WHERE.
  ('trending_athletes_view',   false, 'DEFINER assume 2026-07-07 (harden_trending_athletes_view)')
),
reel as (
  select a.vue,
         a.invoker_attendu,
         a.motif,
         c.oid is not null as vue_existe,
         (select o.option_value
            from pg_options_to_table(c.reloptions) o
           where o.option_name = 'security_invoker') as invoker_brut
  from attendu a
  left join pg_class c
         on c.relname     = a.vue
        and c.relkind     = 'v'
        and c.relnamespace = 'public'::regnamespace
)
select
  vue,
  case when invoker_attendu then 'INVOKER' else 'DEFINER' end as attendu,
  case when not vue_existe then 'VUE INTROUVABLE'
       when invoker_brut is null then 'DEFINER (reloptions vide)'
       else 'INVOKER (' || invoker_brut || ')'
  end as reel,
  case
    when not vue_existe
      then 'Vue absente du schema public — renommee, supprimee, ou attendu perime.'
    when invoker_attendu
      then 'DURCISSEMENT PERDU. Un CREATE OR REPLACE a efface la clause. '
           || 'Reposer WITH (security_invoker = true) — MAIS verifier d abord '
           || 'que le role lecteur a bien une policy sur CHAQUE table de base, '
           || 'sinon la restauration vide des ecrans sans erreur.'
    else 'DEFINER attendu, mais security_invoker est pose. '
           || 'Verifier l intention avant de retirer quoi que ce soit.'
  end as diagnostic,
  motif as reference
from reel
where not vue_existe
   or coalesce(invoker_brut::boolean, false) <> invoker_attendu
order by vue;
