-- W4d — RETRAIT complet (local ; en prod seulement sur GO de BP). Une transaction.
--   docker cp docs/partenaires-w4d/rollback-w4d.sql supabase_db_Nexus:/tmp/rollback-w4d.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1 -f /tmp/rollback-w4d.sql
-- Retire les 4 fonctions W4d et remet partenaire_prospects_mes_issues dans sa version W4a
-- (md5 du corps e511cd02…, relevée en prod le 2026-10-15). Aucune donnée n'est touchée.

drop function if exists public.partenaire_prospects_terminees();
drop function if exists public.partenaire_mes_athletes();
drop function if exists public.admin_prospects_candidats_en_attente();

create or replace function public.partenaire_prospects_mes_issues()
returns table (carte_id uuid, issue text, athlete_id uuid, carte_creee_le timestamptz, terminee_le timestamptz)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select i.carte_id, i.issue,
         case when i.issue = 'RECLAMEE' and i.annulee_le is null then i.athlete_id end,
         i.carte_creee_le, i.terminee_le
    from public.partenaire_prospects_issues i
    join public.media_partners mp on mp.id = i.partner_id
   where mp.user_id = auth.uid()
   order by i.terminee_le desc
$$;

drop function if exists public.partenaire_voit_athlete(uuid);
delete from supabase_migrations.schema_migrations where version = '20261015110727';

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.partenaire_prospects_mes_issues()'::regprocedure)
       is distinct from 'e511cd02c3c80f21809dff1f4ec87bcc'
     or exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
                  and proname in ('partenaire_voit_athlete', 'partenaire_prospects_terminees', 'partenaire_mes_athletes', 'admin_prospects_candidats_en_attente'))
     or exists (select 1 from supabase_migrations.schema_migrations where version = '20261015110727') then
    raise exception 'NEXUS: retrait W4d incomplet';
  end if;
  if (select array_to_string(array(select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') from pg_proc p, unnest(p.proacl::text[]) x
        where p.oid = 'public.partenaire_prospects_mes_issues()'::regprocedure order by 1), ',')) is distinct from 'authenticated,postgres,service_role' then
    raise exception 'NEXUS: ACL de partenaire_prospects_mes_issues changée';
  end if;
  raise notice 'NEXUS W4d retiré : mes_issues W4a remise, aucun objet W4d restant';
end $$;
