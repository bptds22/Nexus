-- Rollback de 20261014180000_w3b_partenaire_badges_nexus — retour à W3 À L'IDENTIQUE.
--
-- Refusé s'il existe une pose de badge Nexus (badge_id non NULL), même
-- retirée : partner_badge_id redeviendrait NOT NULL et ces lignes, qui sont
-- des traces, seraient perdues. Les supprimer est une décision de BP, pas
-- un effet de bord d'un rollback.
--
-- À passer avec psql -1 : sans transaction unique, une garde qui échoue
-- laisse en place ce qui a déjà été exécuté (vécu en local le 2026-10-14).
-- md5 comparés sans les retours chariot (CR) (fichier extrait en CRLF sous Windows).
-- Les trois fonctions W3 sont recopiées OCTET POUR OCTET depuis
-- 20261014142700_w3_partenaire_badges_retrait.sql ; la gate finale compare
-- leur md5 à celui relevé avant W3b.
do $$
declare n int;
begin
  select count(*) into n from public.partner_athlete_badges where badge_id is not null;
  if n <> 0 then
    raise exception 'NEXUS: % pose(s) de badge Nexus en base — rollback W3b refusé', n;
  end if;
end $$;

drop trigger trg_badge_deja_partenaire on public.athlete_badges;
drop function public.badge_refuser_doublon_partenaire();
drop function public.partenaire_attribuer_badge_nexus(uuid, uuid, uuid);
drop function public.partenaire_badges_nexus_admissibles(uuid);
drop function public.badges_partenaires_athlete(uuid);

