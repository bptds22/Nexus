-- ════════════════════════════════════════════════════════════════════════════
-- Mode match « Game On » (R6 option B, retour BP 18 oct. 2026) — 1re itération, RECRUTEURS.
--
-- Pendant le match : des notes rapides par NUMÉRO de maillot (et côté A / B), avec étiquettes.
-- Après le match : chaque numéro est lié à un athlète Nexus ou à une carte prospect (ou gardé tel
-- quel). Les notes sont prises HORS LIGNE d'abord : identifiants générés sur l'appareil, envoi
-- idempotent au retour du réseau.
--
-- Partage : une séance appartient à l'UNITÉ (cégep + sport). Deux recruteurs de l'unité au même
-- match (même game_id) écrivent dans la MÊME séance ; chaque note est signée par son auteur.
-- Recruteur sans unité : séance privée.
--
-- Partenaires : pas dans cette itération (BP : seulement si on les laisse évaluer) — une colonne
-- de portée partenaire s'ajoutera alors, sans toucher à ce qui est ici.
--
-- Accès : AUCUN accès direct aux tables. Fonctions SECURITY DEFINER, portée vérifiée à chaque appel.
-- Rollback : supabase/rollback/20261018130000_rollback_mode_match.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regclass('public.match_seances') is not null or to_regclass('public.match_notes') is not null then
    raise exception 'NEXUS: 20261018130000 déjà appliquée (match_seances / match_notes existent)';
  end if;
  if to_regprocedure('public.acces_unite_pro(uuid,uuid)') is null
  or to_regprocedure('public.carte_ecriture_ok(uuid)') is null
  or to_regclass('public.games') is null then
    raise exception 'NEXUS: préalables absents (lot B1, cartes, games)';
  end if;
end $$;

-- ── 1. Tables ─────────────────────────────────────────────────────────────
create table public.match_seances (
  id              uuid primary key,                        -- généré sur l'appareil (hors ligne)
  cree_par        uuid not null references auth.users(id) on delete cascade,
  unite_cegep_id  uuid,
  unite_sport_id  uuid,
  game_id         uuid references public.games(id) on delete set null,
  equipe_a        text not null check (char_length(trim(equipe_a)) between 1 and 120),
  equipe_b        text check (char_length(equipe_b) <= 120),
  lieu            text check (char_length(lieu) <= 300),
  commence_le     timestamptz not null default now(),
  termine_le      timestamptz,
  created_at      timestamptz not null default now(),
  constraint match_seances_portee check (num_nonnulls(unite_cegep_id, unite_sport_id) in (0, 2))
);
-- Un match = une séance par unité : le 2e recruteur rejoint celle du 1er.
create unique index match_seances_unite_match on public.match_seances (unite_cegep_id, unite_sport_id, game_id)
  where game_id is not null and unite_cegep_id is not null;
create index match_seances_unite on public.match_seances (unite_cegep_id, unite_sport_id, commence_le desc);
create index match_seances_auteur on public.match_seances (cree_par, commence_le desc);

create table public.match_notes (
  id          uuid primary key,                            -- généré sur l'appareil (hors ligne)
  seance_id   uuid not null references public.match_seances(id) on delete cascade,
  auteur      uuid not null references auth.users(id) on delete cascade,
  cote        text not null check (cote in ('A', 'B')),
  numero      text check (numero ~ '^[0-9]{1,3}$'),
  prenom      text check (char_length(prenom) <= 60),
  texte       text not null default '' check (char_length(texte) <= 2000),
  etiquettes  text[] not null default '{}' check (cardinality(etiquettes) <= 10),
  note_le     timestamptz not null,                        -- heure sur l'appareil
  recu_le     timestamptz not null default now(),
  athlete_id  uuid references public.athletes(id) on delete set null,
  carte_id    uuid references public.cartes_prospect(id) on delete set null,
  lie_par     uuid references auth.users(id) on delete set null,
  lie_le      timestamptz,
  constraint match_notes_qui check (numero is not null or nullif(trim(coalesce(prenom, '')), '') is not null),
  constraint match_notes_contenu check (char_length(trim(texte)) > 0 or cardinality(etiquettes) > 0),
  constraint match_notes_un_lien check (num_nonnulls(athlete_id, carte_id) <= 1)
);
create index match_notes_seance on public.match_notes (seance_id, cote, numero);

