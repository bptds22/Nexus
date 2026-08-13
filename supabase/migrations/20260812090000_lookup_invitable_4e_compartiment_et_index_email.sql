-- ═══════════════════════════════════════════════════════════════
-- ITEM 4d — 4e compartiment public.users + index unique partiel
--
-- ── LE TROU ────────────────────────────────────────────────────
-- Les compartiments 1 à 3 de lookup_invitable_athletes_by_email
-- partent TOUS de public.athletes (le 3e fait un LEFT JOIN users,
-- mais l'ancre reste athletes). Un courriel qui appartient à un
-- compte public.users SANS ligne athletes — un COACH, un
-- RECRUTEUR, un PARENT, un ADMIN — n'était donc détecté par aucun
-- d'eux.
--
-- Conséquence : le coach voyait « aucun compte », lançait une
-- invitation, et la collision n'apparaissait qu'au signup. Or
-- signUp sur un courriel déjà pris rend une ERREUR que l'UI
-- traduit en « Vérifie ton courriel » — l'invité restait bloqué
-- sans message utile, et le coach croyait l'invitation partie.
--
-- Le 4e compartiment ferme ce trou EN AMONT : il rend les mêmes
-- deux drapeaux que le 3e, et le front les agrège déjà par
-- `.some()` (athleteEmailAutocomplete.ts:252-253).
--
-- DRAPEAUX SEULS, AUCUNE PII : on signale qu'un compte existe, on
-- ne divulgue jamais le nom ni le rôle du titulaire. Un coach n'a
-- pas à apprendre qu'un courriel donné appartient à tel recruteur.
-- athlete_id reste NULL, donc la ligne ne peut pas remonter dans
-- les suggestions — le front les filtre sur `r.athlete_id`
-- (athleteEmailAutocomplete.ts:242).
--
-- CREATE OR REPLACE suffit ici : le RETURNS TABLE est inchangé.
-- Pas de DROP, donc pas de reprise du grant `anon` par les default
-- privileges Supabase (voir le piège documenté dans
-- 20260811210000).
--
-- ── L'INDEX ────────────────────────────────────────────────────
-- public.athletes n'a AUCUN index sur email (vérifié au catalogue :
-- seul users_email_key existe, et il porte sur users.email brut).
-- Le lookup filtre pourtant sur lower(a.email) à chaque frappe.
--
-- Partiel parce que la colonne est optionnelle : 8 des 26 lignes
-- ont email NULL ou vide, et deux orphelins « sans courriel » ne
-- sont pas des doublons. Sans le WHERE, l'unicité les ferait
-- entrer en collision.
--
-- lower(btrim(...)) parce que « Bob@x.com » et « bob@x.com  » sont
-- le même destinataire : c'est cette clé-là qui doit être unique,
-- pas l'octet brut.
--
-- Pré-vol exécuté avant d'appliquer : 0 doublon sur
-- lower(btrim(email)) dans athletes ET dans users. L'index passe
-- sans réparation de données préalable.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ── L'index ─────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS athletes_email_lower_btrim_uniq
  ON public.athletes (lower(btrim(email)))
  WHERE email IS NOT NULL AND btrim(email) <> '';

COMMENT ON INDEX public.athletes_email_lower_btrim_uniq IS
  'Item 4d — unicite du courriel athlete, insensible a la casse et aux espaces. Partiel : les lignes sans courriel (NULL ou vide) sont exclues, sinon elles entreraient en collision entre elles.';

-- ── La fonction, avec son 4e compartiment ───────────────────────

