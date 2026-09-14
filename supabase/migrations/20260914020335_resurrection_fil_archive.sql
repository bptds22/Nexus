-- ═══════════════════════════════════════════════════════════════
-- Résurrection d'un fil archivé à l'arrivée d'un message.
--
-- LE DÉFAUT. `conversations.status` est une colonne UNIQUE par conversation,
-- pas par participant. L'athlète dispose d'une action d'archivage (et d'un
-- archivage par LOT) ; le coach lit la même colonne. Un rangement d'un côté
-- masque donc le fil de l'autre côté. Et comme AUCUN message ne le
-- ressuscitait, le masquage était DÉFINITIF au lieu de transitoire : le
-- canal se fermait pour de bon, sans que personne en soit averti.
--
-- Constaté le 2026-09-13 : un fil ATHLETE_COACH archivé recevait des messages
-- des deux côtés — livrés, notifiés (`sent:2, failed:0`) — et restait invisible
-- dans la boîte du coach. Le diagnostic a longtemps cherché un problème de
-- rôle (coach intérimaire) qui n'existait pas.
--
-- CE QUE FAIT CETTE MIGRATION. Un fil qui reçoit un message redevient vivant.
-- C'est le comportement de toute messagerie, et c'est le correctif MINIMAL :
-- il ne répare pas le partage de la colonne (voir plus bas), il empêche
-- seulement le masquage d'être irréversible.
--
-- POURQUOI C'EST SÛR
--   · L'UPDATE sur `conversations` EXISTAIT DÉJÀ, à chaque message. On ajoute
--     une colonne au SET — pas une écriture, pas une fréquence.
--   · Aucun trigger nouveau n'est réveillé : `trg_blackout_conversations` et
--     `trg_notify_first_recruiter_contact` sont BEFORE/AFTER INSERT uniquement.
--     Un UPDATE n'en déclenche qu'un, `set_updated_at`, qui pose un timestamp.
--   · `greatest()` reste idempotent : une ligne matchée par la seule branche
--     `status = 'ARCHIVE'` conserve son `last_message_at` s'il est déjà plus
--     récent.
--   · La CHECK de la colonne n'admet que 'ACTIVE' et 'ARCHIVE' — pas d'autre
--     état à préserver.
--
-- CE QUE ÇA NE RÈGLE PAS. `conversations.status` reste PARTAGÉE : archiver
-- masque toujours le fil chez l'autre, simplement plus de façon permanente.
-- Le correctif de fond est l'archivage par participant (`archived_at` sur
-- `conversation_participants` + réécriture des filtres des quatre boîtes),
-- prévu en 1.4.2. Voir docs/registre-archivage-partage.md.
--
-- REPLI. `CREATE OR REPLACE` de la version d'origine, conservée à l'identique
-- dans 20260904175205_last_message_at_par_trigger.sql.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.touch_conversation_last_message()
 returns trigger
 language plpgsql
 volatile
 security definer
 set search_path to 'public', 'pg_temp'
 set row_security to off
as $function$
begin
  update public.conversations
     set last_message_at = greatest(coalesce(last_message_at, NEW.created_at), NEW.created_at),
         -- Réécriture de la même valeur quand le fil est déjà ACTIVE : ce
         -- n'est pas un changement, et ça évite un CASE pour rien.
         status = 'ACTIVE'
   where id = NEW.conversation_id
     -- ★ LE POINT DE VIGILANCE. La garde d'origine ne portait que sur
     --   l'horodatage. Laissée seule, elle aurait avalé la résurrection dans
     --   le cas EXACT où elle sert : un fil archivé dont `last_message_at`
     --   est déjà à jour (réinsertion, rejeu, horloge qui n'avance pas)
     --   n'aurait PAS été dégelé. D'où le OU : on écrit si l'horodatage doit
     --   avancer, OU si le fil est à ressusciter.
     and (
          last_message_at is null
       or last_message_at < NEW.created_at
       or status = 'ARCHIVE'
     );
  return null;
end;
$function$;

comment on function public.touch_conversation_last_message() is
$c$Maintient conversations.last_message_at a la date du message le plus
recent, et RESSUSCITE le fil archive qui recoit un message (status ->
'ACTIVE'). Declenchee AFTER INSERT sur messages. La garde du WHERE couvre les
deux motifs d'ecriture, jamais un seul : sans cela un fil archive deja a jour
restait gele.$c$;
