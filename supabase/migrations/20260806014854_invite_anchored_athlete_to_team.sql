-- ═══════════════════════════════════════════════════════════════════════════
-- invite_anchored_athlete_to_team — sortie du cul-de-sac « courriel déjà pris »
--
-- LE PROBLÈME QU'ELLE RÉSOUT
-- Quand un coach saisit le courriel d'un athlète DÉJÀ ANCRÉ ailleurs, la
-- détection existante (lookup_invitable_athletes_by_email, compartiment 3) lui
-- répond « existe, mais pas invitable ici » — un drapeau booléen SEUL, sans
-- nom, sans courriel, SANS IDENTIFIANT. C'est un choix Loi 25 délibéré :
-- confirmer qu'une adresse appartient à un athlète nommé serait une fuite.
--
-- Mais on ne peut pas créer une invitation d'équipe sans identifiant d'athlète.
-- Le coach était donc dans une impasse : il voyait qu'un athlète existait, et
-- n'avait aucune sortie sauf créer un doublon.
--
-- POURQUOI UNE FONCTION SERVEUR PLUTÔT QU'UN ÉLARGISSEMENT DE LA RECHERCHE
-- Élargir la recherche pour qu'elle rende l'identifiant aurait défait la
-- protection : n'importe quel coach aurait pu réciter nom et sport à partir
-- d'une adresse. Ici la résolution courriel → athlète se fait ENTIÈREMENT côté
-- serveur, et la fonction ne retourne qu'un code de statut. Le coach
-- n'apprend RIEN de plus qu'aujourd'hui : il savait déjà, par le drapeau,
-- qu'un athlète existe à cette adresse.
--
-- CE QU'ELLE N'ÉCRIT PAS
-- Rien dans athlete_invitations. Ce sont deux actions distinctes :
--   · athlete_invitations = « il est chez moi, sans compte » → RÉCLAMATION,
--     aboutit sur /claim, l'athlète se crée un compte.
--   · team_invitations    = « il est chez quelqu'un d'autre » → TRANSFERT,
--     il a déjà un compte, il décide.
-- Les mélanger produirait un lien de réclamation pour quelqu'un qui a déjà un
-- compte. Cette fonction n'écrit QUE dans team_invitations.
--
-- inviteAthleteToTeam() côté client reste intact : il sert le cas où l'athlète
-- a été identifié par une suggestion, donc où l'identifiant est déjà connu
-- légitimement. Ici on part d'un courriel opaque.
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
begin
  if v_caller is null then
    return 'NOT_AUTHENTICATED';
  end if;

  -- Garde rôle : miroir des autres RPC de recherche.
  if not public.is_coach() then
    return 'NOT_COACH';
  end if;

  -- Garde longueur : même minimum que la recherche (anti-énumération). Sans
  -- elle, cette fonction deviendrait un oracle à préfixe court.
  if length(v_email) < 4 then
    return 'EMAIL_TOO_SHORT';
  end if;

  -- Garde équipe : MÊME prédicat que la policy d'insertion de team_invitations
  -- (coach_manages_team). On le teste ICI pour rendre un message clair — sinon
  -- la fonction étant SECURITY DEFINER, la policy ne s'appliquerait pas et le
  -- coach pourrait inviter vers une équipe qu'il n'encadre pas.
  if not public.coach_manages_team(p_team_id) then
    return 'NOT_YOUR_TEAM';
  end if;

  -- Résolution courriel → athlète. On regarde l'adresse de la FICHE et celle
  -- du COMPTE : un athlète inscrit par Apple avec relais privé porte une
  -- adresse de compte différente de celle que le coach connaît.
  select a.id, a.date_naissance, a.user_id
    into v_athlete_id, v_dob, v_user_id
  from public.athletes a
  left join public.users u on u.id = a.user_id
  where lower(btrim(coalesce(a.email, ''))) = v_email
     or lower(btrim(coalesce(u.email, ''))) = v_email
  order by a.created_at desc
  limit 1;

  -- ⚠ REFUS INDISTINGUABLES — NE PAS « AMÉLIORER » CES MESSAGES.
  -- Les trois cas ci-dessous (introuvable, sans compte, moins de 14 ans)
  -- retournent LA MÊME sentinelle, volontairement. Un code distinct par cas
  -- ferait de cette fonction un oracle : en tapant une adresse, un coach
  -- déduirait l'âge d'un athlète qui n'est pas le sien, ou l'état de son
  -- compte. On ne renvoie pas trois codes mappés vers un même texte — on
  -- renvoie UN code, pour qu'aucune couche ne puisse les redistinguer plus
  -- tard, ni les faire fuir par un journal.
  if v_athlete_id is null then
    return 'NOT_INVITABLE';
  end if;

  -- L'athlète est-il DÉJÀ chez ce coach ? Alors ce n'est pas un transfert et il
  -- n'y a rien à proposer.
  if exists (select 1 from public.athletes a
             where a.id = v_athlete_id and a.coach_id = v_caller) then
    return 'ALREADY_YOURS';
  end if;

  -- Sans compte, ce n'est pas un transfert mais une réclamation : ce chemin
  -- n'est pas le bon, et créer une invitation d'équipe pour quelqu'un qui ne
  -- peut pas se connecter la rendrait inacceptable à jamais.
  -- Même sentinelle que ci-dessus : l'état du compte d'un athlète qui n'est
  -- pas le sien ne regarde pas ce coach.
  if v_user_id is null then
    return 'NOT_INVITABLE';
  end if;

  -- Gate <14 EN AMONT (Loi 25). Le blocage de fond vit dans
  -- _apply_team_attachment_core, donc à l'ACCEPTATION — inviter serait légal
  -- mais inutile : l'athlète se heurterait au mur au moment de dire oui.
  -- On refuse ici pour ne pas fabriquer une invitation morte-née.
  -- Ne mord que si la date de naissance est CONNUE, par cohérence avec le
  -- reste de l'application (isUnder14("") === false).
  --
  -- ⚠ ET SURTOUT : la sentinelle est la MÊME que les deux refus précédents.
  -- Retourner ATHLETE_UNDER_14 ici transformerait le champ courriel en
  -- détecteur d'âge — le coach taperait une adresse et saurait que la
  -- personne a moins de 14 ans. C'est exactement la fuite que la protection
  -- Loi 25 de la recherche empêche par ailleurs. L'athlète, lui, reçoit un
  -- message explicite au moment d'ACCEPTER : c'est sa donnée, pas celle du
  -- coach.
  if v_dob is not null
     and extract(year from age(v_dob))::int < 14 then
    return 'NOT_INVITABLE';
  end if;

  -- Doublon : l'index partiel uq_team_invitations_pending interdit deux
  -- invitations PENDING pour le même couple. On teste avant pour rendre un
  -- statut neutre plutôt qu'une violation de contrainte.
  if exists (select 1 from public.team_invitations ti
             where ti.team_id = p_team_id
               and ti.athlete_id = v_athlete_id
               and ti.status = 'PENDING') then
    return 'ALREADY_PENDING';
  end if;

  -- expires_at n'a AUCUN défaut en base : si on ne le pose pas, l'invitation
  -- ne périme jamais. 30 jours = la même durée que inviteAthleteToTeam() et que
  -- les jetons de réclamation.
  insert into public.team_invitations
    (team_id, athlete_id, invited_by_coach_id, status, expires_at)
  values
    (p_team_id, v_athlete_id, v_caller, 'PENDING', now() + interval '30 days');

  return 'OK';

exception
  -- Filet : une course entre le test et l'insert retomberait sur l'index
  -- partiel. On la traite comme « déjà envoyée », jamais comme une erreur.
  when unique_violation then
    return 'ALREADY_PENDING';
end;
$function$;

comment on function public.invite_anchored_athlete_to_team(text, uuid) is
  'Invite par COURRIEL un athlète déjà ancré ailleurs, sans jamais révéler son '
  'identité à l''appelant. N''écrit QUE dans team_invitations — jamais dans '
  'athlete_invitations (réclamation ≠ transfert). Retourne un code de statut.';

revoke all on function public.invite_anchored_athlete_to_team(text, uuid) from public;
grant execute on function public.invite_anchored_athlete_to_team(text, uuid) to authenticated;
