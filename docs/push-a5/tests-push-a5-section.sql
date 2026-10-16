-- ══ A5 — ouverture au clic et cloche (après tout le banc A4a, même transaction) ══════════

-- ── C. Ce que le push porte ─────────────────────────────────────────────────
select pg_temp.verif('C1 chaque push de la file porte type=announcement + nx_type + route (= push_destination)',
  (select count(*) filter (where d->>'type' = 'announcement' and d ? 'nx_type'
                             and d->>'route' = public.push_destination(d->>'nx_type')->>'route')
          || '/' || count(*)
     from (select convert_from(q.body, 'UTF8')::jsonb->'data' as d from net.http_request_queue q
            where q.id > current_setting('t.q_net')::bigint
              and convert_from(q.body, 'UTF8')::jsonb->'data' ? 'envoi_id') x),
  (select count(*) || '/' || count(*) from push_envois));
select pg_temp.verif('C2 nx_type = le genre de la file, route attendue par genre',
  (select string_agg(distinct d->>'nx_type' || '→' || (d->>'route'), ', ' order by d->>'nx_type' || '→' || (d->>'route'))
     from (select convert_from(q.body, 'UTF8')::jsonb->'data' as d from net.http_request_queue q
            where q.id > current_setting('t.q_net')::bigint
              and convert_from(q.body, 'UTF8')::jsonb->'data' ? 'envoi_id') x),
  (select string_agg(distinct f.genre || '→' || (public.push_destination(f.genre)->>'route'), ', '
                     order by f.genre || '→' || (public.push_destination(f.genre)->>'route'))
     from push_file f where f.statut = 'ENVOYE'));
select pg_temp.verif('C3 routes de la liste blanche du client',
  public.push_destination('BADGE_COACH')->>'route' || ' | ' || (public.push_destination('BADGE_PARTENAIRE')->>'route')
  || ' | ' || (public.push_destination('EVALUATION_COACH')->>'route') || ' | ' || (public.push_destination('EVALUATION_PARTENAIRE')->>'route')
  || ' | ' || (public.push_destination('CARTE_PARTENAIRE')->>'route') || ' | ' || (public.push_destination('AUTRE')->>'route'),
  '/athlete/profil/apercu?section=badges | /athlete/profil/apercu?section=badges | /athlete/profil/apercu?section=evaluation | /athlete/profil/apercu?section=evaluation | /athlete/cartes-partenaires | /athlete/notifications');
select pg_temp.verif('C4 les autres clés du push sont inchangées (categorie, envoi_id, collapse_id)',
  (select count(*)::text from net.http_request_queue q
    where q.id > current_setting('t.q_net')::bigint
      and convert_from(q.body, 'UTF8')::jsonb->'data' ? 'envoi_id'
      and not (convert_from(q.body, 'UTF8')::jsonb->'data' ? 'categorie'
               and convert_from(q.body, 'UTF8')::jsonb ? 'collapse_id')), '0');

-- ── N. Chaque élément de la file a sa ligne dans la cloche ───────────────────
select pg_temp.verif('N1 tout élément badge/évaluation/carte a sa notification (sauf la mise à jour d''évaluation du coach, qui a la sienne)',
  (select count(*)::text from push_file f
    where not (
        exists (select 1 from athlete_notifications n where n.id::text = f.detail->>'notification_id'
                   and n.type = case f.genre when 'BADGE_COACH' then 'COACH_DISTINCTION_ADDED'
                                             when 'EVALUATION_COACH' then 'COACH_EVALUATION_UPDATED'
                                             when 'BADGE_PARTENAIRE' then 'PARTENAIRE_BADGE'
                                             when 'EVALUATION_PARTENAIRE' then 'PARTENAIRE_EVALUATION_RECUE'
                                             when 'CARTE_PARTENAIRE' then 'PARTENAIRE_EVALUATION' end)
        or (f.genre = 'EVALUATION_COACH' and not (f.detail ? 'notification_id')
            and exists (select 1 from athlete_notifications n join athletes a on a.id = n.athlete_id
                         where a.user_id = f.user_id and n.type = 'COACH_EVALUATION_UPDATED'
                           and n.created_at = now() and not (n.metadata ? 'push_cle'))))), '0');
