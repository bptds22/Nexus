-- Empreintes de non-régression du schéma, HORS objets du correctif de la veille.
select 'fonctions' k, count(*)::text || ' ' || md5(string_agg(md5(pg_get_functiondef(p.oid)) || coalesce(p.proacl::text, ''), '' order by p.oid::regprocedure::text)) v
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
   and p.proname not in ('rseq_proposition_equipe', 'rseq_sync_detect_teams', 'rseq_creer_equipes_proposees', 'rseq_sync_apply_games')
union all
select 'policies', count(*)::text || ' ' || md5(string_agg(c.relname || '.' || pol.polname || ':' || pol.polcmd::text || ':' || coalesce(pg_get_expr(pol.polqual, pol.polrelid), '')
       || ':' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') || ':' || pol.polroles::text, '|' order by c.relname, pol.polname))
  from pg_policy pol join pg_class c on c.oid = pol.polrelid
union all
select 'triggers', count(*)::text || ' ' || md5(string_agg(pg_get_triggerdef(t.oid), '|' order by t.tgrelid::regclass::text, t.tgname))
  from pg_trigger t where not t.tgisinternal
union all
select 'droits tables (hors rseq_codes_sport)', count(*)::text || ' ' || md5(string_agg(c.relname || coalesce(c.relacl::text, ''), '|' order by c.relname))
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm') and c.relname <> 'rseq_codes_sport'
union all
select 'vues (hors rseq_ligues_a_appeler)', count(*)::text || ' ' || md5(string_agg(c.relname || md5(pg_get_viewdef(c.oid)) || coalesce(c.reloptions::text, ''), '|' order by c.relname))
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'v' and c.relname <> 'rseq_ligues_a_appeler'
union all
select 'contraintes rseq_sync_runs', string_agg(conname || ' ' || convalidated, ', ' order by conname)
  from pg_constraint where conrelid = 'public.rseq_sync_runs'::regclass
order by 1;
