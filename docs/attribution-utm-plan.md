# Attribution d'inscription first-party (UTM) — PLAN, rien d'appliqué

Décision BP 2026-10-07 : à l'inscription, conserver `utm_source`,
`utm_medium`, `utm_campaign` de l'URL d'arrivée, **dans notre base, pour
tous les rôles (athlètes compris)**. **Rien ne part chez Meta.** BP calcule
le coût par inscription athlète lui-même depuis Supabase.

Statut : plan + DDL brouillon. **Aucune migration appliquée, ni locale ni
prod.** Prod seulement sur GO explicite de BP.

## Choix : sessionStorage, pas de cookie

| | sessionStorage (retenu) | Cookie 1st-party après consentement |
|---|---|---|
| Lié au bandeau Meta ? | Non — couvre aussi ceux qui refusent | Oui — perd tous les « Refuser » et tous les athlètes qui ne voient pas le bandeau |
| Survit à OAuth Google/Apple ? | Oui (même onglet, même origine au retour) | Oui |
| Survit à un retour le lendemain ? | Non (onglet fermé = perdu) | Oui (30 j) |
| Visible du serveur ? | Non | Oui |
| Persistance hors session | Aucune | 30 j sur l'appareil |

Le bandeau actuel ne parle que des « témoins de mesure… et nos
publicités » : y suspendre une attribution interne mêlerait deux finalités.
sessionStorage ne laisse rien sur l'appareil après l'onglet, ne sert qu'à
nous, et n'a pas besoin du bandeau. Le prix : une inscription faite dans un
autre onglet ou un autre jour n'est pas attribuée — acceptable pour une
mesure de coût par campagne (on sous-compte, on ne fabrique rien).

**À valider côté légal (BP) :** l'UTM rattachée à un compte est un
renseignement de plus sur la personne (souvent mineure). À mentionner dans
la politique (finalité : mesurer l'efficacité de nos campagnes), à inclure
dans l'export `/admin/loi25`, et durée de conservation à fixer (proposé :
24 mois, purge pg_cron comme `search_filter_events`).

## Flux

