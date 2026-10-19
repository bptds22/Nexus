-- ════════════════════════════════════════════════════════════════════════════
-- Dépistage (mode match) pour les PARTENAIRES — BP 2026-10-19 : « pour partenaire rajoute la
-- section dépistage ; ça va être lié à ses cartes en attente ».
--
-- Ce qui s'ajoute, sans rien changer pour les recruteurs :
--   · match_seances.partner_id : une séance appartient à un partenaire (portée exclusive de l'unité) ;
--     un match = une séance par partenaire.
--   · match_notes.partenaire_prospect_id : une note se lie à une carte du partenaire (exclusif avec
--     athlete_id / carte_id).
--   · partenaire_prospects.numero : le numéro de chandail d'une carte (posé au premier lien).
--   · match_seance_acces / match_seance_ouvrir / match_seances_recentes : la branche partenaire.
--   · partenaire_match_notes_lier : lier un numéro à SA carte (ou garder sans lien) ; pose le numéro
--     sur la carte s'il manque.
--   · partenaire_depistage_cartes : ses cartes actives des écoles / équipes du match.
--   · partenaire_prospect_notes_match : les notes de dépistage liées à une de ses cartes.
--
-- Partenaire admis = partenaire_admis() + sa ligne media_partners (user_id = auth.uid()) avec
-- peut_evaluer. Cartes visées : statut A_ENVOYER, ENVOYEE, RESERVEE ou CONFIRMEE_ATTENTE_OPTIN.
--
-- Accès : aucune table ouverte ; fonctions SECURITY DEFINER, portée vérifiée à chaque appel.
-- Rollback : supabase/rollback/20261019140000_rollback_depistage_partenaire.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v text;
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'match_seances' and column_name = 'partner_id') then
    raise exception 'NEXUS: 20261019140000 déjà appliquée (match_seances.partner_id existe)';
  end if;
  if to_regclass('public.match_seances') is null or to_regclass('public.partenaire_prospects') is null
  or to_regprocedure('public.partenaire_admis()') is null then
    raise exception 'NEXUS: préalables absents (mode match 20261018130000, cartes partenaire W4a)';
  end if;
  -- Les fonctions remplacées sont EXACTEMENT celles de 20261018130000 (empreintes relevées en local).
  select md5(pg_get_functiondef('public.match_seance_acces(uuid)'::regprocedure)) into v;
  if v <> '6d385c6126bedf148b7bc534095c1eb3' then raise exception 'NEXUS: match_seance_acces inattendue (%)', v; end if;
  select md5(pg_get_functiondef('public.match_seance_ouvrir(uuid,uuid,text,text,text,timestamptz)'::regprocedure)) into v;
  if v <> 'a7b6f74ddd1d4fdfaeb9a95ba9095ec0' then raise exception 'NEXUS: match_seance_ouvrir inattendue (%)', v; end if;
  select md5(pg_get_functiondef('public.match_seances_recentes()'::regprocedure)) into v;
  if v <> '4a61e642b97ad174901352cd76eb5f63' then raise exception 'NEXUS: match_seances_recentes inattendue (%)', v; end if;
end $$;

-- ── 1. Colonnes ───────────────────────────────────────────────────────────
alter table public.match_seances
  add column partner_id uuid references public.media_partners(id) on delete cascade;
alter table public.match_seances drop constraint match_seances_portee;
alter table public.match_seances add constraint match_seances_portee check (
  num_nonnulls(unite_cegep_id, unite_sport_id) in (0, 2)
  and not (unite_cegep_id is not null and partner_id is not null)
);
create unique index match_seances_partenaire_match on public.match_seances (partner_id, game_id)
  where game_id is not null and partner_id is not null;
create index match_seances_partenaire on public.match_seances (partner_id, commence_le desc) where partner_id is not null;

alter table public.match_notes
  add column partenaire_prospect_id uuid references public.partenaire_prospects(id) on delete set null;
