-- ═══════════════════════════════════════════════════════════════════════════
-- lookup_invitable_athletes_by_email — le drapeau exists_exact
--
-- LE PROBLÈME
-- Le compartiment 3 signale « un athlète existe à ce courriel, mais tu ne peux
-- pas l'inviter d'ici » — par un booléen SEUL, sans nom, sans identifiant, sans
-- courriel (choix Loi 25 : confirmer qu'une adresse appartient à un athlète
-- nommé serait une fuite).
-- Mais il le calculait par PRÉFIXE : `like v_prefix || '%'`. Taper « bptd »
-- suffisait à lever le drapeau, donc à afficher la bannière « un athlète
-- utilise déjà ce courriel », à bloquer la création et à proposer le bouton
-- d'invitation — sur une saisie partielle.
--
-- LA CORRECTION
-- Un SECOND drapeau, exists_exact, calculé par ÉGALITÉ. Le préfixe reste sur
-- les compartiments 1 et 2 : le coach doit voir des noms apparaître en tapant,
-- c'est le rôle des suggestions. Les quatre surfaces clientes (les deux wizards
-- de création, le modal web et la feuille mobile d'invitation) lisent désormais
-- exists_exact.
--
-- ⚠ CE QUE ÇA NE RÉVÈLE PAS
-- Un booléen de plus, rien d'autre. Ni courriel, ni identifiant, ni nom.
-- L'appelant sait déjà, par exists_not_invitable, qu'un athlète existe sur ce
-- préfixe ; exists_exact lui dit seulement si c'est sur l'adresse complète.
-- Le compartiment reste conforme : aucune PII ne traverse.
--
-- ⚠ DROP + CREATE, PAS CREATE OR REPLACE
-- Ajouter une colonne au RETURNS TABLE change la signature ; CREATE OR REPLACE
-- lève « cannot change return type of existing function ». Le DROP impose de
-- REPOSER les droits — ils sont plus bas, ne pas les oublier.
--
-- Vérifié en transaction annulée après application :
--   préfixe 4 car.        → not_invitable=true, exact=FALSE, 0 suggestion
--   courriel complet      → les deux drapeaux true
--   préfixe invitable     → 1 suggestion, les deux drapeaux false
--   inexistant / 3 car.   → aucune ligne
--   casse + espaces       → exact=true (tolérance lower/btrim des deux côtés)
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.lookup_invitable_athletes_by_email(text);

create function public.lookup_invitable_athletes_by_email(p_prefix text)
returns table (
  athlete_id           uuid,
  email                text,
  first_name           text,
  last_name            text,
  sport_name           text,
  has_account          boolean,
  exists_not_invitable boolean,
  exists_exact         boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
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
  -- Compartiment 1 : MES orphelins sans compte → invitable (courriel de claim).
  -- PRÉFIXE conservé : c'est une suggestion, elle doit apparaître en tapant.
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
  -- Compartiment 2 : comptes SANS coach (civil OU scolaire) → invitable.
  -- PRÉFIXE conservé, même raison.
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
  -- Compartiment 3 : existe mais NON-invitable → DRAPEAUX SEULS, AUCUNE PII.
  --   exists_not_invitable : inchangé, sur PRÉFIXE.
  --   exists_exact         : NOUVEAU, sur ÉGALITÉ — c'est lui qui gouverne la
  --                          bannière, le blocage de création et le bouton.
  -- Les deux prédicats de non-invitabilité sont identiques ; seule la
  -- comparaison du courriel change. Ne pas les factoriser : les garder côte à
  -- côte rend l'écart visible.
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
    ) );
end;
$function$;

comment on function public.lookup_invitable_athletes_by_email(text) is
  'Recherche par PRÉFIXE pour les suggestions (compartiments 1 et 2). Le '
  'compartiment 3 rend DEUX drapeaux sans PII : exists_not_invitable (préfixe, '
  'inchangé) et exists_exact (ÉGALITÉ) — c''est exists_exact qui gouverne la '
  'bannière, le blocage de création et le bouton d''invitation.';

revoke all on function public.lookup_invitable_athletes_by_email(text) from public;
grant execute on function public.lookup_invitable_athletes_by_email(text) to anon, authenticated, service_role;