alter table public.match_seances enable row level security;   -- aucune policy : fonctions seulement
alter table public.match_notes   enable row level security;
revoke all on public.match_seances from public, anon, authenticated;
revoke all on public.match_notes   from public, anon, authenticated;

-- ── 2. Portée ─────────────────────────────────────────────────────────────
create function public.match_seance_acces(p_seance uuid)
returns boolean
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.match_seances s
     where s.id = p_seance
       and ((s.unite_cegep_id is not null and public.acces_unite_pro(s.unite_cegep_id, s.unite_sport_id))
            or (s.unite_cegep_id is null and s.cree_par = auth.uid() and public.user_has_pro()))
  )
$$;

-- ── 3. Ouvrir (ou rejoindre) une séance ───────────────────────────────────
-- Rend l'identifiant RETENU : celui de l'appareil, ou celui de la séance déjà ouverte par un
-- collègue pour le même match. L'appareil remappe alors ses notes. Idempotent.
create function public.match_seance_ouvrir(
  p_id uuid, p_game_id uuid, p_equipe_a text, p_equipe_b text, p_lieu text, p_commence_le timestamptz
)
returns uuid
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_moi   public.users%rowtype;
  v_cegep uuid;
  v_sport uuid;
  v_id    uuid;
begin
  select * into v_moi from public.users where id = auth.uid();
  if v_moi.id is null or v_moi.role <> 'RECRUTEUR'::public.user_role or not public.user_has_pro() then
    raise exception 'NEXUS: mode match réservé aux recruteurs Pro';
  end if;
  if p_id is null then raise exception 'NEXUS: identifiant de séance manquant'; end if;

  -- Déjà connue (renvoi après coupure) : on la rend telle quelle si elle est à ma portée.
  if exists (select 1 from public.match_seances where id = p_id) then
    if not public.match_seance_acces(p_id) then raise exception 'NEXUS: séance hors de ton unité'; end if;
    return p_id;
  end if;

  if v_moi.school_id is not null and v_moi.sport_id is not null
     and public.acces_unite_pro(v_moi.school_id, v_moi.sport_id) then
    v_cegep := v_moi.school_id; v_sport := v_moi.sport_id;
  end if;

  if p_game_id is not null and v_cegep is not null then
    select s.id into v_id from public.match_seances s
     where s.unite_cegep_id = v_cegep and s.unite_sport_id = v_sport and s.game_id = p_game_id;
    if v_id is not null then return v_id; end if;
  end if;

  insert into public.match_seances (id, cree_par, unite_cegep_id, unite_sport_id, game_id, equipe_a, equipe_b, lieu, commence_le)
  values (p_id, v_moi.id, v_cegep, v_sport, p_game_id,
          trim(p_equipe_a), nullif(trim(coalesce(p_equipe_b, '')), ''), nullif(trim(coalesce(p_lieu, '')), ''),
          coalesce(p_commence_le, now()))
  on conflict (unite_cegep_id, unite_sport_id, game_id) where game_id is not null and unite_cegep_id is not null
  do nothing
  returning id into v_id;

  if v_id is null then   -- course avec un collègue : sa séance gagne
    select s.id into v_id from public.match_seances s
     where s.unite_cegep_id = v_cegep and s.unite_sport_id = v_sport and s.game_id = p_game_id;
  end if;
  return v_id;
end $$;