select pg_temp.verif('N2 aussi pour ce qui ne part pas (préférence coupée, sans appareil, compte inactif)',
  (select count(*) filter (where f.detail ? 'notification_id') || '/' || count(*) from push_file f
    where f.statut in ('PREFERENCE', 'SANS_JETON', 'ANNULE') and f.genre <> 'CARTE_PARTENAIRE'
      and not (f.genre = 'EVALUATION_COACH' and not (f.detail ? 'notification_id'))),
  (select count(*) || '/' || count(*) from push_file f
    where f.statut in ('PREFERENCE', 'SANS_JETON', 'ANNULE') and f.genre <> 'CARTE_PARTENAIRE'
      and not (f.genre = 'EVALUATION_COACH' and not (f.detail ? 'notification_id'))));
select pg_temp.verif('N3 un push groupé = UNE notification, au texte du push',
  (select count(*)::text from push_envois e
    where e.categorie = 'BADGES_EVALUATIONS'
      and exists (select 1 from push_file f where f.envoi_id = e.id and f.detail ? 'notification_id')
      and ((select count(distinct f.detail->>'notification_id') from push_file f where f.envoi_id = e.id and f.detail ? 'notification_id') <> 1
           or not exists (select 1 from athlete_notifications n
                           where n.id::text = (select max(f.detail->>'notification_id') from push_file f where f.envoi_id = e.id)
                             and n.title = e.titre and n.message = e.texte))), '0');
select pg_temp.verif('N4 au moins un groupe de plusieurs badges a été vérifié',
  (select (count(*) > 0)::text from push_envois e where e.nb_elements > 1 and e.categorie = 'BADGES_EVALUATIONS'), 'true');
select pg_temp.verif('N5 la cloche ne porte ni cote, ni grade, ni chiffre (hors « N nouveaux badges »)',
  (select count(*)::text from athlete_notifications n
    where n.metadata ? 'push_cle'
      and ((n.title || ' ' || coalesce(n.message, '')) ~* '(cote|grade|/ ?5|[0-9][.,][0-9])'
           or regexp_replace(regexp_replace(n.title || ' ' || coalesce(n.message, ''), '[0-9]+ nouveaux badges', '', 'g'),
                             'badge Top 25', '', 'g') ~ '[0-9]')), '0');
select pg_temp.verif('N6 la notification porte la route de son push',
  (select count(*)::text from athlete_notifications n
    where n.metadata ? 'push_cle' and n.metadata->>'route' is distinct from
          public.push_destination(n.metadata->>'nx_type')->>'route'), '0');

-- ── G. Regroupement dans la cloche, cas directs ─────────────────────────────
delete from push_file where statut = 'EN_ATTENTE';
select public.push_mettre_en_file(current_setting('t.felix')::uuid, 'BADGES_EVALUATIONS', 'BADGE_PARTENAIRE', 'badges:partenaire:banc-a5',
         'Média A5', '{"libelle": "Top 25"}'::jsonb);
select pg_temp.verif('G1 un badge partenaire : « Nouveau badge » / « Tu as reçu le badge Top 25 de Média A5. »',
  (select count(*) || '|' || max(title) || '|' || max(message) || '|' || bool_and(not read)
     from athlete_notifications where metadata->>'push_cle' = 'badges:partenaire:banc-a5'),
  '1|Nouveau badge|Tu as reçu le badge Top 25 de Média A5.|true');
update athlete_notifications set read = true where metadata->>'push_cle' = 'badges:partenaire:banc-a5';
select public.push_mettre_en_file(current_setting('t.felix')::uuid, 'BADGES_EVALUATIONS', 'BADGE_PARTENAIRE', 'badges:partenaire:banc-a5',
         'Média A5', '{"libelle": "Esprit sportif"}'::jsonb);
select pg_temp.verif('G2 un 2e du même groupe : la MÊME notification, réécrite et remise à non lue',
  (select count(*) || '|' || max(title) || '|' || max(message) || '|' || bool_and(not read)
     from athlete_notifications where metadata->>'push_cle' = 'badges:partenaire:banc-a5'),
  '1|2 nouveaux badges|2 nouveaux badges de Média A5.|true');
