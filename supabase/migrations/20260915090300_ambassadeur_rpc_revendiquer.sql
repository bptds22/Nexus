-- ═══════════════════════════════════════════════════════════════════════════
-- M4 — ambassadeur_revendiquer : la RPC centrale.
--
-- L'ORDRE DES GESTES EST LA SÉCURITÉ. Ce fichier ne se relit pas comme une
-- suite d'étapes interchangeables : chaque position a une raison.
--
--   1. identité            2. COMPTEUR      3. anti-auto-parrainage
--   4. concordance forte   5. faible        6. INSERT en bloc INTERNE
--
-- ── POURQUOI LE COMPTEUR AVANT TOUT LE RESTE ────────────────────────────
-- C'est la borne d'énumération, et elle compte TOUTES les tentatives,
-- réussies comprises (décision BP). Compter les seuls échecs laisserait
-- sonder sans limite quiconque tombe juste.
--
-- ── POURQUOI « INTROUVABLE » EST UN RETURN ET JAMAIS UN RAISE ───────────
-- C'est le point le plus facile à casser de tout le fichier. Un RAISE annule
-- la transaction, DONC l'incrément du compteur qu'on vient d'écrire. Une
-- recherche infructueuse qui lèverait serait donc GRATUITE : le compteur
-- reviendrait à sa valeur d'avant, et l'énumération redeviendrait illimitée —
-- exactement ce que le compteur existe pour empêcher.
-- Tous les refus métier (introuvable, déjà parrainée, soi-même) sont donc des
-- RETURN structurés. Seuls le dépassement de quota et l'absence de session
-- lèvent, et pour eux l'annulation est SANS EFFET : le quota est déjà atteint,
-- le compteur plafonne à 5 et chaque tentative suivante relève. Conséquence
-- assumée de ce choix : au-delà de 5, l'acharnement n'est pas visible dans le
-- compteur, qui reste à 5.
--
-- ── POURQUOI LE HANDLER unique_violation EST DANS UN BLOC INTERNE ───────
-- En plpgsql, TOUT bloc portant une clause EXCEPTION ouvre une
-- sous-transaction. Attrapé au niveau de la fonction, le handler annulerait
-- tout ce qui précède — Y COMPRIS L'INCRÉMENT DU COMPTEUR. Provoquer
-- volontairement la collision deviendrait alors une remise à zéro gratuite.
-- Les deux précédents du dépôt (claim_parent_invitation ligne 105,
-- create_team_join_token ligne 136) ne montrent pas ce piège : ni l'un ni
-- l'autre n'a d'écriture à préserver avant l'INSERT. Nous, si.
--
-- ── ZÉRO STOCKAGE DES RECHERCHES REFUSÉES, SUR TROIS FRONTS ─────────────
--   · table    — ambassadeur_tentatives n'a aucune colonne texte ;
--   · messages — AUCUN raise n'interpole le terme cherché. Un
--                `raise 'NEXUS: rien pour %', p_nom` écrirait le nom en clair
--                dans les journaux Postgres, lisibles via query_logs ;
--   · journaux — la recherche reste O(1) sur les index existants, donc hors
--                de portée de log_min_duration_statement.
-- Une ligne de ambassadeur_revendications n'est écrite QUE si au moins une
-- personne inscrite a été trouvée.
--
-- ── AU MOINS UN DISCRIMINANT EST EXIGÉ ──────────────────────────────────
-- Un nom seul, sans courriel ni école ni équipe, balaierait toute la base :
-- ce serait l'outil d'énumération qu'on cherche à interdire. La fonction
-- refuse. Ce n'est pas une commodité d'interface, c'est la garde.
--
-- ── LES DISCRIMINANTS DE LA FILE ADMIN (décision BP, 2026-09-15) ────────
-- Deux homonymes de même école et de même équipe sont STRICTEMENT
-- indistinguables à l'écran — constaté en recette, l'administrateur ne pouvait
-- pas trancher. `candidats` porte donc aussi `promotion` (annee_diplomation)
-- et `courriel_masque`.
--
-- LE MASQUE EST IRRÉVERSIBLE, ET C'EST TOUT L'INTÉRÊT. Il donne assez pour
-- reconnaître (« samu•••@exe••• » vs « stre•••@gma••• ») et pas assez pour
-- écrire à la personne ni pour confirmer une adresse devinée.
--
-- ⚠ CE CHAMP NE SORT JAMAIS VERS LE PARRAIN. `candidats` n'est lu que par
-- l'administrateur (policy `ambassadeur revendications admin read`,
-- is_admin()), et ambassadeur_mon_tableau() ne le projette pas. Un courriel
-- même masqué reste une donnée de tiers mineur.
--
-- ── LA TOLÉRANCE ORTHOGRAPHIQUE (décision BP, 2026-09-15) ───────────────
-- L'utilisateur SAIT qui il veut déclarer, il ne sait pas l'ÉCRIRE. Exiger
-- l'orthographe exacte, c'est refuser une vraie recrue pour une lettre.
--
-- LE RÉFLEXE — un autocomplete — EST EXACTEMENT CE QU'ON INTERDIT. Un moteur
-- qui suggère des noms de mineurs à tout compte connecté est un annuaire de
-- mineurs, et c'est la chose que toute cette RPC existe pour empêcher.
--
-- La sortie : ASSOUPLIR LA CONCORDANCE SANS RIEN EXPOSER. Le serveur pardonne
-- la faute, ne montre jamais rien, et rend le même verdict binaire. Aucune
-- suggestion, aucune liste, aucun « vouliez-vous dire » — ce dernier serait
-- l'oracle par la porte arrière, un test d'existence à la lettre près.
--
-- ⚠ LE PÉRIMÈTRE EST OBLIGATOIRE POUR L'APPROXIMATIF. Un flou sans école ni
-- équipe balaierait toute la base à deux lettres près : ce serait un moteur
-- de recherche sur des mineurs. C'est l'école/équipe qui fait la précision,
-- pas l'orthographe — dans une équipe de vingt, « alex » + Wildcats n'a
-- qu'un seul candidat plausible. La garde tient dans le fait que les deux
-- disjonctions du WHERE sont fausses quand les deux paramètres sont nuls :
-- aucune ligne ne sort, et le verdict est « introuvable ».
--
-- ── DEUX EXTENSIONS, ET POURQUOI unaccent N'EST PAS DU CONFORT ──────────
-- `fuzzystrmatch` donne levenshtein_less_equal(), une distance BORNÉE qui
-- court-circuite dès qu'elle dépasse le plafond — en C, pas en plpgsql. Une
-- seconde implémentation maison serait plus lente et à re-prouver.
--
-- `unaccent` n'était PAS installé, contrairement à ce que supposait le
-- cahier des charges, et la différence est décisive. Mesuré le 2026-09-15 :
--     levenshtein('alexy tremblay', 'alexis tremblay')  = 2   ← passe
--     levenshtein('eric cote',      'éric côté')        = 3   ← ÉCHOUE
-- Sans unaccent, les accents MANGENT tout le budget de fautes et « Éric
-- Côté » devient introuvable même sans faute de frappe. Sur des noms
-- québécois, ce n'est pas un cas limite, c'est le cas courant. Les deux
-- extensions partent donc ensemble.
--
-- Elles vivent dans le schéma `extensions` (comme pgcrypto, pg_net,
-- uuid-ossp) et sont appelées QUALIFIÉES : le search_path de la fonction est
-- épinglé à 'public','pg_temp', il ne les verrait pas autrement.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists fuzzystrmatch with schema extensions;
create extension if not exists unaccent      with schema extensions;