create function public.match_seance_terminer(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.match_seance_acces(p_id) then raise exception 'NEXUS: séance hors de ton unité'; end if;
  update public.match_seances set termine_le = coalesce(termine_le, now()) where id = p_id;
end $$;

-- ── 4. Envoyer des notes (lot, idempotent) ────────────────────────────────
-- p_notes : [{ id, cote, numero, prenom, texte, etiquettes[], note_le }]. Une note déjà reçue est
-- mise à jour seulement par son auteur (correction hors ligne) ; jamais la note d'un collègue.
create function public.match_notes_envoyer(p_seance uuid, p_notes jsonb)
returns integer
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_n integer;
begin
  if not public.match_seance_acces(p_seance) then raise exception 'NEXUS: séance hors de ton unité'; end if;
  if jsonb_typeof(p_notes) <> 'array' or jsonb_array_length(p_notes) > 200 then
    raise exception 'NEXUS: lot de notes invalide (200 au plus)';
  end if;

  insert into public.match_notes as n (id, seance_id, auteur, cote, numero, prenom, texte, etiquettes, note_le)
  select (e->>'id')::uuid, p_seance, auth.uid(), e->>'cote',
         nullif(trim(coalesce(e->>'numero', '')), ''),
         nullif(trim(coalesce(e->>'prenom', '')), ''),
         coalesce(e->>'texte', ''),
         coalesce(array(select jsonb_array_elements_text(coalesce(e->'etiquettes', '[]'::jsonb))), '{}'),
         coalesce((e->>'note_le')::timestamptz, now())
    from jsonb_array_elements(p_notes) e
  on conflict (id) do update
    set cote = excluded.cote, numero = excluded.numero, prenom = excluded.prenom,
        texte = excluded.texte, etiquettes = excluded.etiquettes
    where n.auteur = auth.uid() and n.seance_id = p_seance;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create function public.match_note_supprimer(p_id uuid)
returns void
language plpgsql security definer
set search_path = public
set row_security = off
as $$
begin
  delete from public.match_notes where id = p_id and auteur = auth.uid();
end $$;

-- ── 5. Lire ───────────────────────────────────────────────────────────────
create function public.match_seances_recentes()
returns table (
  id uuid, game_id uuid, equipe_a text, equipe_b text, lieu text, commence_le timestamptz,
  termine_le timestamptz, cree_par uuid, nb_notes integer, nb_a_lier integer
)
language sql stable security definer
set search_path = public
set row_security = off
as $$
  select s.id, s.game_id, s.equipe_a, s.equipe_b, s.lieu, s.commence_le, s.termine_le, s.cree_par,
         (select count(*)::int from public.match_notes n where n.seance_id = s.id),
         (select count(*)::int from public.match_notes n
           where n.seance_id = s.id and n.athlete_id is null and n.carte_id is null and n.lie_le is null)
    from public.match_seances s
   where s.commence_le >= now() - interval '120 days'
     and public.match_seance_acces(s.id)
   order by s.commence_le desc
   limit 100
$$;

create function public.match_notes_seance(p_seance uuid)
returns table (
  id uuid, auteur uuid, auteur_nom text, cote text, numero text, prenom text, texte text,
  etiquettes text[], note_le timestamptz, athlete_id uuid, carte_id uuid, lie_le timestamptz
)
language plpgsql stable security definer
set search_path = public
set row_security = off
as $$
begin
  if not public.match_seance_acces(p_seance) then return; end if;
  return query
  select n.id, n.auteur, nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''), n.cote, n.numero,
         n.prenom, n.texte, n.etiquettes, n.note_le, n.athlete_id, n.carte_id, n.lie_le
    from public.match_notes n
    left join public.users u on u.id = n.auteur
   where n.seance_id = p_seance
   order by n.note_le;
end $$;

-- ── 6. Lier un numéro après le match ──────────────────────────────────────
-- Marque TOUTES les notes du groupe (côté + numéro, ou côté + prénom sans numéro). Cible : un
-- athlète, une carte de l'unité, ou rien (« garder sans lier » : lie_le seul). Les notes sont
-- recopiées dans la fiche par l'appli, avec les fonctions d'écriture existantes.
create function public.match_notes_lier(
  p_seance uuid, p_cote text, p_numero text, p_prenom text, p_athlete_id uuid, p_carte_id uuid
)
returns integer
language plpgsql security definer
set search_path = public
set row_security = off
as $$
declare
  v_n integer;
