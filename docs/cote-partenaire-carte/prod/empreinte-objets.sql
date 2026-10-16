-- Empreinte des objets du lot 20261016170000 TELS QU'ILS SONT EN BASE. Calculée en local après
-- application du fichier testé ; le lot de prod exige la MÊME empreinte avant de valider (sinon tout
-- est annulé). Fonctions (corps sans CR, sécurité, volatilité, configuration, retour, droits complets),
-- contraintes de type et triggers.
select md5(string_agg(x, E'\n' order by x collate "C")) as empreinte_objets, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|' || replace(p.prosrc, E'\r', '')
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('cotes_partenaires_athletes', 'partenaire_mes_athletes', 'evaluations_partenaires_athlete',
                       'badges_partenaires_athlete', 'partenaire_badges_nexus_admissibles', 'recruiter_search_athletes',
                       'push_textes', 'push_traiter_file', 'partenaire_demander_visibilite',
                       'partenaire_regler_demandes_visibilite', 'trg_partenaire_demande_sur_carte',
                       'trg_partenaire_demande_sur_optin', 'accepter_visibilite_partenaire', 'partenaire_voit_athlete')
  union all
  select 'ck:' || conname || '|' || pg_get_constraintdef(oid)
    from pg_constraint
   where conname in ('athlete_notifications_type_check', 'parent_notifications_type_check', 'push_file_genre_check')
  union all
  select 'tg:' || tgrelid::regclass::text || '|' || pg_get_triggerdef(oid)
    from pg_trigger
   where not tgisinternal and tgname in ('trg_partenaire_demande_sur_carte', 'trg_partenaire_demande_sur_optin')
) t;
