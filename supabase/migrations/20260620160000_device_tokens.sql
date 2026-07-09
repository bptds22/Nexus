-- device_tokens : tokens d'appareil (FCM/APNs) pour notifications push mobile.
-- Lecture/suppression : RLS limité au propriétaire. Écriture : via register_device_token().
-- L'Edge Function d'envoi (Phase 3) lira ces tokens en service role (bypass RLS).

create table if not exists public.device_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  token        text not null,
  platform     text not null check (platform in ('ios','android')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint device_tokens_token_key unique (token)
);

create index if not exists device_tokens_user_id_idx
  on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

-- L'utilisateur ne voit que ses propres tokens (écran « appareils », debug).
create policy device_tokens_select_own
  on public.device_tokens for select
  using (auth.uid() = user_id);

-- L'utilisateur peut supprimer son token (nettoyage au logout, côté client encore authentifié).
create policy device_tokens_delete_own
  on public.device_tokens for delete
  using (auth.uid() = user_id);

-- Pas de policy INSERT/UPDATE directe : toutes les écritures passent par la RPC ci-dessous.

-- Chemin d'écriture unique. SECURITY DEFINER + auth.uid() interne =>
-- ne peut jamais écrire au nom d'un autre utilisateur, même en upsert cross-user.
create or replace function public.register_device_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
begin
  if auth.uid() is null then
    raise exception 'register_device_token: appel non authentifié';
  end if;
  if p_platform not in ('ios','android') then
    raise exception 'register_device_token: platform invalide (%)', p_platform;
  end if;

  insert into public.device_tokens (user_id, token, platform, last_seen_at)
  values (auth.uid(), p_token, p_platform, now())
  on conflict (token) do update
    set user_id      = excluded.user_id,
        platform     = excluded.platform,
        last_seen_at = now();
end;
$$;

revoke all on function public.register_device_token(text, text) from public;
grant execute on function public.register_device_token(text, text) to authenticated;
