-- ═══════════════════════════════════════════════════════════════
-- badge_sports — un badge de sport peut appartenir à PLUSIEURS sports.
--
-- badges.sport_id était scalaire. Or 7 des 12 badges de sport sont partagés :
-- « insaisissable » vaut en basketball, football ET flag. Une colonne scalaire
-- ne peut pas porter ça.
--
-- ── POURQUOI PAS sport_id NULL = « tous les sports » ─────────────
-- Parce que la table sports compte 24 lignes. Ce n'est pas « un joueur de
-- hockey verrait La Fusée », c'est 20 sports sur 24 : badminton, judo,
-- natation, golf, water-polo. Et surtout : famille='universel' signifie DÉJÀ
-- « tous les sports ». Un badge sport à NULL se comporterait exactement comme
-- un universel — deux encodages pour un seul sens, et le CHECK sur famille
-- deviendrait décoratif.
--
-- ── POURQUOI PAS UN TABLEAU sport_ids uuid[] ─────────────────────
-- PostgreSQL ne sait pas poser de clé étrangère sur un ÉLÉMENT de tableau.
-- Supprimer un sport laisserait un UUID fantôme qu'aucune contrainte n'attrape,
-- et le picker filtrerait en silence sur un sport disparu. Tout le reste du
-- schéma (athletes.sport_id, evaluation_grilles.sport_id) référence sports par
-- une vraie FK ; le tableau serait l'exception.
-- ═══════════════════════════════════════════════════════════════

create table public.badge_sports (
  badge_id uuid not null references public.badges(id) on delete cascade,
  -- restrict, pas cascade : supprimer un sport encore référencé doit ÉCHOUER
  -- bruyamment plutôt que dérattacher des badges en silence.
  sport_id uuid not null references public.sports(id) on delete restrict,
  primary key (badge_id, sport_id)
);

-- La PK sert « quels sports pour ce badge ». Le picker pose la question
-- inverse — « quels badges pour ce sport » — d'où le second index.
create index badge_sports_par_sport on public.badge_sports (sport_id, badge_id);

comment on table public.badge_sports is
$c$Rattachement badge ↔ sports. Ne concerne QUE famille='sport'.

Les familles 'universel' et 'honneur' valent pour tous les sports et ne doivent
avoir AUCUNE ligne ici — invariant tenu par trg_badge_sports_coherent_*.$c$;

-- ── L'invariant, rendu impossible à violer ───────────────────────
-- Un badge famille='sport' SANS rattachement serait invisible dans tous les
-- pickers, pour toujours, sans lever la moindre erreur. C'est la classe de
-- panne silencieuse que ce chantier a rencontrée à répétition. Elle est donc
-- traitée par une contrainte, pas par une convention.
--
-- DEFERRABLE INITIALLY DEFERRED : vérifiée au COMMIT, ce qui permet d'insérer
-- un badge puis ses sports dans la même transaction. Une contrainte immédiate
-- rendrait toute création de badge impossible.
create or replace function public.badge_sports_coherent()
  returns trigger language plpgsql
  security definer set search_path to 'public'
as $fn$
declare
  v_badge_id uuid; v_famille text; v_code text; v_n int;
begin
  if tg_table_name = 'badges' then
    v_badge_id := coalesce(new.id, old.id);
  else
    v_badge_id := coalesce(new.badge_id, old.badge_id);
  end if;

  select b.famille, b.code into v_famille, v_code
  from public.badges b where b.id = v_badge_id;

  -- Le badge a pu être supprimé dans la même transaction (la cascade sur
  -- badge_sports déclenche alors ce trigger) : plus rien à vérifier.
  if v_famille is null then
    return null;
  end if;

  select count(*) into v_n from public.badge_sports where badge_id = v_badge_id;

  if v_famille = 'sport' and v_n = 0 then
    raise exception
      'NEXUS: le badge « % » est de famille sport et n''est rattaché à AUCUN sport. Il serait invisible dans tous les pickers, sans erreur. Ajoutez une ligne dans badge_sports, ou changez sa famille.', v_code;
  end if;

  if v_famille <> 'sport' and v_n > 0 then
    raise exception
      'NEXUS: le badge « % » est de famille % — donc valable pour tous les sports — mais porte % rattachement(s) dans badge_sports. Retirez-les, ou passez-le en famille sport.', v_code, v_famille, v_n;
  end if;

  return null;
