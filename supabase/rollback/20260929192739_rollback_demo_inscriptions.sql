-- Rollback de 20260929192739_demo_inscriptions. ⚠ Supprime les inscriptions.
drop function public.demo_clic_compte(uuid);
drop function public.inscrire_demo(text, text, text, uuid, text, uuid, text, text[], text, boolean, text, boolean, boolean, text);
drop table public.demo_inscriptions_tentatives;
drop table public.demo_inscriptions;

do $$
begin
  if exists (select 1 from pg_class where relnamespace = 'public'::regnamespace
              and relname in ('demo_inscriptions', 'demo_inscriptions_tentatives')) then
    raise exception 'NEXUS: une table de la démo existe encore';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname in ('inscrire_demo', 'demo_clic_compte')) then
    raise exception 'NEXUS: inscrire_demo existe encore';
  end if;
end $$;
