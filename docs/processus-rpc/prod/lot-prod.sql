-- LOT PROD processus (cartes et notes par fonctions) — généré par docs/processus-rpc/prod/construire-lot.mjs
-- Fichier : supabase/migrations/20261016060000_processus_cartes_rpc.sql — md5 2e7b5dabfd5fa690b0fe152669990ef6
-- État de départ attendu des objets : 7cf4b4282075e604ca6b7d74b2c12d24 ; empreinte attendue après : e1146ae5cf5be08cb8f6c77d7bc3052a
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _pr_releve as
select txid_current() as txid,
       (select count(*) from public.cartes_prospect) || '|' || (select count(*) from public.cartes_prospect_notes)
       || '|' || (select count(*) from public.recruiter_notes) || '|' || (select count(*) from public.recruiter_pipeline)
       || '|' || (select count(*) from public.users) as donnees,
       (select e.etat from (
select md5(string_agg(x, E'\n' order by x collate "C")) as etat, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|'
         || case when p.proname in ('unite_pipeline', 'carte_lecture_ok', 'acces_carte_lecture')
                 then 'norm:' || md5(btrim(regexp_replace(regexp_replace(replace(p.prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
                 else md5(p.prosrc) end
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('unite_pipeline', 'carte_lecture_ok', 'acces_carte_lecture',
                       'processus_cartes', 'processus_dernieres_notes_cartes', 'processus_dernieres_notes',
                       'processus_notes_export')
  union all
  select 'pol:' || c.relname || '|' || po.polname || '|' || po.polcmd::text || '|' || po.polpermissive::text || '|'
         || coalesce(pg_get_expr(po.polqual, po.polrelid), '') || '|' || coalesce(pg_get_expr(po.polwithcheck, po.polrelid), '')
    from pg_policy po
    join pg_class c on c.oid = po.polrelid
   where po.polrelid in ('public.cartes_prospect'::regclass, 'public.cartes_prospect_notes'::regclass)
) t
       ) e) as etat_objets,
       (select count(*) from public.admin_operations) as operations,
       (select count(*) from supabase_migrations.schema_migrations where version = '20261016060000') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $gpr$
begin
  if (select txid from _pr_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _pr_releve) <> 0 then
    raise exception 'NEXUS LOT: migration processus_cartes_rpc déjà présente — rien n''est appliqué';
  end if;
  if (select etat_objets from _pr_releve) is distinct from '7cf4b4282075e604ca6b7d74b2c12d24' then
    raise exception 'NEXUS LOT: objets de départ ≠ relevé (%) — rien n''est appliqué', (select etat_objets from _pr_releve);
  end if;
end $gpr$;

-- 3. ===== DÉBUT 20261016060000_processus_cartes_rpc.sql =====
-- Mon processus : lecture des cartes prospect et des dernières notes par fonctions en base (décision BP du
-- 2026-10-16, correctif urgent prod).
--
-- Le défaut : le client lisait les dernières notes des cartes par .in("carte_id", ids) — les 953 identifiants
-- de l'unité Lauréats dans l'ADRESSE (35 Ko) : 400 en prod (414 en local), erreur avalée, colonne « Note de
-- suivi » vide pour toute l'unité. Les cartes elles-mêmes passaient par une lecture PostgREST plafonnée à
-- 1000 lignes (max-rows) : au-delà, des cartes auraient disparu sans bruit.
--
-- Le correctif : des fonctions qui rendent UNE SEULE valeur jsonb (une ligne) — ni liste d'identifiants dans
-- l'adresse, ni plafond de lignes, quel que soit le volume :
--
--  · processus_cartes(cégep, sport, tout le cégep)                : toutes les cartes lisibles, au format exact
--    de l'ancienne lecture (mêmes colonnes ; équipe, école, établissement et position imbriqués), triées par
--    etape_le décroissante. Mêmes filtres que lireCartes.
--  · processus_dernieres_notes_cartes(cégep, sport, tout le cégep) : la dernière note de chaque carte lisible.
--  · processus_dernieres_notes(cégep, sport, tout le cégep)       : { cartes: la précédente, dossiers: la
--    dernière note de chaque athlète de unite_pipeline } ; note = { content, created_at, auteur (id) }.
--  · processus_notes_export(athlètes[], cartes[])                 : TOUTES les notes des lignes de l'export
--    Excel (même défaut : .in(...) dans l'adresse — l'export des Lauréats échouait, « notes illisibles »).
--
-- ACCÈS. Les deux lectures de cartes sont SECURITY DEFINER pour une seule raison, la vitesse : sous RLS,
-- acces_carte_lecture était évaluée à CHAQUE ligne (952 cartes + 870 notes ≈ 350 ms en local, 5 000 cartes
-- ≈ 1 s). Elles appliquent EXACTEMENT la règle des policies, une fois par unité :
--    carte lisible = fusionnee_le IS NULL (cartes_non_fusionnees, restrictive)
--                    ET acces_carte_lecture(unite_cegep_id, unite_sport_id) (cartes_select, seule permissive
--                    en lecture) ;
--    note lisible  = carte_lecture_ok(carte_id) = note d'une carte lisible (cartes_notes_select, seule policy
--                    de lecture).
-- Les équipes, écoles et positions : lisibles par tout RECRUTEUR (teams « Recruiters see teams »), et
-- acces_carte_lecture exige un RECRUTEUR — l'imbrication ne montre rien de plus qu'avant. La garde de départ
-- vérifie ces policies et ces fonctions telles que relevées : si elles changent, cette migration ne passe pas
-- (et le relevé du lot prod non plus). Les notes des DOSSIERS restent sous la RLS de l'appelant
-- (processus_dernieres_notes est SECURITY INVOKER).
-- Aucun droit nouveau sur les données, aucune donnée écrite, aucune fonction existante modifiée.

do $$
declare
  v_pol text;
begin
  if to_regprocedure('public.processus_cartes(uuid, uuid, boolean)') is not null
     or to_regprocedure('public.processus_dernieres_notes_cartes(uuid, uuid, boolean)') is not null
     or to_regprocedure('public.processus_dernieres_notes(uuid, uuid, boolean)') is not null
     or to_regprocedure('public.processus_notes_export(uuid[], uuid[])') is not null then
    raise exception 'NEXUS: migration déjà appliquée (processus_cartes)';
  end if;
  if to_regprocedure('public.unite_pipeline(uuid, boolean)') is null then
    raise exception 'NEXUS: unite_pipeline(uuid, boolean) absente';
  end if;
  -- Les policies de LECTURE reproduites ci-dessous, telles que relevées (prod = local, 2026-10-16).
  select string_agg(polname || '|' || polcmd::text || '|' || polpermissive::text || '|' || coalesce(pg_get_expr(polqual, polrelid), ''),
                    ';' order by polname)
    into v_pol
    from pg_policy
   where polrelid in ('public.cartes_prospect'::regclass, 'public.cartes_prospect_notes'::regclass)
     and polcmd in ('r', '*');
  if v_pol is distinct from 'cartes_non_fusionnees|*|false|(fusionnee_le IS NULL);'
                            'cartes_notes_select|r|true|carte_lecture_ok(carte_id);'
                            'cartes_select|r|true|acces_carte_lecture(unite_cegep_id, unite_sport_id)' then
    raise exception 'NEXUS: policies de lecture des cartes ≠ relevé (%)', v_pol;
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.carte_lecture_ok(uuid)'::regprocedure)
     is distinct from 'a1bb67f6eb7ae0e0fbe9cd620f452c76' then
    raise exception 'NEXUS: carte_lecture_ok ne correspond pas au relevé';
  end if;
end $$;

-- ── Toutes les cartes lisibles, une seule valeur ─────────────────────────────

create function public.processus_cartes(p_cegep_id uuid, p_sport_id uuid, p_tout_le_cegep boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  -- MATERIALIZED : l'accès est évalué une fois par UNITÉ, jamais poussé ligne à ligne par le planificateur.
  with unites as materialized (
         select distinct c.unite_cegep_id, c.unite_sport_id
           from public.cartes_prospect c
          where (p_cegep_id is null or c.unite_cegep_id = p_cegep_id)
            and (p_tout_le_cegep or p_sport_id is null or c.unite_sport_id = p_sport_id)),
       lisibles as materialized (
         select u.unite_cegep_id, u.unite_sport_id from unites u
          where public.acces_carte_lecture(u.unite_cegep_id, u.unite_sport_id))
  select coalesce(jsonb_agg(to_jsonb(x) order by x.etape_le desc, x.id), '[]'::jsonb)
    from (
      select c.id, c.unite_cegep_id, c.unite_sport_id, c.cree_par, c.prenom, c.nom, c.team_id, c.position_id,
             c.numero, c.promotion, c.taille_pieds, c.taille_pouces, c.poids_lbs, c.lien_video, c.courriel,
             c.telephone, c.parent_nom, c.parent_courriel, c.etape, c.grade, c.relance_le, c.relance_note,
             c.visite_le, c.drapeau, c.invitee_le, c.invitation_etat, c.renvois_invitation, c.dernier_renvoi_le,
             c.etape_le, c.derniere_activite, c.created_at, c.school_id, c.sport_athlete_id,
             case when t.id is null then null else jsonb_build_object(
               'name', t.name, 'division', t.division, 'league', t.league, 'age_group', t.age_group,
               'gender', t.gender, 'zone', t.zone, 'season', t.season, 'rseq_team_id', t.rseq_team_id,
               'schools', case when ts.id is null then null
                               else jsonb_build_object('name', ts.name, 'region', ts.region, 'type', ts.type) end)
             end as teams,
             case when e.id is null then null
                  else jsonb_build_object('name', e.name, 'region', e.region, 'type', e.type) end as etablissement,
             case when p.id is null then null else jsonb_build_object('abreviation', p.abreviation) end as positions
        from public.cartes_prospect c
        join lisibles l              on l.unite_cegep_id = c.unite_cegep_id and l.unite_sport_id = c.unite_sport_id
        left join public.teams t     on t.id = c.team_id
        left join public.schools ts  on ts.id = t.school_id
        left join public.schools e   on e.id = c.school_id
        left join public.positions p on p.id = c.position_id
       where c.fusionnee_le is null
         and (p_cegep_id is null or c.unite_cegep_id = p_cegep_id)
         and (p_tout_le_cegep or p_sport_id is null or c.unite_sport_id = p_sport_id)
    ) x
$$;

-- ── Dernière note de chaque carte lisible, une seule valeur ──────────────────

create function public.processus_dernieres_notes_cartes(p_cegep_id uuid, p_sport_id uuid, p_tout_le_cegep boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with unites as materialized (
         select distinct c.unite_cegep_id, c.unite_sport_id
           from public.cartes_prospect c
          where (p_cegep_id is null or c.unite_cegep_id = p_cegep_id)
            and (p_tout_le_cegep or p_sport_id is null or c.unite_sport_id = p_sport_id)),
       lisibles as materialized (
         select u.unite_cegep_id, u.unite_sport_id from unites u
          where public.acces_carte_lecture(u.unite_cegep_id, u.unite_sport_id))
  select coalesce(jsonb_object_agg(d.carte_id, jsonb_build_object('content', d.contenu, 'created_at', d.created_at, 'auteur', d.auteur)), '{}'::jsonb)
    from (select distinct on (n.carte_id) n.carte_id, n.contenu, n.created_at, n.auteur
            from public.cartes_prospect_notes n
            join public.cartes_prospect c on c.id = n.carte_id
            join lisibles l               on l.unite_cegep_id = c.unite_cegep_id and l.unite_sport_id = c.unite_sport_id
           where c.fusionnee_le is null
             and (p_cegep_id is null or c.unite_cegep_id = p_cegep_id)
             and (p_tout_le_cegep or p_sport_id is null or c.unite_sport_id = p_sport_id)
           order by n.carte_id, n.created_at desc, n.id desc) d
$$;

-- ── Dernières notes du processus : cartes + dossiers (RLS de l'appelant) ─────

create function public.processus_dernieres_notes(p_cegep_id uuid, p_sport_id uuid, p_tout_le_cegep boolean default false)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'cartes', public.processus_dernieres_notes_cartes(p_cegep_id, p_sport_id, p_tout_le_cegep),
    'dossiers', coalesce((
      select jsonb_object_agg(d.athlete_id, jsonb_build_object('content', d.content, 'created_at', d.created_at, 'auteur', d.recruiter_id))
        from (select distinct on (r.athlete_id) r.athlete_id, r.content, r.created_at, r.recruiter_id
                from public.recruiter_notes r
               where r.athlete_id in (select u.athlete_id from public.unite_pipeline(p_sport_id, p_tout_le_cegep) u)
               order by r.athlete_id, r.created_at desc nulls last, r.id desc) d), '{}'::jsonb))
$$;

-- ── Export Excel : TOUTES les notes des lignes exportées, une seule valeur ──
-- Les identifiants voyagent dans le CORPS de l'appel (tableaux), plus dans l'adresse ; aucun plafond de
-- lignes. RLS de l'appelant (SECURITY INVOKER) : exactement les notes que l'ancienne lecture rendait.

create function public.processus_notes_export(p_athletes uuid[], p_cartes uuid[])
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'dossiers', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.athlete_id, 'content', r.content, 'created_at', r.created_at,
                                          'auteur', r.recruiter_id) order by r.created_at, r.id)
        from public.recruiter_notes r
       where r.athlete_id = any(coalesce(p_athletes, '{}'::uuid[]))), '[]'::jsonb),
    'cartes', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.carte_id, 'content', n.contenu, 'created_at', n.created_at,
                                          'auteur', n.auteur) order by n.created_at, n.id)
        from public.cartes_prospect_notes n
       where n.carte_id = any(coalesce(p_cartes, '{}'::uuid[]))), '[]'::jsonb))
