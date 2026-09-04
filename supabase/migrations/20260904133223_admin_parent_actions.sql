-- ═══════════════════════════════════════════════════════════════
-- LOT B0 — JOURNAL DES GESTES ADMIN SUR LE LIEN PARENTAL
--
-- Prérequis des lots A et B1 : la fiche athlète admin va pouvoir inviter,
-- relancer, corriger et délier. Ce sont des gestes d'un adulte sur les
-- données d'un mineur ; ils ne peuvent pas être invisibles.
--
-- ── POURQUOI UNE TABLE, ET PAS `consent_audit_trail` ─────────────────────
-- Relevé avant écriture (prod, 2026-09-04) : `consent_audit_trail.action`
-- porte un CHECK à SIX valeurs — ATTESTED, WITHDRAWN, EXPIRED,
-- PDF_DOWNLOADED, PDF_UPLOADED, GRANTED. Y écrire « PARENT_INVITED » exige
-- d'élargir cette contrainte sur une table Loi 25, et surtout de diluer un
-- vocabulaire qui est celui du CONSENTEMENT. Un admin qui relance un
-- courriel d'invitation n'accorde ni ne retire aucun consentement ; l'y
-- consigner fausserait tout comptage Loi 25 futur.
--
-- LA FRONTIÈRE EST DONC : ce journal-ci porte le geste ADMINISTRATIF ;
-- `consent_audit_trail` continue de porter le CONSENTEMENT, et lui seul.
-- Le jour où le déliement arrivera (lot B2), il écrira dans LES DEUX — une
-- ligne ici pour le geste, et une vraie ligne `WITHDRAWN` là-bas, mais
-- seulement si des consentements étaient effectivement actifs. Valeur déjà
-- permise par le CHECK existant : aucune contrainte Loi 25 à toucher.
--
-- ── CE QUE LE VOCABULAIRE DÉCLARE D'AVANCE ──────────────────────────────
-- Le CHECK porte les SIX actions du chantier, dont quatre ne sont pas
-- encore écrites (lots B2 à B5). C'est délibéré : le vocabulaire d'un
-- journal se fixe une fois. L'alternative — l'élargir à chaque lot — ferait
-- quatre migrations sur une table d'audit pour ajouter des mots qu'on
-- connaît déjà.
--
-- ── LE JOURNAL NE PERD JAMAIS SON AUTEUR ────────────────────────────────
-- `admin_user_id` est en ON DELETE SET NULL, comme `consent_audit_trail.
-- coach_id` (relevé pg_constraint) — mais on fait MIEUX que le précédent :
-- `admin_email` garde une COPIE de l'adresse au moment du geste. Chez le
-- voisin, supprimer le coach efface l'auteur de la ligne et la trace ne dit
-- plus qui a agi. Ici elle le dit encore. Même chose pour le parent :
-- `parent_user_id` peut devenir NULL, `parent_email` reste.
--
-- `athlete_id` est en ON DELETE CASCADE, lui, et c'est l'inverse assumé :
-- c'est le choix déjà fait par `consent_audit_trail` et
-- `parent_notifications`. Le droit à l'effacement d'un mineur passe avant
-- la conservation de la trace administrative.
--
-- ── AUCUNE POLICY D'ÉCRITURE, ET C'EST LE POINT ─────────────────────────
-- Une seule policy : SELECT sous `is_admin()`. Pas d'INSERT, pas d'UPDATE,
-- pas de DELETE — donc personne n'écrit ici depuis un client, jamais. Les
-- lignes n'arrivent QUE par les RPC SECURITY DEFINER du lot B1 et suivants,
-- dans la même transaction que le geste qu'elles décrivent : un geste
-- réussi sans trace est impossible, un rollback les emporte tous les deux.
-- Les GRANT d'écriture sont révoqués en plus de l'absence de policy — deux
-- verrous, pour qu'une policy permissive ajoutée par erreur plus tard ne
-- suffise pas à ouvrir la porte.
--
-- LE JETON N'EST JAMAIS JOURNALISÉ. `parent_invitations.token` est un
-- porteur d'identité : quiconque l'a peut réclamer l'enfant. Le journal
-- garde l'id de l'invitation et sa date d'expiration, jamais le jeton.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.admin_parent_actions (
  id             uuid primary key default gen_random_uuid(),

  -- L'auteur. SET NULL + copie de l'adresse : voir l'en-tête.
  admin_user_id  uuid references public.users(id) on delete set null,
  admin_email    text,

  athlete_id     uuid not null references public.athletes(id) on delete cascade,

  -- Le parent visé. NULL tant qu'aucun compte n'existe (cas de l'invitation
  -- envoyée à une adresse qui n'a pas encore de compte) — d'où `parent_email`
  -- qui, lui, est toujours renseigné.
  parent_user_id uuid references public.users(id) on delete set null,
  parent_email   text,

  action         text not null check (action in (
                   'PARENT_INVITED',        -- B1 — première invitation
                   'PARENT_INVITE_RESENT',  -- B1 — jeton renouvelé, ré-émission
                   'PARENT_LINKED',         -- B5 — liaison posée par l'admin
                   'PARENT_UNLINKED',       -- B2 — déliement
                   'PARENT_EMAIL_CHANGED',  -- B3 — auth.users + public.users
                   'PARENT_RECOVERY_SENT'   -- B4 — courriel de reinitialisation
                 )),

  -- Le détail du geste. Jamais de jeton ici (voir l'en-tête).
  details        jsonb not null default '{}'::jsonb,

  created_at     timestamptz not null default now()
);

-- La fiche admin lit le journal d'UN athlète, du plus récent au plus ancien.
create index if not exists admin_parent_actions_athlete_idx
  on public.admin_parent_actions (athlete_id, created_at desc);

alter table public.admin_parent_actions enable row level security;

drop policy if exists admin_parent_actions_select on public.admin_parent_actions;
create policy admin_parent_actions_select
  on public.admin_parent_actions
  for select to authenticated
  using (public.is_admin());

-- Second verrou : même sans policy, on retire les droits de table. Une
-- policy permissive posée par erreur plus tard ne suffira pas.
revoke all on public.admin_parent_actions from anon;
revoke insert, update, delete, truncate on public.admin_parent_actions from authenticated;

comment on table public.admin_parent_actions is
$c$Journal des gestes ADMINISTRATIFS sur le lien parental d'un athlete
(invitation, relance, liaison, deliement, correction de courriel, renvoi de
reinitialisation).

FRONTIERE : ce journal porte le GESTE ADMIN. consent_audit_trail porte le
CONSENTEMENT, et lui seul — son CHECK a six valeurs est un vocabulaire de
consentement, on ne le dilue pas. Un deliement ecrit dans LES DEUX : une
ligne ici, et une ligne WITHDRAWN la-bas si des consentements etaient actifs.

ECRITURE : aucune policy, aucun GRANT. Les lignes n'arrivent que par les RPC
SECURITY DEFINER (admin_invite_parent et suivantes), dans la meme transaction
que le geste — un geste sans trace est impossible.

Le jeton d'invitation n'est JAMAIS journalise : c'est un porteur d'identite.$c$;

-- ── GARDE-FOU ──────────────────────────────────────────────────────────
do $$
declare
  n_policies_ecriture int;
  n_actions           int;
begin
  select count(*) into n_policies_ecriture
    from pg_policies
   where schemaname='public' and tablename='admin_parent_actions' and cmd <> 'SELECT';

  if n_policies_ecriture > 0 then
    raise exception 'NEXUS: admin_parent_actions porte % policy(ies) d''ecriture — le journal ne doit etre alimente que par les RPC definer', n_policies_ecriture;
  end if;

  select count(*) into n_actions
    from pg_constraint
   where conrelid = 'public.admin_parent_actions'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) like '%PARENT_INVITED%';

  if n_actions <> 1 then
    raise exception 'NEXUS: le vocabulaire d''actions de admin_parent_actions est absent';
  end if;

  raise notice 'NEXUS: admin_parent_actions cree — lecture admin seule, ecriture par RPC definer uniquement.';
end $$;
