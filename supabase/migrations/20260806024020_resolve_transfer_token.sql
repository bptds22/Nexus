-- ═══════════════════════════════════════════════════════════════════════════
-- resolve_transfer_token — ce que la bannière affiche
--
-- LA BANNIÈRE, PAS LE CHAMP
-- Le jeton personnel ne passe PAS par le champ de saisie du portail. Les deux
-- jetons n'ont pas le même contrat : le code d'équipe AUTORISE (le détenir
-- suffit à rejoindre), le jeton personnel DÉSIGNE (l'autorisation vient de la
-- session). Les fondre dans un même champ mélangerait deux niveaux de
-- confiance dans une seule boîte de texte. La bannière montre l'invitation
-- déjà résolue ; la recherche par code reste dessous, intacte, pour son cas
-- d'origine — l'athlète qui cherche lui-même.
--
-- ⚠ LE JETON NE RÉVÈLE RIEN À QUI N'EST PAS LE DESTINATAIRE
-- La fonction exige is_own_athlete(athlete_id). Un jeton qui fuit — journaux,
-- Referer, courriel transféré — ne rend donc NI l'équipe, NI l'école, NI le
-- coach à un tiers : il rend une ligne vide. C'est la contrepartie du transport
-- par URL, et c'est ce qui distingue ce jeton du code d'équipe, dont la
-- résolution est ouverte à anon par conception.
--
-- Retour aligné sur resolve_team_join_token (mêmes colonnes d'équipe) plus
-- l'identifiant de l'invitation, dont la bannière a besoin pour accepter. La
-- forme commune permet à la bannière de réutiliser TransferConfirmDialog sans
-- adaptateur.
--
-- PREMIER ENDROIT QUI HONORE expires_at. Ailleurs dans l'application la
-- colonne est posée mais jamais lue — dette connue. Ici un jeton périmé rend
-- is_valid = false, au même titre qu'un jeton inconnu : aucune distinction,
-- pas d'oracle (même principe que la copie unique du champ de code).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.resolve_transfer_token(p_token text)
returns table (
  invitation_id   uuid,
  team_id         uuid,
  team_name       text,
  school_id       uuid,
  school_name     text,
  school_type     text,
  sport_name      text,
  season          text,
  age_group       text,
  division        text,
  gender          text,
  league          text,
  coach_name      text,
  is_valid        boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $function$
declare
  v_token text := upper(btrim(coalesce(p_token, '')));
begin
  -- Garde longueur : miroir de l'alphabet des codes (6 à 8). Sans elle, la
  -- fonction accepterait des sondes courtes.
  if length(v_token) < 6 or length(v_token) > 8 then
    return;
  end if;

  return query
  select
    ti.id,
    t.id,
    t.name,
    s.id,
    s.name,
    s.type::text,
    sp.nom,
    t.season,
    -- ⚠ ORDRE STRICT — RETURNS TABLE ne nomme pas les colonnes du select, il
    -- les mappe par POSITION. age_group, division, gender, league : toute
    -- permutation ici passerait la compilation et sortirait des valeurs
    -- croisées à l'écran, sans une seule erreur.
    t.age_group,
    t.division,
    t.gender,
    t.league,
    nullif(btrim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), ''),
    true
  from public.team_invitations ti
  join public.teams t   on t.id = ti.team_id
  left join public.schools s on s.id = t.school_id
  left join public.sports sp on sp.id = t.sport_id
  left join public.users  u  on u.id = ti.invited_by_coach_id
  where ti.transfer_token = v_token
    and ti.status = 'PENDING'
    -- Échéance HONORÉE ici (voir l'en-tête). Une invitation sans date reste
    -- valable : cohérent avec le reste de l'application, où NULL vaut « pas de
    -- limite » plutôt que « expirée ».
    and (ti.expires_at is null or ti.expires_at > now())
    -- LE CONTRÔLE QUI COMPTE : seul le destinataire voit quoi que ce soit.
    and public.is_own_athlete(ti.athlete_id);
end;
$function$;

comment on function public.resolve_transfer_token(text) is
  'Résout un jeton PERSONNEL de transfert pour la bannière du portail. Ne rend '
  'quoi que ce soit qu''au destinataire (is_own_athlete) : un jeton qui fuit ne '
  'révèle rien. Honore expires_at. Aucune ligne = inconnu, périmé, consommé ou '
  'pas à toi — indistinguables, volontairement.';

revoke all on function public.resolve_transfer_token(text) from public;
grant execute on function public.resolve_transfer_token(text) to authenticated;
