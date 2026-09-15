-- ═══════════════════════════════════════════════════════════════════════════
-- M8 — La purge hebdomadaire du compteur de tentatives.
--
-- UN TRAVAIL SÉPARÉ, PAS UNE ÉDITION DE rseq-veille-hebdo. Le travail RSEQ
-- porte un `net.http_post` avec une sous-requête sur le Vault : y greffer un
-- DELETE mêlerait deux cycles de vie sans rapport, et un échec de l'un
-- masquerait l'autre. `cron.schedule` sur un nom neuf coûte une ligne.
--
-- PAS DE pg_net ICI. C'est un DELETE local, pas un appel HTTP : ni Vault, ni
-- secret, ni timeout de 5 s. Rien de la mécanique de la veille RSEQ ne
-- s'applique.
--
-- L'HORAIRE EST EN UTC — pg_cron n'a pas de fuseau par travail et suit celui
-- du serveur, qui est UTC sur Supabase. `10 8 * * 1` vaut donc lundi 04:10 à
-- Montréal en heure avancée, 03:10 en hiver. Une heure de dérive saisonnière
-- sur une purge hebdomadaire : on l'assume, comme pour la veille RSEQ.
-- Volontairement décalé du mercredi 07:55 de rseq-veille-hebdo — deux
-- travaux, deux créneaux, aucun recouvrement à diagnostiquer.
--
-- 30 JOURS. Le compteur ne sert qu'à borner la journée en cours ; au-delà,
-- il ne documente plus qu'un historique d'usage. On en garde un mois pour que
-- l'onglet admin puisse montrer un acharnement récent, et rien de plus.
-- Rappel : cette table ne contient AUCUN texte — la purge efface des
-- compteurs, jamais des recherches, puisqu'aucune recherche n'y est écrite.
--
-- CE QUE CETTE PURGE NE FAIT PAS : elle ne touche NI ambassadeur_revendications,
-- NI ambassadeur_paliers. Une revendication est un fait déclaré par un jeune
-- sur un autre jeune ; sa rétention est une question Loi 25, pas une question
-- d'hygiène de table, et elle n'a pas été tranchée. Ne pas l'ajouter ici sans
-- décision écrite.
--
-- IDEMPOTENTE : `cron.schedule` sur un nom existant REMPLACE le travail au
-- lieu d'en créer un second.
-- ═══════════════════════════════════════════════════════════════════════════

select cron.schedule(
  'ambassadeur-purge-hebdo',
  '10 8 * * 1',
  $job$
  delete from public.ambassadeur_tentatives
   where jour < ((now() at time zone 'America/Montreal')::date - 30);
  $job$
);

do $$
declare v_n int;
begin
  select count(*) into v_n from cron.job where jobname = 'ambassadeur-purge-hebdo';
  if v_n <> 1 then
    raise exception 'NEXUS: le travail ambassadeur-purge-hebdo n''est pas arme (% trouve(s)).', v_n;
  end if;
  raise notice 'NEXUS: purge hebdomadaire armee — lundi 08:10 UTC, retention 30 jours.';
end $$;