CREATE OR REPLACE FUNCTION public.lookup_invitable_athletes_by_email(p_prefix text)
RETURNS TABLE(
  athlete_id           uuid,
  email                text,
  first_name           text,
  last_name            text,
  sport_name           text,
  has_account          boolean,
  exists_not_invitable boolean,
  exists_exact         boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_prefix text := lower(trim(coalesce(p_prefix, '')));
  v_caller uuid := auth.uid();
begin
  if not public.is_coach() then
    return;
  end if;
  if length(v_prefix) < 4 then
    return;
  end if;

  return query
  -- Compartiment 1 : MES orphelins sans compte -> invitable (courriel de claim).
  -- PREFIXE conserve : c'est une suggestion, elle doit apparaitre en tapant.
  ( select a.id, a.email, a.first_name, a.last_name, sp.nom, false, false, false
    from public.athletes a
    left join public.sports sp on sp.id = a.sport_id
    where a.coach_id = v_caller
      and a.user_id is null
      and a.email is not null
      and lower(a.email) like v_prefix || '%'
    order by a.email
    limit 3 )

  union all
  -- Compartiment 2 : comptes SANS coach (civil OU scolaire) -> invitable.
  -- PREFIXE conserve, meme raison.
  ( select a.id, u.email, a.first_name, a.last_name, sp.nom, true, false, false
    from public.users u
    join public.athletes a on a.user_id = u.id
    left join public.sports sp on sp.id = a.sport_id
    where u.role = 'ATHLETE'
      and a.coach_id is null
      and u.email ilike v_prefix || '%'
    order by u.email
    limit 3 )

  union all
  -- Compartiment 3 : existe mais NON-invitable -> DRAPEAUX SEULS, AUCUNE PII.
  --   exists_not_invitable : inchange, sur PREFIXE.
  --   exists_exact         : sur EGALITE — c'est lui qui gouverne la
  --                          banniere, le blocage de creation et le bouton.
  -- Les deux predicats de non-invitabilite sont identiques ; seule la
  -- comparaison du courriel change. Ne pas les factoriser : les garder cote a
  -- cote rend l'ecart visible.
  ( select null::uuid, null::text, null::text, null::text, null::text,
           null::boolean,
           exists (
             select 1
             from public.athletes a
             left join public.users u on u.id = a.user_id
             where lower(coalesce(a.email, u.email)) like v_prefix || '%'
               and not coalesce(a.coach_id = v_caller and a.user_id is null, false)
               and not (a.coach_id is null and a.user_id is not null)
           ),
           exists (
             select 1
             from public.athletes a
             left join public.users u on u.id = a.user_id
             where lower(btrim(coalesce(a.email, u.email))) = v_prefix
               and not coalesce(a.coach_id = v_caller and a.user_id is null, false)
               and not (a.coach_id is null and a.user_id is not null)
           )
    where exists (
      select 1
      from public.athletes a
      left join public.users u on u.id = a.user_id
      where lower(coalesce(a.email, u.email)) like v_prefix || '%'
        and not coalesce(a.coach_id = v_caller and a.user_id is null, false)
        and not (a.coach_id is null and a.user_id is not null)
    ) )

  union all
  -- Compartiment 4 : le courriel appartient a un compte public.users qui n'a
  -- AUCUNE ligne athletes (COACH, RECRUTEUR, PARENT, ADMIN). Invisible des
  -- compartiments 1-3, qui sont tous ancres sur public.athletes.
  -- DRAPEAUX SEULS, AUCUNE PII : on signale l'existence, jamais l'identite
  -- ni le role. athlete_id reste NULL -> exclu des suggestions cote front.
  -- Le coach lui-meme tombe ici s'il saisit son propre courriel : correct,
  -- on ne s'invite pas soi-meme.
  ( select null::uuid, null::text, null::text, null::text, null::text,
           null::boolean,
           exists (
             select 1 from public.users u
             where lower(btrim(u.email)) like v_prefix || '%'
               and not exists (select 1 from public.athletes a where a.user_id = u.id)
           ),
           exists (
             select 1 from public.users u
             where lower(btrim(u.email)) = v_prefix
               and not exists (select 1 from public.athletes a where a.user_id = u.id)
           )
    where exists (
      select 1 from public.users u
      where lower(btrim(u.email)) like v_prefix || '%'
        and not exists (select 1 from public.athletes a where a.user_id = u.id)
    ) );
end;
$function$;

COMMENT ON FUNCTION public.lookup_invitable_athletes_by_email(text) IS
  'Item 4d — 4 compartiments. 1-2 : suggestions invitables (PII, prefixe). 3 : existe mais non-invitable, drapeaux seuls. 4 : courriel pris par un compte users sans ligne athletes (coach, recruteur, parent), drapeaux seuls — ferme la collision qui ne se revelait qu au signup.';

COMMIT;