-- ── Normalisation partagée des noms ─────────────────────────────────────
-- Utilisée par les DEUX chemins, strict et approximatif. Le tiret devient une
-- espace, donc « Marc-Antoine » et « Marc Antoine » sont le MÊME nom pour le
-- chemin strict — ils ne consomment pas le budget de fautes, ils n'en ont pas
-- besoin.
--
-- STABLE et non IMMUTABLE : unaccent dépend d'un dictionnaire de recherche
-- plein-texte, qui peut être rechargé. La conséquence pratique est qu'on ne
-- peut pas l'indexer telle quelle — ce n'est pas un problème ici, la
-- concordance faible est toujours bornée par une école ou une équipe, donc
-- par un index existant sur school_id / team_athletes.
create or replace function public.nexus_normaliser_nom(p_nom text)
  returns text
  language sql
  stable
  set search_path to 'public', 'extensions', 'pg_temp'
as $fn$
  select nullif(
    btrim(regexp_replace(
      lower(extensions.unaccent(replace(coalesce(p_nom, ''), '-', ' '))),
      '\s+', ' ', 'g')), '');
$fn$;

comment on function public.nexus_normaliser_nom(text) is
$c$Forme comparable d'un nom : minuscules, sans accents, tiret = espace,
espaces multiples réduites. « Marc-Antoine Côté » → « marc antoine cote ».

