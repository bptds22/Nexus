-- 20260924185901_users_sport_id_recruteur (version enregistrée en prod ; écrite 20260924190000)
--
-- LOT A du tableau blanc par unité (décision BP 2026-09-24).
-- Unité = (cégep = users.school_id, sport). Le sport du recruteur était un
-- TEXTE libre (users.sport) : on lui adjoint une vraie clé vers `sports`.
--
-- ADDITIVE SEULEMENT (règle 1 de BP) :
--   · une colonne NULLABLE, une FK, un index, une fonction, un trigger ;
--   · rien n'est retiré, rien n'est renommé, aucune contrainte resserrée.
--   · users.sport reste la colonne écrite par l'app 1.4.3 (onboarding
--     recruteur, profil) : le trigger en DÉDUIT sport_id, sans que le
--     binaire publié ait à connaître la nouvelle colonne.
--
-- Périmètre : les RECRUTEURS seulement. La correspondance montrée à BP porte
-- sur eux (16/16 exacts en prod le 2026-09-24 : Basketball 4, Flag football 4,
-- Football 6, Soccer 1, Volleyball 1). Les coachs et parents qui portent un
-- users.sport ne sont PAS touchés : le concept d'unité est recruteur.
--
-- Rollback : supabase/rollback/20260924185901_rollback_users_sport_id_recruteur.sql

-- ── 1. La colonne ───────────────────────────────────────────────────────────
alter table public.users
  add column if not exists sport_id uuid
  references public.sports(id) on delete set null;

comment on column public.users.sport_id is
  'Sport du RECRUTEUR (unité = school_id × sport_id). Déduit de users.sport '
  'par trg_users_sport_id (l''app 1.4.3 n''écrit que le texte). NULL pour '
  'les autres rôles.';

create index if not exists users_school_sport_idx
  on public.users (school_id, sport_id)
  where sport_id is not null;

-- ── 2. La déduction texte ⇄ clé ─────────────────────────────────────────────
-- Règles :
--   · rôle ≠ RECRUTEUR  → rien (on ne touche ni sport ni sport_id) ;
--   · sport_id écrit explicitement (et différent de l'ancien) → il GAGNE, et
--     le texte est réaligné sur sports.nom — l'app 1.4.3 continue de lire le
--     texte ;
--   · sinon, si le texte change (ou à l'insertion, ou au passage au rôle
--     RECRUTEUR) → sport_id := le sport dont le nom correspond, casse et
--     espaces de bord ignorés. Aucun sport reconnu → NULL, jamais d'erreur :
--     l'inscription d'un binaire publié ne doit pas casser sur un texte libre.
create or replace function public.users_sport_id_depuis_texte()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_nom text;
begin
  if new.role is distinct from 'RECRUTEUR'::user_role then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.sport_id is distinct from old.sport_id
     and new.sport is not distinct from old.sport then
    if new.sport_id is null then
      new.sport := null;
    else
      select s.nom into v_nom from public.sports s where s.id = new.sport_id;
      new.sport := v_nom;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT'
     or new.sport is distinct from old.sport
     or new.role is distinct from old.role then
    select s.id into new.sport_id
      from public.sports s
     where lower(s.nom) = lower(btrim(new.sport))
     limit 1;
    -- `select … into` laisse NULL quand rien ne correspond.
  end if;

  return new;
end $$;

drop trigger if exists trg_users_sport_id on public.users;
create trigger trg_users_sport_id
  before insert or update of sport, sport_id, role on public.users
  for each row execute function public.users_sport_id_depuis_texte();

-- Une fonction trigger n'a pas à être appelable par qui que ce soit.
revoke execute on function public.users_sport_id_depuis_texte() from public, anon, authenticated;

-- ── 3. Rattrapage des recruteurs existants ──────────────────────────────────
-- Correspondance exacte (casse / espaces de bord). updated_at n'est pas un
-- acte de l'utilisateur : on le préserve en désactivant le trigger
-- d'horodatage le temps du rattrapage.
alter table public.users disable trigger trg_users_updated_at;
update public.users u
   set sport_id = s.id
  from public.sports s
 where u.role = 'RECRUTEUR'
   and u.sport_id is null
   and lower(s.nom) = lower(btrim(u.sport));
alter table public.users enable trigger trg_users_updated_at;

-- ── 4. GATES ────────────────────────────────────────────────────────────────
do $$
declare
  f    regprocedure := 'public.users_sport_id_depuis_texte()'::regprocedure;
  vus  text[];
  veut text[] := array['postgres','service_role'];
  n_sans int;
begin
  -- ACL : comparaison de la liste COMPLÈTE, jamais par inclusion.
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = f;
  if vus is distinct from veut then
    raise exception 'NEXUS: ACL de users_sport_id_depuis_texte = %, attendu %', vus, veut;
  end if;

  -- Rattrapage : tout recruteur qui porte un sport reconnu a sa clé.
  select count(*) into n_sans
    from public.users u
    join public.sports s on lower(s.nom) = lower(btrim(u.sport))
   where u.role = 'RECRUTEUR' and u.sport_id is distinct from s.id;
  if n_sans > 0 then
    raise exception 'NEXUS: % recruteur(s) au sport reconnu sans sport_id cohérent', n_sans;
  end if;

  raise notice 'NEXUS: users.sport_id posé — ACL %', vus;
end $$;