1. **Capture (premier contact de l'onglet)** — `lib/attribution/utm.ts`,
   appelé par un composant client global monté dans `app/layout.tsx`, web
   seulement. À l'arrivée, si l'URL porte au moins un des trois `utm_*` et
   que rien n'est encore mémorisé : `sessionStorage["nx_utm"] =
   {source, medium, campaign}`, chaque valeur normalisée (minuscules,
   `[a-z0-9_.-]`, ≤ 100 car., sinon ignorée). Jamais d'autre paramètre,
   jamais l'URL complète.
2. **Écriture (un seul point d'appel, tous les chemins d'inscription)** —
   le même composant, dès qu'une session existe et que `nx_utm` est présent
   et pas encore envoyé : `rpc('enregistrer_attribution_inscription', …)`,
   puis marque `nx_utm_envoye`. Couvre `/auth`, `/auth/pro`, `/claim`,
   OAuth et `/inscription/role` sans toucher à chaque formulaire.
3. **La base décide** : la RPC n'écrit que pour `auth.uid()`, que si le
   compte a moins d'1 h, et une seule fois (`on conflict do nothing`). Un
   compte ancien qui revient par une pub n'est donc jamais réattribué.

## DDL brouillon (non appliqué)

```sql
create table public.inscription_attribution (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  utm_source   text check (utm_source   is null or utm_source   ~ '^[a-z0-9_.-]{1,100}$'),
  utm_medium   text check (utm_medium   is null or utm_medium   ~ '^[a-z0-9_.-]{1,100}$'),
  utm_campaign text check (utm_campaign is null or utm_campaign ~ '^[a-z0-9_.-]{1,100}$'),
  cree_le      timestamptz not null default now(),
  check (coalesce(utm_source, utm_medium, utm_campaign) is not null)
);
alter table public.inscription_attribution enable row level security;
-- Aucune policy : lecture par le service/SQL admin seulement.
revoke all on public.inscription_attribution from public, anon, authenticated;

create function public.enregistrer_attribution_inscription(
  p_utm_source text, p_utm_medium text, p_utm_campaign text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  n text := '^[a-z0-9_.-]{1,100}$';
  s text := nullif(lower(btrim(p_utm_source)), '');
  m text := nullif(lower(btrim(p_utm_medium)), '');
  c text := nullif(lower(btrim(p_utm_campaign)), '');
begin
  if v_uid is null then return; end if;
  if not exists (select 1 from auth.users u
                  where u.id = v_uid and u.created_at > now() - interval '1 hour') then
    return;
  end if;
  if s !~ n then s := null; end if;
  if m !~ n then m := null; end if;
  if c !~ n then c := null; end if;
  if coalesce(s, m, c) is null then return; end if;
  insert into public.inscription_attribution (user_id, utm_source, utm_medium, utm_campaign)
  values (v_uid, s, m, c)
  on conflict (user_id) do nothing;
end $$;

-- ACL : revoke PUBLIC + ce que les default privileges ajoutent (anon !),
-- puis grant authenticated seulement.
revoke all on function public.enregistrer_attribution_inscription(text, text, text) from public, anon;
grant execute on function public.enregistrer_attribution_inscription(text, text, text) to authenticated;

-- Gate ACL : liste COMPLÈTE triée (règle CLAUDE.md, jamais par inclusion).
do $$
declare f oid := 'public.enregistrer_attribution_inscription(text,text,text)'::regprocedure;
        vus text[]; veut text[] := array['authenticated','postgres','service_role'];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = f;
  if vus is distinct from veut then raise exception 'NEXUS: ACL = %, attendu %', vus, veut; end if;
end $$;
```

### Lecture admin — `/admin/campagnes` (page livrée sur la branche)

Comptes seulement, jamais une ligne par personne. Fenêtre fermée à 7 ou
30 jours. Les inscriptions sans UTM ressortent en « (sans campagne) » pour
que le total colle au nombre réel de comptes créés.

```sql
create function public.admin_inscriptions_par_campagne(p_jours int)
returns table (campagne text, source text,
               athletes bigint, coachs bigint, recruteurs bigint, parents bigint, total bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'NEXUS: réservé à l''admin plateforme' using errcode = '42501';
  end if;
  if p_jours is null or p_jours not in (7, 30) then
    raise exception 'NEXUS: fenêtre 7 ou 30 jours' using errcode = '22023';
  end if;
  return query
  select a.utm_campaign, a.utm_source,
         count(*) filter (where u.role = 'ATHLETE'),
         count(*) filter (where u.role = 'COACH'),
         count(*) filter (where u.role = 'RECRUTEUR'),
         count(*) filter (where u.role = 'PARENT'),
         count(*)
    from public.users u
    left join public.inscription_attribution a on a.user_id = u.id
   where u.created_at >= now() - make_interval(days => p_jours)
     and u.role in ('ATHLETE', 'COACH', 'RECRUTEUR', 'PARENT')
   group by a.utm_campaign, a.utm_source
   order by count(*) desc, a.utm_campaign nulls last, a.utm_source nulls last;
end $$;
revoke all on function public.admin_inscriptions_par_campagne(int) from public, anon;
grant execute on function public.admin_inscriptions_par_campagne(int) to authenticated;
-- + même gate ACL liste complète que ci-dessus.
```

Colonnes de sortie nommées `campagne` / `source` (pas `utm_*`) : en
plpgsql, un paramètre OUT homonyme d'une colonne rend la requête ambiguë.

`veut` est à confirmer au premier apply local (relever l'ACL réelle avant
de figer la liste).

## Preuves prévues (local Docker d'abord)

- authenticated, compte < 1 h → 1 ligne ; second appel → toujours 1 ligne.
- compte > 1 h → 0 ligne. anon → `permission denied`. Valeur hors motif → NULL.
- `select` direct sur la table sous authenticated → refusé.
- Requête de BP : inscriptions par `utm_campaign` × `users.role`.
