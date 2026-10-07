-- 20261005192511_carte_sport_athlete — APPLIQUÉE en prod le 2026-10-05 sous
-- cette version (fichier préparé sous 20261005140000, renommé le 2026-10-07).
-- Vérifié le 2026-10-07 : les trois fonctions de la prod sont identiques à ce
-- fichier, commentaires retirés (md5 de pg_get_functiondef normalisé).
-- ⚠️ RÉGRESSION portée par ce fichier : sa version de rapprochement_candidats
-- part de carte_etablissement et PERD le critère COURRIEL_PARENT_CARTE
-- (introduit par 20261001021046_carte_parent). Restauré par la migration
-- suivante (lot 1 cartes, 2026-10-07). Ne pas « corriger » ce fichier : il
-- doit rester le miroir de ce qui a tourné en prod.
-- ════════════════════════════════════════════════════════════════════════════
-- LE SPORT DE L'ATHLÈTE, DISTINCT DU SPORT DE L'UNITÉ (décision BP 2026-10-05).
--
-- Jusqu'ici une carte prospect ne pouvait porter qu'une équipe (ou, sans
-- équipe, un rattachement direct) DU SPORT DE L'UNITÉ DU CRÉATEUR — un
-- recruteur de football ne pouvait créer une carte que pour un athlète de
-- football. La carte reste dans l'unité du créateur (son tableau Mon
-- processus) ; mais l'ATHLÈTE qu'elle représente peut jouer n'importe quel
-- sport offert par son établissement.
--
-- Nouveau flow de création : École/club → SPORT (sports qui ont au moins une
-- équipe dans cet établissement, ou choix libre si l'établissement n'a AUCUNE
-- équipe) → ÉQUIPE de ce sport précis. La carte porte désormais le sport de
-- L'ATHLÈTE (`sport_athlete_id`) — déduit de l'équipe choisie quand il y en a
-- une (la base l'écrase, la valeur client est ignorée, même garde que pour
-- `school_id`/`unite_*`), ou posé directement par le client quand
-- l'établissement n'a aucune équipe de CE sport (`team_id` null).
--
-- Additif : une colonne NOT NULL (backfill immédiat depuis `unite_sport_id` —
-- comportement historique inchangé pour les cartes existantes), un index,
-- deux triggers redéfinis (la garde « sport de l'unité » est remplacée par
-- une garde « sport de l'athlète », cohérente avec elle-même), et la fonction
-- de rapprochement qui comparait le sport de l'ATHLÈTE NEXUS à celui de
-- L'UNITÉ — elle doit maintenant le comparer à celui de LA CARTE.
--
-- ROLLBACK (si le GO prod est retiré après coup) : supprimer la colonne
-- `sport_athlete_id` et republier les définitions de fonctions de
-- `20260930191224_carte_etablissement.sql` (la seule migration qui les
-- redéfinissait avant celle-ci). Aucune donnée n'est perdue par le rollback :
-- `unite_sport_id` n'a jamais été touché.
-- ════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- 1. COLONNE — additive, backfill immédiat (aucun lecteur existant n'en
--    suppose encore le sens : NOT NULL direct est sans risque ici).
-- ──────────────────────────────────────────────────────────────────────────
alter table public.cartes_prospect
  add column sport_athlete_id uuid references public.sports(id);
create index cartes_prospect_sport_athlete_idx on public.cartes_prospect (sport_athlete_id);

-- Comportement historique préservé pour toute carte déjà créée : son sport
-- athlète = le sport de l'unité qui l'a créée (c'était la seule valeur
-- possible jusqu'ici).
update public.cartes_prospect set sport_athlete_id = unite_sport_id where sport_athlete_id is null;

alter table public.cartes_prospect alter column sport_athlete_id set not null;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. TRIGGERS — la garde « du sport de l'unité » devient « du sport de
--    l'athlète ». `unite_cegep_id`/`unite_sport_id` restent posés sur le
--    créateur, inchangés : c'est le TABLEAU qui ne bouge pas, pas le sport
--    de l'athlète qu'il contient.
-- ──────────────────────────────────────────────────────────────────────────
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

  -- Décision BP 2026-10-05 : l'équipe (et donc le sport de l'athlète) n'est
  -- plus limitée au sport de l'unité. Avec une équipe, le sport ET
  -- l'établissement en sont déduits (valeurs client ignorées). Sans équipe,
  -- le sport de l'athlète est OBLIGATOIRE côté client — rien à déduire —
  -- mais seulement si l'établissement n'a vraiment aucune équipe de CE sport
  -- (sinon : « choisis-la », même garde qu'avant, portée par sport plutôt
  -- que par unité).
  if new.team_id is not null then
    select t.sport_id, t.school_id into v_sport_equipe, v_ecole_equipe from public.teams t where t.id = new.team_id;
    new.school_id := v_ecole_equipe;
    new.sport_athlete_id := v_sport_equipe;
  else
    if new.school_id is null or not exists (select 1 from public.schools s where s.id = new.school_id) then
      raise exception 'NEXUS: l''équipe ou l''établissement est obligatoire' using errcode = '23502';
    end if;
    if new.sport_athlete_id is null then
      raise exception 'NEXUS: le sport de l''athlète est obligatoire sans équipe' using errcode = '23502';
    end if;
    if exists (select 1 from public.teams t where t.school_id = new.school_id and t.sport_id = new.sport_athlete_id) then
      raise exception 'NEXUS: cet établissement a une équipe de ce sport — choisis-la' using errcode = '23502';
    end if;
  end if;
  if new.position_id is not null then
    select p.sport_id into v_sport_position from public.positions p where p.id = new.position_id;
    if v_sport_position is distinct from new.sport_athlete_id then
      raise exception 'NEXUS: la position doit être du sport de l''athlète' using errcode = '22023';
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
    -- « Préciser l'équipe » (sansEquipe → une équipe du MÊME sport que celui
    -- déjà posé à la création) : le sport de l'athlète ne peut plus bouger
    -- après coup, exactement comme l'établissement ne pouvait déjà pas
    -- bouger seul — seule l'équipe en est la source.
    select t.sport_id, t.school_id into v_sport_equipe, v_ecole_equipe from public.teams t where t.id = new.team_id;
    if v_sport_equipe is distinct from old.sport_athlete_id then
      raise exception 'NEXUS: l''équipe doit être du sport de l''athlète' using errcode = '22023';
    end if;
    new.school_id := v_ecole_equipe;       -- l'établissement suit l'équipe précisée
    new.sport_athlete_id := old.sport_athlete_id;
  else
    new.school_id := old.school_id;             -- jamais modifié seul
    new.sport_athlete_id := old.sport_athlete_id; -- jamais modifié seul
  end if;
  if new.position_id is distinct from old.position_id and new.position_id is not null then
    select p.sport_id into v_sport_position from public.positions p where p.id = new.position_id;
    if v_sport_position is distinct from new.sport_athlete_id then
      raise exception 'NEXUS: la position doit être du sport de l''athlète' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. RAPPROCHEMENT — comparait le sport de l'athlète Nexus à celui de
