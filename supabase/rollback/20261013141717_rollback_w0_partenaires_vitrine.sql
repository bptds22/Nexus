-- Rollback de 20261013141717_w0_partenaires_vitrine.sql : retire la RPC.
-- ⚠ Défaire 094806 D'ABORD et redéployer un carrousel qui lit media_partners en direct,
-- sinon l'accueil web perd ses partenaires (appel RPC en erreur).

drop function if exists public.partenaires_vitrine();
