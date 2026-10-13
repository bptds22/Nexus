-- Relevé W1 (lecture seule). Lancer avant ET après 20261013181000.
\pset footer off
select 'media_partners.colonnes' as objet, count(*)::text as valeur,
       string_agg(column_name, ',' order by ordinal_position) as detail
  from information_schema.columns where table_schema='public' and table_name='media_partners';
select 'media_partners.peut_evaluer' as objet,
       coalesce((select data_type||' null='||is_nullable||' def='||column_default
                   from information_schema.columns
                  where table_schema='public' and table_name='media_partners' and column_name='peut_evaluer'),'absente') as valeur;
select 'media_partners.partenaires' as objet, id::text, organization_name || ' ' || status as detail
  from public.media_partners order by created_at;
select 'garde_w0.md5' as objet, md5(pg_get_functiondef('public.media_partners_garde_colonnes()'::regprocedure)) as valeur;
select 'media_partners.policies' as objet, policyname || ':' || cmd || ':' || roles::text as valeur
  from pg_policies where schemaname='public' and tablename='media_partners' order by cmd, policyname;
select 'partenaire_sports_permis' as objet, coalesce(to_regclass('public.partenaire_sports_permis')::text,'absente') as valeur;
select 'partenaire_peut_evaluer' as objet,
       coalesce((select p.proacl::text from pg_proc p where p.proname='partenaire_peut_evaluer'),'absente') as valeur;
select 'partenaire_admis.md5' as objet, md5(pg_get_functiondef('public.partenaire_admis()'::regprocedure)) as valeur;
