-- ════════════════════════════════════════════════════════════════════════════
-- ANNULATION de la relance J+7 (2-relance-j7.sql) — l'ÉTAT seulement (une push reçue reste reçue).
--
--   psql -v op=<id admin_operations CONSENTEMENT_V2_RELANCE> -f 4-rollback-relance.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\if :{?op}
\else
  \echo 'NEXUS: passer -v op=<id admin_operations>'
  \quit
\endif

begin;
select set_config('nexus.op', :'op', true);

do $$
declare
  o     public.admin_operations;
  n_upd int;
begin
  select * into o from public.admin_operations
   where id = current_setting('nexus.op')::uuid and operation = 'CONSENTEMENT_V2_RELANCE';
  if not found then
    raise exception 'NEXUS: opération CONSENTEMENT_V2_RELANCE % introuvable', current_setting('nexus.op');
  end if;
  if exists (select 1 from public.admin_operations
              where operation = 'CONSENTEMENT_V2_RELANCE_ANNULEE' and details->>'op' = o.id::text) then
    raise exception 'NEXUS: opération % déjà annulée', o.id;
  end if;

  update public.consentement_partenaire_v2 set relance_le = null, maj_le = now()
   where relance_le = (o.details->>'relance_le')::timestamptz;
  get diagnostics n_upd = row_count;
  if n_upd <> (o.details->>'envoyes')::int then
    raise exception 'NEXUS: % lignes remises, attendu %', n_upd, o.details->>'envoyes';
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CONSENTEMENT_V2_RELANCE_ANNULEE', 'Annulation de l''état de la relance J+7 du consentement v2',
          jsonb_build_object('op', o.id, 'remises', n_upd),
          (select id from public.users where email = 'bptds22@gmail.com'));
  raise notice 'NEXUS: relance % annulée — % lignes remises à vide', o.id, n_upd;
end $$;

commit;
