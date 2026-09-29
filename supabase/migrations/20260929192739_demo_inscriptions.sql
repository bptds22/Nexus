-- ════════════════════════════════════════════════════════════════════════════
-- Démo recruteurs du 12 octobre 2026 — inscriptions (page publique /12octobre).
-- Additif : deux tables neuves, une RPC appelable sans connexion, rien d'autre.
--
-- · demo_inscriptions : une ligne par courriel et par événement (la seconde
--   soumission met la première à jour : on garde la DERNIÈRE réponse).
--   Lecture : admin seulement (policy). Écriture : la RPC seulement.
-- · demo_inscriptions_tentatives : empreintes d'IP (sha256 salé, jamais l'IP)
--   pour la limite de débit ; purgée à 24 h ; personne ne la lit.
-- · inscrire_demo(...) : SECURITY DEFINER, anon + authenticated. Pot de miel
--   (p_site_web rempli → faux succès, rien d'écrit), validation, limite de
--   débit (5 par IP et par heure, 300 en tout par heure).
-- · Les courriels (confirmation à l'inscrit, avis à info@) partent par
--   l'edge function send-demo-inscription, qui RÉCLAME chaque envoi
--   (A_ENVOYER → EN_COURS) : un courriel au plus par soumission.
-- ════════════════════════════════════════════════════════════════════════════

create table public.demo_inscriptions (
  id                     uuid primary key default gen_random_uuid(),
  evenement              text not null default 'demo-2026-10-12' check (evenement = 'demo-2026-10-12'),
  prenom                 text not null check (char_length(btrim(prenom)) between 1 and 80),
  nom                    text not null check (char_length(btrim(nom)) between 1 and 80),
  courriel               text not null check (char_length(courriel) <= 200 and courriel ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  cegep_id               uuid references public.schools(id) on delete set null,
  cegep_autre            text check (cegep_autre is null or char_length(cegep_autre) <= 160),
  sport_id               uuid references public.sports(id) on delete set null,
  role                   text check (role is null or role in ('RECRUTEUR', 'ENTRAINEUR_CHEF', 'DIRECTEUR_SPORTS', 'AUTRE')),
  interets               text[] not null default '{}' check (interets <@ array['OUTILS', 'BASSIN', 'AUTRE']),
  interet_autre          text check (interet_autre is null or char_length(interet_autre) <= 500),
  -- Vrai quand l'inscrit a cliqué « Ouvrir mon compte Nexus » (sur la page
  -- ou sur la page de remerciement) : l'intérêt, pas l'ouverture du compte.
  veut_compte            boolean not null default false,
  participation          text not null check (participation in ('DIRECT', 'ENREGISTREMENT')),
  -- Cumulable avec l'un ou l'autre choix (retour BP 2026-09-29) : la
  -- réservation elle-même se fait dans l'agenda Google.
  presentation_1a1       boolean not null default false,
  consentement_courriels boolean not null check (consentement_courriels),
  consentement_le        timestamptz not null default now(),
  nb_soumissions         integer not null default 1,
  cree_le                timestamptz not null default now(),
  modifie_le             timestamptz not null default now(),
  confirmation_statut    text not null default 'A_ENVOYER' check (confirmation_statut in ('A_ENVOYER', 'EN_COURS', 'ENVOYE', 'ECHEC')),
  confirmation_envoyee_le timestamptz,
  avis_statut            text not null default 'A_ENVOYER' check (avis_statut in ('A_ENVOYER', 'EN_COURS', 'ENVOYE', 'ECHEC')),
  avis_envoye_le         timestamptz,
  envoi_erreur           text
);
create unique index demo_inscriptions_courriel_uniq on public.demo_inscriptions (evenement, lower(courriel));

create table public.demo_inscriptions_tentatives (
  id           bigint generated always as identity primary key,
  ip_empreinte text not null,
  cree_le      timestamptz not null default now()
);
create index demo_inscriptions_tentatives_idx on public.demo_inscriptions_tentatives (ip_empreinte, cree_le);

alter table public.demo_inscriptions enable row level security;
alter table public.demo_inscriptions_tentatives enable row level security;
revoke all on public.demo_inscriptions, public.demo_inscriptions_tentatives from public, anon, authenticated;
grant select on public.demo_inscriptions to authenticated;
create policy demo_inscriptions_admin_select on public.demo_inscriptions for select to authenticated
  using (public.is_admin());

-- ════════════════════════════════════════════════════════════════════════════
create function public.inscrire_demo(
  p_prenom text, p_nom text, p_courriel text,
  p_cegep_id uuid, p_cegep_autre text, p_sport_id uuid, p_role text,
  p_interets text[], p_interet_autre text, p_veut_compte boolean,
  p_participation text, p_presentation_1a1 boolean, p_consentement boolean, p_site_web text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ip text;
  v_empreinte text;
  v_id uuid;
  v_courriel text := lower(btrim(coalesce(p_courriel, '')));
  v_interets text[] := coalesce(p_interets, '{}');
begin
  -- Empreinte de l'IP (premier maillon de x-forwarded-for), jamais l'IP.
  begin
    v_ip := split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1);
  exception when others then v_ip := '';
  end;
  v_empreinte := encode(extensions.digest('nexus-demo-2026|' || coalesce(nullif(btrim(v_ip), ''), 'inconnue'), 'sha256'), 'hex');

  delete from public.demo_inscriptions_tentatives where cree_le < now() - interval '1 day';
  if (select count(*) from public.demo_inscriptions_tentatives
       where ip_empreinte = v_empreinte and cree_le > now() - interval '1 hour') >= 5
     or (select count(*) from public.demo_inscriptions_tentatives where cree_le > now() - interval '1 hour') >= 300 then
    raise exception 'NEXUS: trop de tentatives, réessayez plus tard' using errcode = 'P0001';
  end if;
  insert into public.demo_inscriptions_tentatives (ip_empreinte) values (v_empreinte);

  -- Pot de miel : un robot remplit le champ caché. Faux succès, rien d'écrit.
  if nullif(btrim(coalesce(p_site_web, '')), '') is not null then
    return gen_random_uuid();
  end if;

  if nullif(btrim(coalesce(p_prenom, '')), '') is null or nullif(btrim(coalesce(p_nom, '')), '') is null
     or v_courriel = '' then
    raise exception 'NEXUS: prénom, nom et courriel sont obligatoires' using errcode = '22023';
  end if;
  if v_courriel !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_courriel) > 200 then
    raise exception 'NEXUS: courriel invalide' using errcode = '22023';
  end if;
  if p_consentement is not true then
    raise exception 'NEXUS: consentement requis' using errcode = '22023';
  end if;
  if p_participation is null or p_participation not in ('DIRECT', 'ENREGISTREMENT') then
    raise exception 'NEXUS: choix de participation requis' using errcode = '22023';
  end if;
  if p_cegep_id is not null and not exists (select 1 from public.schools where id = p_cegep_id and type = 'CEGEP') then
    raise exception 'NEXUS: cégep inconnu' using errcode = '22023';
  end if;
  if p_sport_id is not null and not exists (select 1 from public.sports where id = p_sport_id) then
    raise exception 'NEXUS: sport inconnu' using errcode = '22023';
  end if;
  if not (v_interets <@ array['OUTILS', 'BASSIN', 'AUTRE']) then
    raise exception 'NEXUS: intérêt inconnu' using errcode = '22023';
  end if;

  insert into public.demo_inscriptions as d
    (prenom, nom, courriel, cegep_id, cegep_autre, sport_id, role, interets, interet_autre,
     veut_compte, participation, presentation_1a1, consentement_courriels)
  values
    (btrim(p_prenom), btrim(p_nom), v_courriel, p_cegep_id,
     case when p_cegep_id is null then nullif(btrim(coalesce(p_cegep_autre, '')), '') end,
     p_sport_id, p_role, v_interets,
     case when 'AUTRE' = any (v_interets) then nullif(btrim(coalesce(p_interet_autre, '')), '') end,
     coalesce(p_veut_compte, false), p_participation, coalesce(p_presentation_1a1, false), true)
  on conflict (evenement, lower(courriel)) do update set
    prenom = excluded.prenom, nom = excluded.nom, cegep_id = excluded.cegep_id, cegep_autre = excluded.cegep_autre,
    sport_id = excluded.sport_id, role = excluded.role, interets = excluded.interets,
    interet_autre = excluded.interet_autre, veut_compte = d.veut_compte or excluded.veut_compte,
    participation = excluded.participation, presentation_1a1 = excluded.presentation_1a1, consentement_le = now(),
    nb_soumissions = d.nb_soumissions + 1, modifie_le = now(),
    -- Nouvelle confirmation seulement si le choix change ou si le 1:1 vient
    -- d'être demandé : resoumettre ne fait pas pleuvoir les courriels.
    confirmation_statut = case when d.participation is distinct from excluded.participation
                                 or (excluded.presentation_1a1 and not d.presentation_1a1)
                               then 'A_ENVOYER' else d.confirmation_statut end,
    avis_statut = 'A_ENVOYER'
  returning d.id into v_id;
  return v_id;
end $$;

revoke execute on function public.inscrire_demo(text, text, text, uuid, text, uuid, text, text[], text, boolean, text, boolean, boolean, text) from public;
grant execute on function public.inscrire_demo(text, text, text, uuid, text, uuid, text, text[], text, boolean, text, boolean, boolean, text) to anon, authenticated;

-- « Ouvrir mon compte Nexus » cliqué APRÈS l'inscription (page de
-- remerciement) : pose l'intérêt sur la ligne. Ne fait que passer un booléen
-- à vrai ; l'id vient de inscrire_demo.
create function public.demo_clic_compte(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.demo_inscriptions set veut_compte = true where id = p_id and not veut_compte
$$;
revoke execute on function public.demo_clic_compte(uuid) from public;
grant execute on function public.demo_clic_compte(uuid) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- GATES — listes complètes, jamais par inclusion.
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare r record; vus text[];
begin
  for r in
    select * from (values
      ('public.demo_inscriptions',            array['authenticated','postgres','service_role']),
      ('public.demo_inscriptions_tentatives', array['postgres','service_role'])
    ) as v(t, veut)
  loop
    select array_agg(distinct t.g order by t.g) into vus
      from pg_class c, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                  from unnest(c.relacl::text[]) as x) t
     where c.oid = r.t::regclass;
    if vus is distinct from r.veut then raise exception 'NEXUS: ACL de % = %, attendu %', r.t, vus, r.veut; end if;
    if not (select relrowsecurity from pg_class where oid = r.t::regclass) then raise exception 'NEXUS: RLS inactive sur %', r.t; end if;
  end loop;
  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'public' and grantee = 'authenticated'
                and table_name = 'demo_inscriptions' and privilege_type <> 'SELECT') then
    raise exception 'NEXUS: authenticated peut écrire dans demo_inscriptions';
  end if;

  select array_agg(t.g order by t.g) into vus
    from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.inscrire_demo(text, text, text, uuid, text, uuid, text, text[], text, boolean, text, boolean, boolean, text)'::regprocedure;
  if vus is distinct from array['anon','authenticated','postgres','service_role'] then
    raise exception 'NEXUS: ACL de inscrire_demo = %', vus;
  end if;
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr, lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                                from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.demo_clic_compte(uuid)'::regprocedure;
  if vus is distinct from array['anon','authenticated','postgres','service_role'] then
    raise exception 'NEXUS: ACL de demo_clic_compte = %', vus;
  end if;

  select coalesce(array_agg(polname::text order by polname::text), '{}') into vus
    from pg_policy where polrelid in ('public.demo_inscriptions'::regclass, 'public.demo_inscriptions_tentatives'::regclass);
  if vus is distinct from array['demo_inscriptions_admin_select'] then
    raise exception 'NEXUS: policies = %', vus;
  end if;
end $$;