end;
$fn$;

create constraint trigger trg_badge_sports_coherent_badges
  after insert or update of famille on public.badges
  deferrable initially deferred
  for each row execute function public.badge_sports_coherent();

create constraint trigger trg_badge_sports_coherent_liaison
  after insert or update or delete on public.badge_sports
  deferrable initially deferred
  for each row execute function public.badge_sports_coherent();

-- ── Les 20 rattachements ─────────────────────────────────────────
-- Par CODE et par NOM, jamais par UUID en dur : un UUID copié de travers passe
-- inaperçu, un code inexistant fait échouer la jointure et le compte final.
insert into public.badge_sports (badge_id, sport_id)
select b.id, s.id
from (values
  ('finisseur',       'Basketball'),
  ('3-points',        'Basketball'),
  ('inarretable',     'Football'),
  ('force-de-frappe', 'Football'),
  ('rempart',         'Football'),
  ('insaisissable',   'Basketball'),
  ('insaisissable',   'Football'),
  ('insaisissable',   'Flag football'),
  ('verrou',          'Basketball'),
  ('verrou',          'Football'),
  ('fusee',           'Football'),
  ('fusee',           'Flag football'),
  ('dans-la-mire',    'Football'),
  ('dans-la-mire',    'Flag football'),
  ('vitesse',         'Football'),
  ('vitesse',         'Flag football'),
  ('mains-sures',     'Football'),
  ('mains-sures',     'Flag football'),
  ('radar',           'Football'),
  ('radar',           'Flag football')
) v(code_badge, nom_sport)
join public.badges b on b.code = v.code_badge
join public.sports s on s.nom  = v.nom_sport;

-- ── Suppression de la colonne scalaire ───────────────────────────
-- NULL sur les 22 lignes, lue par aucun code, le picker n'existe pas encore :
-- c'est le moment le moins cher de la vie du projet. La garder à côté de
-- badge_sports créerait deux sources de vérité pour la même question.
--
-- Sans CASCADE : si un objet en dépendait, la migration doit échouer.
-- Rejeu : badges_seed_22 (version 20260825014323) insère bien sport_id, mais
-- s'exécute AVANT cette migration dans l'ordre des versions — un db reset
-- reste valide.
alter table public.badges drop column sport_id;

-- ── Garde-fou final : l'état COMPLET, pas seulement les lignes touchées ──
do $$
declare v_liaisons int; v_bad int; v_liste text;
begin
  select count(*) into v_liaisons from public.badge_sports;
  if v_liaisons <> 20 then
    raise exception 'NEXUS: % rattachements au lieu de 20 — un code ou un nom de sport n''a pas joint', v_liaisons;
  end if;

  -- Les triggers ne se déclenchent que sur les lignes écrites. Les 10 badges
  -- universel/honneur n'ont pas bougé : on les valide explicitement ici.
  select count(*), coalesce(string_agg(code, ', ' order by code), '(aucun)')
    into v_bad, v_liste
  from (
    select b.code
    from public.badges b
    left join public.badge_sports bs on bs.badge_id = b.id
    group by b.id, b.code, b.famille
    having (b.famille =  'sport' and count(bs.sport_id) = 0)
        or (b.famille <> 'sport' and count(bs.sport_id) > 0)
  ) x;

  if v_bad > 0 then
    raise exception 'NEXUS: % badge(s) incohérent(s) après migration : %', v_bad, v_liste;
  end if;

  raise notice 'NEXUS: % rattachements posés, 22 badges cohérents, badges.sport_id supprimée.', v_liaisons;
end $$;