-- 20260917181701_pipeline_frontieres_lot2a_rpc
--
-- APPLIQUEE en PROD le 2026-09-17 via MCP apply_migration, sur GO de BP.
-- Nom de fichier aligne sur la version REELLE assignee par MCP (redigee sous
-- 20260917200000). md5 des 3 fonctions identique prod / local apres apply.
--
-- ETAPE 1/2 : AJOUT SEUL. Le retrait des policies est un geste SEPARE, apres
-- deploiement du web qui appelle ces RPC.
--
-- ── LOT 2a DES FRONTIERES DU PIPELINE — ETAPE 1/2 : AJOUT SEUL ───────────────
-- Decision BP 2026-09-17 : `next_action_note`, `visit_at` et `flagged` sont
-- PRIVES au recruteur. Ni le coach, ni l'admin cegep ne doivent pouvoir les
-- lire, meme par appel direct a l'API. Voir docs/pipeline-recruteur-frontieres.md.
--
-- La RLS PostgreSQL filtre des LIGNES, jamais des colonnes : tant qu'une policy
-- SELECT donne une ligne de `recruiter_pipeline` a un role, ce role lit TOUTES
-- ses colonnes. Deux policies donnent aujourd'hui des lignes a d'autres que le
-- proprietaire et l'admin plateforme :
--   · `coaches read pipeline for own athletes`  (coach, ligne entiere)
--   · `cegep admin read pipeline`               (admin cegep, lignes des collegues)
-- plus `cegep admin update pipeline`, qui laisse l'admin cegep reecrire
-- N'IMPORTE QUELLE colonne d'un collegue alors que seule la reassignation
-- (changer recruiter_id) en a besoin.
--
-- Cette migration AJOUTE les trois RPC qui remplaceront ces acces. Elle ne
-- retire RIEN : les policies restent en place, aucun ecran ne casse. Le retrait
-- est un geste SEPARE (etape 2/2), apres deploiement du web qui appelle ces RPC.
--
-- ── 1. coach_pipeline_for_my_athletes ────────────────────────────────────────
-- Quatre colonnes, pas une de plus : athlete_id, recruiter_id, stage,
-- updated_at. Rien de ce qui decrit la cuisine interne du recruteur.
--
-- PERIMETRE (decision BP) : les athletes dont l'appelant est `coach_id`
-- (acces actuel de la policy, conserve a l'identique — y compris un athlete
-- DIPLOME ou DESACTIVE) UNION `get_coach_athletes(true)` (equipes coachees et,
-- pour un directeur, toute l'ecole). Les pages « ecole » batissent deja leur
-- liste d'athletes avec get_coach_athletes puis lisaient le pipeline sous la
-- policy `coach_id = moi` : elles SOUS-COMPTAIENT en silence tout ce qui
-- touchait les athletes des autres coachs. Corrige au passage.
--
-- ── 2. cegep_pipeline_overview ───────────────────────────────────────────────
-- Remplace la lecture directe des ecrans « Mon CEGEP ». Colonnes : recruiter_id,
-- athlete_id, stage, created_at, updated_at, moved_at. Parite EXACTE avec la
-- RLS actuelle, colonnes privees en moins : une ligne est rendue si l'appelant
-- en est le proprietaire, s'il est admin cegep du recruteur, ou admin plateforme.
-- `p_recruiter_ids` est obligatoire : c'est le `.in("recruiter_id", teamIds)`
-- des ecrans, pousse dans la RPC.
--
-- ── 3. reassign_pipeline ─────────────────────────────────────────────────────
-- Remplace les ecritures client de /recruteur/cegep/reassignation, qui :
--   · COPIAIENT les notes (originales laissees au recruteur source, created_at
--     perdu, faux NOTE_ADDED via trg_log_note) ;
--   · faisaient un UPSERT de favori cote destinataire → trigger AFTER INSERT →
--     notify_athlete_favorited + notify_parent_favorited : l'athlete et son
--     parent recevaient une FAUSSE notification « favori » a chaque transfert ;
--   · ne transferaient pas les grades ;
--   · ignoraient la violation d'unicite quand le destinataire suivait deja
--     l'athlete (erreur avalee cote client).
-- Ici tout est un UPDATE de recruiter_id — DEPLACEMENT, pas copie :
--   recruiter_pipeline, recruiter_notes, recruiter_favorites,
--   recruiter_athlete_grades (decision BP : les grades suivent).
-- Aucun trigger INSERT ne part (favoris et notes n'ont que des triggers
-- INSERT/DELETE). Sur le pipeline, l'etape ne change pas : ni journal
-- PIPELINE_CHANGED, ni notification parent ; sync_global_recruitment_status
-- recalcule un statut inchange.
--
-- CONFLIT (decision BP) : signale dans le jsonb de retour, JAMAIS fusionne.
-- Un athlete est en conflit si la destination a deja une ligne pipeline pour
-- lui, ou si les deux recruteurs ont chacun un favori / un grade (l'UPDATE
-- violerait l'unicite). Un athlete en conflit n'est touche NULLE PART.
--
-- ── ACL ──────────────────────────────────────────────────────────────────────
-- CREATE FUNCTION → les DEFAULT PRIVILEGES Supabase accordent EXECUTE a anon.
-- Revoque explicitement, puis gate en liste COMPLETE triee (regle CLAUDE.md
-- du 2026-09-07) : {authenticated, postgres, service_role}.

-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.coach_pipeline_for_my_athletes(
  p_athlete_ids uuid[] default null,
  p_stages      text[] default null)
returns table (athlete_id uuid, recruiter_id uuid, stage text, updated_at timestamptz)
language sql
stable security definer
set search_path = public
set row_security = off
as $$
  select p.athlete_id, p.recruiter_id, p.stage::text, p.updated_at
    from public.recruiter_pipeline p
   where public.is_coach()
     and (p_athlete_ids is null or p.athlete_id = any(p_athlete_ids))
     and (p_stages      is null or p.stage::text = any(p_stages))
     and (
           exists (select 1 from public.athletes a
                    where a.id = p.athlete_id and a.coach_id = auth.uid())
        or p.athlete_id in (select s.athlete_id from public.get_coach_athletes(true) s)
     );
$$;

comment on function public.coach_pipeline_for_my_athletes(uuid[], text[]) is
  'Lot 2a — vue coach du pipeline : athlete_id, recruiter_id, stage, updated_at. Perimetre = coach_id OU get_coach_athletes(true). Jamais next_action_note / visit_at / flagged.';

-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.cegep_pipeline_overview(
  p_recruiter_ids uuid[],
  p_stages        text[] default null)
returns table (recruiter_id uuid, athlete_id uuid, stage text,
               created_at timestamptz, updated_at timestamptz, moved_at timestamptz)
language sql
stable security definer
set search_path = public
set row_security = off
as $$
  select p.recruiter_id, p.athlete_id, p.stage::text, p.created_at, p.updated_at, p.moved_at
    from public.recruiter_pipeline p
   where p.recruiter_id = any(coalesce(p_recruiter_ids, '{}'::uuid[]))
     and (p_stages is null or p.stage::text = any(p_stages))
     and (   p.recruiter_id = auth.uid()
          or public.is_cegep_admin_over_recruiter(p.recruiter_id)
          or public.is_admin());
$$;

comment on function public.cegep_pipeline_overview(uuid[], text[]) is
  'Lot 2a — vue « Mon CEGEP » du pipeline, sans colonnes privees. Parite RLS : proprietaire, admin cegep du recruteur, admin plateforme.';

-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reassign_pipeline(
  p_from        uuid,
  p_to          uuid,
  p_athlete_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_athlete  uuid;
  v_tables   text[];
  v_deplaces uuid[] := '{}';
  v_absents  uuid[] := '{}';
  v_conflits jsonb  := '[]'::jsonb;
  v_notes    int    := 0;
  v_n        int;
begin
  if auth.uid() is null then
    raise exception 'NEXUS: authentification requise' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from = p_to then
    raise exception 'NEXUS: la source et la destination doivent etre deux recruteurs distincts'
      using errcode = '22023';
  end if;
  if not (public.is_cegep_admin_over_recruiter(p_from)
          and public.is_cegep_admin_over_recruiter(p_to)) then
    raise exception 'NEXUS: reassignation reservee a l''admin du cegep des deux recruteurs'
      using errcode = '42501';
  end if;

  for v_athlete in
    select distinct x from unnest(coalesce(p_athlete_ids, '{}'::uuid[])) as x where x is not null
  loop
    -- Verrou sur la ligne source : deux reassignations concurrentes du meme
    -- athlete ne peuvent pas s'entrelacer.
    perform 1 from public.recruiter_pipeline
      where recruiter_id = p_from and athlete_id = v_athlete
      for update;
    if not found then
      v_absents := v_absents || v_athlete;
      continue;
    end if;

    v_tables := array_remove(array[
      case when exists (select 1 from public.recruiter_pipeline
                         where recruiter_id = p_to and athlete_id = v_athlete)
           then 'recruiter_pipeline' end,
      case when exists (select 1 from public.recruiter_favorites
                         where recruiter_id = p_from and athlete_id = v_athlete)
            and exists (select 1 from public.recruiter_favorites
                         where recruiter_id = p_to and athlete_id = v_athlete)
           then 'recruiter_favorites' end,
      case when exists (select 1 from public.recruiter_athlete_grades
                         where recruiter_id = p_from and athlete_id = v_athlete)
            and exists (select 1 from public.recruiter_athlete_grades
                         where recruiter_id = p_to and athlete_id = v_athlete)
           then 'recruiter_athlete_grades' end
    ], null);

    if cardinality(v_tables) > 0 then
      -- JAMAIS de fusion : l'athlete n'est touche nulle part.
      v_conflits := v_conflits || jsonb_build_object('athlete_id', v_athlete, 'tables', to_jsonb(v_tables));
      continue;
    end if;

    update public.recruiter_pipeline
       set recruiter_id = p_to
     where recruiter_id = p_from and athlete_id = v_athlete;

    update public.recruiter_notes
       set recruiter_id = p_to
     where recruiter_id = p_from and athlete_id = v_athlete;
    get diagnostics v_n = row_count;
    v_notes := v_notes + v_n;

    update public.recruiter_favorites
       set recruiter_id = p_to
     where recruiter_id = p_from and athlete_id = v_athlete;

    update public.recruiter_athlete_grades
       set recruiter_id = p_to
     where recruiter_id = p_from and athlete_id = v_athlete;

    v_deplaces := v_deplaces || v_athlete;
  end loop;

  return jsonb_build_object(
    'deplaces',        to_jsonb(v_deplaces),
    'conflits',        v_conflits,
    'absents',         to_jsonb(v_absents),
    'notes_deplacees', v_notes);
end;
$$;

comment on function public.reassign_pipeline(uuid, uuid, uuid[]) is
  'Lot 2a — reassignation cegep : DEPLACE (UPDATE recruiter_id) pipeline, notes, favoris, grades. Conflit = signale dans le retour, jamais fusionne.';

-- ── ACL ──────────────────────────────────────────────────────────────────────
revoke all on function public.coach_pipeline_for_my_athletes(uuid[], text[]) from public, anon;
revoke all on function public.cegep_pipeline_overview(uuid[], text[])        from public, anon;
revoke all on function public.reassign_pipeline(uuid, uuid, uuid[])           from public, anon;
grant execute on function public.coach_pipeline_for_my_athletes(uuid[], text[]) to authenticated, service_role;
grant execute on function public.cegep_pipeline_overview(uuid[], text[])        to authenticated, service_role;
grant execute on function public.reassign_pipeline(uuid, uuid, uuid[])           to authenticated, service_role;

-- ── GATE — ACL COMPLETE, triee, jamais par inclusion ─────────────────────────
do $$
declare
  f    regprocedure;
  vus  text[];
  veut text[] := array['authenticated','postgres','service_role'];
begin
  foreach f in array array[
    'public.coach_pipeline_for_my_athletes(uuid[], text[])'::regprocedure,
    'public.cegep_pipeline_overview(uuid[], text[])'::regprocedure,
    'public.reassign_pipeline(uuid, uuid, uuid[])'::regprocedure]
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = f;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL de % = %, attendu %', f, vus, veut;
    end if;
  end loop;

  -- Etape 1/2 : AUCUNE policy retiree. Si ce compte a bouge, la migration
  -- n'est pas celle qu'on croit appliquer.
  if (select count(*) from pg_policy where polrelid = 'public.recruiter_pipeline'::regclass) <> 9 then
    raise exception 'NEXUS: recruiter_pipeline devait porter 9 policies avant le Lot 2a';
  end if;

  raise notice 'NEXUS: Lot 2a etape 1 — 3 RPC posees, ACL exactes, 9 policies intactes.';
end $$;