--    L'UNITÉ (`p.unite_sport_id`) ; doit le comparer à celui de LA CARTE
--    (`p.sport_athlete_id`), désormais potentiellement différent.
--    `rapprochements_unite()` ne compare aucun sport (affichage seul) : pas
--    touchée.
-- ──────────────────────────────────────────────────────────────────────────
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
    select c.id, c.unite_cegep_id, c.unite_sport_id, c.sport_athlete_id, c.team_id, c.prenom, c.promotion,
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
       and (p.ath_sport = p.sport_athlete_id
            or exists (select 1 from public.team_athletes ta join public.teams t on t.id = ta.team_id
                        where ta.athlete_id = p.ath_id and t.sport_id = p.sport_athlete_id))) as meme_ecole_sport
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

-- ════════════════════════════════════════════════════════════════════════════
-- GATES — listes complètes, même forme que 20260930191224.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare r record; vus text[];
begin
  for r in
    select * from (values
      ('public.cartes_prospect_avant_insert()',        array['postgres','service_role']),
      ('public.cartes_prospect_avant_update()',        array['postgres','service_role']),
      ('public.rapprochement_candidats(uuid, uuid)',   array['postgres','service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                  from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f::regprocedure;
    if vus is distinct from r.veut then raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut; end if;
  end loop;
  if exists (select 1 from public.cartes_prospect where sport_athlete_id is null) then
    raise exception 'NEXUS: carte sans sport_athlete_id après le backfill';
  end if;
end $$;
