-- 20260918201523_app_redirect_counts
--
-- Compteur AGRÉGÉ des visites de nexussports.ca/app (lien de la bio
-- Instagram) — décision BP 2026-09-18. LOCAL SEULEMENT tant que BP n'a pas
-- donné son GO prod.
--
-- ── CE QUE LA TABLE PORTE, ET CE QU'ELLE NE PORTERA JAMAIS ──────────────────
--   Une ligne par (jour, plateforme, source), et un nombre. RIEN d'autre :
--   ni User-Agent, ni IP, ni identifiant, ni horodatage à la seconde. Ce ne
--   sont donc pas des renseignements personnels (Loi 25) : pas d'entrée dans
--   l'export /admin/loi25, pas de purge — un total par jour ne désigne
--   personne.
--
--   Le compteur mesure des VISITES, pas des installations. Les installations
--   par source se lisent dans les consoles des stores (liens de campagne,
--   lib/config/appStores.ts). Ce qu'il apporte en plus : le volume du jour
--   même, et les visites depuis un ordinateur, que les stores ne voient pas.
--
-- ── QUI ÉCRIT ───────────────────────────────────────────────────────────────
--   SEULEMENT app/app/page.tsx, côté serveur, sous service_role. Aucun droit
--   pour anon ni authenticated : ouvrir l'écriture aux visiteurs anonymes,
--   c'est laisser n'importe qui gonfler les chiffres depuis l'extérieur.
--   Les robots d'aperçu ne sont pas comptés (filtrés avant l'appel).
--
-- ── LIMITES CONNUES ─────────────────────────────────────────────────────────
--   · L'iPad récent se déclare « Macintosh » : compté `desktop`, puis
--     redirigé côté client. iOS est donc légèrement sous-estimé.
--   · `jour` est le jour de MONTRÉAL, pas UTC : une visite à 22 h le lundi
--     compte pour le lundi.
--
-- `source` et `plateforme` sont des listes FERMÉES, miroir de
-- lib/app-redirect/agent.ts : un paramètre d'URL libre ne crée pas de ligne.

create table public.app_redirect_counts (
  jour        date    not null,
  plateforme  text    not null check (plateforme in ('ios', 'android', 'desktop')),
  source      text    not null check (source in ('instagram-bio', 'direct', 'autre')),
  n           bigint  not null default 0 check (n >= 0),
  primary key (jour, plateforme, source)
);

comment on table public.app_redirect_counts is
  'Visites agregees de /app par jour (Montreal), plateforme et source. Aucune donnee personnelle '
  '(ni UA, ni IP). Ecrit par service_role seulement, via app_redirect_incrementer().';

alter table public.app_redirect_counts enable row level security;
revoke all on table public.app_redirect_counts from public, anon, authenticated;

create function public.app_redirect_incrementer(p_plateforme text, p_source text)
returns void
language sql
set search_path = public, pg_temp
as $$
  insert into public.app_redirect_counts as c (jour, plateforme, source, n)
  values ((now() at time zone 'America/Montreal')::date, p_plateforme, p_source, 1)
  on conflict (jour, plateforme, source) do update set n = c.n + 1;
$$;

comment on function public.app_redirect_incrementer(text, text) is
  'Incremente le compteur de /app. service_role seulement. Plateforme et source hors liste -> '
  'violation de CHECK, donc erreur : l''appelant la journalise et redirige quand meme.';

revoke all on function public.app_redirect_incrementer(text, text) from public, anon, authenticated;
grant execute on function public.app_redirect_incrementer(text, text) to service_role;

-- ── GATES : ACL en liste COMPLÈTE (règle du 2026-09-07) ─────────────────────
do $$
declare
  vus text[];
  v_n int;
begin
  select array_agg(distinct t.g order by t.g) into vus
    from pg_class c,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(c.relacl::text[]) as x) t
   where c.oid = 'public.app_redirect_counts'::regclass;
  if vus is distinct from array['postgres', 'service_role'] then
    raise exception 'NEXUS: ACL de app_redirect_counts = %, attendu {postgres,service_role}', vus;
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.app_redirect_counts'::regclass) then
    raise exception 'NEXUS: RLS inactive sur app_redirect_counts';
  end if;
  select count(*) into v_n from pg_policy where polrelid = 'public.app_redirect_counts'::regclass;
  if v_n <> 0 then
    raise exception 'NEXUS: % policy(s) sur app_redirect_counts, attendu 0', v_n;
  end if;

  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.app_redirect_incrementer(text, text)'::regprocedure;
  if vus is distinct from array['postgres', 'service_role'] then
    raise exception 'NEXUS: ACL de app_redirect_incrementer = %, attendu {postgres,service_role}', vus;
  end if;

  raise notice 'NEXUS: app_redirect_counts — ACL table et fonction {postgres,service_role}, RLS sans policy';
end $$;
