-- ============================================================================
-- LECTURE SEULE — équipes créées par des coachs dans un club « NLS – … » qui
-- ressemblent à une équipe importée de la NLS (registre §79).
--
-- « Créée par un coach » : league vide (l'inscription civile n'en pose pas).
-- « Ressemble » : même club, même sport, même catégorie et même genre
-- (casse et espaces ignorés) qu'une équipe league = 'No Limits Showcases' —
-- la division n'est PAS comparée, c'est justement ce que le mobile ne peut
-- pas saisir (ni Diamond / Gold, ni « aucune division »).
-- Une ligne par paire (équipe créée, équipe importée candidate) ; aucune
-- ligne = aucun doublon probable.
-- ============================================================================
select s.name                                   as club,
       c.name                                   as equipe_creee,
       c.age_group                              as categorie,
       c.gender                                 as genre,
       nullif(c.division, '')                   as division_saisie,
       c.created_at                             as creee_le,
       c.id                                     as equipe_creee_id,
       i.name                                   as equipe_importee,
       nullif(i.division, '')                   as division_importee,
       i.id                                     as equipe_importee_id,
       (select string_agg(coalesce(nullif(trim(u.first_name || ' ' || u.last_name), ''), tc.coach_id::text)
                          || ' (' || tc.role || ')', ', ')
          from public.team_coaches tc left join public.users u on u.id = tc.coach_id
         where tc.team_id = c.id)               as coachs_equipe_creee,
       (select count(*) from public.team_athletes ta where ta.team_id = c.id) as athletes_equipe_creee,
       (select count(*) from public.team_coaches tc where tc.team_id = i.id)  as coachs_equipe_importee
  from public.teams c
  join public.schools s on s.id = c.school_id
  join public.teams i on i.school_id = c.school_id
                     and i.sport_id  = c.sport_id
                     and i.league    = 'No Limits Showcases'
                     and lower(btrim(coalesce(i.age_group, ''))) = lower(btrim(coalesce(c.age_group, '')))
                     and lower(btrim(coalesce(i.gender,    ''))) = lower(btrim(coalesce(c.gender,    '')))
 where s.type = 'LIGUE_CIVILE'
   and s.name like 'NLS – %'
   and btrim(coalesce(c.league, '')) = ''
 order by s.name, c.created_at, i.name;
