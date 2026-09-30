-- Rollback de 20260929183032_lot_e_fusion (lot E).
-- ⚠ Les fusions déjà faites RESTENT faites (dossiers, notes, listes) : seul
-- le mécanisme part. Les cartes encore masquées sont supprimées avec la
-- trace minimale du lot C (motif PURGE : le motif FUSION disparaît avec la
-- contrainte élargie) — elles ont déjà été fusionnées, les démasquer
-- dédoublerait l'athlète. Le registre des fusions est perdu.

select cron.unschedule(jobid) from cron.job where jobname = 'fusions-definitives';

-- Cartes encore masquées : parties, avec trace.
select set_config('nexus.purge_cartes', 'on', false);
delete from public.cartes_prospect where fusionnee_le is not null;
select set_config('nexus.purge_cartes', 'off', false);
update public.cartes_prospect_suppressions set motif = 'PURGE' where motif = 'FUSION';

drop function public.fusions_definitives();
drop function public.fusions_athlete(uuid);
drop function public.annuler_fusion(uuid);
drop function public.fusionner_carte(uuid, uuid);
drop table public.fusions_cartes;

drop policy cartes_non_fusionnees on public.cartes_prospect;
drop trigger trg_carte_c_fusion on public.cartes_prospect;
drop function public.carte_fusion_garde();
alter table public.cartes_prospect drop column fusionnee_le, drop column fusionnee_avec;

alter table public.cartes_prospect_suppressions drop constraint cartes_prospect_suppressions_motif_check;
alter table public.cartes_prospect_suppressions add constraint cartes_prospect_suppressions_motif_check
  check (motif = any (array['RETRAIT'::text, 'PURGE'::text]));

-- Les fonctions redéfinies reprennent leur corps d'avant (ACL conservées par CREATE OR REPLACE).
create or replace function public.carte_lecture_ok(p_carte uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cartes_prospect c
                  where c.id = p_carte and public.acces_carte_lecture(c.unite_cegep_id, c.unite_sport_id))
$$;
create or replace function public.carte_ecriture_ok(p_carte uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.cartes_prospect c
                  where c.id = p_carte and public.acces_carte_ecriture(c.unite_cegep_id, c.unite_sport_id))
$$;

create or replace function public.rapprochement_candidats(p_athlete uuid, p_carte uuid)
returns table (carte_id uuid, athlete_id uuid, unite_cegep_id uuid, unite_sport_id uuid,
               critere text, force text, promotion_concorde boolean)
language sql stable security definer set search_path = public set row_security = off as $$
  with ath as (
    select a.id, a.first_name, a.school_id, a.sport_id, a.annee_diplomation,
           public.nom_normalise(a.last_name) as nom_n,
           nullif(lower(btrim(a.email)), '')        as courriel_fiche,
           nullif(lower(btrim(a.parent_email)), '') as courriel_parent,
           nullif(lower(btrim(u.email)), '')        as courriel_compte
      from public.athletes a
      left join public.users u on u.id = a.user_id
     where a.status = 'ACTIF'::public.account_status
       and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
       and (p_athlete is null or a.id = p_athlete)
  ), car as (
    select c.id, c.unite_cegep_id, c.unite_sport_id, c.team_id, c.prenom, c.promotion,
           public.nom_normalise(c.nom) as nom_n,
           nullif(lower(btrim(c.courriel)), '') as courriel,
           t.school_id as ecole
      from public.cartes_prospect c
      left join public.teams t on t.id = c.team_id
     where (p_carte is null or c.id = p_carte)
  ), paires as (
    select car.*, ath.id as ath_id, ath.first_name, ath.school_id as ath_ecole, ath.sport_id as ath_sport,
           ath.annee_diplomation, ath.nom_n as ath_nom, ath.courriel_fiche, ath.courriel_parent, ath.courriel_compte
      from car join ath
        on (car.courriel is not null and car.courriel in (ath.courriel_compte, ath.courriel_fiche, ath.courriel_parent))
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
     and not exists (select 1 from public.recruiter_pipeline rp
                      where rp.athlete_id = n.ath_id
                        and rp.unite_cegep_id = n.unite_cegep_id and rp.unite_sport_id = n.unite_sport_id)
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
     and public.acces_carte_ecriture(r.unite_cegep_id, r.unite_sport_id)
     and (p_carte is null or r.carte_id = p_carte)
     and a.status = 'ACTIF'::public.account_status
     and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
     and not exists (select 1 from public.recruiter_pipeline rp
                      where rp.athlete_id = r.athlete_id
                        and rp.unite_cegep_id = r.unite_cegep_id and rp.unite_sport_id = r.unite_sport_id)
   order by case r.critere when 'COURRIEL' then 0 when 'COURRIEL_PARENT' then 1 when 'EQUIPE' then 2
                           when 'EQUIPE_PROCHE' then 3 when 'ECOLE' then 4 else 5 end, r.cree_le
$$;

do $$
declare r record; vus text[];
begin
  if exists (select 1 from pg_class where relnamespace = 'public'::regnamespace and relname = 'fusions_cartes') then
    raise exception 'NEXUS: fusions_cartes existe encore';
  end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
              and proname in ('fusionner_carte','annuler_fusion','fusions_athlete','fusions_definitives','carte_fusion_garde')) then
    raise exception 'NEXUS: une fonction du lot E existe encore';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cartes_prospect'
              and column_name in ('fusionnee_le', 'fusionnee_avec')) then
    raise exception 'NEXUS: colonnes de fusion encore présentes';
  end if;
  if exists (select 1 from cron.job where jobname = 'fusions-definitives') then
    raise exception 'NEXUS: tâche fusions-definitives encore présente';
  end if;
  select array_agg(polname::text order by polname::text) into vus from pg_policy where polrelid = 'public.cartes_prospect'::regclass;
  if vus is distinct from array['cartes_delete','cartes_insert','cartes_select','cartes_update'] then
    raise exception 'NEXUS: policies de cartes_prospect = %', vus;
  end if;
  for r in
    select * from (values
      ('public.carte_lecture_ok(uuid)',              array['authenticated','postgres','service_role']),
      ('public.carte_ecriture_ok(uuid)',             array['authenticated','postgres','service_role']),
      ('public.rapprochement_candidats(uuid, uuid)', array['postgres','service_role']),
      ('public.rapprochements_unite(uuid)',          array['authenticated','postgres','service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                  from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f::regprocedure;
    if vus is distinct from r.veut then raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut; end if;
  end loop;
end $$;
