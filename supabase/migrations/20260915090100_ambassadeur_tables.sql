-- ═══════════════════════════════════════════════════════════════════════════
-- M2 — Le socle du programme Ambassadeur : quatre tables.
--
-- MODÈLE ARRÊTÉ PAR BP (2026-09-15)
--   · On ne revendique QUE des personnes DÉJÀ INSCRITES (ACTIF + compte).
--   · AUCUNE règle temporelle. Peu importe qui s'est inscrit quand.
--     L'amorçage rétroactif est un coût de lancement assumé, pas un défaut.
--   · Le premier arrivé garde — et l'INDEX UNIQUE est la seule règle. Pas de
--     départage applicatif, pas de « dernier écrit gagne ».
--   · Un administrateur peut annuler une CONFIRMEE (rejet doux, motif
--     consigné) : l'index se libère, le compteur du parrain se recalcule.
--
-- CE QUE CE FICHIER NE FAIT PAS : aucune RPC, aucun trigger métier. Il pose les
-- tables, les index, la RLS et les droits. Les fonctions viennent en M4-M7.
--
-- ⚠ DONNÉES SUR DES MINEURS. Une revendication porte le nom d'un TIERS, saisi
-- par quelqu'un d'autre. La RLS ci-dessous est donc fermée par défaut : le
-- parrain ne lit RIEN en direct, il passe par une projection (M5) qui ne lui
-- rend que ce qu'il a tapé lui-même. Même motif que le retrait des policies
-- directes partenaire au profit des projections (20260820023055).
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists moddatetime;

-- ── 1. Les revendications ────────────────────────────────────────────────
create table public.ambassadeur_revendications (
  id                  uuid primary key default gen_random_uuid(),

  -- QUI revendique.
  parrain_athlete_id  uuid not null references public.athletes(id) on delete cascade,

  -- CE QUE LE PARRAIN A SAISI. Conservé tel quel : c'est ce que la projection
  -- lui renvoie, et lui seul l'a écrit — donc aucune fuite.
  prenom              text not null,
  nom                 text not null,
  courriel_normalise  text null,
  ecole_id            uuid null references public.schools(id) on delete set null,
  team_id             uuid null references public.teams(id)   on delete set null,

  -- CE QUE LA BASE A TROUVÉ. JAMAIS projeté au parrain.
  --
  -- ON DELETE CASCADE, ET C'EST UNE CORRECTION DE RECETTE (2026-09-15).
  -- La première écriture disait `on delete set null`, par symétrie avec les
  -- autres colonnes de contexte. La recette a levé sur
  -- ambassadeur_confirmee_coherente en supprimant ses fixtures : vider le
  -- filleul d'une ligne CONFIRMEE la rend incohérente, et la contrainte —
  -- qui a raison — refuse. Le défaut n'était pas dans la contrainte, il
  -- était dans le FK.
  --
  -- CASCADE est aussi la bonne réponse sur le fond : une revendication est un
  -- énoncé SUR quelqu'un. Si ce quelqu'un disparaît de Nexus, l'énoncé n'a
  -- plus d'objet, et le garder ferait créditer un parrain pour une personne
  -- qui n'existe plus. C'est enfin ce qu'exige un droit à l'effacement :
  -- partir emporte ce qui a été déclaré sur vous.
  --
  -- Effet de bord assumé : ambassadeur_paliers n'est PAS recalculé (le trigger
  -- écoute INSERT/UPDATE, pas DELETE). C'est voulu — les paliers ne se
  -- défont jamais. Le compteur affiché, lui, est un count() en direct : il
  -- redescend tout seul.
  filleul_athlete_id  uuid null references public.athletes(id) on delete cascade,
  candidats           jsonb null,

  methode             text not null
    check (methode in ('courriel','nom_ecole','nom_equipe','admin')),
  statut              text not null default 'EN_ATTENTE'
    check (statut in ('EN_ATTENTE','CONFIRMEE','REJETEE')),

  confirmee_le        timestamptz null,
  tranchee_par        uuid null references public.users(id) on delete set null,
  raison_rejet        text null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- On ne se parraine pas soi-même. Le courriel est vérifié en plus dans la
  -- RPC : un athlète peut saisir sa propre adresse sans connaître son id.
  constraint ambassadeur_pas_soi_meme
    check (filleul_athlete_id is null or filleul_athlete_id <> parrain_athlete_id),

  -- Une CONFIRMEE sans filleul ne veut rien dire, et compterait quand même au
  -- palier. La contrainte empêche l'incohérence plutôt que de la rattraper.
  constraint ambassadeur_confirmee_coherente
    check (statut <> 'CONFIRMEE' or (filleul_athlete_id is not null and confirmee_le is not null))
);

