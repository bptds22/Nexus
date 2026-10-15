-- CONTRÔLE GLOBAL de l'import Lauréats par tranches — LECTURE SEULE.
-- Attendu : 10 tranches dans admin_operations, 952 cartes et 869 notes du lot dans l'unité dfad9036 × Football.
with ops as (
  select operation, details from public.admin_operations where operation in ('IMPORT_CARTES_LAUREATS_T1', 'IMPORT_CARTES_LAUREATS_T2', 'IMPORT_CARTES_LAUREATS_T3', 'IMPORT_CARTES_LAUREATS_T4', 'IMPORT_CARTES_LAUREATS_T5', 'IMPORT_CARTES_LAUREATS_T6', 'IMPORT_CARTES_LAUREATS_T7', 'IMPORT_CARTES_LAUREATS_T8', 'IMPORT_CARTES_LAUREATS_T9', 'IMPORT_CARTES_LAUREATS_T10')
), ids as (
  select (x)::uuid as id from ops, jsonb_array_elements_text(ops.details->'carte_ids') x
)
select json_build_object(
  'tranches_presentes', (select count(*) from ops),
  'tranches_attendues', 10,
  'tranches_manquantes', (select coalesce(json_agg(o order by o), '[]'::json) from unnest(array['IMPORT_CARTES_LAUREATS_T1', 'IMPORT_CARTES_LAUREATS_T2', 'IMPORT_CARTES_LAUREATS_T3', 'IMPORT_CARTES_LAUREATS_T4', 'IMPORT_CARTES_LAUREATS_T5', 'IMPORT_CARTES_LAUREATS_T6', 'IMPORT_CARTES_LAUREATS_T7', 'IMPORT_CARTES_LAUREATS_T8', 'IMPORT_CARTES_LAUREATS_T9', 'IMPORT_CARTES_LAUREATS_T10']) o
                           where o not in (select operation from ops)),
  'ids_dans_admin_operations', (select count(*) from ids),
  'cartes_du_lot_en_base', (select count(*) from public.cartes_prospect c join ids on ids.id = c.id),
  'cartes_du_lot_dans_l_unite', (select count(*) from public.cartes_prospect c join ids on ids.id = c.id
       where c.unite_cegep_id = 'dfad9036-0d54-4304-906f-91f19542a882' and c.unite_sport_id = (select id from public.sports where nom = 'Football')),
  'notes_du_lot', (select count(*) from public.cartes_prospect_notes nn join ids on ids.id = nn.carte_id),
  'courriel_tel_parent', (select count(*) from public.cartes_prospect c join ids on ids.id = c.id
       where c.courriel is not null or c.telephone is not null or c.parent_courriel is not null or c.parent_nom is not null),
  'invitations_du_lot', (select count(*) from public.cartes_prospect_invitations i join ids on ids.id = i.carte_id),
  'cartes_de_l_unite', (select count(*) from public.cartes_prospect c where c.unite_cegep_id = 'dfad9036-0d54-4304-906f-91f19542a882'
       and c.unite_sport_id = (select id from public.sports where nom = 'Football')),
  'attendu', json_build_object('cartes', 952, 'notes', 869),
  'conforme', (select count(*) from ops) = 10
              and (select count(*) from public.cartes_prospect c join ids on ids.id = c.id) = 952
              and (select count(*) from public.cartes_prospect_notes nn join ids on ids.id = nn.carte_id) = 869
) as controle_global;
