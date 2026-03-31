SELECT first_name, taille_pieds, taille_pouces, poids_lbs, 
       numero_jersey, position_id, programme_cegep_vise,
       annee_diplomation, moyenne_generale, cote_globale_entraineur,
       pret_changer_region, ouvert_cegep_prive, ouvert_cegep_anglophone
FROM athletes 
WHERE first_name = 'Bruno-Philippe';