alter table public.match_notes drop constraint match_notes_un_lien;
alter table public.match_notes add constraint match_notes_un_lien
  check (num_nonnulls(athlete_id, carte_id, partenaire_prospect_id) <= 1);
create index match_notes_partenaire_prospect on public.match_notes (partenaire_prospect_id) where partenaire_prospect_id is not null;

alter table public.partenaire_prospects
  add column numero text check (numero ~ '^[0-9]{1,3}$');

-- ── 2. Le partenaire de l'appelant (admis, peut évaluer), ou null ─────────
create function public.depistage_mon_partenaire()
returns uuid
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select mp.id from public.media_partners mp
   where mp.user_id = auth.uid() and mp.peut_evaluer and public.partenaire_admis()
   limit 1
$$;

-- ── 3. Portée : + la branche partenaire ───────────────────────────────────
create or replace function public.match_seance_acces(p_seance uuid)
returns boolean
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.match_seances s
     where s.id = p_seance
       and ((s.unite_cegep_id is not null and public.acces_unite_pro(s.unite_cegep_id, s.unite_sport_id))
            or (s.partner_id is not null and s.partner_id = public.depistage_mon_partenaire())
            or (s.unite_cegep_id is null and s.partner_id is null and s.cree_par = auth.uid() and public.user_has_pro()))
  )
$$;

create or replace function public.match_seance_ouvrir(
  p_id uuid, p_game_id uuid, p_equipe_a text, p_equipe_b text, p_lieu text, p_commence_le timestamptz
)
returns uuid
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_moi     public.users%rowtype;
  v_cegep   uuid;
  v_sport   uuid;
  v_partner uuid;
  v_id      uuid;
begin
  select * into v_moi from public.users where id = auth.uid();
  if v_moi.id is null then raise exception 'NEXUS: mode match réservé aux recruteurs Pro et aux partenaires qui évaluent'; end if;
  if v_moi.role = 'RECRUTEUR'::public.user_role then
    if not public.user_has_pro() then raise exception 'NEXUS: mode match réservé aux recruteurs Pro'; end if;
  else
    v_partner := public.depistage_mon_partenaire();
    if v_partner is null then
      raise exception 'NEXUS: mode match réservé aux recruteurs Pro et aux partenaires qui évaluent';
    end if;
  end if;
  if p_id is null then raise exception 'NEXUS: identifiant de séance manquant'; end if;

  -- Déjà connue (renvoi après coupure) : on la rend telle quelle si elle est à ma portée.
  if exists (select 1 from public.match_seances where id = p_id) then
    if not public.match_seance_acces(p_id) then raise exception 'NEXUS: séance hors de ton unité'; end if;
    return p_id;
  end if;

  -- PARTENAIRE : une séance par match et par partenaire.
  if v_partner is not null then
    if p_game_id is not null then
      select s.id into v_id from public.match_seances s where s.partner_id = v_partner and s.game_id = p_game_id;
      if v_id is not null then return v_id; end if;
    end if;
    insert into public.match_seances (id, cree_par, partner_id, game_id, equipe_a, equipe_b, lieu, commence_le)
    values (p_id, v_moi.id, v_partner, p_game_id,
            trim(p_equipe_a), nullif(trim(coalesce(p_equipe_b, '')), ''), nullif(trim(coalesce(p_lieu, '')), ''),
            coalesce(p_commence_le, now()))
    on conflict (partner_id, game_id) where game_id is not null and partner_id is not null
    do nothing
    returning id into v_id;
    if v_id is null then
      select s.id into v_id from public.match_seances s where s.partner_id = v_partner and s.game_id = p_game_id;
    end if;
    return v_id;
  end if;

  -- RECRUTEUR : inchangé.
  if v_moi.school_id is not null and v_moi.sport_id is not null
     and public.acces_unite_pro(v_moi.school_id, v_moi.sport_id) then
    v_cegep := v_moi.school_id; v_sport := v_moi.sport_id;
  end if;

  if p_game_id is not null and v_cegep is not null then
    select s.id into v_id from public.match_seances s
     where s.unite_cegep_id = v_cegep and s.unite_sport_id = v_sport and s.game_id = p_game_id;
    if v_id is not null then return v_id; end if;
  end if;

  insert into public.match_seances (id, cree_par, unite_cegep_id, unite_sport_id, game_id, equipe_a, equipe_b, lieu, commence_le)
  values (p_id, v_moi.id, v_cegep, v_sport, p_game_id,
          trim(p_equipe_a), nullif(trim(coalesce(p_equipe_b, '')), ''), nullif(trim(coalesce(p_lieu, '')), ''),
          coalesce(p_commence_le, now()))
  on conflict (unite_cegep_id, unite_sport_id, game_id) where game_id is not null and unite_cegep_id is not null
  do nothing
  returning id into v_id;

  if v_id is null then   -- course avec un collègue : sa séance gagne
    select s.id into v_id from public.match_seances s
     where s.unite_cegep_id = v_cegep and s.unite_sport_id = v_sport and s.game_id = p_game_id;
  end if;
  return v_id;