comment on table public.ambassadeur_revendications is
$c$Revendications du programme Ambassadeur athlète.

Une ligne n'existe QUE si au moins une personne inscrite a été trouvée. Une
recherche qui n'aboutit à rien n'écrit RIEN — c'est la garantie « zéro
stockage des recherches refusées ». Le garde-fou d'énumération vit dans
ambassadeur_tentatives, qui ne conserve aucun texte.

`filleul_athlete_id` et `candidats` ne sortent JAMAIS vers le parrain : la
projection ambassadeur_mon_tableau() ne lui rend que sa propre saisie.$c$;

comment on column public.ambassadeur_revendications.candidats is
$c$Homonymes départagés par l'administrateur (statut EN_ATTENTE). Tableau jsonb
d'objets {athlete_id, prenom, nom, ecole, equipe, promotion, courriel_masque}.

`promotion` et `courriel_masque` sont les DISCRIMINANTS : sans eux, deux
homonymes de même école et de même équipe sont identiques à l'écran et
l'administrateur ne peut pas trancher (constaté en recette, 2026-09-15). Le
masque (public.masquer_courriel) est irréversible — assez pour distinguer, pas
assez pour écrire à la personne.

Lisible par l'ADMIN UNIQUEMENT : c'est de l'identité de mineur, et
ambassadeur_mon_tableau() ne le projette jamais vers le parrain.$c$;

comment on column public.ambassadeur_revendications.courriel_normalise is
$c$lower(btrim(courriel)) posé par la RPC. Jamais l'adresse brute : la forme
normalisee est celle des deux index uniques existants
(athletes_email_lower_btrim_uniq, users_email_key).$c$;

-- ── 2. Les index uniques — LA règle ──────────────────────────────────────
-- Premier arrivé garde. Partiel sur CONFIRMEE : deux parrains peuvent avoir
-- une EN_ATTENTE sur la même personne (homonymie tranchée plus tard), un seul
-- peut la confirmer. Le second arbitrage lèvera unique_violation, que la RPC
-- traduit en « deja_parrainee » (M7).
create unique index ambassadeur_filleul_unique_confirme
  on public.ambassadeur_revendications (filleul_athlete_id)
  where statut = 'CONFIRMEE' and filleul_athlete_id is not null;

-- Un parrain ne revendique pas deux fois la même personne. REJETEE exclue :
-- une revendication annulée ne doit pas verrouiller l'avenir.
create unique index ambassadeur_parrain_filleul_unique
  on public.ambassadeur_revendications (parrain_athlete_id, filleul_athlete_id)
  where statut <> 'REJETEE' and filleul_athlete_id is not null;

-- Ni deux fois la même adresse. Le WHERE sur non-null est indispensable :
-- NULLS NOT DISTINCT serait FAUX ici — deux personnes sans courriel sont deux
-- personnes. (C'est l'inverse exact de athlete_badges_unicite_vivante, où
-- NULLS NOT DISTINCT était la bonne réponse. Ne pas copier l'un sur l'autre.)
create unique index ambassadeur_parrain_courriel_unique
  on public.ambassadeur_revendications (parrain_athlete_id, courriel_normalise)
  where courriel_normalise is not null and statut <> 'REJETEE';

create index ambassadeur_parrain_idx
  on public.ambassadeur_revendications (parrain_athlete_id);
