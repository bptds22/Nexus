-- 20261007193918_cartes_lot1_parent_prenom_invitation — APPLIQUÉE en prod le
-- 2026-10-07 (GO BP) sous cette version (fichier préparé sous 20261007190000).
-- Vérifié après l'apply : empreintes sans commentaires = ce fichier, ACL
-- {postgres, service_role}, trg_carte_z_inviter_ajout présent, colonne
-- signataire présente. send-invitation-carte v6 déployée juste après.
-- ════════════════════════════════════════════════════════════════════════════
-- CARTES PROSPECT — LOT 1 (décisions BP 2026-10-07).
--
-- 1. RESTAURER COURRIEL_PARENT_CARTE. 20261005192511_carte_sport_athlete a
--    redéfini rapprochement_candidats à partir de carte_etablissement et a
--    perdu le parent de la carte (absent du CTE `car`, de la jointure
--    `paires` et du CASE). Le courriel du parent reste FACULTATIF.
--
-- 2. PRÉNOM À UNE LETTRE PRÈS. prenoms_compatibles n'accepte qu'un début de
--    mot identique (Alex/Alexandre). prenoms_proches ajoute UNE substitution,
--    insertion ou suppression (Mathis/Mathys, Jacob/Jakob, Thomas/Tomas),
--    seulement si les deux prénoms ont au moins 4 caractères (Leo/Lea,
--    Noe/Noa : probablement deux enfants différents). Une paire acceptée grâce
--    à cette tolérance ne monte JAMAIS au-dessus de « Possible »
--    (EQUIPE_PROCHE / ECOLE_PROCHE, force FAIBLE). Les critères par parent
--    (COURRIEL_PARENT, COURRIEL_PARENT_CARTE, TELEPHONE_PARENT) gardent le
--    prénom STRICT : un même parent a souvent plusieurs enfants.
--
-- 3. COURRIEL AJOUTÉ PLUS TARD → INVITATION. Jusqu'ici l'invitation ne
--    partait qu'à l'INSERT. Nouveau trigger AFTER UPDATE OF courriel, quand la
--    carte passe de « pas de courriel » à « un courriel » : mêmes règles qu'à
--    la création (compte existant, désabonné, invité depuis 90 jours → mention
--    neutre NON_ENVOYEE).
--
-- 3 bis. SIGNATAIRE (BP 2026-10-07, 15 h 23). L'invitation née d'un AJOUT de
--    courriel est signée par celui qui l'ajoute ; à la création, par le
--    créateur. Figé sur cartes_prospect_invitations.signataire (nouvelle
--    colonne nullable) ; lu par send-invitation-carte et par le journal
--    (ligne INVITATION). Les rappels, eux, restent au nom de celui qui les
--    demande (cartes_prospect_rappels.demande_par) : inchangés.
--
-- 4. COURRIEL CHANGÉ APRÈS UNE INVITATION → RIEN. cartes_prospect_inviter
--    sort tout de suite si la carte a déjà une ligne d'invitation (index
--    unique une-par-carte) : couvre aussi le courriel effacé puis remis.
--
-- Aucune notification nouvelle. Additive : une colonne nullable, une
-- fonction, un trigger, trois fonctions redéfinies. Rien de retiré.
-- DÉPLOIEMENT : cette migration D'ABORD, puis send-invitation-carte (voir
-- docs/runbook-cartes-lot1.md) — l'ordre inverse est lui aussi sans dégât.
-- Rollback : supabase/rollback/20261007193918_rollback_cartes_lot1_parent_prenom_invitation.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────────
-- 1. PRÉNOMS À UNE LETTRE PRÈS
-- ──────────────────────────────────────────────────────────────────────────
create function public.prenoms_proches(a text, b text)
returns boolean language sql stable set search_path = public as $$
  -- Premier mot normalisé, exactement comme prenoms_compatibles.
  select coalesce(length(x) >= 4 and length(y) >= 4
                  and not (left(x, length(y)) = y or left(y, length(x)) = x)
                  and extensions.levenshtein_less_equal(x, y, 1) <= 1, false)
    from (select coalesce((regexp_match(public.nom_normalise(a), '[a-z0-9]+'))[1], '') as x,
                 coalesce((regexp_match(public.nom_normalise(b), '[a-z0-9]+'))[1], '') as y) s
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. RAPPROCHEMENT — version prod (20261005192511, sport de la carte)
--    + parent de la carte restauré (forme de 20261001021046)
--    + prénom proche, en DEUX branches ajoutées à la fin du CASE.
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
      public.prenoms_proches(p.prenom, p.first_name) as prenom_proche,
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
        -- Prénom à une lettre près : jamais plus haut que « Possible » (FAIBLE),
        -- même avec le nom exact. Jamais par le parent (garde fratrie).
        when not q.prenom_ok and q.prenom_proche and q.meme_equipe then 'EQUIPE_PROCHE'
        when not q.prenom_ok and q.prenom_proche and q.meme_ecole_sport then 'ECOLE_PROCHE'
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

