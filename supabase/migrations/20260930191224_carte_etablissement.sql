-- 20260930191224_carte_etablissement (appliquée en prod le 2026-09-30, 19:12 UTC)
-- ════════════════════════════════════════════════════════════════════════════
-- CARTE PROSPECT RATTACHÉE À L'ÉTABLISSEMENT (décision BP 2026-09-30).
--
-- Bug prod : « Civil » ne proposait aucun club — aucun club n'a d'équipe de
-- basketball. Décision (option 1, généralisée) : l'ÉQUIPE devient facultative
-- quand l'établissement (école ou club) n'a AUCUNE équipe du sport de l'unité ;
-- la carte se rattache alors à l'établissement. Avec des équipes, l'équipe
-- reste obligatoire.
--   · cartes_prospect.school_id, rempli dans tous les cas (déduit de l'équipe
--     quand il y en a une ; les cartes existantes, rétro-remplies) ;
--   · création / mise à jour (lot C, redéfinies) : la règle ci-dessus ;
--     préciser l'équipe plus tard reste possible, l'établissement la suit ;
--   · rapprochement (D/E, redéfinis) : sans équipe, « même nom + même
--     établissement + sport de l'unité » = ETABLISSEMENT (niveau 2,
--     « Correspondance : même nom, même établissement ») ; le nom proche
--     reste ECOLE_PROCHE (niveau 3).
-- Additif : une colonne nullable, un index, une contrainte élargie, un
-- trigger re-posé avec une colonne de plus ; quatre fonctions redéfinies.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.cartes_prospect
  add column school_id uuid references public.schools(id) on delete set null;
create index cartes_prospect_school_idx on public.cartes_prospect (school_id);

-- Rétro-remplissage, triggers de la table coupés le temps de l'UPDATE (dans
-- la transaction ; propriétaire requis, pas superutilisateur) : la dernière
-- activité (purge à 12 mois) et le journal ne bougent pas pour une donnée
-- déduite.
alter table public.cartes_prospect disable trigger user;
update public.cartes_prospect c set school_id = t.school_id
  from public.teams t where t.id = c.team_id and c.school_id is null;
alter table public.cartes_prospect enable trigger user;

create or replace function public.cartes_prospect_avant_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cegep uuid; v_sport uuid; v_sport_equipe uuid; v_sport_position uuid; v_ecole_equipe uuid;
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

  -- Décision BP 2026-09-30 : l'ÉQUIPE est facultative quand l'établissement
  -- (école ou club) n'a AUCUNE équipe du sport de l'unité ; la carte se
  -- rattache alors à l'établissement. Avec une équipe, l'établissement en
  -- est déduit (la valeur envoyée est ignorée).
  if new.team_id is not null then
    select t.sport_id, t.school_id into v_sport_equipe, v_ecole_equipe from public.teams t where t.id = new.team_id;
    if v_sport_equipe is distinct from v_sport then
      raise exception 'NEXUS: l''équipe doit être du sport de l''unité' using errcode = '22023';
    end if;
    new.school_id := v_ecole_equipe;
  else
    if new.school_id is null or not exists (select 1 from public.schools s where s.id = new.school_id) then
      raise exception 'NEXUS: l''équipe ou l''établissement est obligatoire' using errcode = '23502';
    end if;
    if exists (select 1 from public.teams t where t.school_id = new.school_id and t.sport_id = v_sport) then
      raise exception 'NEXUS: cet établissement a une équipe du sport — choisis-la' using errcode = '23502';
    end if;
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
  v_sport_equipe uuid; v_sport_position uuid; v_ecole_equipe uuid;
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
    select t.sport_id, t.school_id into v_sport_equipe, v_ecole_equipe from public.teams t where t.id = new.team_id;
    if v_sport_equipe is distinct from old.unite_sport_id then
      raise exception 'NEXUS: l''équipe doit être du sport de l''unité' using errcode = '22023';
    end if;
    new.school_id := v_ecole_equipe;       -- l'établissement suit l'équipe précisée
  else
    new.school_id := old.school_id;        -- jamais modifié seul
  end if;
  if new.position_id is distinct from old.position_id and new.position_id is not null then
    select p.sport_id into v_sport_position from public.positions p where p.id = new.position_id;
    if v_sport_position is distinct from old.unite_sport_id then
      raise exception 'NEXUS: la position doit être du sport de l''unité' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

alter table public.rapprochements drop constraint rapprochements_critere_check;
alter table public.rapprochements add constraint rapprochements_critere_check
  check (critere in ('COURRIEL','COURRIEL_PARENT','TELEPHONE','TELEPHONE_PARENT',
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
   order by case r.critere when 'COURRIEL' then 0 when 'COURRIEL_PARENT' then 1 when 'TELEPHONE' then 2
                           when 'TELEPHONE_PARENT' then 3 when 'EQUIPE' then 4 when 'ETABLISSEMENT' then 5
                           when 'EQUIPE_PROCHE' then 6 when 'ECOLE' then 7 else 8 end, r.cree_le
$$;

-- Une carte qui change d'établissement (équipe précisée) est ré-évaluée.
drop trigger trg_rapprochement_carte_update on public.cartes_prospect;
create trigger trg_rapprochement_carte_update after update of courriel, telephone, team_id, school_id, nom, prenom on public.cartes_prospect
  for each row execute function public.rapprochement_sur_carte();

-- ════════════════════════════════════════════════════════════════════════════
-- GATES — listes complètes.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare r record; vus text[];
begin
  for r in
    select * from (values
      ('public.cartes_prospect_avant_insert()',        array['postgres','service_role']),
      ('public.cartes_prospect_avant_update()',        array['postgres','service_role']),
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
  if exists (select 1 from public.cartes_prospect where team_id is not null and school_id is null) then
    raise exception 'NEXUS: carte avec équipe mais sans établissement après le rétro-remplissage';
  end if;
end $$;