-- ── W3 §6 : poser un badge (texte W3) ──
create or replace function public.partenaire_attribuer_badge(p_athlete_id uuid, p_badge_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_badge   public.partner_badges%rowtype;
  v_mp      public.media_partners%rowtype;
  v_sport   uuid;
  v_status  public.account_status;
  v_admin   boolean := public.is_admin();
  v_id      uuid;
begin
  select * into v_badge from public.partner_badges where id = p_badge_id;
  if not found or not v_badge.actif then
    raise exception 'NEXUS: badge introuvable ou désactivé' using errcode = 'P0002';
  end if;
  select * into v_mp from public.media_partners where id = v_badge.partner_id;

  select a.sport_id, a.status into v_sport, v_status from public.athletes a where a.id = p_athlete_id;
  if not found then
    raise exception 'NEXUS: athlète introuvable' using errcode = 'P0002';
  end if;
  if v_status is distinct from 'ACTIF'::public.account_status then
    raise exception 'NEXUS: athlète non actif' using errcode = '42501';
  end if;
  if not coalesce(public.is_partner_eligible_athlete(p_athlete_id), false) then
    raise exception 'NEXUS: athlète non éligible à la visibilité partenaire' using errcode = '42501';
  end if;

  if v_admin then
    -- L'admin pose au nom du partenaire : l'organisation doit être APPROUVÉE.
    if v_mp.status is distinct from 'APPROVED' then
      raise exception 'NEXUS: partenaire non approuvé' using errcode = '42501';
    end if;
  else
    -- Le partenaire : SES badges seulement, et la garde W2 complète.
    if v_mp.user_id is distinct from auth.uid() then
      raise exception 'NEXUS: ce badge appartient à un autre partenaire' using errcode = '42501';
    end if;
    if not public.partenaire_peut_evaluer(v_mp.id, v_sport) then
      raise exception 'NEXUS: attribution non permise (permission, sport ou statut du partenaire)' using errcode = '42501';
    end if;
  end if;

  if exists (select 1 from public.partner_athlete_badges
              where partner_badge_id = p_badge_id and athlete_id = p_athlete_id and retire_le is null) then
    raise exception 'NEXUS: ce badge est déjà attribué à cet athlète' using errcode = '23505';
  end if;

  insert into public.partner_athlete_badges (partner_badge_id, athlete_id, attribue_par)
  values (p_badge_id, p_athlete_id, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- ── W3 §7 : retirer un badge (texte W3) ──
create or replace function public.retirer_badge_partenaire(p_attribution_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $$
declare
  v_owner uuid;
  v_retire timestamptz;
begin
  select mp.user_id, x.retire_le into v_owner, v_retire
    from public.partner_athlete_badges x
    join public.partner_badges b on b.id = x.partner_badge_id
    join public.media_partners mp on mp.id = b.partner_id
   where x.id = p_attribution_id;
  if not found then
    raise exception 'NEXUS: badge introuvable' using errcode = 'P0002';
  end if;
  if not (public.is_admin() or v_owner is not distinct from auth.uid()) then
    raise exception 'NEXUS: seul le partenaire qui a posé ce badge, ou un admin, peut le retirer' using errcode = '42501';
  end if;
  if v_retire is not null then
    raise exception 'NEXUS: badge déjà retiré' using errcode = '22023';
  end if;
  update public.partner_athlete_badges
     set retire_le = now(), retire_par = auth.uid()
   where id = p_attribution_id;
end $$;

-- ── W3 §9 : lecture (texte W3) ──
create function public.badges_partenaires_athlete(p_athlete_id uuid)
returns table (id uuid, badge_id uuid, libelle text, icone_path text, organisation text,
               created_at timestamptz, est_masque boolean, est_le_mien boolean, peut_masquer boolean)
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $$
  with lecteur as (
    select
      public.is_admin() as admin,
      (public.coach_can_read_athlete_evals(p_athlete_id)
        or public.is_director_of_athlete_school(p_athlete_id)) as encadrement,
      public.coach_can_award_badge(p_athlete_id) as coach,
      (    public.is_admin()
        or (public.is_recruiter() and public.athlete_is_active(p_athlete_id))
        or public.coach_can_read_athlete_evals(p_athlete_id)
        or public.is_director_of_athlete_school(p_athlete_id)
        or exists (select 1 from public.athletes a
                    where a.id = p_athlete_id and a.user_id = auth.uid())
      ) as tout
  )
  select x.id, b.id, b.libelle, b.icone_path, mp.organization_name, x.created_at,
         (x.masque_le is not null),
         (mp.user_id is not distinct from auth.uid()),
         (lecteur.admin or lecteur.coach)
    from public.partner_athlete_badges x
    join public.partner_badges b on b.id = x.partner_badge_id and b.actif
    join public.media_partners mp on mp.id = b.partner_id and mp.status = 'APPROVED'
    cross join lecteur
   where x.athlete_id = p_athlete_id
     and x.retire_le is null
     and auth.uid() is not null
     and (lecteur.tout or mp.user_id = auth.uid())
     and (x.masque_le is null or lecteur.admin or lecteur.encadrement or mp.user_id = auth.uid())
   order by x.created_at
$$;

revoke all on function public.badges_partenaires_athlete(uuid) from public, anon, authenticated;
grant execute on function public.badges_partenaires_athlete(uuid) to authenticated, service_role;

drop index public.partner_athlete_badges_nexus_vivant_key;
drop index public.partner_athlete_badges_partner_idx;
alter table public.partner_athlete_badges drop constraint partner_athlete_badges_un_seul_badge;
alter table public.partner_athlete_badges alter column partner_badge_id set not null;
alter table public.partner_athlete_badges drop column badge_id;
alter table public.partner_athlete_badges drop column partner_id;

comment on table public.partner_athlete_badges is
  'W3 : badges partenaire posés. Table séparée d''athlete_badges : hors plafond de 5 (badge_plafond) et hors M10. Retrait doux ; masquage par le coach.';

do $$
declare
  f text; attendu text; vu text;
  vus text[]; veut text[] := array['authenticated', 'postgres', 'service_role'];
begin
  for f, attendu in values
    ('public.partenaire_attribuer_badge(uuid, uuid)', 'b9b379472983ae03a046fd5af5313ded'),
    ('public.retirer_badge_partenaire(uuid)', '0e2388b927708a3efc11a21d8caf7e29'),
    ('public.badges_partenaires_athlete(uuid)', '7cd05f7cc8a9a04913aada360fb75bc2'),
    ('public.coach_masquer_badge_partenaire(uuid, boolean)', '8a61d292cfac6db385c4e825dfc549f3')
  loop
    select md5(replace(pg_get_functiondef(f::regprocedure), E'\r', '')) into vu;
    if vu is distinct from attendu then
      raise exception 'NEXUS: % pas revenue à W3 (md5 %, attendu %)', f, vu, attendu;
    end if;
    select array_agg(x.g order by x.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(a,'=',1),''),'PUBLIC') as g from unnest(pr.proacl::text[]) as a) x
     where pr.oid = f::regprocedure;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', f, vus, veut;
    end if;
  end loop;
  select string_agg(tgname, ',' order by tgname) into vu
    from pg_trigger where tgrelid = 'public.athlete_badges'::regclass and not tgisinternal;
  if vu is distinct from 'trg_athlete_badges_miroir,trg_badge_contexte_requis,trg_badge_plafond' then
    raise exception 'NEXUS: triggers d''athlete_badges = %, attendu les trois de W3', vu;
  end if;
  if exists (select 1 from pg_proc where proname in ('partenaire_attribuer_badge_nexus', 'partenaire_badges_nexus_admissibles',
                                                     'badge_refuser_doublon_partenaire')) then
    raise exception 'NEXUS: fonction W3b encore présente';
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'partner_athlete_badges' and column_name in ('partner_id', 'badge_id')) then
    raise exception 'NEXUS: colonne W3b encore présente';
  end if;
  raise notice 'NEXUS: rollback W3b — retour à W3 à l''identique';
end $$;
