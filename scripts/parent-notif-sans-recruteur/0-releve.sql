-- Relevé LECTURE SEULE : anciennes parent_notifications qui portent un
-- identifiant de recruteur ou de cégep dans metadata.
-- Exécuter dans une transaction read only.
select count(*)                                  as lignes_a_modifier,
       count(distinct parent_user_id)            as parents,
       count(*) filter (where type = 'CHILD_FAVORITED')      as favori,
       count(*) filter (where type = 'CHILD_PIPELINE_STAGE') as etape,
       count(*) filter (where type = 'CHILD_VISIT_PLANNED')  as visite,
       count(*) filter (where type not in ('CHILD_FAVORITED', 'CHILD_PIPELINE_STAGE', 'CHILD_VISIT_PLANNED')) as autres,
       min(created_at) as plus_ancienne, max(created_at) as plus_recente,
       md5(string_agg(id::text, ',' order by id)) as empreinte_ids
  from public.parent_notifications
 where metadata ?| public.parent_notif_cles_retirees();

-- Le détail (sans aucune valeur d'identifiant) :
select id, type, created_at, array(select k from jsonb_object_keys(metadata) k order by k) as cles
  from public.parent_notifications
 where metadata ?| public.parent_notif_cles_retirees()
 order by created_at;
