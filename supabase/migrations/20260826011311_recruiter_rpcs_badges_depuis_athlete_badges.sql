-- ═══════════════════════════════════════════════════════════════
-- VOIE 2 — les trois RPC recruteur projettent athlete_badges.
--
-- LE PROBLEME
-- recruiter_athlete_cards, recruiter_search_athletes et
-- recruiter_athlete_profile projetaient ev.distinctions, la colonne DERIVEE.
-- Elle ne porte que les codes ayant un equivalent parmi les 7 anciens : la
-- fiche recruteur montrait 3 badges sur 7, et un athlete dont tous les badges
-- sont specifiques au sport n'en montrait aucun.
--
-- POURQUOI UNE REECRITURE CIBLEE
-- Ces trois fonctions font 700 a 950 caracteres de RETURNS TABLE a elles
-- seules. Les recopier pour changer UNE expression, c'est se donner trois
-- occasions de reintroduire une difference invisible ailleurs. On relit la
-- definition deployee, on remplace l'expression VISEE, on execute. Si elle
-- n'est pas trouvee, on LEVE — jamais de substitution muette.
--
-- SUBSTITUTION PAR EXPRESSION REGULIERE, PAS LITTERALE
-- Un premier essai en replace() litteral a leve sur
-- recruiter_athlete_profile, qui ecrit « 'distinctions',        ev.… » avec
-- huit espaces la ou les deux autres en ont un. Le garde-fou a fait son
-- travail ; la substitution est donc insensible a l'espacement.
--
-- ET SURTOUT : LE RETURNS TABLE NE DOIT PAS BOUGER
-- Un changement de type de retour imposerait DROP + CREATE, et PostgREST
-- rendrait 404 sur ces trois routes le temps de la transaction. On capture
-- pg_get_function_result AVANT, on recompare APRES, on leve au moindre
-- ecart. C'est la garantie, pas l'intention.
--
-- CONSEQUENCE DE FORME
-- Les badges sont par ATHLETE, la projection est dans un agregat par
-- EVALUATION : un athlete a deux evaluations verra la meme liste dans les
-- deux entrees. selectBestEvaluation en choisit une — et l'ambiguite
-- « distinctions de quelle evaluation ? » disparait, faute de deux sources.
-- ═══════════════════════════════════════════════════════════════

DO $mig$
DECLARE
  r record;
  v_avant text;
  v_apres text;
  v_src   text;
  v_new   text;
  v_motif constant text := '''distinctions''\s*,\s*ev\.distinctions';
  v_remp  constant text :=
    '''distinctions'', (select coalesce(jsonb_agg(jsonb_build_object('
    || '''badge'', b2.code, ''detail'', ab.contexte, ''libelle'', b2.libelle'
    || ') order by b2.ordre), ''[]''::jsonb)'
    || ' from public.athlete_badges ab'
    || ' join public.badges b2 on b2.id = ab.badge_id'
    || ' where ab.athlete_id = ev.athlete_id and ab.retire_le is null)';
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('recruiter_athlete_cards',
                         'recruiter_search_athletes',
                         'recruiter_athlete_profile')
  LOOP
    v_avant := pg_get_function_result(r.oid);
    v_src   := pg_get_functiondef(r.oid);

    IF v_src !~ v_motif THEN
      RAISE EXCEPTION
        'NEXUS: expression ''distinctions'' / ev.distinctions introuvable dans %. Le corps deploye a change — aucune substitution faite.',
        r.proname;
    END IF;

    v_new := regexp_replace(v_src, v_motif, v_remp);
    EXECUTE v_new;

    SELECT pg_get_function_result(p.oid) INTO v_apres
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = r.proname
     LIMIT 1;

    IF v_apres IS DISTINCT FROM v_avant THEN
      RAISE EXCEPTION
        'NEXUS: le RETURNS TABLE de % a change — annulation. Avant: % / Apres: %',
        r.proname, left(v_avant, 120), left(v_apres, 120);
    END IF;

    RAISE NOTICE 'NEXUS: % reecrite, RETURNS TABLE inchange.', r.proname;
  END LOOP;
END $mig$;

-- Verification finale, hors boucle : plus aucune des trois ne lit la
-- colonne derivee.
DO $verif$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public'
     AND p.proname IN ('recruiter_athlete_cards','recruiter_search_athletes','recruiter_athlete_profile')
     AND pg_get_functiondef(p.oid) ~ 'ev\.distinctions';
  IF n > 0 THEN
    RAISE EXCEPTION 'NEXUS: % RPC lisent encore ev.distinctions apres la bascule', n;
  END IF;
END $verif$;
