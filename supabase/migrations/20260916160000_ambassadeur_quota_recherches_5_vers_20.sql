-- ═══════════════════════════════════════════════════════════════════════════
-- Le quota de recherches ambassadeur passe de 5 à 20 par jour et par athlète.
-- Décision produit BP, 2026-09-16.
--
-- ── L'ARBITRAGE, ÉCRIT PLUTÔT QUE SOUS-ENTENDU ──────────────────────────
-- Ce compteur n'est pas un garde-fou de performance : c'est la BORNE
-- ANTI-ÉNUMÉRATION de la recherche de MINEURS. Il s'incrémente AVANT toute
-- lecture de la base des athlètes, et un refus le consomme quand même —
-- sans quoi on pourrait balayer la base en ne « payant » que les trouvailles.
--
-- BP la QUADRUPLE sciemment : 20 requêtes par jour et par athlète, refus
-- compris. La raison est produit — un ambassadeur qui vise le palier 10
-- déclare dix personnes, se trompe sur une orthographe, recommence avec un
-- courriel, corrige une école. À cinq, il tape le mur avant d'avoir fini et
-- doit revenir le lendemain. Le programme demande de l'élan ; le quota le
-- cassait.
--
-- Ce que ça coûte, et qui est assumé : la fenêtre d'énumération passe de 5 à
-- 20 noms de mineurs par jour et par compte athlète. Restent en place, et ce
-- sont eux qui portent vraiment la protection : le DISCRIMINANT obligatoire
-- (nom seul refusé — il faut courriel, école ou équipe), la projection
-- `ambassadeur_mon_tableau` qui ne rend JAMAIS l'identité trouvée (l'écran
-- n'affiche que ce que l'athlète a tapé), et le message de refus générique
-- qui ne dit pas si la personne existe.
--
-- Si la borne devait un jour se resserrer, c'est ici et dans la projection —
-- les deux, voir ci-dessous.
--
-- ── DEUX FONCTIONS, ET C'EST LE PIÈGE DE CE CHANTIER ────────────────────
-- Le « 5 » vivait à DEUX endroits, sans constante partagée :
--   · ambassadeur_revendiquer  → `v_max constant int := 5`   (LA RÈGLE)
--   · ambassadeur_mon_tableau  → `greatest(0, 5 - …)`        (L'AFFICHAGE)
-- N'en changer qu'un fait MENTIR l'écran : soit « il te reste 0 recherche »
-- alors qu'elles passent, soit « il te reste 15 » alors que la 6e est
-- refusée. Les deux bougent ensemble, et le gate ci-dessous le vérifie.
--
-- ⚠ DETTE NOMMÉE : il n'y a toujours pas de constante partagée. Le jour où le
-- quota rebouge, il rebouge AUX DEUX ENDROITS. Une table de configuration
-- serait le vrai correctif ; elle n'est pas dans ce chantier.
--
-- ── POURQUOI UNE SUBSTITUTION TEXTUELLE, PAS UN CREATE OR REPLACE COMPLET ─
-- `ambassadeur_revendiquer` fait plus de 400 lignes. La retaper pour changer
-- un seul littéral, c'est prendre le risque d'en abîmer une autre. On relit
-- donc le corps DÉPLOYÉ par pg_get_functiondef et on ne remplace QUE le
-- fragment visé — patron déjà employé par
-- 20260825144302 (apply_approved_suggestion) et documenté dans CLAUDE.md.
-- La substitution échoue BRUYAMMENT si le texte attendu a bougé : mieux vaut
-- une migration qui refuse de passer qu'une fonction à moitié réécrite.
--
-- Vérifié avant application : chaque fragment est UNIQUE dans sa fonction, et
-- le `palier = 5` de `ambassadeur_mon_tableau` — le seuil du BADGE, sans
-- rapport avec le quota — est distinct et doit survivre. Le gate le contrôle.
-- ═══════════════════════════════════════════════════════════════════════════

do $patch$
declare
  v_def    text;
  v_avant  constant text := 'constant int := 5;';
  v_apres  constant text := 'constant int := 20;';
  v_occ    int;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'ambassadeur_revendiquer';

  if v_def is null then
    raise exception 'NEXUS: ambassadeur_revendiquer introuvable';
  end if;

  v_occ := (length(v_def) - length(replace(v_def, v_avant, ''))) / length(v_avant);
  if v_occ <> 1 then
    raise exception 'NEXUS: « % » trouve % fois dans ambassadeur_revendiquer, 1 attendu — le corps a bouge, migration refusee', v_avant, v_occ;
  end if;

  execute replace(v_def, v_avant, v_apres);
end;
$patch$;

do $patch$
declare
  v_def    text;
  v_avant  constant text := 'greatest(0, 5 - coalesce(max(n), 0))';
  v_apres  constant text := 'greatest(0, 20 - coalesce(max(n), 0))';
  v_occ    int;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'ambassadeur_mon_tableau';

  if v_def is null then
    raise exception 'NEXUS: ambassadeur_mon_tableau introuvable';
  end if;

  v_occ := (length(v_def) - length(replace(v_def, v_avant, ''))) / length(v_avant);
  if v_occ <> 1 then
    raise exception 'NEXUS: « % » trouve % fois dans ambassadeur_mon_tableau, 1 attendu — le corps a bouge, migration refusee', v_avant, v_occ;
  end if;

  execute replace(v_def, v_avant, v_apres);
end;
$patch$;

-- ── GATE : le quota vaut 20 des DEUX cotes, et aucun 5 de quota ne survit ──
do $gate$
declare
  v_r text;
  v_t text;
begin
  select pg_get_functiondef(p.oid) into v_r from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='ambassadeur_revendiquer';
  select pg_get_functiondef(p.oid) into v_t from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='ambassadeur_mon_tableau';

  if position('constant int := 20;' in v_r) = 0 then
    raise exception 'NEXUS: v_max ne vaut pas 20 dans ambassadeur_revendiquer';
  end if;
  if position('constant int := 5;' in v_r) > 0 then
    raise exception 'NEXUS: un quota a 5 survit dans ambassadeur_revendiquer';
  end if;

  if position('greatest(0, 20 - coalesce(max(n), 0))' in v_t) = 0 then
    raise exception 'NEXUS: le restant ne se calcule pas sur 20 dans ambassadeur_mon_tableau';
  end if;
  if position('greatest(0, 5 - coalesce(max(n), 0))' in v_t) > 0 then
    raise exception 'NEXUS: un quota a 5 survit dans ambassadeur_mon_tableau';
  end if;

  -- Le seuil du BADGE (palier 5) n'a rien a voir avec le quota : il doit
  -- rester intact. Le confondre avec le quota serait la faute de ce chantier.
  if position('palier = 5' in v_t) = 0 then
    raise exception 'NEXUS: le seuil du badge (palier 5) a ete emporte par la substitution';
  end if;

  raise notice 'NEXUS: quota 20/jour pose des deux cotes, seuil du badge intact.';
end;
$gate$;
