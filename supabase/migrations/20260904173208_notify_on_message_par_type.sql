-- ═══════════════════════════════════════════════════════════════
-- notify_on_message — LES DESTINATAIRES DÉPENDENT DU TYPE DE FIL
--
-- CONSTAT (prod, 2026-09-04 17:21) : un parent écrit à un coach sur un fil
-- PARENT_COACH ; le téléphone de l'ATHLÈTE reçoit « Tu as un nouveau
-- message ». L'athlète n'est pas partie à ce fil — et aucune policy RLS ne
-- lui permet de l'ouvrir. Notifié pour quelque chose qu'il ne peut pas lire.
--
-- ── LA CAUSE ────────────────────────────────────────────────────────────
-- L'ancienne version prenait TOUTE colonne d'identifiant non nulle de la
-- ligne `conversations` — recruiter_id, coach_id, coach_b_id, parent_id, et
-- l'utilisateur derrière athlete_id — moins l'expéditeur. Sans jamais
-- regarder `conversation_type`.
-- Or `athlete_id` ne veut pas dire « destinataire ». Sur un PARENT_COACH ou
-- un RECRUTEUR_COACH, il désigne l'athlète DONT ON PARLE. Le code confondait
-- le sujet et le destinataire.
--
-- Ce n'était pas une étourderie : il a été écrit quand la messagerie n'avait
-- que deux ou trois types, où « toutes les colonnes remplies » se trouvait
-- coïncider avec « les participants ». L'enum en compte SEPT aujourd'hui.
--
-- ── L'ÉTENDUE MESURÉE AVANT CORRECTION (prod, 2026-09-04) ───────────────
--   RECRUTEUR_COACH    6 fils / 9 msg  — athlete_id sur 6/6 : l'athlète était
--                      notifié de CHAQUE échange recruteur↔coach à son sujet.
--                      Le plus grave, et le moins visible.
--   PARENT_COACH       1 fil  / 1 msg  — le cas signalé.
--   COACH_COACH        3 fils / 5 msg  — athlete_id sur 1 fil.
--   GROUP              5 fils / 11 msg — bug INVERSE : aucune colonne n'est
--                      remplie sur un GROUP, donc AUCUNE notification depuis
--                      toujours.
--   ADMIN_USER         81 fils / 148 msg — `admin_id` n'était dans AUCUNE
--                      branche : une réponse d'athlète à la messagerie Équipe
--                      Nexus ne prévenait jamais l'admin.
--   ATHLETE_COACH, RECRUTEUR_ATHLETE : corrects par coïncidence.
--
-- ── L'INVARIANT, ET SA LIMITE EXACTE ────────────────────────────────────
-- « Ne notifier personne HORS de l'ensemble que la RLS laisse lire le fil. »
-- C'est une INCLUSION, pas une égalité — et la nuance est délibérée :
-- `group_conversations_select` laisse aussi lire une autorité scolaire
-- (`is_group_school_authority`), qui peut consulter un groupe sans en être
-- destinataire. Pouvoir lire est un PLAFOND, pas une cible. On notifie les
-- adressés ; on ne notifie jamais quelqu'un qui n'aurait rien à ouvrir.
--
-- ── GROUP : TOUS LES PARTICIPANTS ───────────────────────────────────────
-- Décision BP. Vérifié avant d'écrire : `conversation_participants` porte
-- `joined_at` mais AUCUN `left_at`, et `is_group_participant()` est un simple
-- EXISTS sur l'appartenance. La notion de « départ » n'existe pas dans le
-- schéma — on notifie donc tous les membres, le standard. Le jour où un
-- `left_at` apparaît, c'est ici qu'il faut le filtrer.
--
-- ── ADMIN_USER : L'ADMIN AUSSI ──────────────────────────────────────────
-- Décision BP. La branche liste `admin_id` PLUS toutes les contreparties
-- possibles (athlète, coach, recruteur, parent) : sur un fil ADMIN_USER une
-- seule d'entre elles est renseignée, les autres sont nulles et tombent au
-- filtre. Écrire les cinq évite d'avoir à deviner laquelle porte la
-- contrepartie — et de se tromper si une sixième arrive.
--
-- ── LE GARDE-FOU REFUSE L'APPLICATION ───────────────────────────────────
-- En fin de fichier, un bloc compare les étiquettes de l'enum
-- `conversation_type` au code de la fonction et LÈVE si l'une manque. Le
-- défaut d'aujourd'hui vient d'un code écrit avant trois types ; au huitième,
-- la migration échouera au lieu de laisser un type sans destinataires.
-- Le `case` sans `else` renvoie NULL pour un type inconnu, et la fonction
-- journalise un warning explicite plutôt que de notifier au hasard — ceinture
-- en plus des bretelles.
--
-- Propriétés conservées à l'identique : SECURITY DEFINER, search_path
-- épinglé, row_security off, AFTER INSERT ON messages FOR EACH ROW.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.notify_on_message()
 returns trigger
 language plpgsql
 volatile
 security definer
 set search_path to 'public', 'pg_temp'
 set row_security to off
