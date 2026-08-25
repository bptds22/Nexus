-- ═══════════════════════════════════════════════════════════════
-- COMMENT ON TRIGGER uniquement. Aucune donnée, aucune fonction, aucun
-- trigger modifié.
--
-- ── POURQUOI CETTE MIGRATION EXISTE ─────────────────────────────
-- Le 2026-08-25, une session tierce a réécrit calculate_profile_completion
-- (trigger BEFORE sur athletes) sans savoir qu'un garde-fou dépendait de
-- l'ordre de déclenchement. Rien n'a cassé — CREATE OR REPLACE FUNCTION ne
-- recrée pas le trigger, donc l'ordre a survécu. Mais un DROP TRIGGER suivi
-- d'un CREATE TRIGGER portant un nom triant après « trg_zz_… » aurait annulé
-- la neutralisation EN SILENCE : aucune erreur, aucun test rouge, et des
-- cotes d'athlètes qui se mettent à bouger quand on pose un badge.
--
-- L'avertissement vivait dans le fichier de migration. Personne ne lit un
-- fichier de migration vieux de trois semaines. Il vit désormais dans le
-- catalogue, où \d et les outils d'inspection le montrent.
-- ═══════════════════════════════════════════════════════════════

comment on trigger trg_zz_preserve_updated_at on public.evaluations is
$c$⚠ LE PRÉFIXE « zz » EST FONCTIONNEL, PAS DÉCORATIF.

PostgreSQL déclenche les triggers BEFORE dans l'ORDRE ALPHABÉTIQUE de leur
nom. Ce trigger doit passer APRÈS set_updated_at pour défaire ce que
celui-ci vient d'écrire, pendant une écriture du miroir des badges
(drapeau nexus.mirror_write).

Ordre actuel :
  trg_cote_globale < trg_evaluations_updated_at < trg_zz_preserve_updated_at

DEUX FAÇONS DE CASSER ÇA EN SILENCE :
  · renommer ce trigger en quelque chose qui trie avant
    « trg_evaluations_updated_at » ;
  · AJOUTER un trigger BEFORE dont le nom trie APRÈS celui-ci et qui touche
    updated_at.

Dans les deux cas : aucune erreur, aucun test rouge. updated_at serait de
nouveau bumpé par le miroir, la ligne d'évaluation touchée deviendrait la
plus récente, et le jeu de badges affiché basculerait au gré des écritures.

Vérifier l'ordre avec :
  select tgname from pg_trigger where tgrelid='public.evaluations'::regclass
   and not tgisinternal and (tgtype & 2)=2 order by tgname;$c$;

comment on trigger trg_zz_preserve_athlete_denorm on public.athletes is
$c$⚠ LE PRÉFIXE « zz » EST FONCTIONNEL, PAS DÉCORATIF.

Ce trigger annule l'effet de bord de calc_cote_globale sur athletes pendant
une écriture du miroir des badges : sans lui, poser un badge sur un athlète
qui a PLUSIEURS évaluations à cotes divergentes déplacerait sa cote affichée
au hasard de l'ordre de mise à jour, polluerait recruiter_activity_log, et
pourrait publier un événement « 5 étoiles » au fil public.

Il doit donc être le DERNIER trigger BEFORE de la table. Ordre actuel :
  trg_athletes_updated_at < trg_notify_parent_on_minor
    < trg_profile_completion < trg_zz_preserve_athlete_denorm

TOUT TRIGGER BEFORE AJOUTÉ APRÈS LUI DANS L'ORDRE ALPHABÉTIQUE annule la
neutralisation, sans erreur ni test rouge. Un DROP + CREATE TRIGGER sur un
trigger existant suffit à le faire passer devant s'il est renommé.

Vérifier l'ordre avec :
  select tgname from pg_trigger where tgrelid='public.athletes'::regclass
   and not tgisinternal and (tgtype & 2)=2 order by tgname;$c$;

do $$
declare v_n int;
begin
  select count(*) into v_n from pg_trigger t
  where t.tgrelid in ('public.evaluations'::regclass, 'public.athletes'::regclass)
    and t.tgname in ('trg_zz_preserve_updated_at','trg_zz_preserve_athlete_denorm')
    and obj_description(t.oid, 'pg_trigger') is not null;
  if v_n <> 2 then
    raise exception 'NEXUS: % commentaire(s) posé(s) au lieu de 2', v_n;
  end if;
  raise notice 'NEXUS: avertissement posé sur les 2 triggers zz.';
end $$;