begin
  if not public.match_seance_acces(p_seance) then raise exception 'NEXUS: séance hors de ton unité'; end if;
  if num_nonnulls(p_athlete_id, p_carte_id) > 1 then raise exception 'NEXUS: un athlète OU une carte'; end if;
  if p_carte_id is not null and not public.carte_ecriture_ok(p_carte_id) then
    raise exception 'NEXUS: carte hors de ton unité';
  end if;
  if p_athlete_id is not null and not exists (
       select 1 from public.athletes a where a.id = p_athlete_id and a.status = 'ACTIF'::public.account_status) then
    raise exception 'NEXUS: athlète introuvable';
  end if;

  update public.match_notes n
     set athlete_id = p_athlete_id, carte_id = p_carte_id, lie_par = auth.uid(), lie_le = now()
   where n.seance_id = p_seance and n.cote = p_cote
     and (case when nullif(trim(coalesce(p_numero, '')), '') is not null
               then n.numero = trim(p_numero)
               else n.numero is null and lower(trim(n.prenom)) = lower(trim(coalesce(p_prenom, ''))) end);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ── 7. ACL : poser, puis vérifier la liste COMPLÈTE triée (CLAUDE.md) ─────
revoke all on function public.match_seance_acces(uuid)                                      from public, anon, authenticated;
revoke all on function public.match_seance_ouvrir(uuid, uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.match_seance_terminer(uuid)                                   from public, anon, authenticated;
revoke all on function public.match_notes_envoyer(uuid, jsonb)                              from public, anon, authenticated;
revoke all on function public.match_note_supprimer(uuid)                                    from public, anon, authenticated;
revoke all on function public.match_seances_recentes()                                      from public, anon, authenticated;
revoke all on function public.match_notes_seance(uuid)                                      from public, anon, authenticated;
revoke all on function public.match_notes_lier(uuid, text, text, text, uuid, uuid)          from public, anon, authenticated;
grant execute on function public.match_seance_ouvrir(uuid, uuid, text, text, text, timestamptz) to authenticated, service_role;
grant execute on function public.match_seance_terminer(uuid)                                   to authenticated, service_role;
grant execute on function public.match_notes_envoyer(uuid, jsonb)                              to authenticated, service_role;
grant execute on function public.match_note_supprimer(uuid)                                    to authenticated, service_role;
grant execute on function public.match_seances_recentes()                                      to authenticated, service_role;
grant execute on function public.match_notes_seance(uuid)                                      to authenticated, service_role;
grant execute on function public.match_notes_lier(uuid, text, text, text, uuid, uuid)          to authenticated, service_role;
grant execute on function public.match_seance_acces(uuid)                                      to service_role;

do $$
declare
  f regprocedure; veut text[]; vus text[]; t regclass;
begin
  for f, veut in
    select * from (values
      ('public.match_seance_acces(uuid)'::regprocedure, array['postgres','service_role']),
      ('public.match_seance_ouvrir(uuid,uuid,text,text,text,timestamptz)'::regprocedure, array['authenticated','postgres','service_role']),
      ('public.match_seance_terminer(uuid)'::regprocedure, array['authenticated','postgres','service_role']),
      ('public.match_notes_envoyer(uuid,jsonb)'::regprocedure, array['authenticated','postgres','service_role']),
      ('public.match_note_supprimer(uuid)'::regprocedure, array['authenticated','postgres','service_role']),
      ('public.match_seances_recentes()'::regprocedure, array['authenticated','postgres','service_role']),
      ('public.match_notes_seance(uuid)'::regprocedure, array['authenticated','postgres','service_role']),
      ('public.match_notes_lier(uuid,text,text,text,uuid,uuid)'::regprocedure, array['authenticated','postgres','service_role'])
    ) v(f, veut)
  loop
    select array_agg(t2.g order by t2.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t2
     where pr.oid = f;
    if vus is distinct from veut then raise exception 'NEXUS: ACL % = %, attendu %', f, vus, veut; end if;
  end loop;

  foreach t in array array['public.match_seances'::regclass, 'public.match_notes'::regclass] loop
    select array_agg(distinct t2.g order by t2.g) into vus
      from pg_class c,
           lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                      from unnest(c.relacl::text[]) as x) t2
     where c.oid = t;
    if exists (select 1 from unnest(vus) g where g not in ('postgres','service_role')) then
      raise exception 'NEXUS: ACL % = %', t, vus;
    end if;
  end loop;
end $$;
