-- Rollback de 1-anciennes-lignes.sql : remet metadata À L'IDENTIQUE depuis
-- parent_notifications_metadata_avant. Aucun DELETE (la copie reste).
-- Le trigger trg_parent_notif_sans_identifiants retirerait de nouveau les
-- clés : il est suspendu le temps de la transaction, puis réactivé.
-- Bloc unique : à exécuter avec psql -1 (ou en une transaction MCP).
alter table public.parent_notifications disable trigger trg_parent_notif_sans_identifiants;

update public.parent_notifications pn
   set metadata = b.metadata
  from public.parent_notifications_metadata_avant b
 where b.notification_id = pn.id
   and pn.metadata is distinct from b.metadata;

alter table public.parent_notifications enable trigger trg_parent_notif_sans_identifiants;

do $$
begin
  if exists (select 1 from public.parent_notifications pn
               join public.parent_notifications_metadata_avant b on b.notification_id = pn.id
              where pn.metadata is distinct from b.metadata) then
    raise exception 'NEXUS: rollback incomplet';
  end if;
  if not (select tgenabled = 'O' from pg_trigger where tgname = 'trg_parent_notif_sans_identifiants') then
    raise exception 'NEXUS: trigger non réactivé';
  end if;
end $$;
