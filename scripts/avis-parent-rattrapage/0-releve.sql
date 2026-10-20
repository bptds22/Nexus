-- Relevé LECTURE SEULE — premiers contacts passés sans avis au parent, selon
-- la MÊME règle que le trigger aviser_parent_contact_recruteur :
-- unité = cégep du recruteur (sans cégep : le recruteur) ; mineur à la date du
-- premier message de l'unité ; destinataire = parent_email, sinon adresse du
-- compte parent réclamé ; pas encore de ligne AVISE au journal.
-- Ne révèle aucune adresse : seulement des compteurs et des indicateurs.
with premier as (
  select distinct on (c.athlete_id, coalesce('C:' || u.school_id::text, 'R:' || c.recruiter_id::text))
         c.athlete_id,
         coalesce('C:' || u.school_id::text, 'R:' || c.recruiter_id::text) as cle,
         m.id as message_id, m.created_at
    from public.conversations c
    join public.messages m on m.conversation_id = c.id and m.sender_id = c.recruiter_id
    left join public.users u on u.id = c.recruiter_id
   where c.conversation_type = 'RECRUTEUR_ATHLETE'
   order by c.athlete_id, coalesce('C:' || u.school_id::text, 'R:' || c.recruiter_id::text), m.created_at
)
select p.athlete_id, p.created_at as premier_message,
       nullif(btrim(a.parent_email), '') is not null as parent_email_declare,
       exists (select 1 from public.parent_athletes pa where pa.athlete_id = p.athlete_id) as parent_reclame,
       public.is_messaging_blacked_out(p.athlete_id) as periode_sans_contact_aujourdhui,
       exists (select 1 from public.parent_contact_avis v
                where v.athlete_id = p.athlete_id and v.cle_unite = p.cle and v.statut = 'AVISE') as deja_avise
  from premier p
  join public.athletes a on a.id = p.athlete_id
 where a.date_naissance is not null
   and (p.created_at at time zone 'America/Toronto')::date < a.date_naissance + interval '18 years'
   and (nullif(btrim(a.parent_email), '') is not null
        or exists (select 1 from public.parent_athletes pa join public.users pu on pu.id = pa.parent_user_id
                    where pa.athlete_id = p.athlete_id and nullif(btrim(pu.email), '') is not null))
 order by p.created_at;