STABLE (pas IMMUTABLE) : unaccent dépend d'un dictionnaire. Ne pas l'indexer
sans wrapper IMMUTABLE assumé.

C'est la SEULE définition de « même nom » du programme Ambassadeur : le chemin
strict et le chemin approximatif l'appellent tous les deux, sinon ils
divergeraient sur les accents.$c$;

revoke all on function public.nexus_normaliser_nom(text) from public, anon;
grant execute on function public.nexus_normaliser_nom(text) to authenticated;

-- ── Le masque ───────────────────────────────────────────────────────────
-- « samuel.tremblay@exemple.com » → « samu•••@exe••• ».
-- IMMUTABLE : la sortie ne dépend que de l'entrée, donc le planner peut la
-- replier et elle reste utilisable dans un index si le besoin venait.
-- Une adresse plus courte que la fenêtre n'est PAS rallongée par du
-- remplissage : masquer « al@bc.co » en « al••@bc•• » inventerait des
-- caractères et ferait croire à une adresse plus longue qu'elle n'est.
create or replace function public.masquer_courriel(p_courriel text)
  returns text language sql immutable
as $fn$
  select case
    when nullif(btrim(coalesce(p_courriel, '')), '') is null then null
    when position('@' in btrim(p_courriel)) = 0 then '•••'
    -- rtrim sur le point : un domaine court comme « bc.co » se coupe en
    -- « bc. » et donnerait « bc.••• », qui se lit comme un point manquant.
    else left(split_part(btrim(p_courriel), '@', 1), 4) || '•••'
         || '@' || rtrim(left(split_part(btrim(p_courriel), '@', 2), 3), '.') || '•••'
  end;
$fn$;

comment on function public.masquer_courriel(text) is
$c$Masque irréversible pour la file admin du programme Ambassadeur :
4 premiers caractères de la partie locale, 3 du domaine, le reste en •••.

Assez pour DISTINGUER deux homonymes, pas assez pour écrire à la personne ni
pour confirmer une adresse devinée. Ne jamais l'exposer au parrain — c'est une
donnée de tiers, souvent mineur.$c$;

revoke all on function public.masquer_courriel(text) from public, anon;
grant execute on function public.masquer_courriel(text) to authenticated;

create or replace function public.ambassadeur_revendiquer(
  p_prenom   text,
  p_nom      text,
  p_courriel text default null,
  p_ecole_id uuid default null,
  p_team_id  uuid default null)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
  set row_security to 'off'
as $fn$
declare
  v_uid       uuid;
  v_parrain   uuid;
  v_prenom    text;
  v_nom       text;
  v_courriel  text;
  v_jour      date;
  v_n         int;
  v_max       constant int := 5;
  v_ids       uuid[];
  v_cible     uuid;
  v_methode   text;
  v_statut    text;
  v_candidats jsonb;
  v_id        uuid;