select pg_temp.verif('G3 les 2 éléments de la file pointent cette notification',
  (select count(distinct detail->>'notification_id') || '|' || count(*) from push_file where cle = 'badges:partenaire:banc-a5'), '1|2');
update push_file set statut = 'ENVOYE', traite_le = now() where cle = 'badges:partenaire:banc-a5';
select public.push_mettre_en_file(current_setting('t.felix')::uuid, 'BADGES_EVALUATIONS', 'BADGE_PARTENAIRE', 'badges:partenaire:banc-a5',
         'Média A5', '{"libelle": "Top 25"}'::jsonb);
select pg_temp.verif('G4 le groupe parti, un nouveau badge = une nouvelle notification',
  (select count(*)::text from athlete_notifications where metadata->>'push_cle' = 'badges:partenaire:banc-a5'), '2');
select public.push_mettre_en_file(current_setting('t.felix')::uuid, 'BADGES_EVALUATIONS', 'EVALUATION_COACH', 'eval:coach:banc-a5',
         null, '{"cloche": false}'::jsonb);
select pg_temp.verif('G5 « cloche: false » : aucune notification, et la clé ne reste pas dans la file',
  (select count(*) from athlete_notifications where metadata->>'push_cle' = 'eval:coach:banc-a5')
  || '|' || (select count(*) || '|' || bool_and(not (detail ? 'cloche')) from push_file where cle = 'eval:coach:banc-a5'),
  '0|1|true');
select public.push_mettre_en_file(current_setting('t.felix')::uuid, 'BADGES_EVALUATIONS', 'EVALUATION_COACH', 'eval:coach:banc-a5b',
         null, '{}'::jsonb);
select pg_temp.verif('G6 évaluation du coach (création), coach non nommable : « Ton entraîneur t''a évalué. »',
  (select type || '|' || title || '|' || message from athlete_notifications where metadata->>'push_cle' = 'eval:coach:banc-a5b'),
  'COACH_EVALUATION_UPDATED|Nouvelle évaluation|Ton entraîneur t''a évalué.');
select public.push_mettre_en_file((select id from athletes where user_id is null limit 1), 'BADGES_EVALUATIONS', 'BADGE_COACH',
         'badges:coach:banc-a5-sans-compte', 'X', '{}'::jsonb);
select pg_temp.verif('G7 fiche sans compte : ni file ni cloche',
  (select count(*) from push_file where cle = 'badges:coach:banc-a5-sans-compte')
  || '|' || (select count(*) from athlete_notifications where metadata->>'push_cle' = 'badges:coach:banc-a5-sans-compte'), '0|0');
select public.push_mettre_en_file(current_setting('t.mathis')::uuid, 'CARTES_PARTENAIRES', 'CARTE_PARTENAIRE', 'carte:banc-a5',
         'Média A5', '{"carte_id": "x", "notification_id": "00000000-0000-0000-0000-000000000000"}'::jsonb);
select pg_temp.verif('G8 carte partenaire : pas de 2e notification, detail inchangé',
  (select count(*) from athlete_notifications where metadata->>'push_cle' = 'carte:banc-a5')
  || '|' || (select detail::text from push_file where cle = 'carte:banc-a5'),
  '0|{"carte_id": "x", "notification_id": "00000000-0000-0000-0000-000000000000"}');

-- ── D. Droits de la nouvelle fonction ───────────────────────────────────────
set local role authenticated;
select pg_temp.essai('D1 push_destination fermée aux utilisateurs', current_setting('t.felix_u'),
  'select public.push_destination(''BADGE_COACH'')::text', 'ERR:42501');
select pg_temp.essai('D2 un jeune lit ses nouvelles notifications (RLS existante)', current_setting('t.felix_u'),
  'select (count(*) > 0)::text from public.athlete_notifications where type in (''PARTENAIRE_BADGE'', ''COACH_DISTINCTION_ADDED'')', 'true');
reset role;