create index ambassadeur_attente_idx
  on public.ambassadeur_revendications (created_at)
  where statut = 'EN_ATTENTE';

create trigger ambassadeur_revendications_touch
  before update on public.ambassadeur_revendications
  for each row execute function public.moddatetime(updated_at);

-- ── 3. Les paliers ───────────────────────────────────────────────────────
-- La clé primaire composite EST l'idempotence : un palier ne se franchit
-- qu'une fois, même si le compteur redescend puis remonte (annulation admin).
create table public.ambassadeur_paliers (
  athlete_id  uuid not null references public.athletes(id) on delete cascade,
  palier      int  not null check (palier in (3,5,10)),
  atteint_le  timestamptz not null default now(),
  notifie_le  timestamptz null,
  primary key (athlete_id, palier)
);

comment on table public.ambassadeur_paliers is
$c$Paliers franchis. Ne se DÉFONT PAS : une annulation administrative fait
baisser le compteur, mais le palier reste acquis. Retirer un palier
retirerait un badge déjà posé et une notification déjà lue — on ne réécrit
pas le passé d'un jeune de 16 ans pour un ajustement de compteur.

notifie_le NULL après un échec d'écriture de notification → un rejeu reste
possible. Même sémantique que team_invitations.email_sent_at.$c$;

-- ── 4. Le compteur de tentatives ─────────────────────────────────────────
-- AUCUNE COLONNE TEXTE, ET C'EST LE POINT. Le terme cherché ne doit exister
-- nulle part quand la recherche n'aboutit pas : ni ici, ni dans un message
-- d'erreur (les RAISE de la RPC sont génériques, sans paramètre — sinon le
-- nom part dans les journaux Postgres, lisibles par query_logs).
create table public.ambassadeur_tentatives (
  athlete_id  uuid not null references public.athletes(id) on delete cascade,
  jour        date not null,
  n           int  not null default 0,
  primary key (athlete_id, jour)
);

comment on table public.ambassadeur_tentatives is
$c$Borne d'énumération : 5 tentatives par jour et par athlète, TOUTES comptées
— réussies comprises (décision BP). Compter les seuls échecs laisserait un
attaquant sonder sans limite tant qu'il tombe juste.

`jour` est le jour de MONTRÉAL, pas celui du serveur : pg_cron et Postgres
sont en UTC, et un athlète ne doit pas voir son quota basculer à 20 h.

Purge hebdomadaire par le travail ambassadeur-purge-hebdo (M8).$c$;

-- ── 5. Le suivi administratif ────────────────────────────────────────────
create table public.ambassadeur_suivi (
  athlete_id          uuid primary key references public.athletes(id) on delete cascade,
  post_ig_le          timestamptz null,
  chandail_envoye_le  timestamptz null,
  note_admin          text null,
  updated_at          timestamptz not null default now(),
  updated_by          uuid null references public.users(id) on delete set null
);

comment on table public.ambassadeur_suivi is
$c$Gestes hors plateforme, cochés à la main par l'administrateur (publication
Instagram, chandail envoyé). Aucun effet sur les paliers ni sur le badge :
c'est un carnet, pas une règle.$c$;

create trigger ambassadeur_suivi_touch
  before update on public.ambassadeur_suivi
  for each row execute function public.moddatetime(updated_at);

-- ── 6. athlete_badges.origine gagne 'systeme' ────────────────────────────
-- Le badge Ambassadeur n'est ni une saisie de coach, ni une suggestion
-- d'athlète, ni une reprise de l'ancien format. Le confondre avec 'saisie'
-- le rendrait éditable par le picker d'un coach ; avec 'suggestion', il
-- passerait par une approbation que personne n'est en mesure de donner.
--
-- ⚠ CONTRAT SOLIDAIRE — lib/queries/shared/athleteBadges.ts doit verser
-- 'systeme' dans `autres` (lecture seule). Sans ce changement de client, le
-- PREMIER enregistrement du picker coach retire le badge : appliquer_badges_
-- saisie retire tout ce qui n'est pas dans p_entrees, et le picker n'enverra
-- jamais un badge qu'il ne connaît pas. C'est le piège payé le 2026-08-26 et
-- de nouveau le 2026-08-27. Les deux ne se séparent pas.
alter table public.athlete_badges drop constraint if exists athlete_badges_origine_check;
alter table public.athlete_badges add constraint athlete_badges_origine_check
  check (origine in ('saisie','transposition','suggestion','systeme'));

