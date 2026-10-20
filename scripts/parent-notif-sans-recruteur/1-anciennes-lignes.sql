-- ============================================================================
-- Anciennes parent_notifications : retirer les identifiants de recruteur ou de
-- cégep de metadata. Après 20261020180000 (trigger + table de copie).
--
-- AUCUN DELETE. Chaque ligne touchée est d'abord COPIÉE telle quelle dans
-- parent_notifications_metadata_avant ; 2-rollback.sql la remet à l'identique.
--
-- Gardes (exception « NEXUS: » → rien n'est écrit) :
--   · nombre de lignes et empreinte des ids = ceux du relevé 0-releve.sql
--     (à recopier ci-dessous avant exécution) ;
--   · après : 0 ligne ne porte encore une clé retirée ; copie = lignes touchées.
-- Usage : remplacer __ATTENDU__ et __EMPREINTE__ par les valeurs du relevé.
-- Bloc DO unique = atomique.
-- ============================================================================
do $$
declare
  c_attendu   constant integer := __ATTENDU__;
  c_empreinte constant text    := '__EMPREINTE__';
  v_n         integer;
  v_emp       text;
begin
  select count(*), md5(string_agg(id::text, ',' order by id)) into v_n, v_emp
    from public.parent_notifications
   where metadata ?| public.parent_notif_cles_retirees();
  if v_n <> c_attendu or v_emp is distinct from c_empreinte then
    raise exception 'NEXUS: % lignes (empreinte %), attendu % (%) — refaire le relevé', v_n, v_emp, c_attendu, c_empreinte;
  end if;

  insert into public.parent_notifications_metadata_avant (notification_id, metadata)
  select id, metadata from public.parent_notifications
   where metadata ?| public.parent_notif_cles_retirees()
  on conflict (notification_id) do nothing;
  get diagnostics v_n = row_count;
  if v_n <> c_attendu then
    raise exception 'NEXUS: % copies (attendu %) — copie déjà présente ?', v_n, c_attendu;
  end if;

  update public.parent_notifications pn
     set metadata = pn.metadata - public.parent_notif_cles_retirees()
    from public.parent_notifications_metadata_avant b
   where b.notification_id = pn.id
     and pn.metadata ?| public.parent_notif_cles_retirees();
  get diagnostics v_n = row_count;
  if v_n <> c_attendu then
    raise exception 'NEXUS: % lignes modifiées (attendu %)', v_n, c_attendu;
  end if;

  if exists (select 1 from public.parent_notifications where metadata ?| public.parent_notif_cles_retirees()) then
    raise exception 'NEXUS: des lignes portent encore un identifiant';
  end if;
end $$;
