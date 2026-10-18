-- Rollback de 20261018100000 : retire les trois fonctions du partenaire et rend les deux listes de
-- valeurs d'avant. REFUSE si une décision du partenaire existe déjà (valeur 'PARTENAIRE' en base) :
-- aucune donnée n'est réécrite ni effacée en silence — à traiter à la main avant.
do $$
begin
  if to_regprocedure('public.partenaire_rapprochements()') is null then
    raise exception 'NEXUS: 20261018100000 absente — rien à défaire';
  end if;
  if exists (select 1 from public.partenaire_prospects where reservation_source = 'PARTENAIRE')
  or exists (select 1 from public.partenaire_prospects_rapprochements where origine = 'PARTENAIRE') then
    raise exception 'NEXUS: des décisions du partenaire existent (PARTENAIRE) — rollback refusé, rien n''est touché';
  end if;
end $$;

drop function public.partenaire_rapprochement_refuser(uuid, uuid);
drop function public.partenaire_rapprochement_accepter(uuid, uuid);
drop function public.partenaire_rapprochements();

alter table public.partenaire_prospects drop constraint partenaire_prospects_reservation_source_check;
alter table public.partenaire_prospects add constraint partenaire_prospects_reservation_source_check
  check (reservation_source = any (array['LIEN', 'ADMIN', 'AUTO']::text[]));
alter table public.partenaire_prospects_rapprochements drop constraint partenaire_prospects_rapprochements_origine_check;
alter table public.partenaire_prospects_rapprochements add constraint partenaire_prospects_rapprochements_origine_check
  check (origine = any (array['ADMIN', 'AUTO']::text[]));

comment on table public.partenaire_prospects_rapprochements is
  'W4 — décisions de rapprochement carte partenaire × athlète existant (admin, ou automatique si un seul candidat MOYENNE déjà visible du partenaire). Jamais lisible par le partenaire.';

do $$
begin
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.partenaire_prospects'::regclass and conname = 'partenaire_prospects_reservation_source_check')
     is distinct from 'CHECK ((reservation_source = ANY (ARRAY[''LIEN''::text, ''ADMIN''::text, ''AUTO''::text])))'
  or (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.partenaire_prospects_rapprochements'::regclass and conname = 'partenaire_prospects_rapprochements_origine_check')
     is distinct from 'CHECK ((origine = ANY (ARRAY[''ADMIN''::text, ''AUTO''::text])))' then
    raise exception 'NEXUS: les listes de valeurs ne reviennent pas à leur état d''avant';
  end if;
end $$;
