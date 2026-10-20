-- ════════════════════════════════════════════════════════════════════════════
-- parent_notifications : plus aucun identifiant de recruteur ou de cégep
-- lisible par le parent (décision BP, 2026-10-20)
--
-- Constat : CHILD_FAVORITED, CHILD_PIPELINE_STAGE et CHILD_VISIT_PLANNED
-- portaient recruiter_id dans metadata ; la policy « parent reads own
-- notifications » rend la ligne entière, metadata compris. Aucun écran ne
-- l'affichait (le portail sélectionne id, type, title, message, read,
-- created_at), mais l'API le renvoyait.
--
-- Ce que fait cette migration — NOUVELLES lignes seulement :
--   · trigger BEFORE INSERT OR UPDATE OF metadata : retire les clés
--     d'identification (liste ci-dessous) de metadata, quelle que soit la
--     fonction émettrice et sa version — aucune fonction existante redéfinie ;
--   · table parent_notifications_metadata_avant (serveur seulement) : la copie
--     d'origine des ANCIENNES lignes, remplie par le script séparé
--     scripts/parent-notif-sans-recruteur/1-anciennes-lignes.sql (relevé et GO
--     d'abord), qui sert aussi de rollback à ce script.
--
-- Personne ne lit metadata->'recruiter_id' de parent_notifications (code et
-- SQL vérifiés le 2026-10-20) : rien ne casse côté serveur.
-- Rollback : supabase/rollback/20261020180000_rollback_parent_notif_sans_identifiant_recruteur.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_parent_notif_sans_identifiants') then
    raise exception 'NEXUS: 20261020180000 déjà appliquée';
  end if;
  if to_regclass('public.parent_notifications') is null then
    raise exception 'NEXUS: parent_notifications absente';
  end if;
end $$;

-- Liste FERMÉE des clés retirées (une seule source : le trigger et le script).
create function public.parent_notif_cles_retirees()
returns text[]
language sql
immutable
set search_path = public
as $$
  select array['recruiter_id', 'recruteur_id', 'cegep_id', 'school_id',
               'unite_cegep_id', 'unite_sport_id', 'conversation_id']
$$;

create function public.parent_notif_sans_identifiants()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if NEW.metadata is not null then
    NEW.metadata := NEW.metadata - public.parent_notif_cles_retirees();
  end if;
  return NEW;
end $$;

create trigger trg_parent_notif_sans_identifiants
  before insert or update of metadata on public.parent_notifications
  for each row execute function public.parent_notif_sans_identifiants();

-- Copie d'origine des anciennes lignes (remplie par le script, jamais lue par l'app).
create table if not exists public.parent_notifications_metadata_avant (
  notification_id uuid primary key references public.parent_notifications(id) on delete cascade,
  metadata        jsonb not null,
  sauvegarde_le   timestamptz not null default now()
);
comment on table public.parent_notifications_metadata_avant is
  'Metadata d''origine des parent_notifications dont les identifiants de recruteur ont été retirés '
  '(script parent-notif-sans-recruteur). Serveur seulement ; source du rollback.';
alter table public.parent_notifications_metadata_avant enable row level security;
revoke all on public.parent_notifications_metadata_avant from public, anon, authenticated;

revoke all on function public.parent_notif_cles_retirees() from public, anon, authenticated, service_role;
revoke all on function public.parent_notif_sans_identifiants() from public, anon, authenticated, service_role;

do $$
declare
  f    regprocedure;
  vus  text[];
begin
  foreach f in array array['public.parent_notif_cles_retirees()'::regprocedure,
                           'public.parent_notif_sans_identifiants()'::regprocedure]
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f;
    if vus is distinct from array['postgres'] then
      raise exception 'NEXUS: ACL de % = %, attendu {postgres}', f, vus;
    end if;
  end loop;
  if (select array_agg(t.g order by t.g)
        from pg_class c,
             lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                        from unnest(c.relacl::text[]) as x) t
       where c.oid = 'public.parent_notifications_metadata_avant'::regclass)
     is distinct from array['postgres', 'service_role'] then
    raise exception 'NEXUS: ACL de parent_notifications_metadata_avant inattendue';
  end if;
end $$;
