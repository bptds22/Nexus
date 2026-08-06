-- ═══════════════════════════════════════════════════════════════════════════
-- athlete_notifications : autoriser le type TEAM_INVITATION
--
-- POURQUOI CETTE MIGRATION EXISTE — À LIRE AVANT D'AJOUTER UN TYPE
-- `athlete_notifications.type` est déclarée `text`, ce qui laisse croire qu'un
-- nouveau type ne demande aucun DDL. C'EST FAUX : la colonne porte une
-- contrainte CHECK qui énumère les valeurs permises. Un type absent de cette
-- liste fait ÉCHOUER l'insertion.
--
-- Et l'échec est SILENCIEUX. Les fonctions de notification enveloppent leur
-- insertion dans un `exception when others` — pour la bonne raison qu'une
-- notification ne doit jamais faire échouer l'action qu'elle annonce. Résultat
-- observé avant ce correctif, en transaction annulée : l'invitation d'équipe
-- était bien créée, la notification jamais, et la pastille ne bougeait pas
-- (37 non lues → 37). Rien dans l'interface ne le signalait.
--
-- Toute future notification doit donc ajouter sa valeur ICI d'abord.
--
-- Ajout PUREMENT ADDITIF : les douze valeurs existantes sont reconduites
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
    -- Nouveau : le coach invite un athlète ancré ailleurs à rejoindre son
    -- équipe. Volontairement non cliquable côté affichage — l'écran
    -- d'acceptation EST la page des notifications.
    'TEAM_INVITATION'::text
  ]));
