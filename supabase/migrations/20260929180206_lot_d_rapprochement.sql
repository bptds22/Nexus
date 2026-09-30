-- 20260929180206_lot_d_rapprochement (renommée à la version prod après apply)
--
-- LOT D — RAPPROCHEMENT des cartes prospect avec les vrais profils.
--
-- Une carte prospect (lot C) vise un jeune qui n'est pas encore sur Nexus.
-- Quand il y arrive, chaque UNITÉ qui a une carte pour lui reçoit sa propre
-- proposition « ce profil semble être ta carte » — sans jamais apprendre
-- qu'une autre unité en a une (tout est cloisonné par l'unité de la carte).
--
-- DÉCLENCHEURS (décisions BP 2026-09-29) — ils n'écrivent QU'UNE ligne dans
-- une file, jamais de travail lourd dans l'inscription :
--   · un athlète termine son onboarding (avec une école) ;
--   · un athlète rejoint une équipe (team_athletes) ;
--   · une fiche athlète est créée (y compris par un coach) ;
--   · l'identité d'un athlète devient visible (consentement parental posé ;
--     18e anniversaire, par une tâche quotidienne) ;
--   · une carte est créée, ou son courriel / son équipe / son nom change ;
--   · rattrapage : tous les athlètes ACTIF sont enfilés une fois, ici.
-- Une tâche pg_cron (chaque minute) évalue la file.
--
-- CRITÈRES, dans cet ordre de force :
--   a. courriel exact carte ↔ compte ou fiche → FORTE ;
--      courriel exact carte ↔ PARENT → FORTE aussi, mais seulement si le
--      prénom est compatible : un parent a souvent plusieurs enfants ;
--   a'. TÉLÉPHONE identique (décision BP 2026-09-30) — normalisé : chiffres
--      seulement, sans le 1 initial — carte ↔ athletes.telephone → FORTE ;
--      carte ↔ athletes.telephone_parent → FORTE, prénom compatible exigé.
--      Le téléphone de l'athlète n'est JAMAIS rendu au recruteur : il sert
--      au rapprochement seulement (rapprochements_unite ne le lit pas).
--   b. nom normalisé + prénom compatible + MÊME ÉQUIPE → MOYENNE ;
--   c. nom normalisé + prénom compatible + même école, SI l'athlète joue le
--      sport de l'unité (décision BP) → FAIBLE.
--   b' et c' — TOLÉRANCE AUX FAUTES (retour BP 2026-09-30) : un nom PROCHE
--      (similarité pg_trgm ≥ seuil_nom_proche(), 0,5), pas exact, avec
--      prénom compatible → EQUIPE_PROCHE / ECOLE_PROCHE, chacun un cran sous
--      son équivalent au nom exact.
--      Seuil calibré sur les noms de la prod (lecture seule, 2026-09-30) :
--      à 0,6, « Gangnon » ne trouvait pas « Gagnon » (0,50) ; à 0,5, seuls
--      des noms composés (« Simard » ~ « Simard Pagé ») passent, et
--      « Carrier » ~ « Cartier » (0,45) reste dehors.
--   Prénom tolérant (« Bruno-Philippe » ↔ « Bruno »). La promotion est un
--   indice affiché (promotion_concorde), jamais éliminatoire.
-- JAMAIS proposé : identité masquée (athlete_identity_ok), athlète déjà dans
-- le processus de l'unité, paire déjà proposée (refusée comprise).
--
-- ADDITIF : trois tables, fonctions et triggers nouveaux, deux tâches cron,
-- l'extension pg_trgm (schéma extensions), une colonne nullable
-- cartes_prospect.telephone. Aucun objet existant n'est modifié (les
-- triggers ajoutés sur athletes, users, team_athletes et cartes_prospect
-- ne font qu'insérer dans la file, normaliser le téléphone ou journaliser).

-- ════════════════════════════════════════════════════════════════════════════
-- 1. NORMALISATION
-- ════════════════════════════════════════════════════════════════════════════
create function public.nom_normalise(p text)
returns text language sql stable set search_path = public as $$
  select btrim(regexp_replace(lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, ''))), '\s+', ' ', 'g'))
$$;