$$;

-- ── Droits ───────────────────────────────────────────────────────────────────

revoke all on function public.processus_notes_export(uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.processus_notes_export(uuid[], uuid[]) to authenticated;
revoke all on function public.processus_cartes(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.processus_dernieres_notes_cartes(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.processus_dernieres_notes(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.processus_cartes(uuid, uuid, boolean) to authenticated;
grant execute on function public.processus_dernieres_notes_cartes(uuid, uuid, boolean) to authenticated;
grant execute on function public.processus_dernieres_notes(uuid, uuid, boolean) to authenticated;

-- ── Garde finale ─────────────────────────────────────────────────────────────

do $$
declare
  r record;
  vus text[];
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('processus_cartes', 'processus_dernieres_notes_cartes', 'processus_dernieres_notes',
                                'processus_notes_export')
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
      raise exception 'NEXUS: ACL % = %, attendu {authenticated,postgres,service_role}', r.proname, vus;
    end if;
  end loop;
  if (select string_agg(proname || ':' || prosecdef::text, ',' order by proname) from pg_proc
       where pronamespace = 'public'::regnamespace
         and proname in ('processus_cartes', 'processus_dernieres_notes_cartes', 'processus_dernieres_notes',
                         'processus_notes_export'))
     is distinct from 'processus_cartes:true,processus_dernieres_notes:false,processus_dernieres_notes_cartes:true,'
                      'processus_notes_export:false' then
    raise exception 'NEXUS: fonctions du processus manquantes ou mode de sécurité inattendu';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('processus_cartes', 'processus_dernieres_notes_cartes')
        and position('acces_carte_lecture(' in prosrc) > 0 and position('fusionnee_le is null' in prosrc) > 0) <> 2 then
    raise exception 'NEXUS: une lecture de cartes ne reproduit pas la règle des policies';
  end if;
  raise notice 'NEXUS processus : cartes et dernières notes lues par fonctions (une valeur, sans plafond) — OK';
end $$;

-- ===== FIN 20261016060000_processus_cartes_rpc.sql =====

-- 4. Enregistrement de la version (statements = le fichier) et du geste (admin_operations)
create temp table _pr_texte as select $PRMIG$-- Mon processus : lecture des cartes prospect et des dernières notes par fonctions en base (décision BP du
-- 2026-10-16, correctif urgent prod).
--
-- Le défaut : le client lisait les dernières notes des cartes par .in("carte_id", ids) — les 953 identifiants
-- de l'unité Lauréats dans l'ADRESSE (35 Ko) : 400 en prod (414 en local), erreur avalée, colonne « Note de
-- suivi » vide pour toute l'unité. Les cartes elles-mêmes passaient par une lecture PostgREST plafonnée à
-- 1000 lignes (max-rows) : au-delà, des cartes auraient disparu sans bruit.
--
-- Le correctif : des fonctions qui rendent UNE SEULE valeur jsonb (une ligne) — ni liste d'identifiants dans
-- l'adresse, ni plafond de lignes, quel que soit le volume :
--
--  · processus_cartes(cégep, sport, tout le cégep)                : toutes les cartes lisibles, au format exact
--    de l'ancienne lecture (mêmes colonnes ; équipe, école, établissement et position imbriqués), triées par
--    etape_le décroissante. Mêmes filtres que lireCartes.
--  · processus_dernieres_notes_cartes(cégep, sport, tout le cégep) : la dernière note de chaque carte lisible.
--  · processus_dernieres_notes(cégep, sport, tout le cégep)       : { cartes: la précédente, dossiers: la
--    dernière note de chaque athlète de unite_pipeline } ; note = { content, created_at, auteur (id) }.
--  · processus_notes_export(athlètes[], cartes[])                 : TOUTES les notes des lignes de l'export
--    Excel (même défaut : .in(...) dans l'adresse — l'export des Lauréats échouait, « notes illisibles »).
--
-- ACCÈS. Les deux lectures de cartes sont SECURITY DEFINER pour une seule raison, la vitesse : sous RLS,
-- acces_carte_lecture était évaluée à CHAQUE ligne (952 cartes + 870 notes ≈ 350 ms en local, 5 000 cartes
-- ≈ 1 s). Elles appliquent EXACTEMENT la règle des policies, une fois par unité :
--    carte lisible = fusionnee_le IS NULL (cartes_non_fusionnees, restrictive)
--                    ET acces_carte_lecture(unite_cegep_id, unite_sport_id) (cartes_select, seule permissive
--                    en lecture) ;
--    note lisible  = carte_lecture_ok(carte_id) = note d'une carte lisible (cartes_notes_select, seule policy
--                    de lecture).
-- Les équipes, écoles et positions : lisibles par tout RECRUTEUR (teams « Recruiters see teams »), et
-- acces_carte_lecture exige un RECRUTEUR — l'imbrication ne montre rien de plus qu'avant. La garde de départ
-- vérifie ces policies et ces fonctions telles que relevées : si elles changent, cette migration ne passe pas
-- (et le relevé du lot prod non plus). Les notes des DOSSIERS restent sous la RLS de l'appelant
-- (processus_dernieres_notes est SECURITY INVOKER).
-- Aucun droit nouveau sur les données, aucune donnée écrite, aucune fonction existante modifiée.

do $$
declare
  v_pol text;
begin
  if to_regprocedure('public.processus_cartes(uuid, uuid, boolean)') is not null
     or to_regprocedure('public.processus_dernieres_notes_cartes(uuid, uuid, boolean)') is not null
     or to_regprocedure('public.processus_dernieres_notes(uuid, uuid, boolean)') is not null
     or to_regprocedure('public.processus_notes_export(uuid[], uuid[])') is not null then
    raise exception 'NEXUS: migration déjà appliquée (processus_cartes)';
  end if;
  if to_regprocedure('public.unite_pipeline(uuid, boolean)') is null then
    raise exception 'NEXUS: unite_pipeline(uuid, boolean) absente';
  end if;
  -- Les policies de LECTURE reproduites ci-dessous, telles que relevées (prod = local, 2026-10-16).
  select string_agg(polname || '|' || polcmd::text || '|' || polpermissive::text || '|' || coalesce(pg_get_expr(polqual, polrelid), ''),
                    ';' order by polname)
    into v_pol
    from pg_policy
   where polrelid in ('public.cartes_prospect'::regclass, 'public.cartes_prospect_notes'::regclass)
     and polcmd in ('r', '*');
  if v_pol is distinct from 'cartes_non_fusionnees|*|false|(fusionnee_le IS NULL);'
                            'cartes_notes_select|r|true|carte_lecture_ok(carte_id);'
                            'cartes_select|r|true|acces_carte_lecture(unite_cegep_id, unite_sport_id)' then
    raise exception 'NEXUS: policies de lecture des cartes ≠ relevé (%)', v_pol;
  end if;
  if (select md5(btrim(regexp_replace(regexp_replace(replace(prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
        from pg_proc where oid = 'public.carte_lecture_ok(uuid)'::regprocedure)
     is distinct from 'a1bb67f6eb7ae0e0fbe9cd620f452c76' then
    raise exception 'NEXUS: carte_lecture_ok ne correspond pas au relevé';
  end if;
end $$;

-- ── Toutes les cartes lisibles, une seule valeur ─────────────────────────────

create function public.processus_cartes(p_cegep_id uuid, p_sport_id uuid, p_tout_le_cegep boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  -- MATERIALIZED : l'accès est évalué une fois par UNITÉ, jamais poussé ligne à ligne par le planificateur.
  with unites as materialized (
         select distinct c.unite_cegep_id, c.unite_sport_id
           from public.cartes_prospect c
          where (p_cegep_id is null or c.unite_cegep_id = p_cegep_id)
            and (p_tout_le_cegep or p_sport_id is null or c.unite_sport_id = p_sport_id)),
       lisibles as materialized (
         select u.unite_cegep_id, u.unite_sport_id from unites u
          where public.acces_carte_lecture(u.unite_cegep_id, u.unite_sport_id))
  select coalesce(jsonb_agg(to_jsonb(x) order by x.etape_le desc, x.id), '[]'::jsonb)
    from (
      select c.id, c.unite_cegep_id, c.unite_sport_id, c.cree_par, c.prenom, c.nom, c.team_id, c.position_id,
             c.numero, c.promotion, c.taille_pieds, c.taille_pouces, c.poids_lbs, c.lien_video, c.courriel,
             c.telephone, c.parent_nom, c.parent_courriel, c.etape, c.grade, c.relance_le, c.relance_note,
             c.visite_le, c.drapeau, c.invitee_le, c.invitation_etat, c.renvois_invitation, c.dernier_renvoi_le,
             c.etape_le, c.derniere_activite, c.created_at, c.school_id, c.sport_athlete_id,
             case when t.id is null then null else jsonb_build_object(
               'name', t.name, 'division', t.division, 'league', t.league, 'age_group', t.age_group,
               'gender', t.gender, 'zone', t.zone, 'season', t.season, 'rseq_team_id', t.rseq_team_id,
               'schools', case when ts.id is null then null
                               else jsonb_build_object('name', ts.name, 'region', ts.region, 'type', ts.type) end)
             end as teams,
             case when e.id is null then null
                  else jsonb_build_object('name', e.name, 'region', e.region, 'type', e.type) end as etablissement,
             case when p.id is null then null else jsonb_build_object('abreviation', p.abreviation) end as positions
        from public.cartes_prospect c
        join lisibles l              on l.unite_cegep_id = c.unite_cegep_id and l.unite_sport_id = c.unite_sport_id
        left join public.teams t     on t.id = c.team_id
        left join public.schools ts  on ts.id = t.school_id
        left join public.schools e   on e.id = c.school_id
        left join public.positions p on p.id = c.position_id
       where c.fusionnee_le is null
         and (p_cegep_id is null or c.unite_cegep_id = p_cegep_id)
         and (p_tout_le_cegep or p_sport_id is null or c.unite_sport_id = p_sport_id)
    ) x
$$;

-- ── Dernière note de chaque carte lisible, une seule valeur ──────────────────

create function public.processus_dernieres_notes_cartes(p_cegep_id uuid, p_sport_id uuid, p_tout_le_cegep boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with unites as materialized (
         select distinct c.unite_cegep_id, c.unite_sport_id
           from public.cartes_prospect c
          where (p_cegep_id is null or c.unite_cegep_id = p_cegep_id)
            and (p_tout_le_cegep or p_sport_id is null or c.unite_sport_id = p_sport_id)),
       lisibles as materialized (
         select u.unite_cegep_id, u.unite_sport_id from unites u
          where public.acces_carte_lecture(u.unite_cegep_id, u.unite_sport_id))
  select coalesce(jsonb_object_agg(d.carte_id, jsonb_build_object('content', d.contenu, 'created_at', d.created_at, 'auteur', d.auteur)), '{}'::jsonb)
    from (select distinct on (n.carte_id) n.carte_id, n.contenu, n.created_at, n.auteur
            from public.cartes_prospect_notes n
            join public.cartes_prospect c on c.id = n.carte_id
            join lisibles l               on l.unite_cegep_id = c.unite_cegep_id and l.unite_sport_id = c.unite_sport_id
           where c.fusionnee_le is null
             and (p_cegep_id is null or c.unite_cegep_id = p_cegep_id)
             and (p_tout_le_cegep or p_sport_id is null or c.unite_sport_id = p_sport_id)
           order by n.carte_id, n.created_at desc, n.id desc) d
$$;

-- ── Dernières notes du processus : cartes + dossiers (RLS de l'appelant) ─────

create function public.processus_dernieres_notes(p_cegep_id uuid, p_sport_id uuid, p_tout_le_cegep boolean default false)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'cartes', public.processus_dernieres_notes_cartes(p_cegep_id, p_sport_id, p_tout_le_cegep),
    'dossiers', coalesce((
      select jsonb_object_agg(d.athlete_id, jsonb_build_object('content', d.content, 'created_at', d.created_at, 'auteur', d.recruiter_id))
        from (select distinct on (r.athlete_id) r.athlete_id, r.content, r.created_at, r.recruiter_id
                from public.recruiter_notes r
               where r.athlete_id in (select u.athlete_id from public.unite_pipeline(p_sport_id, p_tout_le_cegep) u)
               order by r.athlete_id, r.created_at desc nulls last, r.id desc) d), '{}'::jsonb))
$$;

-- ── Export Excel : TOUTES les notes des lignes exportées, une seule valeur ──
-- Les identifiants voyagent dans le CORPS de l'appel (tableaux), plus dans l'adresse ; aucun plafond de
-- lignes. RLS de l'appelant (SECURITY INVOKER) : exactement les notes que l'ancienne lecture rendait.

create function public.processus_notes_export(p_athletes uuid[], p_cartes uuid[])
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'dossiers', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.athlete_id, 'content', r.content, 'created_at', r.created_at,
                                          'auteur', r.recruiter_id) order by r.created_at, r.id)
        from public.recruiter_notes r
       where r.athlete_id = any(coalesce(p_athletes, '{}'::uuid[]))), '[]'::jsonb),
    'cartes', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.carte_id, 'content', n.contenu, 'created_at', n.created_at,
                                          'auteur', n.auteur) order by n.created_at, n.id)
        from public.cartes_prospect_notes n
       where n.carte_id = any(coalesce(p_cartes, '{}'::uuid[]))), '[]'::jsonb))
