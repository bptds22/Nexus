-- ════════════════════════════════════════════════════════════════════════════
-- ANNULATION de la push 1 (1-envoi.sql) — l'ÉTAT seulement.
-- Une push reçue sur un téléphone ne se rappelle pas : ceci remet la base comme avant
-- (le QG retrouve ses « jamais demandé », la fonction peut renvoyer).
--
--   psql -v op=<id admin_operations CONSENTEMENT_V2_PUSH> -f 3-rollback-envoi.sql
--
-- · Lignes créées par la push : supprimées, SAUF si l'athlète a répondu depuis (accord,
--   « Non », « Plus tard », demande au parent) — sa réponse est gardée, push_le remise à vide.
-- · Lignes qui existaient avant : push_le remise à vide.
-- · Refuse si la relance J+7 est partie pour l'un d'eux (4-rollback-relance.sql d'abord),
--   ou si l'opération a déjà été annulée.
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
  o       public.admin_operations;
  v_ts    timestamptz;
  v_crees uuid[];
  n_del   int;
  n_upd   int;
begin
  select * into o from public.admin_operations
   where id = current_setting('nexus.op')::uuid and operation = 'CONSENTEMENT_V2_PUSH';
  if not found then
    raise exception 'NEXUS: opération CONSENTEMENT_V2_PUSH % introuvable', current_setting('nexus.op');
  end if;
  if exists (select 1 from public.admin_operations
              where operation = 'CONSENTEMENT_V2_PUSH_ANNULE' and details->>'op' = o.id::text) then
    raise exception 'NEXUS: opération % déjà annulée', o.id;
  end if;
  v_ts    := (o.details->>'push_le')::timestamptz;
  v_crees := array(select jsonb_array_elements_text(o.details->'lignes_creees')::uuid);

  if exists (select 1 from public.consentement_partenaire_v2 where push_le = v_ts and relance_le is not null) then
    raise exception 'NEXUS: la relance J+7 est partie pour au moins un athlète — 4-rollback-relance.sql d''abord';
  end if;

  delete from public.consentement_partenaire_v2
   where athlete_id = any (v_crees) and push_le = v_ts
     and accepte_le is null and refuse_le is null and demande_parent_le is null
     and plus_tard_nb = 0 and plus_tard_le is null;
  get diagnostics n_del = row_count;

  update public.consentement_partenaire_v2 set push_le = null, maj_le = now() where push_le = v_ts;
  get diagnostics n_upd = row_count;

  if n_del + n_upd <> (o.details->>'envoyes')::int then
    raise exception 'NEXUS: % lignes défaites (% supprimées, % remises), attendu %',
      n_del + n_upd, n_del, n_upd, o.details->>'envoyes';
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CONSENTEMENT_V2_PUSH_ANNULE', 'Annulation de l''état de la push 1 du consentement v2',
          jsonb_build_object('op', o.id, 'supprimees', n_del, 'remises', n_upd),
          (select id from public.users where email = 'bptds22@gmail.com'));
  raise notice 'NEXUS: push % annulée — % lignes supprimées, % remises à vide', o.id, n_del, n_upd;
end $$;

commit;