-- ── 7. RLS ───────────────────────────────────────────────────────────────
alter table public.ambassadeur_revendications enable row level security;
alter table public.ambassadeur_paliers        enable row level security;
alter table public.ambassadeur_tentatives     enable row level security;
alter table public.ambassadeur_suivi          enable row level security;

-- LECTURE : administrateur SEULEMENT. Le parrain passe par la projection.
create policy "ambassadeur revendications admin read" on public.ambassadeur_revendications
  for select to authenticated using (public.is_admin());
create policy "ambassadeur paliers admin read" on public.ambassadeur_paliers
  for select to authenticated using (public.is_admin());
create policy "ambassadeur tentatives admin read" on public.ambassadeur_tentatives
  for select to authenticated using (public.is_admin());
create policy "ambassadeur suivi admin read" on public.ambassadeur_suivi
  for select to authenticated using (public.is_admin());

-- ÉCRITURE : le carnet administratif seulement. Tout le reste passe par des
-- RPC SECURITY DEFINER — les revendications parce qu'elles doivent rattraper
-- unique_violation, les tentatives parce qu'elles sont le garde-fou lui-même.
create policy "ambassadeur suivi admin insert" on public.ambassadeur_suivi
  for insert to authenticated with check (public.is_admin());
create policy "ambassadeur suivi admin update" on public.ambassadeur_suivi
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── 8. Droits ────────────────────────────────────────────────────────────
-- pg_default_acl accorde ALL à anon ET authenticated sur toute table neuve du
-- schéma public. On révoque ce blanc-seing avant de rendre le strict
-- nécessaire. anon n'a RIEN : ce sont des données sur des mineurs.
revoke all on public.ambassadeur_revendications from anon, authenticated;
revoke all on public.ambassadeur_paliers        from anon, authenticated;
revoke all on public.ambassadeur_tentatives     from anon, authenticated;
revoke all on public.ambassadeur_suivi          from anon, authenticated;

grant select on public.ambassadeur_revendications to authenticated;  -- borné admin
grant select on public.ambassadeur_paliers        to authenticated;  -- borné admin
grant select on public.ambassadeur_tentatives     to authenticated;  -- borné admin
grant select, insert, update on public.ambassadeur_suivi to authenticated;  -- borné admin

-- ── 9. Garde-fou ─────────────────────────────────────────────────────────
do $$
declare v_t int; v_i int; v_o boolean;
begin
  select count(*) into v_t from pg_tables
   where schemaname='public' and tablename like 'ambassadeur\_%';
  if v_t <> 4 then
    raise exception 'NEXUS: % tables ambassadeur au lieu de 4.', v_t;
  end if;

  select count(*) into v_i from pg_indexes
   where schemaname='public' and indexname in (
     'ambassadeur_filleul_unique_confirme',
     'ambassadeur_parrain_filleul_unique',
     'ambassadeur_parrain_courriel_unique');
  if v_i <> 3 then
    raise exception 'NEXUS: % index uniques au lieu de 3 — la regle du premier arrive n''est pas posee.', v_i;
  end if;

  select pg_get_constraintdef(oid) like '%systeme%' into v_o
    from pg_constraint where conname = 'athlete_badges_origine_check';
  if not coalesce(v_o, false) then
    raise exception 'NEXUS: athlete_badges.origine n''accepte pas ''systeme''.';
  end if;

  raise notice 'NEXUS: socle ambassadeur pose — 4 tables, 3 index uniques, origine systeme ouverte.';
end $$;
