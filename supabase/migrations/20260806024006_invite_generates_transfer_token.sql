-- ═══════════════════════════════════════════════════════════════════════════
-- invite_anchored_athlete_to_team — génère le jeton personnel, et passe à 14 j
--
-- CE QUI CHANGE
--   1. La ligne d'invitation naît avec un transfer_token unique.
--   2. L'échéance passe de 30 à 14 jours.
--
-- POURQUOI 14 ET NON 30
-- Le jeton voyage dans l'URL du courriel : il finira dans les journaux du
-- serveur et dans l'en-tête Referer sortant. C'est l'argument exact que
-- l'auteur du portail avait écrit pour REFUSER le transport d'un code par URL.
-- Il ne s'applique pas ici avec la même force — ce jeton n'autorise rien, il
-- désigne — mais il justifie de borner l'exposition. Une seule échéance,
-- portée par la ligne : le jeton et l'invitation meurent ensemble, sinon on
-- obtiendrait une invitation vivante avec un lien mort.
--
-- ⚠ expires_at N'EST TOUJOURS APPLIQUÉ NULLE PART
-- Dette connue, inchangée par cette migration : aucune lecture ne filtre sur
-- expires_at, et rien ne bascule une invitation vers EXPIRED. La date est
-- posée, elle n'est pas encore honorée. La résolution du jeton (migration
-- suivante) est le PREMIER endroit qui la vérifie.
--
-- Le reste de la fonction est identique — mêmes gardes, mêmes sentinelles, même
-- fusion des trois refus dans NOT_INVITABLE. Voir 20260806014854.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.invite_anchored_athlete_to_team(
  p_email   text,
  p_team_id uuid
)
returns text
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $function$
declare
  v_caller     uuid := auth.uid();
  v_email      text := lower(btrim(coalesce(p_email, '')));
  v_athlete_id uuid;
  v_dob        date;
  v_user_id    uuid;
  v_token      text;
  v_try        int := 0;
begin
  if v_caller is null then
    return 'NOT_AUTHENTICATED';
  end if;

  if not public.is_coach() then
    return 'NOT_COACH';
  end if;

  if length(v_email) < 4 then
    return 'EMAIL_TOO_SHORT';
  end if;

  if not public.coach_manages_team(p_team_id) then
    return 'NOT_YOUR_TEAM';
  end if;

  select a.id, a.date_naissance, a.user_id
    into v_athlete_id, v_dob, v_user_id
  from public.athletes a
  left join public.users u on u.id = a.user_id
  where lower(btrim(coalesce(a.email, ''))) = v_email
     or lower(btrim(coalesce(u.email, ''))) = v_email
  order by a.created_at desc
  limit 1;

  -- ⚠ REFUS INDISTINGUABLES — NE PAS « AMÉLIORER » CES MESSAGES.
  -- Introuvable, sans compte et moins de 14 ans partagent LA MÊME sentinelle.
  -- Un code distinct par cas ferait du champ courriel un détecteur d'âge pour
  -- des athlètes qui ne sont pas ceux de ce coach.
  if v_athlete_id is null then
    return 'NOT_INVITABLE';
  end if;

  if exists (select 1 from public.athletes a
             where a.id = v_athlete_id and a.coach_id = v_caller) then
    return 'ALREADY_YOURS';
  end if;

  if v_user_id is null then
    return 'NOT_INVITABLE';
  end if;

  if v_dob is not null
     and extract(year from age(v_dob))::int < 14 then
    return 'NOT_INVITABLE';
  end if;

  if exists (select 1 from public.team_invitations ti
             where ti.team_id = p_team_id
               and ti.athlete_id = v_athlete_id
               and ti.status = 'PENDING') then
    return 'ALREADY_PENDING';
  end if;

  -- Génération du jeton, avec retry sur collision. Même patron que
  -- create_team_join_token : l'espace est immense (31^8 ≈ 8,5·10^11), mais on
  -- ne parie pas dessus. _gen_join_code n'est accordé qu'à postgres — cette
  -- fonction lui appartient, donc l'appel passe.
  loop
    v_try := v_try + 1;
    v_token := public._gen_join_code(8);
    begin
      insert into public.team_invitations
        (team_id, athlete_id, invited_by_coach_id, status, expires_at, transfer_token)
      values
        (p_team_id, v_athlete_id, v_caller, 'PENDING',
         now() + interval '14 days', v_token);
      return 'OK';
    exception
      -- Collision sur le jeton → on retente. Collision sur
      -- uq_team_invitations_pending → c'est une course avec une autre
      -- invitation, traitée comme « déjà envoyée », jamais comme une erreur.
      when unique_violation then
        if exists (select 1 from public.team_invitations ti
                   where ti.team_id = p_team_id
                     and ti.athlete_id = v_athlete_id
                     and ti.status = 'PENDING') then
          return 'ALREADY_PENDING';
        end if;
        if v_try >= 10 then
          return 'TOKEN_GENERATION_FAILED';
        end if;
    end;
  end loop;
end;
$function$;

comment on function public.invite_anchored_athlete_to_team(text, uuid) is
  'Invite par COURRIEL un athlète déjà ancré ailleurs, sans jamais révéler son '
  'identité à l''appelant. N''écrit QUE dans team_invitations, avec un jeton '
  'personnel de transfert valable 14 jours. Retourne un code de statut ; '
  'introuvable / sans compte / <14 partagent NOT_INVITABLE.';
