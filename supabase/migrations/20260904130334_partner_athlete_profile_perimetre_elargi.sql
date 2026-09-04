-- ═══════════════════════════════════════════════════════════════
-- PÉRIMÈTRE PARTENAIRE ÉLARGI — lots 2 à 7, une seule migration
--
-- partner_athlete_profile passe de 30 à 61 colonnes projetées. Rien n'est
-- retiré, rien ne change de nom : une seule colonne change de SENS
-- (`cote_globale`, voir plus bas), les 29 autres sont identiques.
--
-- ═══ LE CADRE — arbitrage BP du 2026-09-03, à ne plus re-deviner ═══
--
-- La règle du 19 août (« rien du texte libre d'un adulte sur un mineur »)
-- reste entière. Elle visait `rapport_entraineur` et `notes_coach` : de la
-- PROSE nominative, écrite par un adulte, sur un enfant. Elle ne visait pas
-- les chiffres.
--
-- LA DISTINCTION, ÉCRITE UNE FOIS POUR TOUTES :
--   · CHIFFRES SUR GRILLE STRUCTURÉE → DANS le périmètre. Une cote globale
--     et les 14 traits sont de MÊME NATURE que les badges, déjà partagés
--     depuis le 25 août : une mesure bornée, sur une échelle publique, dont
--     l'athlète et son coach connaissent la définition. Un « 4/5 en
--     leadership » ne raconte rien sur personne ; il situe sur une grille.
--   · TEXTE NOMINATIF LIBRE → JAMAIS. Aucune exception, aucun palier,
--     aucune anonymisation qui rendrait la chose acceptable.
--     `rapport_entraineur`, `notes_coach` : hors périmètre définitivement.
--     Le lateral ci-dessous ne les sélectionne pas, et le garde-fou en fin
--     de fichier refuse leur retour.
--
-- DEUX MASQUAGES QUI NE SONT PAS DES OUBLIS :
--   · STATUT DE RECRUTEMENT (`recruitment_status`,
--     `statut_recrutement_override`, `open_to_offers`, `committed_school_id`)
--     — MASQUÉ, et pas pour un motif de vie privée : c'est de l'information
--     COMMERCIALEMENT SENSIBLE. Savoir qu'un athlète est « engagé » ou
--     « en discussion » avant tout le monde a une valeur que le partenaire
--     n'achète pas. Le front le masque déjà ; le garde-fou l'inscrit ici.
--   · `instagram_url` — hors lot. Ce n'est pas une vidéo de sport, c'est le
--     compte personnel d'un mineur ; il n'est pas dans la liste des lots
--     ouverts (« vidéos secondaires »). L'ouvrir se décide, ne se déduit pas.
--
-- LE GARDE-FOU N'INTERDIT PAS D'ÉLARGIR. Il oblige à rouvrir sa liste —
-- donc à relire ce cadre — avant de projeter l'un de ces noms. C'est la
-- discipline de la règle 11 du MIGRATION SAFETY CHECKLIST : une exemption
-- se réécrit, elle ne s'évapore pas.
--
-- ═══ CE QUI ENTRE, LOT PAR LOT ═══
--
-- LOT 2 — PRÉSÉANCE DE COTE, ALIGNÉE SUR LE RECRUTEUR.
--   `cote_globale` rendait `athletes.cote_globale_entraineur` NU. Le
--   recruteur, lui, calcule `eval.cote_globale ?? cote_globale_entraineur`
--   (AthleteRecruiterProfileBody, `overallRating`). Deux écrans, deux
--   nombres possibles sur le même athlète. La colonne devient donc
--   `coalesce(e.cote_globale, a.cote_globale_entraineur)` : une seule
--   définition, côté serveur, que la carte partageable ET le corps de fiche
--   lisent. `eval_cote_globale` est projetée EN PLUS, brute, pour que le
--   front rejoue son expression telle quelle sans changer de code.
--
--   ET LA DIVERGENCE DE TRI EST CORRIGÉE. Le lateral triait
--   `created_at desc` là où selectBestEvaluation (frontend) trie
--   `updated_at desc` : deux règles concurrentes sur « quelle évaluation
--   gagne », signalées dans le code depuis août et jamais réconciliées.
--   Relevé en prod le 2026-09-03 : 5 athlètes évalués, 2 en portent
--   plusieurs, et 1 change de ligne selon la clé de tri. Aujourd'hui les
--   deux lignes de cet athlète portent la même cote et il n'est pas
--   éligible partenaire — la correction est donc INERTE à l'instant où elle
--   est posée. Elle ne l'était plus le jour où l'on projette 14 traits :
--   deux lignes différentes, ce sont 14 nombres différents. On aligne
--   pendant que ça ne coûte rien. `nulls last` reproduit le -Infinity que
--   le frontend donne à un `updated_at` manquant ; `created_at desc` en
--   départage, là où le frontend garde le premier venu.
--
-- LOT 3 — COMPLÉTION (`profile_completion`). Ouverte (arbitrage BP). La
--   barre était masquée parce qu'elle affichait « 0 % » pour les 48 fiches
--   éligibles, alors que le réel va de 30 à 95. Elle dit maintenant vrai.
--
-- LOT 4 — MESURES : envergure, taille_mains, main_dominante, pied_dominant.
-- LOT 5 — VIDÉOS SECONDAIRES : video_match_complet_url,
--   video_entrainement_url. Deux vidéos de sport, rien d'autre.
-- LOT 6 — TESTS ATHLÉTIQUES : les six chronos et sauts.
--
-- LOT 6bis — LES 14 TRAITS, plus `eval_id` et `eval_grille_id`.
--   `eval_id` est le MARQUEUR D'EXISTENCE : `updated_at` est nullable sur
--   evaluations (vérifié en prod), `cote_globale` et chaque trait peuvent
--   être nuls légitimement. Seul l'id dit « il y a une évaluation ». Sans
--   lui, l'adaptateur front ne saurait pas distinguer « aucune évaluation »
--   de « une évaluation vide », et rendrait 14 zéros.
--   `eval_grille_id` n'est PAS une donnée d'athlète : c'est l'ÉTIQUETTE des
--   5 fentes variables de la grille. Sans elle, le partenaire voit les
--   mêmes 14 nombres que le recruteur sous des libellés résolus par un
--   repli — donc potentiellement d'autres mots pour les mêmes notes. Le
--   catalogue des grilles est déjà lu côté client par ce même écran.
--
-- LOT 7 — PARCOURS D'ÉQUIPES (`parcours_equipes`).
--   RÉPONSE À LA QUESTION POSÉE : NON, la donnée n'arrivait pas déjà. Le
--   parcours n'était pas une garde front seule comme les badges — la RPC ne
--   projetait rien. Il rejoint donc bien la migration groupée.
--   C'est de l'historique sportif : nom d'équipe, sport, ligue, division,
--   saisons. Aucun nom de personne, aucune prose. Même nature verte que les
--   badges et les mesures.
--
-- ═══ POURQUOI DROP PUIS CREATE ═══
-- `create or replace` refuse tout changement de RETURNS TABLE (42P13). Le
-- drop est sûr : relevé pg_depend le 2026-09-03, AUCUN objet ne dépend de
-- cette fonction (badges_json avait rompu la dernière dépendance en août).
-- La migration est atomique — aucun appel partenaire ne tombe entre les deux.
--
-- ═══ CE QUI NE BOUGE PAS ═══
-- Le gate (`is_approved_partner(null)` ET `is_partner_eligible_athlete`),
-- SECURITY DEFINER, le search_path, le REVOKE anon, l'âge dérivé côté
-- serveur, l'absence totale de `date_naissance`. Aucune RLS touchée, aucune
-- vue redéfinie — le contrôle scripts/check-view-hardening.sql n'a rien de
-- nouveau à voir ici.
-- ═══════════════════════════════════════════════════════════════

drop function if exists public.partner_athlete_profile(uuid);

create function public.partner_athlete_profile(p_athlete_id uuid)
 returns table(
   -- ── Les 30 colonnes d'origine, inchangées de nom et de position ──
   id uuid, first_name text, last_name text, photo_url text,
   numero_jersey text, age integer, genre text, annee_diplomation integer,
   verified boolean, last_profile_validation timestamp with time zone,
   cote_globale numeric, taille_pieds integer, taille_pouces integer,
   poids_lbs numeric, bio text, sport_nom text, position_nom text,
   position_abbr text, school_name text, school_region text, school_city text,
   school_type text, is_civil boolean, team_name text, league_name text,
   distinctions jsonb, video_faits_saillants_url text, hudl_url text,
   youtube_url text, badges jsonb,
   -- ── Lot 3 ──
   profile_completion integer,
   -- ── Lot 4 ──
   envergure text, taille_mains text, main_dominante text, pied_dominant text,
   -- ── Lot 6 ──
   test_40_verges text, saut_vertical text, saut_longueur text,
   developpe_couche text, navette_agilite text, sprint_100m text,
   -- ── Lot 5 ──
   video_match_complet_url text, video_entrainement_url text,
   -- ── Lot 7 ──
   parcours_equipes jsonb,
   -- ── Lots 2 et 6bis : l'évaluation retenue ──
   eval_id uuid, eval_grille_id uuid, eval_cote_globale numeric,
   vitesse_explosivite numeric, force_puissance numeric, endurance_cardio numeric,
   agilite_coordination numeric, vision_du_jeu numeric, sens_tactique numeric,
   leadership integer, discipline integer, coachabilite integer,
   intelligence_jeu integer, competitivite integer, esprit_equipe integer,
   resilience integer, attitude_mentalite integer)
 language sql stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
  select
    a.id, a.first_name, a.last_name, a.photo_url, a.numero_jersey,
    extract(year from age(a.date_naissance))::int as age,
    a.genre, a.annee_diplomation, a.verified, a.last_profile_validation,
    -- LOT 2 : la préséance du recruteur, décidée UNE fois, côté serveur.
    coalesce(e.cote_globale, a.cote_globale_entraineur) as cote_globale,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.bio, s.nom, p.nom, p.abreviation, sch.name, sch.region, sch.city, sch.type,
    (a.school_id is null or sch.type = 'LIGUE_CIVILE') as is_civil,
    t.name  as team_name,
    t.league as league_name,
    e.distinctions,
    a.video_faits_saillants_url, a.hudl_url, a.youtube_url,
    ( select coalesce(jsonb_agg(jsonb_build_object(
               'code', x.code, 'libelle', x.libelle, 'famille', x.famille,
               'contexte', x.contexte, 'attribue_le', x.attribue_le)
             order by x.rang, x.ordre, x.attribue_le), '[]'::jsonb)
        from ( select b2.code, b2.libelle, b2.famille, ab.contexte,
                      ab.created_at as attribue_le, b2.ordre,
                      case b2.famille when 'honneur' then 0 when 'universel' then 1 else 2 end as rang
                 from public.athlete_badges ab
                 join public.badges b2 on b2.id = ab.badge_id
                where ab.athlete_id = a.id and ab.retire_le is null) x
    ) as badges,
    a.profile_completion,
    a.envergure, a.taille_mains, a.main_dominante, a.pied_dominant,
    a.test_40_verges, a.saut_vertical, a.saut_longueur,
    a.developpe_couche, a.navette_agilite, a.sprint_100m,
    a.video_match_complet_url, a.video_entrainement_url,
    a.parcours_equipes,
    e.id, e.grille_id, e.cote_globale,
    e.vitesse_explosivite, e.force_puissance, e.endurance_cardio,
    e.agilite_coordination, e.vision_du_jeu, e.sens_tactique,
    e.leadership, e.discipline, e.coachabilite,
    e.intelligence_jeu, e.competitivite, e.esprit_equipe,
    e.resilience, e.attitude_mentalite
  from public.athletes a
  left join public.sports    s   on s.id   = a.sport_id
  left join public.positions p   on p.id   = a.position_id
  left join public.schools   sch on sch.id = a.school_id
  -- team_athletes porte UNIQUE (athlete_id) : la jointure est 1:0..1, aucune
  -- duplication possible (verifie 2026-08-19, 0 athlete multi-equipes).
  left join public.team_athletes ta on ta.athlete_id = a.id
  left join public.teams         t  on t.id = ta.team_id
  left join lateral (
    -- L'ÉVALUATION RETENUE — même clé que selectBestEvaluation côté front
    -- (`updated_at desc`) : la divergence `created_at` d'août est corrigée.
    -- `nulls last` = le -Infinity que le frontend donne à un updated_at
    -- manquant. rapport_entraineur et notes_coach NE SONT PAS ICI, et n'y
    -- seront pas — voir LE CADRE en tête de fichier.
    select ev.id, ev.grille_id, ev.cote_globale, ev.distinctions,
           ev.vitesse_explosivite, ev.force_puissance, ev.endurance_cardio,
           ev.agilite_coordination, ev.vision_du_jeu, ev.sens_tactique,
           ev.leadership, ev.discipline, ev.coachabilite, ev.intelligence_jeu,
           ev.competitivite, ev.esprit_equipe, ev.resilience, ev.attitude_mentalite
    from public.evaluations ev
    where ev.athlete_id = a.id
    order by ev.updated_at desc nulls last, ev.created_at desc
    limit 1
  ) e on true
  where a.id = p_athlete_id
    and public.is_approved_partner(null)
    and public.is_partner_eligible_athlete(a.id);
$function$;

revoke all on function public.partner_athlete_profile(uuid) from public, anon;
grant execute on function public.partner_athlete_profile(uuid) to authenticated, service_role;

comment on function public.partner_athlete_profile(uuid) is
$c$Projection partenaire d'une fiche athlete — 61 colonnes, gate interne
(is_approved_partner ET is_partner_eligible_athlete).

LE CADRE (arbitrage BP, 2026-09-03) — a lire AVANT d'ajouter une colonne :
  · CHIFFRES SUR GRILLE STRUCTUREE : DANS le perimetre. La cote globale et
    les 14 traits sont de meme nature que les badges — une mesure bornee sur
    une echelle publique, pas un propos sur quelqu'un.
  · TEXTE NOMINATIF LIBRE : JAMAIS. rapport_entraineur, notes_coach — la
    prose d'un adulte sur un mineur ne franchit pas cette frontiere, sans
    exception ni palier.
  · STATUT DE RECRUTEMENT : masque. Motif COMMERCIAL, pas vie privee —
    savoir qui est engage avant tout le monde a une valeur que le partenaire
    n'achete pas.
  · PARCOURS D'EQUIPES : dans le perimetre. Historique sportif public
    (equipes, saisons, ligues) — aucun nom de personne, aucune prose.
  · date_naissance : jamais projetee. L'age arrive derive du serveur.

cote_globale = coalesce(evaluation retenue, athletes.cote_globale_entraineur)
— la meme preseance que la fiche recruteur. L'evaluation retenue est celle au
`updated_at` le plus recent, meme clef que selectBestEvaluation cote front.

Le bloc DO de la migration partner_athlete_profile_perimetre_elargi refuse a
l'application toute colonne hors cadre. Elargir le perimetre = modifier cette
liste, donc relire ce commentaire.$c$;

-- ── GARDE-FOU ──────────────────────────────────────────────────────────
-- Deux vérifications, exécutées à l'application. Le préfixe « NEXUS: » est
-- obligatoire : sans lui, le message n'atteint jamais l'écran.
do $$
declare
  n_out      int;
  hors_cadre text[];
begin
  select count(*) into n_out
    from pg_proc pr, unnest(pr.proargmodes, pr.proargnames) as u(mode, nom)
   where pr.oid = 'public.partner_athlete_profile(uuid)'::regprocedure
     and u.mode = 't';

  if n_out <> 61 then
    raise exception 'NEXUS: partner_athlete_profile projette % colonnes, 61 attendues', n_out;
  end if;

  select array_agg(u.nom order by u.nom) into hors_cadre
    from pg_proc pr, unnest(pr.proargnames) as u(nom)
   where pr.oid = 'public.partner_athlete_profile(uuid)'::regprocedure
     and u.nom = any (array[
       -- Loi 25 / identité
       'date_naissance','email','telephone','nom_parent','telephone_parent',
       'consentement_parental',
       -- Dossier scolaire
       'moyenne_generale','mentions_academiques','matieres_fortes',
       'programme_cegep_vise','programmes_vises','regions_cegep_preferees',
       -- Texte libre d'un adulte sur un mineur
       'rapport_entraineur','notes_coach',
       -- Sensible commercialement
       'recruitment_status','statut_recrutement_override','open_to_offers',
       'committed_school_id',
       -- Hors lot, à décider explicitement
       'instagram_url']);

  if hors_cadre is not null then
    raise exception
      'NEXUS: colonne(s) hors cadre partenaire projetee(s) — %. Relire le commentaire de la fonction avant de toucher a ce garde-fou.',
      array_to_string(hors_cadre, ', ');
  end if;

  raise notice 'NEXUS: partner_athlete_profile — 61 colonnes, cadre respecte.';
end $$;