$$;

-- ── Droits ───────────────────────────────────────────────────────────────────

revoke all on function public.processus_notes_export(uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.processus_notes_export(uuid[], uuid[]) to authenticated;
revoke all on function public.processus_cartes(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.processus_dernieres_notes_cartes(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.processus_dernieres_notes(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.processus_cartes(uuid, uuid, boolean) to authenticated;
grant execute on function public.processus_dernieres_notes_cartes(uuid, uuid, boolean) to authenticated;
grant execute on function public.processus_dernieres_notes(uuid, uuid, boolean) to authenticated;

-- ── Garde finale ─────────────────────────────────────────────────────────────

do $$
declare
  r record;
  vus text[];
begin
  for r in select p.oid, p.proname from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('processus_cartes', 'processus_dernieres_notes_cartes', 'processus_dernieres_notes',
                                'processus_notes_export')
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.oid;
    if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
      raise exception 'NEXUS: ACL % = %, attendu {authenticated,postgres,service_role}', r.proname, vus;
    end if;
  end loop;
  if (select string_agg(proname || ':' || prosecdef::text, ',' order by proname) from pg_proc
       where pronamespace = 'public'::regnamespace
         and proname in ('processus_cartes', 'processus_dernieres_notes_cartes', 'processus_dernieres_notes',
                         'processus_notes_export'))
     is distinct from 'processus_cartes:true,processus_dernieres_notes:false,processus_dernieres_notes_cartes:true,'
                      'processus_notes_export:false' then
    raise exception 'NEXUS: fonctions du processus manquantes ou mode de sécurité inattendu';
  end if;
  if (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
        and proname in ('processus_cartes', 'processus_dernieres_notes_cartes')
        and position('acces_carte_lecture(' in prosrc) > 0 and position('fusionnee_le is null' in prosrc) > 0) <> 2 then
    raise exception 'NEXUS: une lecture de cartes ne reproduit pas la règle des policies';
  end if;
  raise notice 'NEXUS processus : cartes et dernières notes lues par fonctions (une valeur, sans plafond) — OK';
end $$;
$PRMIG$::text as t;
do $epr$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _pr_texte' using '20261016060000', 'processus_cartes_rpc', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _pr_texte' using '20261016060000', 'processus_cartes_rpc';
  end if;
end $epr$;
insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_PROCESSUS_CARTES_RPC',
       'Mon processus : cartes et dernières notes lues par fonctions (ni identifiants dans l''adresse ni plafond de 1000 lignes), export complet (correctif urgent, GO BP)',
       jsonb_build_object('version', '20261016060000', 'md5_fichier', '2e7b5dabfd5fa690b0fe152669990ef6', 'etat_depart', '7cf4b4282075e604ca6b7d74b2c12d24',
                          'empreinte_objets', 'e1146ae5cf5be08cb8f6c77d7bc3052a'),
       (select id from public.users where lower(email) = 'bptds22@gmail.com' limit 1);

-- 5. Gardes finales
do $fpr$
declare
  v_empreinte text;
  v_n int;
begin
  if (select txid from _pr_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261016060000')
     is distinct from '2e7b5dabfd5fa690b0fe152669990ef6' then
    raise exception 'NEXUS LOT: le texte enregistré n''est pas le fichier testé (md5)';
  end if;
  select e.empreinte_objets, e.n_elements into v_empreinte, v_n from (
select md5(string_agg(x, E'\n' order by x collate "C")) as empreinte_objets, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|'
         || case when p.proname in ('unite_pipeline', 'carte_lecture_ok', 'acces_carte_lecture')
                 then 'norm:' || md5(btrim(regexp_replace(regexp_replace(replace(p.prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
                 else p.prosrc end
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('unite_pipeline', 'carte_lecture_ok', 'acces_carte_lecture',
                       'processus_cartes', 'processus_dernieres_notes_cartes', 'processus_dernieres_notes',
                       'processus_notes_export')
  union all
  select 'pol:' || c.relname || '|' || po.polname || '|' || po.polcmd::text || '|' || po.polpermissive::text || '|'
         || coalesce(pg_get_expr(po.polqual, po.polrelid), '') || '|' || coalesce(pg_get_expr(po.polwithcheck, po.polrelid), '')
    from pg_policy po
    join pg_class c on c.oid = po.polrelid
   where po.polrelid in ('public.cartes_prospect'::regclass, 'public.cartes_prospect_notes'::regclass)
) t
  ) e;
  if v_empreinte is distinct from 'e1146ae5cf5be08cb8f6c77d7bc3052a' then
    raise exception 'NEXUS LOT: objets créés ≠ objets testés en local (empreinte % / % éléments) — tout est annulé', v_empreinte, v_n;
  end if;
  if (select count(*) from public.cartes_prospect) || '|' || (select count(*) from public.cartes_prospect_notes)
       || '|' || (select count(*) from public.recruiter_notes) || '|' || (select count(*) from public.recruiter_pipeline)
       || '|' || (select count(*) from public.users) <> (select donnees from _pr_releve) then
    raise exception 'NEXUS LOT: une donnée a changé — tout est annulé';
  end if;
  if (select count(*) from public.admin_operations) <> (select operations + 1 from _pr_releve) then
    raise exception 'NEXUS LOT: admin_operations non enregistrée — tout est annulé';
  end if;
end $fpr$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, etat_objets, operations, version_deja, derniere_version, pg from _pr_releve) r),
  'apres', json_build_object(
     'donnees', (select count(*) from public.cartes_prospect) || '|' || (select count(*) from public.cartes_prospect_notes)
       || '|' || (select count(*) from public.recruiter_notes) || '|' || (select count(*) from public.recruiter_pipeline)
       || '|' || (select count(*) from public.users),
     'version', (select version from supabase_migrations.schema_migrations where version = '20261016060000'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261016060000'),
     'admin_operation', (select id from public.admin_operations where operation = 'MIGRATION_PROCESSUS_CARTES_RPC' order by le desc limit 1),
     'fonctions', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
                     and proname in ('processus_cartes', 'processus_dernieres_notes_cartes', 'processus_dernieres_notes',
                                     'processus_notes_export')),
     'meme_transaction', (select txid from _pr_releve) = txid_current())
) as resultat_lot_processus;
