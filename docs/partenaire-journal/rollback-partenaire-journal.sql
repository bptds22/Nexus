-- ROLLBACK de 20261016150000_partenaire_journal.sql — retire la fonction, rien d'autre.
-- Les lignes déjà écrites dans partner_profile_views / partner_card_downloads RESTENT (c'est un journal).
-- ⚠ Avant de l'appliquer : remettre en ligne une version du web qui journalise par les routes
--   /api/partner/*, sinon les vues et téléchargements ne sont plus tracés (web ET appli).
do $$
begin
  if to_regprocedure('public.partenaire_journaliser(uuid,text,text)') is null then
    raise exception 'NEXUS: rien à retirer (partenaire_journaliser absente)';
  end if;
end $$;

drop function public.partenaire_journaliser(uuid, text, text);
delete from supabase_migrations.schema_migrations where version = '20261016150000';

do $$
begin
  if to_regprocedure('public.partenaire_journaliser(uuid,text,text)') is not null then
    raise exception 'NEXUS: rollback incomplet';
  end if;
  raise notice 'NEXUS rollback journal partenaire — OK';
end $$;
