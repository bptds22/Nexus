-- Rollback de 20261007190000_cartes_lot1_parent_prenom_invitation.
-- Republie les définitions PROD au 2026-10-07 (avant le lot 1) :
--   · rapprochement_candidats = 20261005192511_carte_sport_athlete (SANS le
--     parent de la carte — c'est l'état prod, régression comprise) ;
--   · cartes_prospect_inviter = version prod (sans la garde une-par-carte) ;
-- puis retire le trigger d'ajout de courriel et prenoms_proches.
-- Les propositions déjà créées restent : leurs critères (COURRIEL_PARENT_CARTE,
-- EQUIPE_PROCHE, ECOLE_PROCHE) sont valides avant comme après.
-- Les invitations déjà parties restent aussi (une ligne par carte).

drop trigger if exists trg_carte_z_inviter_ajout on public.cartes_prospect;

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

create or replace function public.cartes_prospect_inviter()
returns trigger language plpgsql security definer set search_path = public set row_security = off as $$
declare
  v_adresse text;
  v_emp     text;
  v_motif   text;
  v_id      uuid;
begin
  if new.courriel is null or btrim(new.courriel) = '' then return new; end if;
  v_adresse := lower(btrim(new.courriel));
  v_emp := public.empreinte_courriel(v_adresse);
  -- Deux cégeps qui créent la même adresse au même instant : l'un attend l'autre.
  perform pg_advisory_xact_lock(hashtext('carte-invitation:' || v_emp));

  v_motif := case
    when exists (select 1 from public.athletes a where lower(btrim(a.email)) = v_adresse)
      or exists (select 1 from public.users u where lower(btrim(u.email)) = v_adresse)
      or exists (select 1 from auth.users au where lower(btrim(au.email)) = v_adresse)
      then 'COMPTE_EXISTANT'
    when exists (select 1 from public.courriel_desabonnements_adresses d where d.empreinte = v_emp)
      then 'DESABONNE'
    when exists (select 1 from public.cartes_prospect_invitations i
                  where i.empreinte = v_emp and i.statut in ('A_ENVOYER','EN_COURS','ENVOYE')
                    and i.created_at > now() - interval '90 days')
      then 'DEJA_INVITE'
  end;

  insert into public.cartes_prospect_invitations (carte_id, unite_cegep_id, empreinte, statut, motif)
  values (new.id, new.unite_cegep_id, v_emp, case when v_motif is null then 'A_ENVOYER' else 'ECARTE' end, v_motif)
  returning id into v_id;

  if v_motif is null then
    perform public.envoyer_invitation_carte(v_id);
  else
    -- Constat neutre : l'état sur la carte, la ligne au journal. Jamais le motif.
    perform set_config('nexus.invitation_carte', 'on', true);
    update public.cartes_prospect set invitation_etat = 'NON_ENVOYEE' where id = new.id;
    perform set_config('nexus.invitation_carte', '', true);
    -- clock_timestamp : après la ligne CREEE (now()), dans l'ordre du geste.
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details, created_at)
    values (new.id, null, 'INVITATION_NON_ENVOYEE', '{}'::jsonb, clock_timestamp());
  end if;
  return new;
end $$;

drop function if exists public.prenoms_proches(text, text);

revoke execute on function public.rapprochement_candidats(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.cartes_prospect_inviter()           from public, anon, authenticated;

do $$
declare r record; vus text[];
begin
  for r in
    select * from (values
      ('public.rapprochement_candidats(uuid, uuid)', array['postgres','service_role']),
      ('public.cartes_prospect_inviter()',           array['postgres','service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                  from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f::regprocedure;
    if vus is distinct from r.veut then raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut; end if;
  end loop;
  if to_regprocedure('public.prenoms_proches(text, text)') is not null then
    raise exception 'NEXUS: prenoms_proches existe encore';
  end if;
end $$;