-- Premier élément du prénom : « Bruno-Philippe » → « bruno », « J. » → « j ».
create function public.prenoms_compatibles(a text, b text)
returns boolean language sql stable set search_path = public as $$
  select coalesce(x <> '' and y <> '' and (left(x, length(y)) = y or left(y, length(x)) = x), false)
    from (select coalesce((regexp_match(public.nom_normalise(a), '[a-z0-9]+'))[1], '') as x,
                 coalesce((regexp_match(public.nom_normalise(b), '[a-z0-9]+'))[1], '') as y) s
$$;

-- Tolérance aux fautes : similarité de trigrammes (pg_trgm).
create extension if not exists pg_trgm with schema extensions;

-- LE seuil, en un seul endroit (calibrage : voir l'en-tête).
create function public.seuil_nom_proche()
returns real language sql immutable set search_path = public as $$ select 0.5::real $$;

-- Deux noms DÉJÀ normalisés, différents mais proches (« gagno » ~ « gagnon »).
create function public.noms_proches(a text, b text)
returns boolean language sql stable set search_path = public as $$
  select coalesce(a <> '' and b <> '' and a <> b
                  and extensions.similarity(a, b) >= public.seuil_nom_proche(), false)
$$;

-- Téléphone : chiffres seulement, sans le 1 initial d'un numéro à 11
-- chiffres (« +1 (438) 555-0123 » → « 4385550123 ») ; vide → null.
create function public.telephone_normalise(p text)
returns text language sql immutable set search_path = public as $$
  select case when d = '' then null
              when length(d) = 11 and left(d, 1) = '1' then substr(d, 2)
              else d end
    from (select regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g') as d) s
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1 bis. LE TÉLÉPHONE SUR LA CARTE PROSPECT (décision BP 2026-09-30)
-- ════════════════════════════════════════════════════════════════════════════
-- Facultatif, format libre à la saisie, NORMALISÉ à l'enregistrement (par la
-- base, quel que soit le client) : 10 chiffres. Même régime Loi 25 que le
-- reste de la carte — le cégep en est propriétaire ; visible des Pro de
-- l'unité (et de l'admin de son cégep, en lecture), par les policies
-- existantes. À la fusion (lot E) il n'est PAS copié sur le dossier : la
-- carte masquée le garde jusqu'à sa suppression.
alter table public.cartes_prospect
  add column telephone text check (telephone is null or telephone ~ '^[0-9]{10}$');

create function public.carte_telephone_normaliser()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.telephone := public.telephone_normalise(new.telephone);
  return new;
end $$;
create trigger trg_carte_d_telephone before insert or update of telephone on public.cartes_prospect
  for each row execute function public.carte_telephone_normaliser();

-- Le journal de la carte (lot C) ne compare pas cette colonne, qu'il ne
-- connaissait pas : une modification du seul téléphone s'y inscrit ici,
-- comme toute modification d'identification (« MODIFIEE »).
create function public.carte_telephone_journaliser()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.telephone is distinct from old.telephone
     and (new.prenom, new.nom, new.team_id, new.position_id, new.numero, new.promotion, new.taille_pieds,
          new.taille_pouces, new.poids_lbs, new.lien_video, new.courriel)
         is not distinct from
         (old.prenom, old.nom, old.team_id, old.position_id, old.numero, old.promotion, old.taille_pieds,
          old.taille_pouces, old.poids_lbs, old.lien_video, old.courriel) then
    insert into public.cartes_prospect_journal (carte_id, acteur, action, details)
    values (new.id, auth.uid(), 'MODIFIEE', '{}'::jsonb);
  end if;
  return null;
end $$;
create trigger trg_carte_z_telephone after update of telephone on public.cartes_prospect
  for each row execute function public.carte_telephone_journaliser();

