-- Rollback de 2-fermer.sql : rouvre EXACTEMENT les alertes listées dans la dernière ligne
-- admin_operations ALERTES_RSEQ_V1_CLOSES, avec leur état d'avant. admin_operations est
-- immuable : le rollback ajoute sa propre ligne, il n'efface pas la première.
begin;

do $$
declare
  op record;
  nb int;
  conflits int;
  admin uuid;
begin
  select * into op from public.admin_operations
   where operation = 'ALERTES_RSEQ_V1_CLOSES' order by le desc limit 1;
  if op.id is null then raise exception 'NEXUS: aucune clôture à annuler'; end if;
  if exists (select 1 from public.admin_operations
              where operation = 'ALERTES_RSEQ_V1_ROUVERTES' and details->>'annule' = op.id::text) then
    raise exception 'NEXUS: clôture % déjà annulée', op.id;
  end if;

  -- Index unique (type, cle) WHERE OUVERTE : une alerte neuve sur la même clé bloquerait.
  select count(*) into conflits
    from jsonb_array_elements(op.details->'alertes') a
    join public.rseq_sync_alerts s
      on s.type = 'NOUVELLES_EQUIPES' and s.cle = a->>'cle' and s.statut = 'OUVERTE'
     and s.id <> (a->>'id')::uuid;
  if conflits > 0 then raise exception 'NEXUS: % alerte(s) neuve(s) sur les mêmes clés — à trancher', conflits; end if;

  update public.rseq_sync_alerts s
     set statut = a->>'statut_avant',
         traite_le = (a->>'traite_le_avant')::timestamptz,
         traite_par = (a->>'traite_par_avant')::uuid,
         note = a->>'note_avant'
    from jsonb_array_elements(op.details->'alertes') a
   where s.id = (a->>'id')::uuid and s.statut = 'TRAITEE';
  get diagnostics nb = row_count;
  if nb <> (op.details->>'nb')::int then
    raise exception 'NEXUS: % alertes rouvertes, attendu %', nb, op.details->>'nb';
  end if;

  select id into admin from public.users where email = 'bptds22@gmail.com';
  insert into public.admin_operations (operation, motif, details, par)
  values ('ALERTES_RSEQ_V1_ROUVERTES', 'Rollback de la clôture des alertes v1',
          jsonb_build_object('annule', op.id, 'nb', nb), admin);
  raise notice 'NEXUS: % alertes rouvertes', nb;
end $$;

commit;