begin
  -- ── 1. Identité ───────────────────────────────────────────────────────
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NEXUS: tu dois etre connecte pour declarer une recrue.';
  end if;

  select a.id into v_parrain
    from public.athletes a
   where a.user_id = v_uid
   limit 1;

  if v_parrain is null then
    raise exception 'NEXUS: seul un athlete peut declarer une recrue.';
  end if;

  -- ── 2. COMPTEUR — avant toute lecture de la base des athlètes ─────────
  -- Jour de MONTRÉAL : Postgres et pg_cron sont en UTC, et le quota d'un
  -- athlète ne doit pas basculer à 20 h.
  v_jour := (now() at time zone 'America/Montreal')::date;

  insert into public.ambassadeur_tentatives (athlete_id, jour, n)
  values (v_parrain, v_jour, 1)
  on conflict (athlete_id, jour)
    do update set n = public.ambassadeur_tentatives.n + 1
  returning n into v_n;

  if v_n > v_max then
    -- Message générique : le terme cherché n'y figure PAS (front « messages »).
    raise exception 'NEXUS: tu as atteint la limite de recherches pour aujourd''hui. Reessaie demain.';
  end if;

  -- ── 3. Normalisation + garde du discriminant ─────────────────────────
  -- Une seule définition de « même nom » : accents retirés, tiret = espace.
  -- Voir nexus_normaliser_nom — les chemins strict et approximatif s'en
  -- servent tous les deux, sinon ils divergeraient.
  v_prenom   := coalesce(public.nexus_normaliser_nom(p_prenom), '');
  v_nom      := coalesce(public.nexus_normaliser_nom(p_nom), '');
  v_courriel := nullif(lower(btrim(coalesce(p_courriel, ''))), '');

  if v_prenom = '' or v_nom = '' then
    return jsonb_build_object('ok', false, 'motif', 'saisie_incomplete');
  end if;

  if length(v_prenom) > 100 or length(v_nom) > 100 or length(coalesce(v_courriel, '')) > 200 then
    return jsonb_build_object('ok', false, 'motif', 'saisie_incomplete');
  end if;

  -- Sans discriminant, un nom seul balaierait toute la base : refus.
  if v_courriel is null and p_ecole_id is null and p_team_id is null then
    return jsonb_build_object('ok', false, 'motif', 'discriminant_requis');
  end if;

  -- ── 4. Anti-auto-parrainage ───────────────────────────────────────────
  -- Par le courriel : un athlète connaît sa propre adresse, pas son uuid.
  -- La contrainte ambassadeur_pas_soi_meme couvre l'id ; celle-ci couvre le
  -- chemin par lequel un athlète y arriverait réellement.
  if v_courriel is not null and exists (
       select 1 from public.athletes a
        left join public.users u on u.id = a.user_id
        where a.id = v_parrain
          and (lower(btrim(coalesce(a.email, ''))) = v_courriel
            or lower(btrim(coalesce(u.email, ''))) = v_courriel)
     ) then
    return jsonb_build_object('ok', false, 'motif', 'soi_meme');
  end if;

  -- ── 5. CONCORDANCE FORTE — le courriel ────────────────────────────────
  -- Union des DEUX adresses. athletes.email et users.email coïncident sur
  -- 99/99 aujourd'hui, mais notify_team_invitation_email fait déjà
  -- coalesce(a.email, u.email) pour une raison réelle : un athlète inscrit
  -- par Apple avec relais privé porte une adresse de compte que personne
  -- d'autre ne connaît. Interroger une seule des deux le rendrait invisible.
  -- O(1) : athletes_email_lower_btrim_uniq et users_email_key sont uniques.
  if v_courriel is not null then
    select array_agg(a.id) into v_ids
      from public.athletes a
      left join public.users u on u.id = a.user_id
     where a.status = 'ACTIF'
       and a.user_id is not null
       and a.id <> v_parrain
       and (lower(btrim(coalesce(a.email, ''))) = v_courriel
         or lower(btrim(coalesce(u.email, ''))) = v_courriel);

    if coalesce(array_length(v_ids, 1), 0) = 1 then
      v_cible   := v_ids[1];
      v_methode := 'courriel';
      v_statut  := 'CONFIRMEE';
    end if;
  end if;

  -- ── 6. CONCORDANCE FAIBLE — nom + (école OU équipe) ──────────────────
  -- Élargie à l'équipe le 2026-09-15 : un filleul de ligue civile sans
  -- school_id doit rester trouvable par son équipe (team_athletes → teams).
  -- État constaté ce jour-là : 0 athlète revendicable est « sans école MAIS
  -- avec équipe », donc cette branche ne rattrape encore personne. Elle est
  -- écrite pour la population à venir, et pour l'ami qui connaît le nom de
  -- l'équipe sans connaître celui du club.
  if v_cible is null then
    select array_agg(a.id) into v_ids
      from public.athletes a
     where a.status = 'ACTIF'
       and a.user_id is not null
       and a.id <> v_parrain
       and public.nexus_normaliser_nom(a.first_name) = v_prenom
       and public.nexus_normaliser_nom(a.last_name)  = v_nom
       and (
             (p_ecole_id is not null and a.school_id = p_ecole_id)
          or (p_team_id  is not null and exists (
                select 1 from public.team_athletes ta
                 where ta.athlete_id = a.id and ta.team_id = p_team_id))
       );

    v_methode := case when p_ecole_id is not null then 'nom_ecole' else 'nom_equipe' end;

    -- ── 6 bis. TOLÉRANCE ORTHOGRAPHIQUE ────────────────────────────────
    -- Seulement si l'exact n'a RIEN donné : une correspondance exacte n'a
    -- jamais à être départagée par une approximation.
    --
    -- Budget de DEUX éditions sur le nom COMPLET, pas deux par champ : deux
    -- par champ autoriserait quatre fautes et rapprocherait des noms qui ne
    -- se ressemblent plus. « alexy tremblay » → « alexis tremblay » vaut
    -- exactement 2 (mesuré) : le plafond est donc le minimum qui rende le
    -- service, pas un choix confortable.
    --
    -- levenshtein_less_equal court-circuite au plafond et rend min(d, max+1),
    -- d'où le test `<= 2` et non `= `.
    --
    -- LE PÉRIMÈTRE EST LA GARDE. Les deux disjonctions ci-dessous sont
    -- fausses quand p_ecole_id ET p_team_id sont nuls : la requête ne rend
    -- alors aucune ligne, et le verdict retombe sur « introuvable ». Le flou
    -- ne peut donc JAMAIS balayer la base entière — c'est la condition pour
    -- qu'assouplir ne rouvre pas l'oracle.
    if coalesce(array_length(v_ids, 1), 0) = 0 then
      select array_agg(a.id) into v_ids
        from public.athletes a
       where a.status = 'ACTIF'
         and a.user_id is not null
         and a.id <> v_parrain
         and (
               (p_ecole_id is not null and a.school_id = p_ecole_id)
            or (p_team_id  is not null and exists (
                  select 1 from public.team_athletes ta
                   where ta.athlete_id = a.id and ta.team_id = p_team_id))
         )
         and extensions.levenshtein_less_equal(
               coalesce(public.nexus_normaliser_nom(a.first_name), '') || ' '
                 || coalesce(public.nexus_normaliser_nom(a.last_name), ''),
               v_prenom || ' ' || v_nom,
               2) <= 2;

      if coalesce(array_length(v_ids, 1), 0) > 0 then
        -- Traçabilité : l'admin doit pouvoir distinguer une confirmation
        -- obtenue au mot près d'une obtenue à deux lettres près.
        v_methode := 'nom_approx';
      end if;
    end if;

    if coalesce(array_length(v_ids, 1), 0) = 1 then
      v_cible  := v_ids[1];
      v_statut := 'CONFIRMEE';
    elsif coalesce(array_length(v_ids, 1), 0) > 1 then
      -- Homonymie RÉELLE : il en existe déjà une en prod, deux athlètes de
      -- même prénom, même nom ET même école. L'administrateur tranche.
      v_statut := 'EN_ATTENTE';
      -- promotion + courriel masqué : SANS eux, deux homonymes de même école
      -- et même équipe sont identiques à l'écran et l'admin ne peut pas
      -- trancher (constaté en recette). Ne sortent jamais vers le parrain.
      select jsonb_agg(jsonb_build_object(
               'athlete_id',      a.id,
               'prenom',          a.first_name,
               'nom',             a.last_name,
               'ecole',           s.name,
               'promotion',       a.annee_diplomation,
               'courriel_masque', public.masquer_courriel(coalesce(a.email, u.email)),
               'equipe',          (select t.name from public.team_athletes ta
                                    join public.teams t on t.id = ta.team_id
                                   where ta.athlete_id = a.id
                                   order by ta.joined_at desc nulls last limit 1)))
        into v_candidats
        from public.athletes a
        left join public.schools s on s.id = a.school_id
        left join public.users   u on u.id = a.user_id
       where a.id = any(v_ids);
    end if;
  end if;

  -- ── 7. Rien trouvé → RIEN N'EST ÉCRIT ────────────────────────────────
  -- RETURN, jamais RAISE : voir l'en-tête. L'incrément du compteur doit
  -- survivre à ce chemin, c'est lui qui borne l'énumération.
  if v_cible is null and v_statut is distinct from 'EN_ATTENTE' then
    return jsonb_build_object('ok', false, 'motif', 'introuvable');
  end if;

  -- ── 8. INSERT — bloc INTERNE, pour ne pas annuler le compteur ────────
  begin
    insert into public.ambassadeur_revendications (
      parrain_athlete_id, prenom, nom, courriel_normalise,
      ecole_id, team_id, filleul_athlete_id, candidats,
      methode, statut, confirmee_le)
    values (
      v_parrain, btrim(p_prenom), btrim(p_nom),
      -- Le courriel n'est CONSERVÉ que s'il a servi à la concordance. Saisi
      -- puis resté sans correspondance, c'est l'adresse d'un tiers que rien
      -- ne rattache à la revendication : on ne la garde pas. Minimisation
      -- Loi 25, et cohérent avec « zéro stockage des recherches refusées ».
      case when v_methode = 'courriel' then v_courriel else null end,
      p_ecole_id, p_team_id, v_cible, v_candidats,
      v_methode, v_statut,
      case when v_statut = 'CONFIRMEE' then now() else null end)
    returning id into v_id;
  exception when unique_violation then
    -- Course, ou doublon du même parrain. On ne dit JAMAIS laquelle des trois
    -- contraintes a parlé : le nom de l'index révélerait « cette personne est
    -- déjà revendiquée par quelqu'un d'autre ». Un motif unique, opaque.
    return jsonb_build_object('ok', false, 'motif', 'deja_parrainee');
  end;

  return jsonb_build_object(
    'ok',     true,
    'id',     v_id,
    'statut', v_statut,
    'motif',  case when v_statut = 'CONFIRMEE' then 'confirmee' else 'en_attente' end);
end;
$fn$;

revoke all on function public.ambassadeur_revendiquer(text, text, text, uuid, uuid)
  from public, anon;
grant execute on function public.ambassadeur_revendiquer(text, text, text, uuid, uuid)
  to authenticated;

comment on function public.ambassadeur_revendiquer(text, text, text, uuid, uuid) is
$c$Déclare une recrue. Ne trouve QUE des personnes déjà inscrites
(status ACTIF + compte). Aucune règle temporelle : la date d'inscription
n'entre nulle part.

Retour jsonb — {ok, motif} toujours, {id, statut} quand ok :
  ok:true  confirmee    · concordance certaine, le palier peut bouger
  ok:true  en_attente   · homonymie, l'administrateur tranchera
  ok:false introuvable  · RIEN n'est écrit
  ok:false deja_parrainee · course ou doublon — volontairement indistinctes
  ok:false soi_meme / discriminant_requis / saisie_incomplete

Lève (et seulement dans ces deux cas) : pas de session, quota du jour dépassé.

Le compteur ambassadeur_tentatives est incrémenté AVANT toute lecture, et
tous les refus métier sont des RETURN — un RAISE annulerait l'incrément et
rendrait l'énumération gratuite.$c$;
