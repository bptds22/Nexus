-- 20260917184623_pipeline_frontieres_lot2a_retrait_policies
--
-- APPLIQUEE en PROD le 2026-09-17 via MCP apply_migration, sur GO de BP.
-- Nom de fichier aligne sur la version REELLE assignee par MCP (redigee sous
-- 20260917210000). Verifiee en prod sous identite reelle APRES apply :
-- coach = 0 ligne en direct (1 avant, visite comprise), RPC = ses 4 colonnes ;
-- admin cegep = 0 ligne et 0 note de son collegue en direct, RPC d apercu OK ;
-- reassignation = deplace tout, 0 notification, 0 ligne de journal.
--
-- ── LOT 2a DES FRONTIERES DU PIPELINE — ETAPE 2/2 : LE RETRAIT ───────────────
-- L'etape 1 (20260917181701) a POSE trois RPC sans rien retirer ; le web qui
-- les appelle est deploye et verifie en prod. Cette migration ferme les acces
-- qu'elles remplacent. C'est ici, et seulement ici, que la garantie devient
-- une garantie de BASE DE DONNEES : jusqu'a present, le cloisonnement
-- « le coach ne voit que le stage » n'existait que dans l'UI.
--
-- Decision BP 2026-09-17 : `next_action_note`, `visit_at` et `flagged` sont
-- PRIVES au recruteur. Ni le coach, ni l'admin cegep ne doivent pouvoir les
-- lire, meme par appel direct a l'API.
--
-- ── POURQUOI RETIRER DES LIGNES PLUTOT QUE DES COLONNES ─────────────────────
-- La RLS PostgreSQL filtre des LIGNES, jamais des colonnes. Tant qu'une policy
-- SELECT rend une ligne de `recruiter_pipeline` a un role, ce role lit TOUTES
-- ses colonnes. Il n'existe donc que deux façons de tenir la decision : retirer
-- la ligne (ici), ou deplacer les colonnes dans une table a part (Lot 2b,
-- reporte au lot mobile parce que des binaires publies les ecrivent encore).
--
-- ── CE QUI EST RETIRE, ET CE QUI LE REMPLACE ────────────────────────────────
--   coaches read pipeline for own athletes  -> coach_pipeline_for_my_athletes()
--   cegep admin read pipeline               -> cegep_pipeline_overview()
--   cegep admin update pipeline             -> reassign_pipeline()
--   cegep admin insert notes                -> reassign_pipeline() (deplacement)
--   cegep admin read notes                  -> plus rien : une note privee de
--                                              recruteur n'a pas a etre lue par
--                                              l'admin du cegep. Elle n'etait
--                                              lue que par la reassignation,
--                                              pour COPIER — ce que la RPC ne
--                                              fait plus (elle deplace).
--   cegep admin insert favorites            -> reassign_pipeline() (deplacement)
--   cegep admin update favorites            -> reassign_pipeline() (deplacement)
--
-- ── CE QUI RESTE, DELIBEREMENT ──────────────────────────────────────────────
-- · `cegep admin read favorites` : les ecrans Mon CEGEP comptent encore les
--   favoris de l'equipe en lecture directe (recruteurs :154, stats :248).
--   Hors perimetre de la decision, qui ne vise que les trois colonnes privees.
-- · `admins read all` / `admins update all` : l'admin plateforme est
--   explicitement hors decision (BP, 2026-09-17).
-- · Les policies proprietaire (`recruiter_pipeline_*`) : inchangees.
--
-- ── APRES CETTE MIGRATION ───────────────────────────────────────────────────
-- `recruiter_pipeline` n'est plus lisible que par son proprietaire et l'admin
-- plateforme. `next_action_note`, `visit_at` et `flagged` sont donc prives sans
-- avoir bouge de table. `recruiter_notes` redevient strictement proprietaire.
--
-- ⚠ REGRESSION CONNUE ET ACCEPTEE (registre docs/fast-follow-1.4.2.md §28) :
-- `components/shared/CoachDashboardMobile.tsx:621` lit encore le pipeline en
-- direct. Son indicateur « contactes » affiche 0 dans les binaires coach
-- publies jusqu'au lot mobile. Aucune erreur, aucun plantage.

-- Garde : ne pas fermer les acces si leurs remplaçants ne sont pas la.
do $$
declare v_n int;
begin
  select count(*) into v_n from pg_proc
   where pronamespace = 'public'::regnamespace
     and proname in ('coach_pipeline_for_my_athletes','cegep_pipeline_overview','reassign_pipeline');
  if v_n <> 3 then
    raise exception 'NEXUS: les 3 RPC de l''etape 1 sont absentes (% trouvee(s)) — ne pas retirer les policies', v_n;
  end if;
end $$;

drop policy if exists "coaches read pipeline for own athletes" on public.recruiter_pipeline;
drop policy if exists "cegep admin read pipeline"              on public.recruiter_pipeline;
drop policy if exists "cegep admin update pipeline"            on public.recruiter_pipeline;

drop policy if exists "cegep admin insert favorites"           on public.recruiter_favorites;
drop policy if exists "cegep admin update favorites"           on public.recruiter_favorites;

drop policy if exists "cegep admin insert notes"               on public.recruiter_notes;
drop policy if exists "cegep admin read notes"                 on public.recruiter_notes;

-- ── GATE — listes de policies COMPLETES, triees, jamais par inclusion ───────
do $$
declare
  vus  text[];
  veut text[];
begin
  veut := array['admins read all','admins update all','recruiter_pipeline_delete',
                'recruiter_pipeline_insert','recruiter_pipeline_select','recruiter_pipeline_update'];
  select array_agg(polname order by polname) into vus
    from pg_policy where polrelid = 'public.recruiter_pipeline'::regclass;
  if vus is distinct from veut then
    raise exception 'NEXUS: policies de recruiter_pipeline = %, attendu %', vus, veut;
  end if;

  veut := array['Athletes read own favorites','Coaches read favorites for their athletes',
                'admins read all','cegep admin read favorites','recruiter_favorites_delete',
                'recruiter_favorites_insert','recruiter_favorites_select','recruiter_favorites_update'];
  select array_agg(polname order by polname) into vus
    from pg_policy where polrelid = 'public.recruiter_favorites'::regclass;
  if vus is distinct from veut then
    raise exception 'NEXUS: policies de recruiter_favorites = %, attendu %', vus, veut;
  end if;

  veut := array['Recruiters manage own notes'];
  select array_agg(polname order by polname) into vus
    from pg_policy where polrelid = 'public.recruiter_notes'::regclass;
  if vus is distinct from veut then
    raise exception 'NEXUS: policies de recruiter_notes = %, attendu %', vus, veut;
  end if;

  -- La RLS doit rester active : sans elle, retirer des policies OUVRIRAIT tout.
  if not (select bool_and(relrowsecurity) from pg_class
           where oid in ('public.recruiter_pipeline'::regclass,
                         'public.recruiter_favorites'::regclass,
                         'public.recruiter_notes'::regclass)) then
    raise exception 'NEXUS: RLS inactive sur une des trois tables';
  end if;

  raise notice 'NEXUS: Lot 2a etape 2 — pipeline 6 policies, favoris 8, notes 1. RLS active.';
end $$;
