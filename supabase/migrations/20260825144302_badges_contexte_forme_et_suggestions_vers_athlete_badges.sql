-- ═══════════════════════════════════════════════════════════════
-- (a) contexte_forme au catalogue + les deux branches de
--     apply_approved_suggestion réorientées vers athlete_badges.
--
-- ── POURQUOI TOUCHER apply_approved_suggestion ──────────────────
-- Sa branche 'Distinctions' écrit evaluations.distinctions, colonne
-- désormais DÉRIVÉE : le miroir la reconstruit depuis athlete_badges à
-- chaque changement de badge. Une approbation y survivait jusqu'au badge
-- suivant, puis disparaissait. C'est ce qui a motivé le gel des 24
-- suggestions en attente.
--
-- Les 45 autres branches ne sont PAS réécrites à la main : le corps déployé
-- est relu par pg_get_functiondef et seules les deux branches visées sont
-- remplacées TEXTUELLEMENT. Les 14 traits et leurs libellés FR — dont
-- dépend l'app 1.2 en magasin — restent identiques à l'octet près, et la
-- substitution échoue bruyamment si le texte attendu a bougé.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. contexte_forme ───────────────────────────────────────────
alter table public.badges add column contexte_forme text
  check (contexte_forme in ('stat_annee', 'annee', 'libre'));

update public.badges set contexte_forme = case code
  when 'leader-equipe'  then 'stat_annee'
  when 'leader-ligue'   then 'stat_annee'
  when 'mvp'            then 'annee'
  when 'equipe-etoiles' then 'annee'
  when 'nexus-x'        then 'libre'
end
where code in ('leader-equipe','leader-ligue','mvp','equipe-etoiles','nexus-x');

-- La forme et l'exigence doivent aller ensemble : un badge qui réclame un
-- contexte sans dire lequel laisserait le picker deviner.
alter table public.badges add constraint badges_contexte_forme_coherente
  check ((requiert_contexte and contexte_forme is not null)
      or (not requiert_contexte and contexte_forme is null));

comment on column public.badges.contexte_forme is
$c$Forme du contexte à saisir, lue par le picker. NULL si requiert_contexte
est faux.

  stat_annee = une statistique (voir SPORT_STATS) + une année
  annee      = une année seule
  libre      = texte libre

C'est une DONNÉE, pas un `if` sur les codes dans le frontend : ajouter un
honneur ne doit pas obliger à recâbler sept écrans.$c$;

-- ── 2. origine : une troisième provenance ───────────────────────
-- L'exigence de contexte n'a de sens que là où le contexte peut être
-- COLLECTÉ, c'est-à-dire dans le picker. Une suggestion soumise par
-- l'ancienne interface n'a jamais demandé de millésime ; la refuser
-- bloquerait des athlètes pour une donnée qu'on ne leur a pas demandée.
alter table public.athlete_badges drop constraint if exists athlete_badges_origine_check;
alter table public.athlete_badges add constraint athlete_badges_origine_check
  check (origine in ('saisie', 'transposition', 'suggestion'));

create or replace function public.badge_contexte_requis()
  returns trigger language plpgsql
  security definer set search_path to 'public'
as $function$
declare v_requis boolean; v_code text;
begin
  select requiert_contexte, code into v_requis, v_code
  from public.badges where id = new.badge_id;

  if v_requis is null then
    raise exception 'NEXUS: badge_id % inconnu au catalogue', new.badge_id;
  end if;

  -- Seule origine='saisie' (le picker) est soumise à l'exigence : c'est le
  -- seul chemin qui PEUT demander le contexte. 'transposition' vient de
  -- l'ancien format jsonb qui ne le stockait pas ; 'suggestion' vient d'une
  -- interface qui ne le demandait pas. Les manques sont repérables :
  --   select * from public.athlete_badges ab join public.badges b on b.id=ab.badge_id
  --    where b.requiert_contexte and ab.contexte is null and ab.retire_le is null;
  if v_requis and new.origine = 'saisie'
     and coalesce(btrim(new.contexte), '') = '' then
    raise exception 'NEXUS: le badge « % » exige un contexte (millésime, statistique…)', v_code;
  end if;

  return new;
end;
$function$;

-- ── 3. Le pont ancien code → code de catalogue ──────────────────
-- Jumeau SQL de LEGACY_BADGE_TO_CATALOGUE (lib/config/badges.ts). Les deux
-- listes doivent rester d'accord ; `progression` est absent des DEUX.
create or replace function public.code_badge_catalogue(p_code text)
  returns text language sql stable
  set search_path to 'public'
as $fn$
  select case p_code
    when 'captain'       then 'capitaine'
    when 'allstar'       then 'equipe-etoiles'
    when 'mvp'           then 'mvp'
    when 'team_leader'   then 'leader-equipe'
    when 'league_leader' then 'leader-ligue'
    when 'custom'        then 'nexus-x'
    else (select b.code from public.badges b where b.code = p_code)
  end;
$fn$;

-- ── 4. L'application d'une suggestion de distinctions ───────────
create or replace function public.appliquer_distinctions_suggerees(
  p_athlete_id uuid, p_coach_id uuid, p_entrees jsonb, p_remplacer boolean)
  returns void language plpgsql
  security definer set row_security to 'off' set search_path to 'public'
