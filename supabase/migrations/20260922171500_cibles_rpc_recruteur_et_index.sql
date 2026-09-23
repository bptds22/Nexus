-- ════════════════════════════════════════════════════════════════════════
-- LOT 1 — « quels athlètes ciblent MON cégep », côté recruteur.
--
-- DÉCISION BP : cibler un cégep le lui fait savoir. Jusqu'ici c'était
-- impossible — `public.athlete_targets` ne porte QU'UNE policy, « Athletes
-- manage own targets » (FOR ALL, l'athlète propriétaire), et AUCUNE vue ni
-- AUCUNE fonction ne projetait ses lignes. Un recruteur qui interrogeait
-- l'API directement recevait 0 ligne. Ici, contrairement au pipeline,
-- l'UI ne mentait pas : il n'y avait vraiment rien à lire.
--
-- CE QUE CETTE MIGRATION FAIT — additif, rien n'est redéfini :
--   1. une RPC NOUVELLE, `athletes_targeting_my_cegep()` ;
--   2. son ACL, resserrée puis vérifiée par comparaison INTÉGRALE ;
--   3. un index sur `school_id` (il n'en existait aucun) ;
--   4. la suppression d'un index unique EXACTEMENT redondant.
--
-- CE QU'ELLE NE FAIT PAS, DÉLIBÉRÉMENT : elle ne touche NI
-- `recruiter_search_athletes`, NI `recruiter_athlete_cards`, NI
-- `recruiter_athlete_profile`. Aucun DROP/CREATE sur une fonction livrée,
-- donc aucun risque de rejouer le 2026-09-07. Le filtre « seulement ceux
-- qui me ciblent » de la recherche, LUI, exigera ce DROP/CREATE — c'est
-- un lot à part (lot 5), et son gate d'ACL sera à réécrire là-bas.
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. LA RPC ───────────────────────────────────────────────────────────
--
-- POURQUOI UNE RPC ET PAS UNE POLICY DE PLUS SUR LA TABLE.
-- Même doctrine que le Lot 2a du pipeline (`docs/pipeline-recruteur-
-- frontieres.md`) : une policy rend la LIGNE ENTIÈRE, une RPC ne projette
-- que les colonnes décidées. Ici on ne rend que `athlete_id` et la date.
-- Aucune identité ne transite : le front croise ces ids avec les cartes
-- qu'il charge déjà par `recruiter_athlete_cards`, qui applique seule
-- `athlete_identity_ok()`. Un mineur non consentant reste donc anonyme
-- SANS que cette fonction ait à le savoir — et surtout, l'affichage SUIT
-- un retrait de consentement, ce qu'un nom recopié ici ne ferait jamais.
create or replace function public.athletes_targeting_my_cegep()
returns table (athlete_id uuid, targeted_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $fn$
declare
  v_school uuid;
begin
  -- ALLOWLIST EXPLICITE (MIGRATION SAFETY CHECKLIST, règle 11).
  -- Seul un RECRUTEUR a un « mon cégep » au sens de cette fonction. Le
  -- test `role = 'RECRUTEUR'` est écrit même s'il paraît redondant : un
  -- coach porte lui aussi un `users.school_id`, celui de son école
  -- SECONDAIRE. Il ne remonterait rien aujourd'hui (les 57 écoles ciblées
  -- en prod sont toutes de type CEGEP), mais s'appuyer sur cette
  -- coïncidence de données, c'est laisser la garde dépendre d'un fait qui
  -- peut changer sans que personne ne relise cette fonction.
  select u.school_id
    into v_school
    from public.users u
   where u.id = (select auth.uid())
     and u.role = 'RECRUTEUR'::public.user_role;

  -- Recruteur sans cégep rattaché : 8 comptes sur 25 en prod au
  -- 2026-09-22. On rend ZÉRO LIGNE, on ne lève pas.
  -- `recruiter_search_athletes` lève pour `p_offert_par_mon_cegep`, mais
  -- ce n'est pas le même geste : là-bas l'utilisateur DEMANDE un filtre
  -- qui exige un cégep ; ici la fonction est appelée au chargement du
  -- tableau de bord, et lever casserait la page de ces 8 comptes.
  -- L'UI décide d'afficher ou de MASQUER le bloc en relisant
  -- `users.school_id` (via `useCurrentUser`) — jamais en interprétant un
  -- zéro, qui ne distingue pas « aucun cégep » de « aucune cible ».
  if v_school is null then
    return;
  end if;

  return query
    select t.athlete_id, t.created_at
      from public.athlete_targets t
      join public.athletes a on a.id = t.athlete_id
     where t.school_id = v_school
       -- MIROIR OBLIGATOIRE de `recruiter_athlete_cards` (l. 54 :
       -- `AND a.status = 'ACTIF'`). Sans ce filtre, le bloc du tableau de
       -- bord annoncerait « 5 athlètes te ciblent » et seules 3 cartes se
       -- résoudraient — un écart muet, du type que ce projet paie cher.
       -- Mesuré au 2026-09-22 : 46 athlètes ciblent, 44 sont ACTIF.
       and a.status = 'ACTIF'::public.account_status
     order by t.created_at desc;
end;
$fn$;

comment on function public.athletes_targeting_my_cegep() is
  'Athlètes ACTIFS ayant ciblé le cégep du recruteur connecté (athlete_targets). '
  'Rend athlete_id + date seulement — aucune identité : le masquage des mineurs '
  'reste entier chez recruiter_athlete_cards. Zéro ligne si le compte n''est pas '
  'RECRUTEUR ou n''a pas de school_id.';


-- ── 2. ACL — resserrage PUIS vérification par comparaison intégrale ─────
--
-- L'`ALTER DEFAULT PRIVILEGES` de Supabase sur le schéma `public` accorde
-- EXECUTE à `anon`, `authenticated` et `service_role` sur TOUTE fonction
-- créée. Reposer les bons grants ne suffit donc pas : il faut RÉVOQUER ce
-- que les default privileges ont ajouté. C'est la leçon payée sur
-- `recruiter_search_athletes` le 2026-09-07.
revoke all on function public.athletes_targeting_my_cegep() from public;
revoke all on function public.athletes_targeting_my_cegep() from anon;

grant execute on function public.athletes_targeting_my_cegep() to authenticated;
grant execute on function public.athletes_targeting_my_cegep() to service_role;

-- GATE — liste COMPLÈTE et TRIÉE, jamais par inclusion.
-- `veut` reprend exactement l'ACL des trois RPC recruteur sœurs, relevée
-- en prod le 2026-09-22 : {authenticated, postgres, service_role}.
do $gate$
declare
  f    oid;
  vus  text[];
  veut text[] := array['authenticated','postgres','service_role'];
begin
  select p.oid into f
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'athletes_targeting_my_cegep'
     and pg_get_function_identity_arguments(p.oid) = '';

  if f is null then
    raise exception 'NEXUS: athletes_targeting_my_cegep() introuvable après CREATE';
  end if;

  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = f;

  if vus is distinct from veut then
    raise exception 'NEXUS: ACL = %, attendu %', vus, veut;
  end if;
end
$gate$;


-- ── 3. INDEX SUR school_id ──────────────────────────────────────────────
--
-- Aucun index ne portait `school_id` : les deux index existants commencent
-- tous deux par `athlete_id`. Or la RPC ci-dessus et le compteur
-- `count_followers_by_school()` filtrent sur `school_id` — donc seq scan.
-- Indolore à 318 lignes, pas à 30 000. `created_at desc` est dans la clé
-- parce que la RPC trie dessus et que le bloc du tableau de bord ne veut
-- que « les plus récents ».
create index if not exists athlete_targets_school_created_idx
  on public.athlete_targets (school_id, created_at desc);


-- ── 4. DÉDOUBLONNAGE DES DEUX INDEX UNIQUES IDENTIQUES ──────────────────
--
-- `athlete_targets_athlete_id_school_id_key` (adossé à la contrainte
-- UNIQUE de la table, donc NON supprimable seul) et
-- `athlete_targets_athlete_school_uidx` (index nu, ajouté séparément)
-- portent EXACTEMENT la même clé `(athlete_id, school_id)`. On garde
-- celui de la contrainte : c'est lui qui produit le 23505 sur lequel
-- `useSchoolTargets.ts` s'appuie pour rendre l'insertion idempotente.
drop index if exists public.athlete_targets_athlete_school_uidx;
