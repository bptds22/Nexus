-- 20260929145551_roles_figes_parent_partner_admin (renommée à la version prod après apply)
--
-- AIGUILLAGE — un compte PARENT, PARTNER ou ADMIN n'a JAMAIS de rôle à choisir.
--
-- Constat prod (2026-09-29) : needs_signup_role() ignorait le rôle. Un PARENT
-- créé par le claim d'invitation n'a ni role_claimed_at, ni onboarding terminé,
-- ni fiche athlète : la fonction rendait TRUE. Conséquences, pour les 44 parents :
--   · connexion Google/Apple sur le web → /auth/callback l'envoyait sur
--     /inscription/role au lieu de /parent (« comme s'il n'avait jamais été parent ») ;
--   · claim_signup_role() ne l'en empêchait pas non plus : choisir un rôle sur
--     cet écran ÉCRASAIT le rôle PARENT (cas réel : d11e2688, 2026-08-25).
--
-- Correctif : les deux fonctions ouvrent sur une LISTE EXPLICITE des rôles figés
-- (règle 11 de CLAUDE.md : une exemption décidée s'écrit en tête, elle ne se
-- déduit pas des tests qui suivent). Le miroir web vit dans
-- lib/auth/rolesFiges.ts (garde de /auth/callback, maybeApplySignupRole).
--
-- CREATE OR REPLACE sans changement de signature : l'ACL est conservée ; la
-- gate en fin de fichier la compare en LISTE COMPLÈTE, avant = après.

create or replace function public.needs_signup_role()
returns boolean
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
set row_security to 'off'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row public.users%rowtype;
begin
  if v_uid is null then
    return false;
  end if;

  select * into v_row from public.users where id = v_uid;
  if not found then
    return false;
  end if;

  -- RÔLES FIGÉS — décision BP 2026-09-29, écrite ici en tête : un parent, un
  -- partenaire ou un admin ne choisit jamais son rôle, quel que soit l'état de
  -- son onboarding. Tout nouveau rôle attribué hors inscription s'ajoute ICI.
  if v_row.role::text = any (array['PARENT', 'PARTNER', 'ADMIN']) then
    return false;
  end if;

  if v_row.role_claimed_at is not null then
    return false;                       -- rôle déjà figé (one-shot consommé)
  end if;

  if v_row.onboarding_complete is true then
    return false;                       -- compte établi
  end if;

  if exists (select 1 from public.athletes where user_id = v_uid) then
    return false;                       -- fiche athlète déjà créée
  end if;

  return true;
end;
$function$;

create or replace function public.claim_signup_role(p_role text, p_context text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
set row_security to 'off'
as $function$
declare
  v_uid     uuid := auth.uid();
  v_row     public.users%rowtype;
  v_context text := null;
begin
  -- Garde 1 -- authentification obligatoire.
  if v_uid is null then
    raise exception 'claim_signup_role: appel non authentifie'
      using errcode = '28000';
  end if;

  -- Garde 2 -- whitelist stricte. JAMAIS ADMIN, JAMAIS PARTNER.
  if p_role is null or p_role not in ('ATHLETE', 'COACH', 'RECRUTEUR') then
    raise exception 'claim_signup_role: role % non autorise (attendu ATHLETE|COACH|RECRUTEUR)', p_role
      using errcode = '22023';
  end if;

  -- FOR UPDATE : verrouille la ligne. Sans ce verrou, deux appels concurrents
  -- (double-tap, retry reseau) pourraient tous deux lire role_claimed_at IS NULL
  -- et le one-shot serait franchissable deux fois.
  select * into v_row from public.users where id = v_uid for update;
  if not found then
    raise exception 'claim_signup_role: profil introuvable'
      using errcode = 'P0002';
  end if;

  -- Garde 2bis -- RÔLES FIGÉS (décision BP 2026-09-29) : un rôle PARENT,
  -- PARTNER ou ADMIN déjà attribué ne s'écrase JAMAIS par cette voie. Même
  -- liste que needs_signup_role() et lib/auth/rolesFiges.ts.
  if v_row.role::text = any (array['PARENT', 'PARTNER', 'ADMIN']) then
    raise exception 'claim_signup_role: role % deja attribue -- fige', v_row.role
      using errcode = '55000';
  end if;

  -- Garde 3 -- one-shot.
  if v_row.role_claimed_at is not null then
    raise exception 'claim_signup_role: role deja reclame (%) -- immuable', v_row.role_claimed_at
      using errcode = '55000';
  end if;

  -- Garde 4 -- onboarding termine = role fige.
  if v_row.onboarding_complete is true then
    raise exception 'claim_signup_role: onboarding deja complete -- role fige'
      using errcode = '55000';
  end if;

  -- Garde 5 -- une fiche athlete existante fige le role.
  if exists (select 1 from public.athletes where user_id = v_uid) then
    raise exception 'claim_signup_role: fiche athlete existante -- role fige'
      using errcode = '55000';
  end if;

  -- Coherence role/context -- MIROIR EXACT de maybeApplySignupRole
  -- (app/auth/callback/route.ts). Web et mobile ne doivent pas diverger.
  --   COACH     -> context ∈ {scolaire, ligue_civile} (choix du picker)
  --   RECRUTEUR -> collegial (derive, pas un choix utilisateur)
  --   ATHLETE   -> context ignore ici (choisi a l'ecran 2 / onboarding)
  if p_role = 'COACH' and p_context in ('scolaire', 'ligue_civile') then
    v_context := p_context;
  elsif p_role = 'RECRUTEUR' then
    v_context := 'collegial';
  end if;

  update public.users
  set    role            = p_role::public.user_role,
         context         = coalesce(v_context, context),
         role_claimed_at = now()
  where  id = v_uid;

  return jsonb_build_object(
    'role',       p_role,
    'context',    v_context,
    'claimed_at', now()
  );
end;
$function$;

-- GATE — ACL en LISTE COMPLÈTE (jamais par inclusion), et présence des gardes.
do $$
declare
  r record;
  vus text[];
begin
  for r in
    select * from (values
      ('public.needs_signup_role()',            array['authenticated','postgres','service_role']),
      ('public.claim_signup_role(text, text)',  array['authenticated','postgres','service_role'])
    ) as v(f, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.f::regprocedure;
    if vus is distinct from r.veut then
      raise exception 'NEXUS: ACL de % = %, attendu %', r.f, vus, r.veut;
    end if;
    if (select prosrc from pg_proc where oid = r.f::regprocedure) not like '%array[''PARENT'', ''PARTNER'', ''ADMIN'']%' then
      raise exception 'NEXUS: la liste des rôles figés manque dans %', r.f;
    end if;
  end loop;
end $$;
