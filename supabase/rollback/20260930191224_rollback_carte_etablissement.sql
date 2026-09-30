-- Rollback de 20260930191224_carte_etablissement.
-- ⚠ Une carte SANS équipe (rattachée à l'établissement seulement) reste en
-- place, mais l'ancienne règle d'insertion l'aurait refusée ; ses
-- propositions ETABLISSEMENT deviennent ECOLE (niveau 3), le critère d'avant.

drop trigger trg_rapprochement_carte_update on public.cartes_prospect;
create trigger trg_rapprochement_carte_update after update of courriel, telephone, team_id, nom, prenom on public.cartes_prospect
  for each row execute function public.rapprochement_sur_carte();

update public.rapprochements set critere = 'ECOLE', force = 'FAIBLE' where critere = 'ETABLISSEMENT';
alter table public.rapprochements drop constraint rapprochements_critere_check;
alter table public.rapprochements add constraint rapprochements_critere_check
  check (critere in ('COURRIEL','COURRIEL_PARENT','TELEPHONE','TELEPHONE_PARENT',
                     'EQUIPE','EQUIPE_PROCHE','ECOLE','ECOLE_PROCHE'));

create or replace function public.rapprochement_candidats(p_athlete uuid, p_carte uuid)
returns table (carte_id uuid, athlete_id uuid, unite_cegep_id uuid, unite_sport_id uuid,
               critere text, force text, promotion_concorde boolean)
language sql stable security definer set search_path = public set row_security = off as $$
  with ath as (
    select a.id, a.first_name, a.school_id, a.sport_id, a.annee_diplomation,
           public.nom_normalise(a.last_name) as nom_n,
           nullif(lower(btrim(a.email)), '')        as courriel_fiche,
           nullif(lower(btrim(a.parent_email)), '') as courriel_parent,
           nullif(lower(btrim(u.email)), '')        as courriel_compte,
           public.telephone_normalise(a.telephone)        as tel_fiche,
           public.telephone_normalise(a.telephone_parent) as tel_parent
      from public.athletes a
      left join public.users u on u.id = a.user_id
     where a.status = 'ACTIF'::public.account_status
       and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
       and (p_athlete is null or a.id = p_athlete)
  ), car as (
    select c.id, c.unite_cegep_id, c.unite_sport_id, c.team_id, c.prenom, c.promotion,
           public.nom_normalise(c.nom) as nom_n,
           nullif(lower(btrim(c.courriel)), '') as courriel,
           c.telephone as tel,
           t.school_id as ecole
      from public.cartes_prospect c
      left join public.teams t on t.id = c.team_id
     where (p_carte is null or c.id = p_carte)
       and c.fusionnee_le is null
  ), paires as (
    select car.*, ath.id as ath_id, ath.first_name, ath.school_id as ath_ecole, ath.sport_id as ath_sport,
           ath.annee_diplomation, ath.nom_n as ath_nom, ath.courriel_fiche, ath.courriel_parent, ath.courriel_compte,
           ath.tel_fiche, ath.tel_parent
      from car join ath
        on (car.courriel is not null and car.courriel in (ath.courriel_compte, ath.courriel_fiche, ath.courriel_parent))
        or (car.tel is not null and car.tel in (ath.tel_fiche, ath.tel_parent))
        or (car.nom_n <> '' and (car.nom_n = ath.nom_n or public.noms_proches(car.nom_n, ath.nom_n)))
  ), qualifiees as (
    -- Ce que chaque paire réunit ; le critère se lit ensuite, du plus fort au plus faible.
    select p.*,
      p.nom_n = p.ath_nom as nom_exact,
      public.prenoms_compatibles(p.prenom, p.first_name) as prenom_ok,
      (p.team_id is not null
       and exists (select 1 from public.team_athletes ta where ta.athlete_id = p.ath_id and ta.team_id = p.team_id)) as meme_equipe,
      (p.ecole is not null
       and (p.ath_ecole = p.ecole
            or exists (select 1 from public.team_athletes ta join public.teams t on t.id = ta.team_id
                        where ta.athlete_id = p.ath_id and t.school_id = p.ecole))
       and (p.ath_sport = p.unite_sport_id
            or exists (select 1 from public.team_athletes ta join public.teams t on t.id = ta.team_id
                        where ta.athlete_id = p.ath_id and t.sport_id = p.unite_sport_id))) as meme_ecole_sport
      from paires p
  ), notees as (
    select q.*,
      case
        when q.courriel is not null and q.courriel in (q.courriel_compte, q.courriel_fiche) then 'COURRIEL'
        when q.courriel is not null and q.courriel = q.courriel_parent and q.prenom_ok then 'COURRIEL_PARENT'
        when q.tel is not null and q.tel = q.tel_fiche then 'TELEPHONE'
        when q.tel is not null and q.tel = q.tel_parent and q.prenom_ok then 'TELEPHONE_PARENT'
        when q.prenom_ok and q.meme_equipe and q.nom_exact then 'EQUIPE'
        when q.prenom_ok and q.meme_equipe then 'EQUIPE_PROCHE'
        when q.prenom_ok and q.meme_ecole_sport and q.nom_exact then 'ECOLE'
        when q.prenom_ok and q.meme_ecole_sport then 'ECOLE_PROCHE'
      end as critere
      from qualifiees q
  )
  select n.id, n.ath_id, n.unite_cegep_id, n.unite_sport_id, n.critere,
         case n.critere when 'EQUIPE' then 'MOYENNE' when 'EQUIPE_PROCHE' then 'FAIBLE'
                        when 'ECOLE' then 'FAIBLE' when 'ECOLE_PROCHE' then 'FAIBLE' else 'FORTE' end,
         case when n.promotion is null or n.annee_diplomation is null then null
              else n.promotion = n.annee_diplomation end
    from notees n
   where n.critere is not null
     and not exists (select 1 from public.rapprochements r where r.carte_id = n.id and r.athlete_id = n.ath_id)
$$;

create or replace function public.rapprochements_unite(p_carte uuid default null)
returns table (
  id uuid, force text, critere text, promotion_concorde boolean, cree_le timestamptz,
  carte_id uuid, carte_prenom text, carte_nom text, carte_equipe text, carte_ecole text,
  carte_promotion integer, carte_position text, carte_courriel_present boolean,
  athlete_id uuid, athlete_prenom text, athlete_nom text, athlete_ecole text, athlete_equipes text,
  athlete_promotion integer, athlete_position text, athlete_photo_url text
)
language sql stable security definer set search_path = public set row_security = off as $$
  select r.id, r.force, r.critere, r.promotion_concorde, r.cree_le,
         c.id, c.prenom, c.nom, t.name, ts.name, c.promotion, pc.abreviation, c.courriel is not null,
         a.id, a.first_name, a.last_name, sa.name,
         (select string_agg(tt.name, ' · ' order by tt.name) from public.team_athletes ta
            join public.teams tt on tt.id = ta.team_id where ta.athlete_id = a.id),
         a.annee_diplomation, pa.abreviation, a.photo_url
    from public.rapprochements r
    join public.cartes_prospect c on c.id = r.carte_id
    join public.athletes a on a.id = r.athlete_id
    left join public.teams t on t.id = c.team_id
    left join public.schools ts on ts.id = t.school_id
    left join public.positions pc on pc.id = c.position_id
    left join public.schools sa on sa.id = a.school_id
    left join public.positions pa on pa.id = a.position_id
   where r.statut = 'PROPOSEE'
     and c.fusionnee_le is null
     and public.acces_carte_ecriture(r.unite_cegep_id, r.unite_sport_id)
     and (p_carte is null or r.carte_id = p_carte)
     and a.status = 'ACTIF'::public.account_status
     and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
   order by case r.critere when 'COURRIEL' then 0 when 'COURRIEL_PARENT' then 1 when 'TELEPHONE' then 2
                           when 'TELEPHONE_PARENT' then 3 when 'EQUIPE' then 4 when 'EQUIPE_PROCHE' then 5
                           when 'ECOLE' then 6 else 7 end, r.cree_le
$$;

create or replace function public.cartes_prospect_avant_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cegep uuid; v_sport uuid; v_sport_equipe uuid; v_sport_position uuid;
begin
  new.invitee_le := null;
  select u.school_id, u.sport_id into v_cegep, v_sport
    from public.users u where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role;
  if v_cegep is null or v_sport is null then
    raise exception 'NEXUS: une carte prospect appartient à une unité (cégep × sport) — recruteur requis'
      using errcode = '42501';
  end if;
  new.unite_cegep_id := v_cegep;       -- la valeur envoyée par le client est ignorée
  new.unite_sport_id := v_sport;
  new.cree_par := auth.uid();
  new.modifie_par := auth.uid();
  new.derniere_activite := now();
  new.etape_le := now();
  new.created_at := now();
  new.updated_at := now();

  if new.team_id is null then
    raise exception 'NEXUS: l''équipe est obligatoire' using errcode = '23502';
  end if;
  select t.sport_id into v_sport_equipe from public.teams t where t.id = new.team_id;
  if v_sport_equipe is distinct from v_sport then
    raise exception 'NEXUS: l''équipe doit être du sport de l''unité' using errcode = '22023';
  end if;
  if new.position_id is not null then
    select p.sport_id into v_sport_position from public.positions p where p.id = new.position_id;
    if v_sport_position is distinct from v_sport then
      raise exception 'NEXUS: la position doit être du sport de l''unité' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

create or replace function public.cartes_prospect_avant_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sport_equipe uuid; v_sport_position uuid;
begin
  new.unite_cegep_id := old.unite_cegep_id;
  new.unite_sport_id := old.unite_sport_id;
  new.cree_par := old.cree_par;
  new.created_at := old.created_at;
  new.updated_at := now();
  if auth.uid() is not null then
    new.modifie_par := auth.uid();
    -- L'invitation n'est posée que par l'edge function (service_role).
    new.invitee_le := old.invitee_le;
  end if;
  new.derniere_activite := now();
  new.etape_le := case when new.etape is distinct from old.etape then now() else old.etape_le end;

  if new.team_id is distinct from old.team_id then
    if new.team_id is null then
      raise exception 'NEXUS: l''équipe est obligatoire' using errcode = '23502';
    end if;
    select t.sport_id into v_sport_equipe from public.teams t where t.id = new.team_id;
    if v_sport_equipe is distinct from old.unite_sport_id then
      raise exception 'NEXUS: l''équipe doit être du sport de l''unité' using errcode = '22023';
    end if;
  end if;
  if new.position_id is distinct from old.position_id and new.position_id is not null then
    select p.sport_id into v_sport_position from public.positions p where p.id = new.position_id;
    if v_sport_position is distinct from old.unite_sport_id then
      raise exception 'NEXUS: la position doit être du sport de l''unité' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

drop index public.cartes_prospect_school_idx;
alter table public.cartes_prospect drop column school_id;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public'
              and table_name = 'cartes_prospect' and column_name = 'school_id') then
    raise exception 'NEXUS: cartes_prospect.school_id existe encore';
  end if;
end $$;
