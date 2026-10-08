-- 20261008134902_matchs_ajoutes (APPLIQUÉE en prod le 2026-10-08 sous cette version, GO BP)
-- ════════════════════════════════════════════════════════════════════════════
-- CARTE DES MATCHS, LOT B — 2/3 : MATCHS AJOUTÉS AU CALENDRIER DE L'UNITÉ
-- (BP 2026-10-07, décision 7).
--
-- Le « + » de la carte ajoute un match au calendrier PARTAGÉ de l'unité
-- (cégep × sport), comme le reste de Mon processus ; « ✓ » le retire. Le
-- match apparaît au Calendrier exactement comme les autres, avec « 0 cible »
-- s'il n'a aucun athlète suivi.
--
--   · L'unité et l'auteur sont posés PAR LA BASE (trigger), jamais par le
--     client : un appel client ne fournit que game_id. Ce que le client
--     enverrait d'autre est écrasé.
--   · RLS par les mêmes aides que les cartes prospect :
--       lecture   : acces_carte_lecture (unité Pro + admin cégep) ou is_admin() ;
--       insertion / suppression : acces_carte_ecriture (recruteur Pro de
--       l'unité, dans SON sport) ;
--       aucune mise à jour (une ligne ne change pas : on la retire).
--   · Doublon refusé par la base : unique (unité, match).
--   · Journal d'activité : branché par la migration 4
--     (20261008135031_journal_matchs_ajoutes, décision BP 2026-10-08).
--
-- Rollback : supabase/rollback/20261008134902_rollback_matchs_ajoutes.sql
-- ════════════════════════════════════════════════════════════════════════════

create table public.matchs_ajoutes (
  id             uuid primary key default gen_random_uuid(),
  unite_cegep_id uuid not null references public.schools(id) on delete cascade,
  unite_sport_id uuid not null references public.sports(id) on delete cascade,
  game_id        uuid not null references public.games(id) on delete cascade,
  ajoute_par     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint matchs_ajoutes_unite_match_key unique (unite_cegep_id, unite_sport_id, game_id)
);

comment on table public.matchs_ajoutes is
  'Carte des matchs : matchs ajoutés au calendrier partagé d''une unité (cégep × sport). Unité et auteur posés par la base.';

create index matchs_ajoutes_game_idx on public.matchs_ajoutes (game_id);

-- L'unité et l'auteur viennent de la base. Appel client (un JWT porte un
-- sujet) : ajoute_par = l'appelant, unité = SON cégep et SON sport (users),
-- quoi que le client ait envoyé. Sans sujet (service_role, scripts) :
-- inchangé. NB : on ne teste PAS current_user — dans une fonction SECURITY
-- DEFINER il vaut le propriétaire, jamais « authenticated ».
create function public.matchs_ajoutes_poser_unite()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare v_cegep uuid; v_sport uuid;
begin
  if auth.uid() is not null then
    select u.school_id, u.sport_id into v_cegep, v_sport
      from public.users u where u.id = auth.uid();
    new.ajoute_par := auth.uid();
    new.unite_cegep_id := v_cegep;
    new.unite_sport_id := v_sport;
    new.created_at := now();
  end if;
  return new;
end $$;

create trigger trg_matchs_ajoutes_poser_unite
  before insert on public.matchs_ajoutes
  for each row execute function public.matchs_ajoutes_poser_unite();

revoke all on function public.matchs_ajoutes_poser_unite() from public, anon, authenticated;

alter table public.matchs_ajoutes enable row level security;

create policy matchs_ajoutes_select on public.matchs_ajoutes
  for select to authenticated
  using (public.acces_carte_lecture(unite_cegep_id, unite_sport_id) or public.is_admin());

create policy matchs_ajoutes_insert on public.matchs_ajoutes
  for insert to authenticated
  with check (public.acces_carte_ecriture(unite_cegep_id, unite_sport_id));

create policy matchs_ajoutes_delete on public.matchs_ajoutes
  for delete to authenticated
  using (public.acces_carte_ecriture(unite_cegep_id, unite_sport_id));

revoke all on table public.matchs_ajoutes from public, anon, authenticated;
grant select, insert, delete on table public.matchs_ajoutes to authenticated;

do $$
declare vus text[];
begin
  -- Trigger : personne d'autre que le propriétaire et service_role ne l'appelle.
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.matchs_ajoutes_poser_unite()'::regprocedure;
  if vus is distinct from array['postgres', 'service_role'] then
    raise exception 'NEXUS: ACL de matchs_ajoutes_poser_unite = %, attendu {postgres,service_role}', vus;
  end if;

  -- Table : authenticated = exactement {DELETE, INSERT, SELECT} ; anon rien.
  select array_agg(privilege_type::text order by privilege_type) into vus
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'matchs_ajoutes' and grantee = 'authenticated';
  if vus is distinct from array['DELETE', 'INSERT', 'SELECT'] then
    raise exception 'NEXUS: droits de authenticated sur matchs_ajoutes = %, attendu {DELETE,INSERT,SELECT}', vus;
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and table_name = 'matchs_ajoutes' and grantee in ('anon', 'PUBLIC')) then
    raise exception 'NEXUS: matchs_ajoutes accorde quelque chose à anon ou PUBLIC';
  end if;
end $$;
