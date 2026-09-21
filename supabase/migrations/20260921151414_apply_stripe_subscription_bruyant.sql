/* ═══════════════════════════════════════════════════════════════
   apply_stripe_subscription — un refus d'écriture devient BRUYANT

   Le 2026-09-19, un paiement réel de 19,99 $ (livemode) a été encaissé
   et l'abonnement n'a jamais été activé. La RPC passait par
   `ON CONFLICT DO UPDATE ... WHERE subscriptions.tier_source = 'stripe'` ;
   la ligne du client portait `tier_source = 'admin_grant'` avec
   `tier = 'free'` ; l'UPDATE a été filtré : 0 ligne, AUCUNE exception.
   Le webhook a répondu 200 et Stripe n'a jamais réessayé.

   1. Le garde s'assouplit — un octroi admin qui vaut 'free' n'accorde
      RIEN et ne doit pas bloquer un paiement réel. Le premier paiement
      le convertit en 'stripe' : c'est exactement le geste appliqué à la
      main le 2026-09-19 sur a0000000-…-0000000000a1, automatisé.
   2. Un octroi admin RÉEL (pro / all_star) reste protégé, mais le refus
      LÈVE une exception nommée au lieu d'écrire zéro ligne en silence.
      `GET DIAGNOSTICS` attrape en plus tout zéro-écriture dont la cause
      n'aurait pas été prévue ici — y compris une future valeur de
      tier_source que le CHECK laisserait entrer.

   `tier_source` est NOT NULL, DEFAULT 'stripe', CHECK IN ('stripe',
   'admin_grant') — relevé 2026-09-19. Il n'y a donc pas de cas NULL à
   traiter, et les 263 lignes 'stripe'/'free' existantes passent comme
   avant.

   CREATE OR REPLACE conserve la signature (`returns void`) : pas de DROP,
   donc l'ACL n'est pas emportée. Le gate en fin de fichier la compare
   quand même INTÉGRALEMENT (règle du 2026-09-07). Les DEFAULT des deux
   derniers paramètres sont restitués pour la même raison qu'on restitue
   un `WITH (security_invoker)` : une redéfinition qui les omet les
   supprime sans rien dire.
═══════════════════════════════════════════════════════════════ */

create or replace function public.apply_stripe_subscription(
  p_user_id                uuid,
  p_tier                   text,
  p_status                 text,
  p_billing_cycle          text,
  p_stripe_subscription_id text,
  p_stripe_price_id        text,
  p_current_period_start   timestamptz,
  p_current_period_end     timestamptz,
  p_cancel_at_period_end   boolean     default false,
  p_canceled_at            timestamptz default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
set row_security to 'off'
as $function$
declare
  v_touche integer;
  v_source text;
  v_tier   text;
begin
  /* Une SEULE instruction : le verrou d'ON CONFLICT sérialise les
     livraisons concurrentes. Le 2026-09-19, trois événements sont
     arrivés en 800 ms — la concurrence est réelle, pas théorique.
     Un SELECT … FOR UPDATE suivi d'un UPDATE rouvrirait la course. */
  insert into public.subscriptions (
    user_id, tier, status, billing_cycle,
    stripe_subscription_id, stripe_price_id,
    current_period_start, current_period_end,
    cancel_at_period_end, canceled_at,
    tier_source, updated_at
  ) values (
    p_user_id, p_tier, p_status, p_billing_cycle,
    p_stripe_subscription_id, p_stripe_price_id,
    p_current_period_start, p_current_period_end,
    p_cancel_at_period_end, p_canceled_at,
    'stripe', now()
  )
  on conflict (user_id) do update set
    tier                    = excluded.tier,
    status                  = excluded.status,
    billing_cycle           = excluded.billing_cycle,
    stripe_subscription_id  = excluded.stripe_subscription_id,
    stripe_price_id         = excluded.stripe_price_id,
    current_period_start    = excluded.current_period_start,
    current_period_end      = excluded.current_period_end,
    cancel_at_period_end    = excluded.cancel_at_period_end,
    canceled_at             = excluded.canceled_at,
    tier_source             = 'stripe',
    updated_at              = now()
  where subscriptions.tier_source = 'stripe'
     -- ASSOUPLISSEMENT : un octroi admin à 'free' n'accorde rien.
     or (subscriptions.tier_source = 'admin_grant'
         and subscriptions.tier = 'free');

  get diagnostics v_touche = row_count;
  if v_touche = 1 then
    return;
  end if;

  -- Zéro écriture : on NOMME la cause au lieu de rendre un succès muet.
  select tier_source, tier into v_source, v_tier
    from public.subscriptions
   where user_id = p_user_id;

  raise exception using
    errcode = 'NX001',
    message = format(
      'NEXUS: apply_stripe_subscription a écrit %s ligne(s) pour user=%s '
      '(tier_source=%s, tier=%s). Un octroi admin réel ne peut pas être '
      'écrasé par Stripe — arbitrer à la main.',
      v_touche,
      p_user_id,
      coalesce(v_source, '<aucune ligne>'),
      coalesce(v_tier,   '<aucune ligne>')
    );
end;
$function$;

/* ── Gate d'ACL — comparaison COMPLÈTE, jamais par inclusion ──────
   CREATE OR REPLACE ne devrait pas toucher l'ACL. On ne le suppose pas :
   on la relève et on la compare en entier. Une liste blanche vérifiée
   par inclusion laisse entrer ce qu'elle n'a pas nommé. */
do $gate$
declare
  f oid := 'public.apply_stripe_subscription(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,timestamptz)'::regprocedure;
  vus  text[];
  veut text[] := array['postgres','service_role'];   -- relevé 2026-09-19
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x,'=',1),''),'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = f;
  if vus is distinct from veut then
    raise exception 'NEXUS: ACL = %, attendu %', vus, veut;
  end if;
end
$gate$;
