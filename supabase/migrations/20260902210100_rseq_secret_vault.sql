-- 20260902210100_rseq_secret_vault.sql
-- ============================================================================
-- VEILLE RSEQ — le secret vit dans le Vault, et NULLE PART AILLEURS.
--
-- POURQUOI CE DÉTOUR
--   Le secret existait jusqu'ici comme variable d'environnement de la fonction
--   edge. Le cron, lui, doit le lire depuis la base pour composer son en-tête.
--   Le mettre au Vault depuis un client aurait fait transiter sa valeur en
--   clair par le canal d'administration.
--
--   Il est donc GÉNÉRÉ ICI, par la base, avec extensions.gen_random_bytes(36).
--   Personne — ni humain ni agent — ne le voit jamais.
--
-- ET IL N'EN SORT PAS NON PLUS
--   `rseq_verifie_secret` ne RETOURNE PAS le secret : elle reçoit un candidat
--   et rend un booléen. La fonction edge lui demande « est-ce le bon ? » au
--   lieu de « donne-le-moi ». Une fuite de cette RPC ne divulgue rien ; au
--   pire elle permet de tester une valeur qu'on possède déjà.
--
-- SECURITY DEFINER, ET VERROUILLÉE EN CONSÉQUENCE
--   Elle lit `vault.decrypted_secrets`, donc elle doit s'exécuter avec les
--   droits du propriétaire. On retire alors les DEUX couches de privilèges —
--   les GRANT nominatifs que Supabase pose sur toute fonction neuve (anon,
--   authenticated) ET l'héritage PUBLIC. La leçon du correctif 20260902093000
--   et de sa suite 093100 : `revoke ... from public` seul ne suffit pas.
--
-- IDEMPOTENTE : re-jouer la migration ne régénère pas le secret (ce qui
-- casserait le cron déjà armé), le garde-fou `if not exists` s'en charge.
-- ============================================================================

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'RSEQ_SYNC_SECRET') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(36), 'base64'),
      'RSEQ_SYNC_SECRET',
      'Veille RSEQ hebdomadaire — en-tete x-rseq-secret. Genere DANS la base le 2026-09-02, jamais affiche nulle part.'
    );
  end if;
end $$;

create or replace function public.rseq_verifie_secret(p_candidat text)
returns boolean
language sql
security definer
set search_path = public, vault, pg_temp
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'RSEQ_SYNC_SECRET'
      and decrypted_secret = p_candidat
  );
$$;

comment on function public.rseq_verifie_secret(text) is
  'Compare un candidat au secret de la veille RSEQ. Rend un booleen, JAMAIS le secret.';

-- Les deux couches, toujours : les grants nominatifs, puis l'heritage PUBLIC.
revoke execute on function public.rseq_verifie_secret(text) from anon, authenticated;
revoke execute on function public.rseq_verifie_secret(text) from public;
grant  execute on function public.rseq_verifie_secret(text) to service_role;
