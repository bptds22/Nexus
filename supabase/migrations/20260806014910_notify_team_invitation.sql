-- ═══════════════════════════════════════════════════════════════════════════
-- notify_team_invitation — la pastille de l'athlète invité
--
-- LE TROU
-- team_invitations n'avait AUCUN déclencheur de notification. Un athlète
-- invité n'était prévenu de rien : pas de courriel (cette table n'a pas de
-- chaîne d'envoi, contrairement à athlete_invitations), pas de poussée (le
-- push n'est câblé que sur les nouveaux messages et le premier contact
-- recruteur), et pas de ligne de notification. Le compteur du panneau « Plus »
-- comptait déjà les invitations PENDING, mais rien ne le faisait remarquer.
--
-- CE QU'ON FAIT, ET CE QU'ON NE FAIT PAS
-- On insère une notification. C'est tout. Elle n'est PAS cliquable, et c'est
-- délibéré : l'écran d'acceptation EST la page des notifications
-- (PendingInvitations y est monté en tête). Un lien pointerait vers la page où
-- l'athlète se trouve déjà. La valeur ici est la PASTILLE — le compteur monte,
-- et l'historique garde une trace datée.
-- Par conséquent l'union fermée NotifType du composant d'affichage n'est PAS
-- touchée : ce type ne porte ni couleur ni icône dédiée, il n'apparaît que
-- dans le compteur. Le rendu de la liste ignore proprement un type inconnu.
--
-- ⚠ DÉPENDANCE : 20260806015043 (CHECK type) — appliquée APRÈS celle-ci.
-- L'ordre des versions reflète l'ordre RÉEL d'application en production, où le
-- CHECK est arrivé en dernier : c'est précisément ce qui a produit le premier
-- symptôme (invitation créée, notification absente). Sur un déploiement neuf
-- l'ordre est sans conséquence — aucune invitation n'est insérée pendant la
-- migration — mais le lien reste à connaître.
-- `athlete_notifications.type` est bornée par une contrainte CHECK, pas libre.
-- Sans la migration qui y ajoute TEAM_INVITATION, l'insertion ci-dessous échoue
-- — et l'échec est AVALÉ par le `exception when others` plus bas. Symptôme
-- observé : invitation créée, notification absente, pastille immobile, aucun
-- message nulle part. Ne jamais déployer ce fichier seul.
--
-- PATRON SUIVI
-- Calqué sur notify_athlete_favorited, le plus proche analogue (une action
-- d'un TIERS produit une notification pour l'athlète) :
--   AFTER INSERT · SECURITY DEFINER · insert (athlete_id, type, title, metadata)
-- `message` reste NULL comme chez les cinq autres. `type` est déclarée `text`
-- MAIS bornée par un CHECK — voir la dépendance ci-dessus.
-- SECURITY DEFINER est OBLIGATOIRE : la policy d'insertion de
-- athlete_notifications est réservée à is_admin(), donc un client de coach
-- serait refusé. Les cinq notifications existantes passent toutes par là.
--
-- On n'annonce ni le nom de l'équipe ni celui du coach dans le titre : la
-- carte d'acceptation les affiche déjà, et un titre générique évite de
-- dupliquer une vérité qui pourrait diverger si l'équipe est renommée.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.notify_team_invitation()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Seules les invitations RÉELLEMENT en attente valent une notification. Une
  -- ligne créée directement en ACCEPTED/CANCELLED (reprise, import) n'appelle
  -- aucune décision de l'athlète.
  if NEW.status is distinct from 'PENDING' then
    return NEW;
  end if;

  -- Une notification est un ornement : elle ne doit JAMAIS faire échouer la
  -- création de l'invitation elle-même. Même principe que le try/catch du
  -- helper haptique et que notify_invitation_email.
  begin
    insert into public.athlete_notifications (athlete_id, type, title, metadata)
    values (
      NEW.athlete_id,
      'TEAM_INVITATION',
      'Un coach t''invite à rejoindre son équipe',
      jsonb_build_object(
        'invitation_id', NEW.id,
        'team_id',       NEW.team_id,
        'coach_id',      NEW.invited_by_coach_id
      )
    );
  exception when others then
    raise warning 'notify_team_invitation a échoué pour invitation % (athlete %): %',
      NEW.id, NEW.athlete_id, SQLERRM;
  end;

  return NEW;
end;
$function$;

drop trigger if exists trg_notify_team_invitation on public.team_invitations;

create trigger trg_notify_team_invitation
  after insert on public.team_invitations
  for each row
  execute function public.notify_team_invitation();

comment on function public.notify_team_invitation() is
  'AFTER INSERT sur team_invitations → une ligne athlete_notifications de type '
  'TEAM_INVITATION. Fait monter la pastille ; volontairement non cliquable '
  '(l''écran d''acceptation est la page des notifications elle-même).';
