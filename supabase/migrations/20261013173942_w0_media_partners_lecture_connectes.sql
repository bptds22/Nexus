-- ═══════════════════════════════════════════════════════════════════════════
-- W0.6b — media_partners : un connecté ne lit plus que SA ligne (ou tout, s'il
-- est admin). contact_email / contact_name ne sortent plus vers un athlète, un
-- coach ou un recruteur connecté.
--
-- ÉTAPE 2 sur 2 (contract). À appliquer APRÈS 094805 ET après le déploiement
-- du carrousel qui lit par partenaires_vitrine() — sinon un visiteur connecté
-- voit un carrousel vide entre les deux.
--
-- Avant : « Public read approved partners » FOR SELECT TO public, status =
-- 'APPROVED' → tout utilisateur connecté lisait TOUTES les colonnes de tous
-- les partenaires approuvés. Des privilèges de colonne ne peuvent pas dépendre
-- de la ligne (« sauf la sienne ») : c'est donc la policy qu'on resserre.
--
-- Après, en lecture directe :
--   anon          → partenaires APPROVED, 18 colonnes (094802) — /partenaires/[id]
--                   lit avec un client SANS session, donc toujours en anon ;
--   authenticated → sa propre ligne (« Partners read own profile ») ou tout
--                   (« Admins read all partners ») ;
--   la vitrine pour un connecté passe par partenaires_vitrine() (094805).
-- Les policies de partner_card_downloads / partner_profile_views qui
-- sous-requêtent media_partners le font pour le partenaire lui-même : inchangé.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "Public read approved partners" on public.media_partners;

create policy "Anon read approved partners"
  on public.media_partners
  for select
  to anon
  using (status = 'APPROVED');

-- Gate : les policies SELECT de media_partners sont exactement celles-ci,
-- avec ces rôles (comparaison complète, jamais par inclusion).
do $$
declare
  vus text[];
  veut text[] := array[
    'Admins read all partners:{authenticated}',
    'Anon read approved partners:{anon}',
    'Partners read own profile:{public}'
  ];
begin
  select array_agg(policyname || ':' || roles::text order by policyname) into vus
    from pg_policies
   where schemaname = 'public' and tablename = 'media_partners' and cmd = 'SELECT';
  if vus is distinct from veut then
    raise exception 'NEXUS: policies SELECT = %, attendu %', vus, veut;
  end if;
end $$;
