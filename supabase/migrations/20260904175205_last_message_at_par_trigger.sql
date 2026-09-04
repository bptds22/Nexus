-- ═══════════════════════════════════════════════════════════════
-- `conversations.last_message_at` DEVIENT UNE VÉRITÉ, PAS UNE PROMESSE
--
-- La colonne existe depuis toujours et QUATRE des cinq boîtes trient dessus.
-- Mais rien en base ne la maintenait : elle était écrite par le CLIENT au
-- moment d'envoyer, et par quelques RPC (send_broadcast, create_group,
-- create_custom_group, send_admin_message). Tout chemin d'insertion qui
-- oublie de la toucher laisse la conversation à sa place d'avant.
--
-- ── CE QUE ÇA DONNAIT EN PROD (relevé 2026-09-04) ───────────────────────
-- 100 conversations, 0 colonne nulle, mais **3 périmées — toutes des GROUP**,
-- jusqu'à **12 jours 5 h de retard** (`f1272ed3`, colonne au 29 juillet alors
-- que le dernier message est du 10 août). Les groupes reçoivent leur
-- `last_message_at` à la CRÉATION et plus jamais ensuite : un groupe actif
-- coule au fond de toutes les listes qui trient sur cette colonne.
--
-- ── POURQUOI UN TRIGGER PLUTÔT QU'UN LATERAL JOIN AU SELECT ─────────────
-- Les deux corrigent le tri. Le lateral (`max(created_at)` des messages par
-- conversation) demanderait de toucher CINQ requêtes de liste — et PostgREST
-- ne sait pas exprimer un agrégat corrélé par ligne, il faudrait une vue ou
-- une RPC par boîte. Le trigger corrige les cinq d'un coup, sans toucher une
-- seule requête, et rend la colonne fiable pour tout futur lecteur.
-- Coût : une écriture de plus par message, sur une ligne déjà chaude.
--
-- ── `greatest`, PAS UNE AFFECTATION SÈCHE ───────────────────────────────
-- `last_message_at = greatest(ancien, nouveau)` : un message inséré avec un
-- `created_at` antérieur (import, rattrapage, horloge décalée) ne doit pas
-- faire RECULER la conversation dans la liste. La colonne ne représente pas
-- « le dernier insert » mais « le message le plus récent ».
--
-- ── UN TRIGGER À PART, PAS UNE LIGNE DANS notify_on_message ─────────────
-- Le réflexe serait de l'ajouter à `notify_on_message`, qui tourne déjà sur
-- chaque insert. Mauvaise idée : cette fonction enveloppe TOUT son corps dans
-- un `exception when others` qui avale les erreurs pour qu'un échec de push
-- ne bloque jamais l'envoi d'un message. Le tri hériterait de ce silence — il
-- s'arrêterait de fonctionner sans que rien ne le dise. Deux préoccupations,
-- deux triggers.
--
-- ── RATTRAPAGE ─────────────────────────────────────────────────────────
-- Les lignes déjà périmées sont recalées en une passe. Un `update` borné aux
-- seules lignes en retard : rien n'est touché inutilement.
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
     set last_message_at = greatest(coalesce(last_message_at, NEW.created_at), NEW.created_at)
   where id = NEW.conversation_id
     -- Ne pas ecrire pour rien : si la colonne est deja a jour ou plus
     -- recente, l'UPDATE est inutile et reveillerait les autres triggers de
     -- `conversations` pour rien.
     and (last_message_at is null or last_message_at < NEW.created_at);
  return null;
end;
$function$;

comment on function public.touch_conversation_last_message() is
$c$Maintient conversations.last_message_at a la date du message le plus
recent. QUATRE des cinq boites de messagerie trient sur cette colonne ; rien
ne la maintenait cote base, seulement le client et quelques RPC — d'ou 3
conversations GROUP periemees jusqu'a 12 jours en prod (2026-09-04).

`greatest` et non une affectation seche : un message insere avec un created_at
anterieur ne doit pas faire RECULER la conversation.

Trigger SEPARE de notify_on_message a dessein : cette derniere avale ses
exceptions pour qu'un echec de push ne bloque pas l'envoi, et le tri
heriterait de ce silence.$c$;

drop trigger if exists trg_touch_conversation_last_message on public.messages;
create trigger trg_touch_conversation_last_message
  after insert on public.messages
  for each row
  execute function public.touch_conversation_last_message();

-- ── RATTRAPAGE DES LIGNES DÉJÀ EN RETARD ───────────────────────────────
update public.conversations c
   set last_message_at = m.dernier
  from (select conversation_id, max(created_at) as dernier
          from public.messages group by conversation_id) m
 where m.conversation_id = c.id
   and (c.last_message_at is null or c.last_message_at < m.dernier);

-- ── GARDE-FOU ──────────────────────────────────────────────────────────
do $$
declare
  n_perimees int;
  n_triggers int;
begin
  select count(*) into n_perimees
    from public.conversations c
   where exists (select 1 from public.messages m
                  where m.conversation_id = c.id
                    and (c.last_message_at is null or m.created_at > c.last_message_at));

  if n_perimees > 0 then
    raise exception 'NEXUS: % conversation(s) portent encore un last_message_at en retard apres rattrapage', n_perimees;
  end if;

  select count(*) into n_triggers
    from pg_trigger t join pg_proc p on p.oid = t.tgfoid
   where t.tgrelid = 'public.messages'::regclass
     and not t.tgisinternal
     and p.proname = 'touch_conversation_last_message';

  if n_triggers <> 1 then
    raise exception 'NEXUS: le trigger touch_conversation_last_message n''est pas pose (% trouve(s))', n_triggers;
  end if;

  raise notice 'NEXUS: last_message_at rattrape et desormais maintenu par trigger — 0 conversation en retard.';
end $$;