as $function$
declare
  v_secret       text;
  v_url          text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-push';
  c              public.conversations;
  v_athlete_user uuid;
  v_dest         uuid[];
  r              uuid;
begin
  begin
    select decrypted_secret into v_secret
      from vault.decrypted_secrets
     where name = 'PUSH_DISPATCH_SECRET'
     limit 1;

    if v_secret is null then
      raise warning 'notify_on_message: PUSH_DISPATCH_SECRET absent du Vault';
      return null;
    end if;

    select * into c from public.conversations where id = NEW.conversation_id;
    if c.id is null then
      raise warning 'notify_on_message: conversation % introuvable', NEW.conversation_id;
      return null;
    end if;

    -- L'utilisateur DERRIERE la fiche athlete. Resolu une fois, utilise
    -- uniquement par les branches ou l'athlete est vraiment destinataire.
    select a.user_id into v_athlete_user
      from public.athletes a where a.id = c.athlete_id;

    -- LES DESTINATAIRES, PAR TYPE. `athlete_id` n'apparait QUE la ou
    -- l'athlete est partie au fil — jamais la ou il n'en est que le sujet.
    v_dest := case c.conversation_type
      when 'RECRUTEUR_COACH'   then array[c.recruiter_id, c.coach_id]
      when 'ATHLETE_COACH'     then array[c.coach_id, v_athlete_user]
      when 'PARENT_COACH'      then array[c.coach_id, c.parent_id]
      when 'RECRUTEUR_ATHLETE' then array[c.recruiter_id, v_athlete_user]
      when 'COACH_COACH'       then array[c.coach_id, c.coach_b_id]
      -- Une seule contrepartie est renseignee sur un fil ADMIN_USER ; les
      -- autres sont nulles et tombent au filtre ci-dessous.
      when 'ADMIN_USER'        then array[c.admin_id, v_athlete_user,
                                          c.coach_id, c.recruiter_id, c.parent_id]
      -- Pas de notion de depart dans le schema (joined_at sans left_at) :
      -- tous les membres.
      when 'GROUP'             then (select coalesce(array_agg(cp.user_id), '{}'::uuid[])
                                       from public.conversation_participants cp
                                      where cp.conversation_id = c.id)
    end;

    -- `case` sans `else` : un type non traite rend NULL. On le DIT plutot que
    -- de retomber sur un comportement par defaut.
    if v_dest is null then
      raise warning 'notify_on_message: type % non traite — message % non notifie',
        c.conversation_type, NEW.id;
      return null;
    end if;

    for r in
      select distinct u from unnest(v_dest) as u
       where u is not null and u <> NEW.sender_id
    loop
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-push-secret', v_secret
        ),
        body := jsonb_build_object(
          'user_id', r,
          'title', 'Nexus',
          'body', 'Tu as un nouveau message',
          'data', jsonb_build_object(
            'type', 'message',
            'conversation_id', NEW.conversation_id
          )
        )
      );
    end loop;

  exception when others then
    raise warning 'notify_on_message a échoué pour message %: %', NEW.id, SQLERRM;
  end;

  return null;
end;
$function$;

-- ── GARDE-FOU — REFUSE L'APPLICATION SI UN TYPE N'EST PAS TRAITÉ ────────
do $$
declare
  v_src     text;
  v_label   text;
  v_manquants text[] := '{}';
begin
  select p.prosrc into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'notify_on_message';

  for v_label in
    select e.enumlabel from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'conversation_type'
     order by e.enumsortorder
  loop
    -- On cherche l'etiquette ENTRE QUOTES : c'est la forme qu'elle a dans le
    -- `when`, et ca evite qu'un type soit considere traite parce que son nom
    -- apparait dans un commentaire.
    if position('''' || v_label || '''' in v_src) = 0 then
      v_manquants := v_manquants || v_label;
    end if;
  end loop;

  if array_length(v_manquants, 1) > 0 then
    raise exception
      'NEXUS: notify_on_message ne traite pas le(s) type(s) % — ajouter leur branche AVANT d''appliquer. Un type sans destinataires est une notification perdue ou mal adressee.',
      array_to_string(v_manquants, ', ');
  end if;

  raise notice 'NEXUS: notify_on_message — les % types de conversation ont tous une branche de destinataires.',
    (select count(*) from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='conversation_type');
end $$;