as $fn$
declare v_inconnus text;
begin
  -- ── Aucun effacement silencieux ──
  -- Un code sans équivalent au catalogue (`progression`) ferait, en mode
  -- remplacement, retirer les badges existants et n'en poser aucun. On
  -- REFUSE l'approbation en le disant, plutôt que de vider le profil.
  select string_agg(distinct e->>'badge', ', ')
    into v_inconnus
  from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
  where public.code_badge_catalogue(e->>'badge') is null;

  if v_inconnus is not null then
    raise exception
      'NEXUS: distinction(s) sans équivalent au catalogue : %. Cette suggestion date d''avant le nouveau catalogue et ne peut pas être approuvée telle quelle. Demandez à l''athlète de la resoumettre.', v_inconnus;
  end if;

  -- ── Retrait de ce qui n'est plus proposé ──
  -- On ne retire QUE les badges attribués par ce coach : ceux d'un autre
  -- coach ne lui appartiennent pas. Retrait DOUX (retire_le), jamais DELETE.
  if p_remplacer then
    update public.athlete_badges ab
       set retire_le = now(), retire_par = p_coach_id
      from public.badges b
     where b.id = ab.badge_id
       and ab.athlete_id = p_athlete_id
       and ab.attribue_par = p_coach_id
       and ab.retire_le is null
       and not exists (
         select 1 from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
          where public.code_badge_catalogue(e->>'badge') = b.code
            and nullif(btrim(coalesce(e->>'detail', '')), '') is not distinct from ab.contexte
       );
  end if;

  -- ── Pose de ce qui manque ──
  -- Les lignes déjà présentes ET identiques ne sont pas réécrites : leur
  -- created_at reste la vraie date d'attribution, celle montrée aux
  -- partenaires. L'index unique partiel arbitre le reste.
  insert into public.athlete_badges
    (athlete_id, badge_id, contexte, attribue_par, origine)
  select p_athlete_id, b.id,
         nullif(btrim(coalesce(e->>'detail', '')), ''),
         p_coach_id, 'suggestion'
  from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
  join public.badges b on b.code = public.code_badge_catalogue(e->>'badge')
  on conflict (athlete_id, badge_id, contexte) where retire_le is null
  do nothing;
end;
$fn$;

revoke all on function public.appliquer_distinctions_suggerees(uuid, uuid, jsonb, boolean)
  from public, anon, authenticated;
revoke all on function public.code_badge_catalogue(text) from public, anon;

-- ── 5. Substitution textuelle des DEUX branches ─────────────────
do $$
declare v_src text; v_new text; v_b1_avant text; v_b2_avant text;
begin
  v_src := pg_get_functiondef('public.apply_approved_suggestion'::regproc);

  v_b1_avant :=
'      WHEN ''Distinctions'' THEN
        UPDATE evaluations SET distinctions = NEW.valeur_proposee::jsonb WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, distinctions) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::jsonb) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET distinctions = EXCLUDED.distinctions; END IF;';

  v_b2_avant :=
'      WHEN ''Distinction personnalisée'' THEN
        INSERT INTO custom_distinctions (athlete_id, coach_id, title) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee);';

  v_new := replace(v_src, v_b1_avant,
'      WHEN ''Distinctions'' THEN
        -- 2026-08-25 : écrivait evaluations.distinctions, colonne désormais
        -- DÉRIVÉE (le miroir la reconstruit depuis athlete_badges). Toute
        -- approbation y était effacée au badge suivant. Remplacement = la
        -- suggestion porte le jeu COMPLET voulu par l''athlète.
        PERFORM public.appliquer_distinctions_suggerees(
          NEW.athlete_id, v_coach_id, NEW.valeur_proposee::jsonb, true);');
  if v_new = v_src then
    raise exception 'NEXUS: branche ''Distinctions'' introuvable — le corps déployé a changé, aucune substitution faite';
  end if;
  v_src := v_new;

  v_new := replace(v_src, v_b2_avant,
'      WHEN ''Distinction personnalisée'' THEN
        -- 2026-08-25 : insérait dans custom_distinctions, table VIDE que
        -- rien ne lit ni n''alimente (0 ligne, 0 suggestion de ce champ).
        -- Rebranchée sur nexus-x, dont le contexte tient lieu de libellé.
        -- Ajout, pas remplacement : la sémantique d''origine était additive.
        PERFORM public.appliquer_distinctions_suggerees(
          NEW.athlete_id, v_coach_id,
          jsonb_build_array(jsonb_build_object(''badge'', ''nexus-x'', ''detail'', NEW.valeur_proposee)),
          false);');
  if v_new = v_src then
    raise exception 'NEXUS: branche ''Distinction personnalisée'' introuvable — aucune substitution faite';
  end if;

  execute v_new;
  raise notice 'NEXUS: apply_approved_suggestion — 2 branches réorientées, le reste inchangé.';
end $$;

-- ── 6. Garde-fous ───────────────────────────────────────────────
do $$
declare v_n int; v_src text;
begin
  select count(*) into v_n from public.badges
   where requiert_contexte and contexte_forme is null;
  if v_n > 0 then raise exception 'NEXUS: % honneur(s) sans contexte_forme', v_n; end if;

  select count(*) into v_n from public.badges where contexte_forme is not null;
  if v_n <> 5 then raise exception 'NEXUS: % badges à contexte_forme au lieu de 5', v_n; end if;

  v_src := pg_get_functiondef('public.apply_approved_suggestion'::regproc);
  if v_src like '%SET distinctions = NEW.valeur_proposee%' then
    raise exception 'NEXUS: la fonction écrit encore evaluations.distinctions';
  end if;
  if v_src not like '%appliquer_distinctions_suggerees%' then
    raise exception 'NEXUS: la fonction n''appelle pas le nouveau chemin';
  end if;
  -- Les 14 traits doivent avoir survécu intacts.
  if (select count(*) from regexp_matches(v_src, 'WHEN ''', 'g')) <> 47 then
    raise exception 'NEXUS: le nombre de branches a changé — substitution suspecte';
  end if;
  raise notice 'NEXUS: 47 branches intactes, plus aucune écriture de evaluations.distinctions.';
end $$;