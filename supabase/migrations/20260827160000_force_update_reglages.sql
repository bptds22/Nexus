-- ═══════════════════════════════════════════════════════════════
-- Force update — les six réglages, dans app_settings.
--
-- ── AUCUNE DDL, ET C'EST LE POINT ───────────────────────────────
-- Pas de table `app_config`, pas de policy, pas de GRANT. `app_settings`
-- porte déjà tout ce qu'il fallait, vérifié en prod avant d'écrire ce
-- fichier :
--     SELECT  · policy « anyone can read settings » TO public USING (true),
--               + GRANT SELECT à anon        → le gate lit AVANT login ;
--     INSERT  · WITH CHECK is_admin()        → écriture réservée ;
--     UPDATE  · USING is_admin()             → idem ;
--     DELETE  · aucune policy                → refusé par RLS.
-- Et `app/admin/settings` sait déjà éditer ces lignes. Créer une seconde
-- table de configuration aurait dupliqué quatre mécanismes existants — avec
-- la garantie qu'un jour l'un des deux jeux serait oublié.
--
-- ── enabled = FALSE AU DÉPART, DÉLIBÉRÉMENT ─────────────────────
-- Cette migration ARME le dispositif, elle ne le déclenche pas.
-- `force_update_enabled` reste à 'false' : BP l'activera depuis l'écran admin
-- quand il l'aura décidé. Poser 'true' ici ferait basculer la prod à
-- l'instant de l'apply, sans que personne ne regarde.
--
-- ── LES PLANCHERS SONT À 1.4.0, PAS PLUS HAUT ───────────────────
-- 1.4.0 est la dernière version publiée. Un plancher au-dessus de ce que le
-- magasin peut servir enfermerait des usagers À JOUR devant un bouton
-- « Mettre à jour » qui ne leur offrirait rien. Le plancher ne doit JAMAIS
-- dépasser la version réellement disponible en magasin.
--
-- Rappel du paradoxe, pour le prochain lecteur : ce dispositif ne peut
-- bloquer que les binaires qui le CONTIENNENT. Les 1.2.3 / 1.3.0 déjà
-- installées ne le verront jamais. Livré dans 1.4.0, il ne mordra vraiment
-- qu'à partir de la version suivante.
--
-- ── ON N'ÉCRASE RIEN ────────────────────────────────────────────
-- `on conflict (key) do nothing` : rejouer ce fichier ne remet pas
-- `force_update_enabled` à 'false' une fois que BP l'aura activé, et ne
-- réécrit pas un plancher qu'il aura relevé depuis l'écran admin. Une
-- migration de données ne doit pas défaire un réglage d'exploitation.
--
-- Les surcharges d'URL de magasin (`store_url_ios`, `store_url_android`) ne
-- sont VOLONTAIREMENT pas créées : `lib/config/appStores.ts` fait foi. Le
-- gate les lit si elles existent, pour laisser une porte de sortie sans en
-- faire une dépendance.
-- ═══════════════════════════════════════════════════════════════

insert into public.app_settings (key, value, type, description) values

  ('force_update_enabled', 'false', 'BOOLEAN',
   'Interrupteur général du blocage dur. false = aucun blocage, quels que soient les planchers. Sortie de secours si un plancher mal saisi enferme le parc.'),

  ('min_version_ios', '1.4.0', 'STRING',
   'Version iOS minimale acceptée. En dessous : écran bloquant non contournable. Ne jamais dépasser la version publiée sur l''App Store.'),

  ('min_version_android', '1.4.0', 'STRING',
   'Version Android minimale acceptée. En dessous : écran bloquant non contournable. Ne jamais dépasser la version publiée sur le Play Store.'),

  ('suggested_version_ios', '1.4.0', 'STRING',
   'Version iOS recommandée. En dessous : bannière fermable, non bloquante. Sert à inciter longtemps avant d''avoir à bloquer.'),

  ('suggested_version_android', '1.4.0', 'STRING',
   'Version Android recommandée. En dessous : bannière fermable, non bloquante.'),

  ('force_update_message', 'Cette version de Nexus n''est plus prise en charge. Installe la dernière version pour continuer.', 'STRING',
   'Texte de l''écran bloquant. Modifiable sans redéployer. Vide = le message par défaut du client s''applique.')

on conflict (key) do nothing;
