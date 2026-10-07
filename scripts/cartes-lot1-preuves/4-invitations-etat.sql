\pset pager off
\echo '=== cartes_prospect_invitations par carte (attendu : 1 ligne max par carte) ==='
select c.prenom||' '||c.nom carte, c.courriel courriel_actuel, c.invitation_etat, c.fusionnee_le is not null fusionnee,
       count(i.id) nb_inv, string_agg(i.statut||coalesce('/'||i.motif,''), ',') inv
  from public.cartes_prospect c left join public.cartes_prospect_invitations i on i.carte_id=c.id
 where c.nom in ('Ajoutpreuve','Inscritcartepreuve','Directpreuve','Fusionpreuve','Effacepreuve')
 group by c.id order by c.created_at;
\echo '=== journal des cartes Ajout / Inscrit (ordre) ==='
select c.nom, j.action, coalesce(j.acteur::text,'∅') acteur, j.created_at
  from public.cartes_prospect_journal j join public.cartes_prospect c on c.id=j.carte_id
 where c.nom in ('Ajoutpreuve','Inscritcartepreuve') order by c.nom, j.created_at;
