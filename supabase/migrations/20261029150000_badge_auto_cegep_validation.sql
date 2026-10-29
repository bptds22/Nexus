-- ════════════════════════════════════════════════════════════════════════════
-- Badge du cégépien vérifié automatiquement (suite du lot C1b cégep, décision BP 2026-10-29).
--
-- Défaut : verification_auto_cegep() pose verified = true sans last_profile_validation. La re-validation
-- mensuelle (lib/utils/profileValidation.ts, ensure_validation_notice()) tient une date absente pour « due » :
-- après le 15 du mois, le badge est caché (tableau de bord, profil, liste du coach) et l'athlète reçoit
-- « Ton badge vérifié a été désactivé ». En prod au 2026-10-29 : 1 fiche auto_cegep, date absente, 0 avis envoyé.
--
-- Contenu :
--   1. verification_auto_cegep() : même corps (C1b, md5 f987bdbe8ec4fadf9ff174364ce0635c) + une ligne — la vérification automatique
--      date aussi last_profile_validation (now(), sauf si une date est déjà là). Propriétaire, droits et
--      trigger inchangés (create or replace).
--   2. Rattrapage : les fiches vérifiées auto_cegep sans date reçoivent verified_at (le moment de la
--      vérification). Seule cette colonne change ; aucun trigger d'athletes n'écrit d'avis sur elle.
--
-- Rollback : supabase/rollback/20261029150000_rollback_badge_auto_cegep_validation.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.verification_auto_cegep()'::regprocedure)
     is distinct from 'f987bdbe8ec4fadf9ff174364ce0635c' then
    raise exception 'NEXUS: verification_auto_cegep n''est pas le corps du lot C1b';
  end if;
end $$;

create or replace function public.verification_auto_cegep()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- Seul un NOUVEL ancrage est regardé, comme le verrou du lot C0 : une ligne qui garde son école
  -- passe telle quelle.
  if tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id then
    return new;
  end if;
  if new.school_id is not null
     and exists (select 1 from public.schools s where s.id = new.school_id and s.type::text = 'CEGEP') then
    if not coalesce(new.verified, false) then
      new.verified := true;
      new.verification_method := 'auto_cegep';
      new.verified_at := now();
      new.verified_by := null;
      -- Daté comme une confirmation de profil : sans date, la re-validation mensuelle le tient pour expiré
      -- après le 15 (badge caché, avis « Ton badge vérifié a été désactivé »).
      new.last_profile_validation := coalesce(new.last_profile_validation, now());
    end if;
  elsif tg_op = 'UPDATE' and old.verification_method = 'auto_cegep' then
    -- Le crochet ne valait que pour le cégep : il ne suit pas l'athlète ailleurs.
    new.verified := false;
    new.verification_method := null;
    new.verified_at := null;
    new.verified_by := null;
  end if;
  return new;
end;
$function$;

update public.athletes
   set last_profile_validation = verified_at
 where verification_method = 'auto_cegep'
   and verified is true
   and last_profile_validation is null
   and verified_at is not null;

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.verification_auto_cegep()'::regprocedure)
     is distinct from '69e278f765c30134b31f523a85477e7f' then
    raise exception 'NEXUS: nouveau corps de verification_auto_cegep inattendu';
  end if;
end $$;

do $$
begin
  if exists (select 1 from public.athletes where verification_method = 'auto_cegep' and verified is true
               and last_profile_validation is null) then
    raise exception 'NEXUS: une fiche auto_cegep vérifiée reste sans date de validation';
  end if;
end $$;