-- ──────────────────────────────────────────────────────────────────────────
-- 3. INVITATION — une seule par carte, à la création OU à l'ajout du courriel
--
--    SIGNATAIRE (décision BP 2026-10-07, 15 h 23) : à la création, le
--    créateur ; à l'AJOUT du courriel, celui qui l'ajoute. Figé sur la ligne
--    d'invitation au moment où elle naît — jamais relu dans
--    cartes_prospect.modifie_par, qui change à chaque modification de la
--    carte. Lu par send-invitation-carte (nom dans le courriel) et par le
--    journal (acteur de la ligne INVITATION).
-- ──────────────────────────────────────────────────────────────────────────
alter table public.cartes_prospect_invitations
  add column signataire uuid references public.users(id) on delete set null;

create or replace function public.cartes_prospect_inviter()
returns trigger language plpgsql security definer set search_path = public set row_security = off as $$
declare
  v_adresse text;
  v_emp     text;
  v_motif   text;
  v_id      uuid;
begin
  -- Une invitation (envoyée ou écartée) par carte, jamais deux : un courriel
  -- changé, ou effacé puis remis, ne relance rien (décision BP 2026-10-07).
  if exists (select 1 from public.cartes_prospect_invitations i where i.carte_id = new.id) then return new; end if;
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

  insert into public.cartes_prospect_invitations (carte_id, unite_cegep_id, empreinte, statut, motif, signataire)
  values (new.id, new.unite_cegep_id, v_emp, case when v_motif is null then 'A_ENVOYER' else 'ECARTE' end, v_motif,
          case when tg_op = 'INSERT' then new.cree_par
               else coalesce(auth.uid(), new.modifie_par, new.cree_par) end)
  returning id into v_id;

  if v_motif is null then
    perform public.envoyer_invitation_carte(v_id);
  else
    -- Constat neutre : l'état sur la carte, la ligne au journal. Jamais le motif.
    perform set_config('nexus.invitation_carte', 'on', true);
    update public.cartes_prospect set invitation_etat = 'NON_ENVOYEE' where id = new.id;
    perform set_config('nexus.invitation_carte', '', true);
    -- clock_timestamp : après la ligne CREEE / MODIFIEE (now()), dans l'ordre du geste.
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details, created_at)
    values (new.id, null, 'INVITATION_NON_ENVOYEE', '{}'::jsonb, clock_timestamp());
  end if;
  return new;
end $$;

-- Courriel AJOUTÉ à une carte qui n'en avait pas. Le nom trie avant
-- trg_carte_z_journal (comme trg_carte_z_inviter) ; l'ordre du journal tient
-- quand même : MODIFIEE à now(), INVITATION_NON_ENVOYEE à clock_timestamp().
create trigger trg_carte_z_inviter_ajout
  after update of courriel on public.cartes_prospect
  for each row
  when (coalesce(btrim(old.courriel), '') = '' and coalesce(btrim(new.courriel), '') <> '')
  execute function public.cartes_prospect_inviter();

