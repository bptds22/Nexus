-- 20260928143738_list_notes_policy_liste (version enregistrée en prod ; écrite 20260928150000)
--
-- REGISTRE §41 — NOTES DE LISTE : on n'écrit que dans une liste qui est la
-- sienne ou celle de son unité (GO BP 2026-09-28).
--
-- Le trou : la policy propriétaire « Recruiters manage their own list notes »
-- (FOR ALL, PUBLIC) n'exigeait que recruiter_id = auth.uid(), jamais que la
-- LISTE soit accessible. Depuis B1, unite_poser range la note dans l'unité de
-- la liste et unite_select la rend lisible à cette unité : un recruteur d'un
-- autre cégep qui connaît l'id d'une liste pouvait y injecter une note
-- (prouvé en local le 2026-09-28).
--
-- Le correctif : la policy FOR ALL est remplacée par quatre policies
-- propriétaire, une par commande :
--   · SELECT / DELETE : ses propres notes — inchangé ;
--   · INSERT : sa propre note, Pro (B2-0 : gratuit = tout bloqué), dans une
--     liste ouverte à lui (la sienne, ou celle de son unité, Pro) ;
--   · UPDATE : sa propre note, et elle ne peut pas partir vers une liste qui
--     ne lui est pas ouverte.
-- La vérification passe par liste_ouverte_a_moi(), SECURITY DEFINER
-- (checklist, règle 4 : pas de sous-requête brute dans une policy).
--
-- Les policies unite_* ne bougent pas. AUCUNE contrainte, AUCUNE colonne,
-- AUCUNE signature existante touchée ; ACL de la table inchangée (gate).
-- L'app 1.4.3 n'écrit des notes que dans ses propres listes, écran réservé
-- au Pro : aucun client livré n'est cassé.
-- Prod au moment de l'écriture : 0 note de liste — aucune donnée touchée.
--
-- Rollback : supabase/rollback/20260928143738_rollback_list_notes_policy_liste.sql

-- ACL de la table AVANT, pour la comparer intégralement APRÈS.
create temp table _acl_avant on commit drop as
  select relacl::text as acl from pg_class where oid = 'public.recruiter_list_notes'::regclass;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. AIDE — la liste est-elle ouverte à l'appelant ?
-- ════════════════════════════════════════════════════════════════════════════
create function public.liste_ouverte_a_moi(p_list_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.recruiter_lists l
     where l.id = p_list_id
       and (l.recruiter_id = auth.uid()
            or public.acces_unite_pro(l.unite_cegep_id, l.unite_sport_id))
  )
$$;
comment on function public.liste_ouverte_a_moi(uuid) is
  'Registre §41 (2026-09-28) : vrai si la liste est à l''appelant, ou à son unité (Pro). Utilisée par les policies de recruiter_list_notes.';

revoke execute on function public.liste_ouverte_a_moi(uuid) from public, anon;
grant  execute on function public.liste_ouverte_a_moi(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. POLICIES — la FOR ALL remplacée par quatre policies propriétaire.
-- ════════════════════════════════════════════════════════════════════════════
drop policy "Recruiters manage their own list notes" on public.recruiter_list_notes;

create policy list_notes_select on public.recruiter_list_notes for select to authenticated
  using (recruiter_id = (select auth.uid()));

create policy list_notes_insert on public.recruiter_list_notes for insert to authenticated
  with check (recruiter_id = (select auth.uid())
              and public.user_has_pro()
              and public.liste_ouverte_a_moi(list_id));

create policy list_notes_update on public.recruiter_list_notes for update to authenticated
  using (recruiter_id = (select auth.uid()))
  with check (recruiter_id = (select auth.uid())
              and public.liste_ouverte_a_moi(list_id));

create policy list_notes_delete on public.recruiter_list_notes for delete to authenticated
  using (recruiter_id = (select auth.uid()));

-- ════════════════════════════════════════════════════════════════════════════
-- 3. GATES — listes complètes, jamais par inclusion.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  vus text[];
  veut text[];
  avant text;
  apres text;
begin
  -- 3a. Les policies de la table, liste complète.
  select array_agg(polname::text order by polname::text) into vus
    from pg_policy where polrelid = 'public.recruiter_list_notes'::regclass;
  veut := array['list_notes_delete','list_notes_insert','list_notes_select','list_notes_update',
                'unite_delete','unite_select','unite_update'];
  if vus is distinct from veut then
    raise exception 'NEXUS: policies de recruiter_list_notes = %, attendu %', vus, veut;
  end if;

  -- 3b. ACL de la fonction nouvelle, liste complète.
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.liste_ouverte_a_moi(uuid)'::regprocedure;
  veut := array['authenticated','postgres','service_role'];
  if vus is distinct from veut then
    raise exception 'NEXUS: ACL de liste_ouverte_a_moi = %, attendu %', vus, veut;
  end if;

  -- 3c. ACL de la table : identique à avant, au caractère près.
  select acl into avant from _acl_avant;
  select relacl::text into apres from pg_class where oid = 'public.recruiter_list_notes'::regclass;
  if avant is distinct from apres then
    raise exception 'NEXUS: ACL de recruiter_list_notes modifiée : % → %', avant, apres;
  end if;

  -- 3d. RLS toujours active.
  if not (select relrowsecurity from pg_class where oid = 'public.recruiter_list_notes'::regclass) then
    raise exception 'NEXUS: RLS désactivée sur recruiter_list_notes';
  end if;
end $$;