end $$;

-- « À lier » compte aussi le lien vers une carte partenaire.
create or replace function public.match_seances_recentes()
returns table (
  id uuid, game_id uuid, equipe_a text, equipe_b text, lieu text, commence_le timestamptz,
  termine_le timestamptz, cree_par uuid, nb_notes integer, nb_a_lier integer
)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select s.id, s.game_id, s.equipe_a, s.equipe_b, s.lieu, s.commence_le, s.termine_le, s.cree_par,
         (select count(*)::int from public.match_notes n where n.seance_id = s.id),
         (select count(*)::int from public.match_notes n
           where n.seance_id = s.id and n.athlete_id is null and n.carte_id is null
             and n.partenaire_prospect_id is null and n.lie_le is null)
    from public.match_seances s
   where s.commence_le >= now() - interval '120 days'
     and public.match_seance_acces(s.id)
   order by s.commence_le desc
   limit 100
$$;

-- ── 4. Lier (partenaire) : à SA carte active, ou garder sans lien ─────────
create function public.partenaire_match_notes_lier(
  p_seance uuid, p_cote text, p_numero text, p_prenom text, p_prospect_id uuid
)
returns integer
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_partner uuid := public.depistage_mon_partenaire();
  v_n integer;
begin
  if v_partner is null or not exists (select 1 from public.match_seances s where s.id = p_seance and s.partner_id = v_partner) then
    raise exception 'NEXUS: séance hors de ta portée';
  end if;
  if p_prospect_id is not null and not exists (
       select 1 from public.partenaire_prospects c
        where c.id = p_prospect_id and c.partner_id = v_partner
          and c.statut in ('A_ENVOYER', 'ENVOYEE', 'RESERVEE', 'CONFIRMEE_ATTENTE_OPTIN')) then
    raise exception 'NEXUS: carte introuvable';
  end if;

  update public.match_notes n
     set partenaire_prospect_id = p_prospect_id, athlete_id = null, carte_id = null, lie_par = auth.uid(), lie_le = now()
   where n.seance_id = p_seance and n.cote = p_cote
     and (case when nullif(trim(coalesce(p_numero, '')), '') is not null
               then n.numero = trim(p_numero)
               else n.numero is null and lower(trim(n.prenom)) = lower(trim(coalesce(p_prenom, ''))) end);
  get diagnostics v_n = row_count;

  -- Une carte sans numéro garde celui du match : au prochain match, elle est reconnue.
  if p_prospect_id is not null and nullif(trim(coalesce(p_numero, '')), '') ~ '^[0-9]{1,3}$' then
    update public.partenaire_prospects set numero = trim(p_numero) where id = p_prospect_id and numero is null;
  end if;
  return v_n;
end $$;