-- ════════════════════════════════════════════════════════════════════════════
-- 2. TABLES
-- ════════════════════════════════════════════════════════════════════════════
-- La file : un athlète OU une carte à évaluer. Une seule entrée en attente par
-- objet (les doublons d'événements se fondent).
create table public.rapprochement_file (
  id         bigint generated always as identity primary key,
  athlete_id uuid references public.athletes(id) on delete cascade,
  carte_id   uuid references public.cartes_prospect(id) on delete cascade,
  raison     text not null,
  cree_le    timestamptz not null default now(),
  check (num_nonnulls(athlete_id, carte_id) = 1)
);
create unique index rapprochement_file_athlete_unique on public.rapprochement_file (athlete_id) where athlete_id is not null;
create unique index rapprochement_file_carte_unique on public.rapprochement_file (carte_id) where carte_id is not null;

-- Les propositions : une par paire carte ↔ athlète, pour toujours (une paire
-- refusée n'est jamais reproposée : l'unicité l'interdit).
create table public.rapprochements (
  id                  uuid primary key default gen_random_uuid(),
  carte_id            uuid not null references public.cartes_prospect(id) on delete cascade,
  athlete_id          uuid not null references public.athletes(id) on delete cascade,
  unite_cegep_id      uuid not null,
  unite_sport_id      uuid not null,
  critere             text not null check (critere in ('COURRIEL','COURRIEL_PARENT','TELEPHONE','TELEPHONE_PARENT',
                                                       'EQUIPE','EQUIPE_PROCHE','ECOLE','ECOLE_PROCHE')),
  force               text not null check (force in ('FORTE','MOYENNE','FAIBLE')),
  promotion_concorde  boolean,
  statut              text not null default 'PROPOSEE' check (statut in ('PROPOSEE','REFUSEE','ACCEPTEE','CADUQUE')),
  cree_le             timestamptz not null default now(),
  decide_par          uuid references auth.users(id) on delete set null,
  decide_le           timestamptz,
  unique (carte_id, athlete_id)
);
create index rapprochements_unite_idx on public.rapprochements (unite_cegep_id, unite_sport_id, statut);
comment on table public.rapprochements is
  'Lot D : proposition « ce profil semble être ta carte », propre à l''unité de la carte. Lue par les Pro de l''unité seulement ; décidée par RPC.';

-- Les notifications de l'unité (recruteurs Pro de l'unité). Traitée quand
-- la proposition est décidée ou devenue caduque.
create table public.notifications_unite (
  id             uuid primary key default gen_random_uuid(),
  unite_cegep_id uuid not null,
  unite_sport_id uuid not null,
  type           text not null check (type in ('RAPPROCHEMENT')),
  objet_id       uuid not null,
  cree_le        timestamptz not null default now(),
  traitee_le     timestamptz,
  unique (type, objet_id)
);
create index notifications_unite_idx on public.notifications_unite (unite_cegep_id, unite_sport_id) where traitee_le is null;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. ÉVALUATION
-- ════════════════════════════════════════════════════════════════════════════
-- Les paires candidates pour UN athlète ou UNE carte. Critère le plus fort
-- d'abord ; exclusions appliquées ici.
create function public.rapprochement_candidats(p_athlete uuid, p_carte uuid)
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
     and not exists (select 1 from public.recruiter_pipeline rp
                      where rp.athlete_id = n.ath_id
                        and rp.unite_cegep_id = n.unite_cegep_id and rp.unite_sport_id = n.unite_sport_id)
$$;

-- Écrit les propositions (et leurs notifications) d'UN athlète ou d'UNE carte.
create function public.rapprocher(p_athlete uuid, p_carte uuid)
returns integer language plpgsql security definer set search_path = public set row_security = off as $$
declare n integer;
begin
  with nouvelles as (
    insert into public.rapprochements (carte_id, athlete_id, unite_cegep_id, unite_sport_id, critere, force, promotion_concorde)
    select carte_id, athlete_id, unite_cegep_id, unite_sport_id, critere, force, promotion_concorde
      from public.rapprochement_candidats(p_athlete, p_carte)
    on conflict (carte_id, athlete_id) do nothing
    returning id, unite_cegep_id, unite_sport_id
  ), notif as (
    insert into public.notifications_unite (unite_cegep_id, unite_sport_id, type, objet_id)
    select unite_cegep_id, unite_sport_id, 'RAPPROCHEMENT', id from nouvelles
    on conflict (type, objet_id) do nothing
    returning 1
  )
  select count(*) into n from nouvelles;
  return n;
end $$;

-- La tâche : vide la file par lots (SKIP LOCKED : deux passes ne se gênent pas).
create function public.evaluer_rapprochements(p_max integer default 500)
returns integer language plpgsql security definer set search_path = public set row_security = off as $$
declare r record; total integer := 0;
begin
  for r in
    select id, athlete_id, carte_id from public.rapprochement_file
     order by id limit p_max for update skip locked
  loop
    total := total + public.rapprocher(r.athlete_id, r.carte_id);
    delete from public.rapprochement_file where id = r.id;
  end loop;
  return total;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. DÉCLENCHEURS — une ligne dans la file, rien d'autre.
-- ════════════════════════════════════════════════════════════════════════════
create function public.rapprochement_enfiler(p_athlete uuid, p_carte uuid, p_raison text)
returns void language sql security definer set search_path = public set row_security = off as $$
  insert into public.rapprochement_file (athlete_id, carte_id, raison)
  values (p_athlete, p_carte, p_raison)
  on conflict do nothing
$$;

create function public.rapprochement_sur_athlete()
returns trigger language plpgsql security definer set search_path = public set row_security = off as $$
begin
  if tg_op = 'INSERT' then
    perform public.rapprochement_enfiler(new.id, null, 'fiche_creee');
  elsif not public.athlete_identity_ok(old.date_naissance, old.consentement_parental)
        and public.athlete_identity_ok(new.date_naissance, new.consentement_parental) then
    perform public.rapprochement_enfiler(new.id, null, 'identite_visible');
  end if;
  return null;
end $$;
create trigger trg_rapprochement_athlete_insert after insert on public.athletes
  for each row execute function public.rapprochement_sur_athlete();
create trigger trg_rapprochement_athlete_identite after update of consentement_parental, date_naissance on public.athletes
  for each row execute function public.rapprochement_sur_athlete();

create function public.rapprochement_sur_onboarding()
returns trigger language plpgsql security definer set search_path = public set row_security = off as $$
begin
  if new.onboarding_complete is true and old.onboarding_complete is distinct from true then
    insert into public.rapprochement_file (athlete_id, raison)
    select a.id, 'inscription_terminee' from public.athletes a
     where a.user_id = new.id and a.school_id is not null
    on conflict do nothing;
  end if;
  return null;
end $$;
create trigger trg_rapprochement_onboarding after update of onboarding_complete on public.users
  for each row execute function public.rapprochement_sur_onboarding();

create function public.rapprochement_sur_equipe()
returns trigger language plpgsql security definer set search_path = public set row_security = off as $$
begin
  perform public.rapprochement_enfiler(new.athlete_id, null, 'equipe_rejointe');
  return null;
end $$;
create trigger trg_rapprochement_equipe after insert on public.team_athletes
  for each row execute function public.rapprochement_sur_equipe();

create function public.rapprochement_sur_carte()
returns trigger language plpgsql security definer set search_path = public set row_security = off as $$
begin
  perform public.rapprochement_enfiler(null, new.id, case when tg_op = 'INSERT' then 'carte_creee' else 'carte_modifiee' end);
  return null;
end $$;
create trigger trg_rapprochement_carte_insert after insert on public.cartes_prospect
  for each row execute function public.rapprochement_sur_carte();
create trigger trg_rapprochement_carte_update after update of courriel, telephone, team_id, nom, prenom on public.cartes_prospect
  for each row execute function public.rapprochement_sur_carte();

-- 18e anniversaire : l'identité devient visible sans qu'aucune ligne ne change.
create function public.rapprochement_majorite_du_jour()
returns integer language plpgsql security definer set search_path = public set row_security = off as $$
declare n integer;
begin
  insert into public.rapprochement_file (athlete_id, raison)
  select a.id, 'majorite' from public.athletes a
   where a.status = 'ACTIF'::public.account_status
     and a.date_naissance between (current_date - interval '18 years' - interval '1 day')::date
                              and (current_date - interval '18 years')::date
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. LECTURE ET DÉCISION (recruteurs Pro de l'unité)
-- ════════════════════════════════════════════════════════════════════════════
-- Les propositions OUVERTES de l'unité de l'appelant, carte et profil côte à
-- côte. Relit l'identité au moment de l'affichage : un athlète redevenu
-- masqué, ou entré depuis dans le processus de l'unité, n'apparaît pas.
create function public.rapprochements_unite(p_carte uuid default null)
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
   order by case r.critere when 'COURRIEL' then 0 when 'COURRIEL_PARENT' then 1 when 'TELEPHONE' then 2
                           when 'TELEPHONE_PARENT' then 3 when 'EQUIPE' then 4 when 'EQUIPE_PROCHE' then 5
                           when 'ECOLE' then 6 else 7 end, r.cree_le
$$;

-- Lot C, avertissement de doublon à la création d'une carte (retour BP
-- 2026-09-30) : « Un athlète au nom proche existe : Lea Gagnon — c'est
-- lui ? ». Nom PROCHE (l'exact est déjà couvert par la recherche), prénom
-- compatible, même établissement (école de la fiche ou d'une équipe).
-- Recruteur Pro seulement ; jamais une identité masquée — la même règle que
-- la recherche, donc aucun oracle nouveau.
create function public.athletes_nom_proche(p_prenom text, p_nom text, p_ecole uuid)
returns table (id uuid, first_name text, last_name text)
language sql stable security definer set search_path = public set row_security = off as $$
  select a.id, a.first_name, a.last_name
    from public.athletes a
   where exists (select 1 from public.users u
                  where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role)
     and public.user_has_pro()
     and p_ecole is not null
     and a.status = 'ACTIF'::public.account_status
     and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
     and public.noms_proches(public.nom_normalise(p_nom), public.nom_normalise(a.last_name))
     and public.prenoms_compatibles(p_prenom, a.first_name)
     and (a.school_id = p_ecole
          or exists (select 1 from public.team_athletes ta join public.teams t on t.id = ta.team_id
                      where ta.athlete_id = a.id and t.school_id = p_ecole))
   order by extensions.similarity(public.nom_normalise(p_nom), public.nom_normalise(a.last_name)) desc
   limit 5
$$;

-- Refuser : la paire est marquée pour toujours, pour toute l'unité.
create function public.refuser_rapprochement(p_id uuid)
returns boolean language plpgsql security definer set search_path = public set row_security = off as $$
declare v record;
begin
  select * into v from public.rapprochements where id = p_id for update;
  if not found or not public.acces_carte_ecriture(v.unite_cegep_id, v.unite_sport_id) then
    raise exception 'NEXUS: proposition introuvable' using errcode = '42501';
  end if;
  if v.statut <> 'PROPOSEE' then return false; end if;
  update public.rapprochements set statut = 'REFUSEE', decide_par = auth.uid(), decide_le = now() where id = p_id;
  update public.notifications_unite set traitee_le = now() where type = 'RAPPROCHEMENT' and objet_id = p_id;
  return true;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. RLS ET DROITS
-- ════════════════════════════════════════════════════════════════════════════
alter table public.rapprochement_file enable row level security;
alter table public.rapprochements enable row level security;
alter table public.notifications_unite enable row level security;

create policy rapprochements_select on public.rapprochements for select to authenticated
  using (public.acces_carte_ecriture(unite_cegep_id, unite_sport_id));
create policy notifications_unite_select on public.notifications_unite for select to authenticated
  using (public.acces_carte_ecriture(unite_cegep_id, unite_sport_id));
-- rapprochement_file : aucune policy — interne, jamais lue par l'API.

revoke all on public.rapprochement_file, public.rapprochements, public.notifications_unite from public, anon, authenticated;
grant select on public.rapprochements, public.notifications_unite to authenticated;

revoke execute on function public.nom_normalise(text)                          from public, anon, authenticated;
revoke execute on function public.prenoms_compatibles(text, text)              from public, anon, authenticated;
revoke execute on function public.telephone_normalise(text)                   from public, anon, authenticated;
revoke execute on function public.carte_telephone_normaliser()                from public, anon, authenticated;
revoke execute on function public.carte_telephone_journaliser()               from public, anon, authenticated;
revoke execute on function public.seuil_nom_proche()                              from public, anon, authenticated;
revoke execute on function public.noms_proches(text, text)                     from public, anon, authenticated;
revoke execute on function public.athletes_nom_proche(text, text, uuid)        from public, anon;
revoke execute on function public.rapprochement_candidats(uuid, uuid)          from public, anon, authenticated;
revoke execute on function public.rapprocher(uuid, uuid)                       from public, anon, authenticated;
revoke execute on function public.evaluer_rapprochements(integer)              from public, anon, authenticated;
revoke execute on function public.rapprochement_enfiler(uuid, uuid, text)      from public, anon, authenticated;
revoke execute on function public.rapprochement_sur_athlete()                  from public, anon, authenticated;
revoke execute on function public.rapprochement_sur_onboarding()               from public, anon, authenticated;
revoke execute on function public.rapprochement_sur_equipe()                   from public, anon, authenticated;
revoke execute on function public.rapprochement_sur_carte()                    from public, anon, authenticated;
revoke execute on function public.rapprochement_majorite_du_jour()             from public, anon, authenticated;
revoke execute on function public.rapprochements_unite(uuid)                   from public, anon;
revoke execute on function public.refuser_rapprochement(uuid)                  from public, anon;
grant  execute on function public.rapprochements_unite(uuid)                   to authenticated;
grant  execute on function public.refuser_rapprochement(uuid)                  to authenticated;
grant  execute on function public.athletes_nom_proche(text, text, uuid)        to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. TÂCHES — évaluation chaque minute ; majorité, chaque jour.
-- ════════════════════════════════════════════════════════════════════════════
select cron.unschedule(jobid) from cron.job where jobname in ('rapprochements-evaluation', 'rapprochements-majorite');
select cron.schedule('rapprochements-evaluation', '* * * * *', 'select public.evaluer_rapprochements(500)');
select cron.schedule('rapprochements-majorite', '20 9 * * *', 'select public.rapprochement_majorite_du_jour()');

-- Rattrapage : tous les athlètes ACTIF passent une fois dans la file.
insert into public.rapprochement_file (athlete_id, raison)
select a.id, 'rattrapage' from public.athletes a where a.status = 'ACTIF'::public.account_status
on conflict do nothing;

-- ════════════════════════════════════════════════════════════════════════════
-- 8. GATES — listes complètes, jamais par inclusion.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare r record; vus text[];
begin
  for r in
    select * from (values
      ('public.rapprochement_file',   array['postgres','service_role']),
      ('public.rapprochements',       array['authenticated','postgres','service_role']),
      ('public.notifications_unite',  array['authenticated','postgres','service_role'])
    ) as v(t, veut)
  loop
    select array_agg(distinct t.g order by t.g) into vus
      from pg_class c, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                  from unnest(c.relacl::text[]) as x) t
     where c.oid = r.t::regclass;
    if vus is distinct from r.veut then raise exception 'NEXUS: ACL de % = %, attendu %', r.t, vus, r.veut; end if;
    if not (select relrowsecurity from pg_class where oid = r.t::regclass) then raise exception 'NEXUS: RLS inactive sur %', r.t; end if;
  end loop;

  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and grantee = 'authenticated'
                and table_name in ('rapprochements', 'notifications_unite') and privilege_type <> 'SELECT') then
    raise exception 'NEXUS: authenticated peut écrire dans les propositions ou les notifications';
  end if;

  for r in
    select * from (values
      ('public.nom_normalise(text)',                       array['postgres','service_role']),
      ('public.prenoms_compatibles(text, text)',           array['postgres','service_role']),
      ('public.seuil_nom_proche()',                        array['postgres','service_role']),
      ('public.telephone_normalise(text)',                 array['postgres','service_role']),
      ('public.carte_telephone_normaliser()',              array['postgres','service_role']),
      ('public.carte_telephone_journaliser()',             array['postgres','service_role']),
      ('public.noms_proches(text, text)',                  array['postgres','service_role']),
      ('public.athletes_nom_proche(text, text, uuid)',     array['authenticated','postgres','service_role']),
      ('public.rapprochement_candidats(uuid, uuid)',       array['postgres','service_role']),
      ('public.rapprocher(uuid, uuid)',                    array['postgres','service_role']),
      ('public.evaluer_rapprochements(integer)',           array['postgres','service_role']),
      ('public.rapprochement_enfiler(uuid, uuid, text)',   array['postgres','service_role']),
      ('public.rapprochement_sur_athlete()',               array['postgres','service_role']),
      ('public.rapprochement_sur_onboarding()',            array['postgres','service_role']),
      ('public.rapprochement_sur_equipe()',                array['postgres','service_role']),
      ('public.rapprochement_sur_carte()',                 array['postgres','service_role']),
      ('public.rapprochement_majorite_du_jour()',          array['postgres','service_role']),
      ('public.rapprochements_unite(uuid)',                array['authenticated','postgres','service_role']),
      ('public.refuser_rapprochement(uuid)',               array['authenticated','postgres','service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                  from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f::regprocedure;
    if vus is distinct from r.veut then raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut; end if;
  end loop;

  for r in
    select * from (values
      ('public.rapprochement_file',  array[]::text[]),
      ('public.rapprochements',      array['rapprochements_select']),
      ('public.notifications_unite', array['notifications_unite_select'])
    ) as v(t, veut)
  loop
    select coalesce(array_agg(polname::text order by polname::text), array[]::text[]) into vus
      from pg_policy where polrelid = r.t::regclass;
    if vus is distinct from r.veut then raise exception 'NEXUS: policies de % = %, attendu %', r.t, vus, r.veut; end if;
  end loop;

  if (select count(*) from cron.job where jobname in ('rapprochements-evaluation', 'rapprochements-majorite')) <> 2 then
    raise exception 'NEXUS: tâches de rapprochement absentes ou en double';
  end if;
end $$;