-- Journal : la ligne INVITATION (posée quand l'edge function marque
-- invitee_le) est signée par le signataire de l'invitation de la carte, à
-- défaut par le créateur (invitations nées avant cette migration). Le reste
-- du corps est celui de 20260929020248_lot_c_cartes_prospect, inchangé.
create or replace function public.cartes_prospect_journaliser()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_acteur uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id, v_acteur, 'CREEE', jsonb_build_object('etape', new.etape));
    return new;
  end if;
  if new.etape is distinct from old.etape then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id, v_acteur, 'ETAPE', jsonb_build_object('avant', old.etape, 'apres', new.etape));
  end if;
  if new.grade is distinct from old.grade then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id, v_acteur, 'GRADE', jsonb_build_object('avant', old.grade, 'apres', new.grade));
  end if;
  if new.relance_le is distinct from old.relance_le or new.relance_note is distinct from old.relance_note then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id, v_acteur, 'RELANCE', jsonb_build_object('le', new.relance_le));
  end if;
  if new.visite_le is distinct from old.visite_le then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id, v_acteur, 'VISITE', jsonb_build_object('le', new.visite_le));
  end if;
  if new.drapeau is distinct from old.drapeau then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id, v_acteur, 'DRAPEAU', jsonb_build_object('drapeau', new.drapeau));
  end if;
  if new.invitee_le is distinct from old.invitee_le and new.invitee_le is not null then
    -- Envoi système : au nom du SIGNATAIRE de l'invitation (créateur, ou
    -- collègue qui a ajouté le courriel — BP 2026-10-07), à défaut du créateur.
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id,
            coalesce((select i.signataire from public.cartes_prospect_invitations i where i.carte_id = new.id),
                     new.cree_par),
            'INVITATION', jsonb_build_object('le', new.invitee_le));
  end if;
  if (new.prenom, new.nom, new.team_id, new.position_id, new.numero, new.promotion, new.taille_pieds,
      new.taille_pouces, new.poids_lbs, new.lien_video, new.courriel)
     is distinct from
     (old.prenom, old.nom, old.team_id, old.position_id, old.numero, old.promotion, old.taille_pieds,
      old.taille_pouces, old.poids_lbs, old.lien_video, old.courriel) then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id, v_acteur, 'MODIFIEE', '{}'::jsonb);
  end if;
  return new;
end $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. DROITS — aucune de ces fonctions n'est appelable par un client.
-- ──────────────────────────────────────────────────────────────────────────
revoke execute on function public.prenoms_proches(text, text)            from public, anon, authenticated;
revoke execute on function public.rapprochement_candidats(uuid, uuid)    from public, anon, authenticated;
revoke execute on function public.cartes_prospect_inviter()              from public, anon, authenticated;
revoke execute on function public.cartes_prospect_journaliser()          from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- GATES — listes complètes triées (règle 2026-09-07), jamais par inclusion.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare r record; vus text[];
begin
  for r in
    select * from (values
      ('public.prenoms_proches(text, text)',          array['postgres','service_role']),
      ('public.rapprochement_candidats(uuid, uuid)',   array['postgres','service_role']),
      ('public.cartes_prospect_inviter()',             array['postgres','service_role']),
      ('public.cartes_prospect_journaliser()',         array['postgres','service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                  from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f::regprocedure;
    if vus is distinct from r.veut then raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut; end if;
  end loop;
  -- Les deux triggers d'invitation existent, et eux seuls.
  select array_agg(tgname::text order by tgname) into vus
    from pg_trigger where tgrelid = 'public.cartes_prospect'::regclass and not tgisinternal
     and tgfoid = 'public.cartes_prospect_inviter()'::regprocedure;
  if vus is distinct from array['trg_carte_z_inviter','trg_carte_z_inviter_ajout'] then
    raise exception 'NEXUS: triggers d''invitation = %', vus;
  end if;
  -- La colonne signataire existe, nullable, avec sa clé étrangère vers users.
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'cartes_prospect_invitations'
                    and column_name = 'signataire' and is_nullable = 'YES' and data_type = 'uuid')
     or not exists (select 1 from pg_constraint
                     where conrelid = 'public.cartes_prospect_invitations'::regclass and contype = 'f'
                       and confrelid = 'public.users'::regclass and confdeltype = 'n') then
    raise exception 'NEXUS: colonne cartes_prospect_invitations.signataire absente ou mal formée';
  end if;
  -- Contrôles de sens, exécutés à l'apply.
  if not public.prenoms_proches('Mathis', 'Mathys') or not public.prenoms_proches('Thomas', 'Tomas')
     or public.prenoms_proches('Leo', 'Lea') or public.prenoms_proches('Alexandre', 'Alex')
     or public.prenoms_proches('Mathis', 'Mathieu') then
    raise exception 'NEXUS: prenoms_proches ne rend pas les valeurs attendues';
  end if;
end $$;
