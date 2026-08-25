-- ═══════════════════════════════════════════════════════════════
-- badge_sports : RLS et droits. Corrige DEUX défauts de la migration
-- badges_sports_table_de_liaison (20260825…), détectés par un test sous JWT
-- réel et invisibles en superutilisateur.
--
-- ── DÉFAUT 1 — la table était invisible pour l'application ───────
-- Le projet active RLS d'office sur toute nouvelle table de public. La table
-- a donc été créée avec RLS ACTIVE et AUCUNE policy : un `select` sous le rôle
-- authenticated renvoyait 0 ligne, sans erreur. Le picker n'aurait affiché
-- AUCUN badge de sport, pour tout le monde.
--
-- L'ironie mérite d'être notée : la migration précédente pose un trigger de
-- contrainte DEFERRABLE pour rendre impossible un badge de sport sans
-- rattachement — puis rend tous les rattachements invisibles. La contrainte
-- était nécessaire, pas suffisante ; la panne est revenue par la porte RLS.
--
-- ── DÉFAUT 2 — droits trop larges ───────────────────────────────
-- Les droits par défaut du projet ont accordé à anon ET authenticated :
-- SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER. Seule
-- l'absence de policy l'empêchait de nuire. La première policy permissive
-- ajoutée sans y penser aurait ouvert un TRUNCATE à un visiteur non connecté.
-- On aligne sur `badges` : anon en lecture seule, authenticated en écriture
-- mais bridé par RLS.
-- ═══════════════════════════════════════════════════════════════

revoke all on public.badge_sports from anon, authenticated;
grant select on public.badge_sports to anon, authenticated;
grant insert, update, delete on public.badge_sports to authenticated;

-- Le catalogue n'est pas secret : savoir que « Rempart » est un badge de
-- football ne révèle rien sur personne. Aucune donnée d'athlète ici.
create policy "badge_sports lecture publique"
  on public.badge_sports for select using (true);

-- Écriture réservée aux admins, comme pour badges.
create policy "badge_sports admins insert"
  on public.badge_sports for insert with check (public.is_admin());
create policy "badge_sports admins update"
  on public.badge_sports for update using (public.is_admin()) with check (public.is_admin());
create policy "badge_sports admins delete"
  on public.badge_sports for delete using (public.is_admin());