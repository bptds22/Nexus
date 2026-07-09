-- athlete_invitations : colonnes pour l'envoi d'email d'invitation coach→athlète.
--
-- athlete_invitations est la table du CLAIM d'orphelin (token → lie
-- athletes.user_id via consume_athlete_invitation). On l'étend pour l'envoi
-- email — PLUTÔT que la table `invitations` générique (qui a déjà email +
-- email_sent_at mais set users.school_id : mauvaise sémantique pour un claim).
--
-- Tout idempotent. Aucune colonne existante dupliquée : la table n'a NI `email`
-- NI `email_sent_at` aujourd'hui (confirmé via information_schema).

-- Courriel destinataire de l'invitation (là où send-invitation enverra).
-- Nullable : les rows existantes (flux copy-link) n'en ont pas.
alter table public.athlete_invitations
  add column if not exists email text;

-- Garde d'idempotence anti-doublon d'envoi — miroir de athletes.parent_notified_at
-- (Track B). NULL = jamais envoyé → un trigger/worker peut (ré)essayer ;
-- non-NULL = déjà envoyé → on ne renvoie pas.
alter table public.athlete_invitations
  add column if not exists email_sent_at timestamptz;
