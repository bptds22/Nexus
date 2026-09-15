-- ═══════════════════════════════════════════════════════════════════════════
-- M1 — athlete_notifications : autoriser les deux types AMBASSADEUR
--
-- POURQUOI CELLE-CI PASSE EN PREMIER
-- `athlete_notifications.type` est déclarée `text`, ce qui laisse croire qu'un
-- nouveau type ne demande aucun DDL. C'est faux : la colonne porte un CHECK qui
-- énumère les valeurs permises, et un type absent fait ÉCHOUER l'insertion.
--
-- Et l'échec est SILENCIEUX. Les fonctions de notification enveloppent leur
-- insertion dans `exception when others` — pour la bonne raison qu'une
-- notification ne doit jamais faire échouer l'action qu'elle annonce. Le
-- symptôme constaté en août (migration 20260806015043) : l'invitation d'équipe
-- créée, la notification jamais, la pastille figée à 37 non lues, et rien dans
-- l'interface pour le signaler.
--
-- Le trigger des paliers (M6) écrit dans cette table. Si M6 partait avant M1,
-- les paliers se franchiraient et AUCUNE notification ne sortirait — sans la
-- moindre erreur. D'où cet ordre.
--
-- ⚠ CE N'EST QUE LA MOITIÉ DU TRAVAIL. `app/athlete/notifications/page.tsx`
-- porte une union `NotifType` + deux tables (DOT_COLOR, TYPE_ICON) + un filtre
-- d'onglet, tous codés en dur. Un type accepté en base mais absent de ces
-- quatre endroits s'affiche SANS pastille ni icône et dans AUCUN onglet — c'est
-- exactement ce qui est arrivé à TEAM_INVITATION, et c'est écrit dans le
-- commentaire de ce fichier-là. Les deux vont ensemble.
--
-- Ajout PUREMENT ADDITIF : les quinze valeurs existantes sont reconduites
-- telles quelles, aucune ligne en base ne peut devenir invalide.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.athlete_notifications
  drop constraint if exists athlete_notifications_type_check;

alter table public.athlete_notifications
  add constraint athlete_notifications_type_check
  check (type = any (array[
    'PROFILE_VIEWED'::text,
    'ADDED_TO_FAVORITES'::text,
    'SUGGESTION_APPROVED'::text,
    'SUGGESTION_REJECTED'::text,
    'COACH_REPORT_UPDATED'::text,
    'COACH_VERIFIED'::text,
    'COACH_MODIFIED_PROFILE'::text,
    'COACH_DISTINCTION_ADDED'::text,
    'COACH_EVALUATION_UPDATED'::text,
    'PROFILE_MILESTONE'::text,
    'PROFILE_TIP'::text,
    'ADMIN_BROADCAST'::text,
    'TEAM_INVITATION'::text,
    'SCHOOL_CLAIM_REJECTED'::text,
    'COACH_CLAIMED'::text,
    -- Nouveau — palier 3 : l'athlète reçoit le lien /ma-story, présenté comme
    -- son outil d'ambassadeur. Page publique, 100 % client, aucune donnée ne
    -- quitte son navigateur : il n'y a rien à construire derrière ce lien.
    'AMBASSADEUR_PALIER_3'::text,
    -- Nouveau — palier 5 : le badge Ambassadeur devient DISPONIBLE. Il n'est
    -- pas posé ici, ni par personne d'autre que l'athlète lui-même (bascule
    -- sur /athlete/ambassadeur). « Débloqué » ≠ « attribué ».
    'AMBASSADEUR_PALIER_5'::text
  ]));

-- Le palier 10 ne figure PAS dans cette liste, volontairement : son effet est
-- une alerte côté ADMIN (onglet Ambassadeurs), pas une notification à
-- l'athlète. Ajouter un type mort ferait croire à une notification qui
-- n'existe pas.

do $$
declare v_n int;
begin
  select count(*) into v_n
  from pg_constraint
  where conname = 'athlete_notifications_type_check'
    and pg_get_constraintdef(oid) like '%AMBASSADEUR_PALIER_5%';
  if v_n <> 1 then
    raise exception 'NEXUS: le CHECK des types de notification n''a pas ete repose correctement.';
  end if;
  raise notice 'NEXUS: athlete_notifications accepte desormais AMBASSADEUR_PALIER_3 et _5.';
end $$;
