-- Messagerie admin — migration 1/3 : LES VALEURS D'ENUM, SEULES.
--
-- Pourquoi seules : PostgreSQL interdit d'UTILISER une valeur d'enum
-- ajoutée dans la même transaction (« unsafe use of new value of enum
-- type »). apply_migration transactionne. Toute la structure qui
-- référence ADMIN_USER ou SERVICE part donc en migration 2.
--
-- ADMIN_USER : fil de service 1-on-1 « Équipe Nexus » → utilisateur.
-- SERVICE    : rôle de l'identité de service. Choisi plutôt qu'ADMIN
--              (qui rendrait is_admin() vrai sur un compte dormant,
--              donc la lecture de toute la messagerie privée), et
--              plutôt qu'ATHLETE/PARTNER (qui feraient mentir la donnée
--              et seraient ramassés par les requêtes filtrant le rôle).
--
-- Vérifié au catalogue avant application : aucune contrainte CHECK ne
-- référence user_role ; aucune fonction n'utilise de CASE sur le rôle
-- (donc aucun ELSE NULL ne peut laisser passer un rôle inconnu) ; tous
-- les tests de rôle sont positifs, donc faux pour SERVICE.
--
-- IRRÉVERSIBLE : une valeur d'enum PostgreSQL ne se retire pas.

ALTER TYPE public.conversation_type ADD VALUE IF NOT EXISTS 'ADMIN_USER';
ALTER TYPE public.user_role         ADD VALUE IF NOT EXISTS 'SERVICE';
