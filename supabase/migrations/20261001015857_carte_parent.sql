-- ════════════════════════════════════════════════════════════════════════════
-- CARTE PROSPECT — LE PARENT (décision BP 2026-09-30).
--
-- Deux champs facultatifs sur la carte : parent_nom, parent_courriel. Saisis à
-- la création, modifiables dans Infos ; lisibles par l'unité seulement (RLS de
-- la carte, inchangée). Jamais exportés (choix de l'interface : l'export a sa
-- propre liste de colonnes, sans eux).
--
-- Rapprochement : le courriel du parent de la CARTE égal au courriel du parent
-- de la FICHE (athletes.parent_email), prénom compatible → critère
-- COURRIEL_PARENT_CARTE, force FORTE : « Correspondance confirmée par le
-- courriel », comme l'adresse principale. Une carte dont le courriel du parent
-- change est ré-évaluée (trigger de mise à jour).
--
-- Invitation : INCHANGÉE — elle part à l'adresse principale (courriel) ; le
-- courriel du parent ne sert qu'au rapprochement et au recruteur.
--
-- ADDITIVE : deux colonnes nullables, une valeur de critère ; deux fonctions
-- redéfinies (corps de 20260930191224 + le parent) et un trigger recréé (une
-- colonne de plus). Rien de retiré.
-- Rollback : supabase/rollback/20261001015857_rollback_carte_parent.sql
-- ════════════════════════════════════════════════════════════════════════════

alter table public.cartes_prospect
  add column parent_nom text check (parent_nom is null or char_length(parent_nom) between 1 and 120),
  add column parent_courriel text check (parent_courriel is null or parent_courriel ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

alter table public.rapprochements drop constraint rapprochements_critere_check;
alter table public.rapprochements add constraint rapprochements_critere_check
  check (critere in ('COURRIEL','COURRIEL_PARENT','COURRIEL_PARENT_CARTE','TELEPHONE','TELEPHONE_PARENT',
                     'EQUIPE','ETABLISSEMENT','EQUIPE_PROCHE','ECOLE','ECOLE_PROCHE'));

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
           nullif(lower(btrim(c.parent_courriel)), '') as parent_courriel,
           c.telephone as tel,
           coalesce(t.school_id, c.school_id) as ecole
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
        or (car.parent_courriel is not null and car.parent_courriel = ath.courriel_parent)
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
        -- Courriel du PARENT de la carte = courriel du parent de la fiche, prénom compatible
        -- (un parent a souvent plusieurs enfants) : même niveau que l'adresse principale.
        when q.parent_courriel is not null and q.parent_courriel = q.courriel_parent and q.prenom_ok then 'COURRIEL_PARENT_CARTE'
        when q.tel is not null and q.tel = q.tel_fiche then 'TELEPHONE'
        when q.tel is not null and q.tel = q.tel_parent and q.prenom_ok then 'TELEPHONE_PARENT'
        when q.prenom_ok and q.meme_equipe and q.nom_exact then 'EQUIPE'
        when q.prenom_ok and q.meme_equipe then 'EQUIPE_PROCHE'
        when q.prenom_ok and q.team_id is null and q.meme_ecole_sport and q.nom_exact then 'ETABLISSEMENT'
        when q.prenom_ok and q.meme_ecole_sport and q.nom_exact then 'ECOLE'
        when q.prenom_ok and q.meme_ecole_sport then 'ECOLE_PROCHE'
      end as critere
      from qualifiees q
  )
  select n.id, n.ath_id, n.unite_cegep_id, n.unite_sport_id, n.critere,
         case n.critere when 'EQUIPE' then 'MOYENNE' when 'ETABLISSEMENT' then 'MOYENNE' when 'EQUIPE_PROCHE' then 'FAIBLE'
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
    left join public.schools ts on ts.id = coalesce(t.school_id, c.school_id)
    left join public.positions pc on pc.id = c.position_id
    left join public.schools sa on sa.id = a.school_id
    left join public.positions pa on pa.id = a.position_id
   where r.statut = 'PROPOSEE'
     and c.fusionnee_le is null
     and public.acces_carte_ecriture(r.unite_cegep_id, r.unite_sport_id)
     and (p_carte is null or r.carte_id = p_carte)
     and a.status = 'ACTIF'::public.account_status
     and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
   order by case r.critere when 'COURRIEL' then 0 when 'COURRIEL_PARENT' then 1 when 'COURRIEL_PARENT_CARTE' then 1 when 'TELEPHONE' then 2
                           when 'TELEPHONE_PARENT' then 3 when 'EQUIPE' then 4 when 'ETABLISSEMENT' then 5
                           when 'EQUIPE_PROCHE' then 6 when 'ECOLE' then 7 else 8 end, r.cree_le
$$;

-- Le courriel du parent qui change ré-évalue la carte.
drop trigger trg_rapprochement_carte_update on public.cartes_prospect;
create trigger trg_rapprochement_carte_update
  after update of courriel, parent_courriel, telephone, team_id, school_id, nom, prenom on public.cartes_prospect
  for each row execute function public.rapprochement_sur_carte();

-- GATES — listes complètes.
do $$
declare r record; vus text[];
begin
  for r in
    select * from (values
      ('public.rapprochement_candidats(uuid, uuid)',   array['postgres','service_role']),
      ('public.rapprochements_unite(uuid)',            array['authenticated','postgres','service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                  from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f::regprocedure;
    if vus is distinct from r.veut then raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut; end if;
  end loop;
  if (select count(*) from pg_trigger where tgrelid = 'public.cartes_prospect'::regclass
        and tgname = 'trg_rapprochement_carte_update' and tgenabled = 'O') <> 1 then
    raise exception 'NEXUS: trg_rapprochement_carte_update absent ou inactif';
  end if;
end $$;