-- ── 5. Lire : ses cartes du match, et les notes d'une carte ───────────────
create function public.partenaire_depistage_cartes(p_ecoles uuid[], p_equipes uuid[])
returns table (id uuid, prenom text, nom text, numero text, team_id uuid, school_id uuid, equipe text)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select c.id, c.prenom, c.nom, c.numero, c.team_id, coalesce(c.school_id, t.school_id), t.name
    from public.partenaire_prospects c
    left join public.teams t on t.id = c.team_id
   where c.partner_id = public.depistage_mon_partenaire()
     and c.statut in ('A_ENVOYER', 'ENVOYEE', 'RESERVEE', 'CONFIRMEE_ATTENTE_OPTIN')
     and (c.team_id = any (coalesce(p_equipes, '{}')) or coalesce(c.school_id, t.school_id) = any (coalesce(p_ecoles, '{}')))
   limit 1000
$$;

create function public.partenaire_prospect_notes_match(p_prospect_id uuid)
returns table (id uuid, note_le timestamptz, texte text, equipe_a text, equipe_b text, commence_le timestamptz)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select n.id, n.note_le, n.texte, s.equipe_a, s.equipe_b, s.commence_le
    from public.match_notes n
    join public.match_seances s on s.id = n.seance_id
    join public.partenaire_prospects c on c.id = n.partenaire_prospect_id
   where n.partenaire_prospect_id = p_prospect_id
     and c.partner_id = public.depistage_mon_partenaire()
   order by n.note_le
$$;

-- ── 6. ACL : poser, puis vérifier la liste COMPLÈTE triée ─────────────────
revoke all on function public.depistage_mon_partenaire()                                   from public, anon, authenticated;
revoke all on function public.partenaire_match_notes_lier(uuid, text, text, text, uuid)    from public, anon, authenticated;
revoke all on function public.partenaire_depistage_cartes(uuid[], uuid[])                  from public, anon, authenticated;
revoke all on function public.partenaire_prospect_notes_match(uuid)                        from public, anon, authenticated;
grant execute on function public.depistage_mon_partenaire()                                to service_role;
grant execute on function public.partenaire_match_notes_lier(uuid, text, text, text, uuid) to authenticated, service_role;
grant execute on function public.partenaire_depistage_cartes(uuid[], uuid[])               to authenticated, service_role;
grant execute on function public.partenaire_prospect_notes_match(uuid)                     to authenticated, service_role;

do $$
declare
  f regprocedure; veut text[]; vus text[]; t regclass;
begin
  for f, veut in
    select * from (values
      ('public.depistage_mon_partenaire()'::regprocedure, array['postgres','service_role']),
      ('public.match_seance_acces(uuid)'::regprocedure, array['postgres','service_role']),
      ('public.match_seance_ouvrir(uuid,uuid,text,text,text,timestamptz)'::regprocedure, array['authenticated','postgres','service_role']),
      ('public.match_seances_recentes()'::regprocedure, array['authenticated','postgres','service_role']),
      ('public.partenaire_match_notes_lier(uuid,text,text,text,uuid)'::regprocedure, array['authenticated','postgres','service_role']),
      ('public.partenaire_depistage_cartes(uuid[],uuid[])'::regprocedure, array['authenticated','postgres','service_role']),
      ('public.partenaire_prospect_notes_match(uuid)'::regprocedure, array['authenticated','postgres','service_role'])
    ) v(f, veut)
  loop
    select array_agg(t2.g order by t2.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t2
     where pr.oid = f;
    if vus is distinct from veut then raise exception 'NEXUS: ACL % = %, attendu %', f, vus, veut; end if;
  end loop;

  foreach t in array array['public.match_seances'::regclass, 'public.match_notes'::regclass] loop
    select array_agg(distinct t2.g order by t2.g) into vus
      from pg_class c,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(c.relacl::text[]) as x) t2
     where c.oid = t;
    if exists (select 1 from unnest(vus) g where g not in ('postgres','service_role')) then
      raise exception 'NEXUS: ACL % = %', t, vus;
    end if;
  end loop;
end $$;
