-- Manual tagging of the 55 schools the automated backfill couldn't match.
-- Confidence level: high (these are well-known Quebec educational institutions).

BEGIN;

-- ─── CEGEPs (19) ───────────────────────────────────────────────────

-- Public FR CEGEPs
UPDATE schools SET reseau='PUBLIC', langue='FR' WHERE name='Cégep de Lanaudière à Joliette';
UPDATE schools SET reseau='PUBLIC', langue='FR' WHERE name='Cégep de Lanaudière à L''Assomption';
UPDATE schools SET reseau='PUBLIC', langue='FR' WHERE name='Cégep de Lanaudière à Terrebonne';
UPDATE schools SET reseau='PUBLIC', langue='FR' WHERE name='Cégep de Saint-Félicien';
UPDATE schools SET reseau='PUBLIC', langue='FR' WHERE name='Cégep de Saint-Hyacinthe';
UPDATE schools SET reseau='PUBLIC', langue='FR' WHERE name='Cégep Garneau';

-- Public EN CEGEPs (Champlain network + Dawson + John Abbott + Heritage)
UPDATE schools SET reseau='PUBLIC', langue='EN' WHERE name='Champlain College Lennoxville';
UPDATE schools SET reseau='PUBLIC', langue='EN' WHERE name='Champlain College Saint-Lambert';
UPDATE schools SET reseau='PUBLIC', langue='EN' WHERE name='Champlain College St-Lawrence';
UPDATE schools SET reseau='PUBLIC', langue='EN' WHERE name='Champlain Regional College';
UPDATE schools SET reseau='PUBLIC', langue='EN' WHERE name='Dawson College';
UPDATE schools SET reseau='PUBLIC', langue='EN' WHERE name='Heritage College';
UPDATE schools SET reseau='PUBLIC', langue='EN' WHERE name='John Abbott College';

-- Private FR CEGEPs
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège Bart';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège Mérici';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège O''Sullivan de Montréal';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège O''Sullivan de Québec';

-- Private EN CEGEPs
UPDATE schools SET reseau='PRIVE', langue='EN' WHERE name='Centennial College' AND type='CEGEP';
UPDATE schools SET reseau='PRIVE', langue='EN' WHERE name='TAV College';

-- ─── SECONDAIRE — private French (24) ─────────────────────────────

UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Académie Lafontaine';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Centre académique Fournier';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Centre d''intégration scolaire';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège Boisbriand';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège Charlemagne';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège Charles-Lemoyne (Longueuil)';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège Charles-Lemoyne (Sainte-Catherine)';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège Français Secondaire Longueuil';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège Français Secondaire Montréal';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège Héritage de Châteauguay';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège Jésus-Marie de Bellechasse' AND city='Sainte-Sabine';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège Mont Notre-Dame de Sherbrooke';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège Saint-Alexandre';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège Sainte-Anne (Dorval)';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège Stanislas (Montréal)';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Collège Stanislas (Québec)';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='École Lucien-Guilbault (Papineau)';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='École Montessori Orford';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='École Peter Hall';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='École secondaire Duval';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='École secondaire Saint-Joseph' AND city='Saint-Hyacinthe';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='École Socrates-Démosthène (Laval)';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='École Socrates-Démosthène (Montréal)';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Étude Secours';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Résonance Montréal';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Séminaire de Chicoutimi';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Séminaire du Sacré-Coeur' AND city='Nominingue';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Séminaire Marie-Reine-du-Clergé';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Séminaire Sainte-Marie';
UPDATE schools SET reseau='PRIVE', langue='FR' WHERE name='Succès scolaire';

-- ─── SECONDAIRE — private English (6) ─────────────────────────────

UPDATE schools SET reseau='PRIVE', langue='EN' WHERE name='Centennial Academy';
UPDATE schools SET reseau='PRIVE', langue='EN' WHERE name='Collège Trafalgar';
UPDATE schools SET reseau='PRIVE', langue='EN' WHERE name='École Le Sommet - Summit School';
UPDATE schools SET reseau='PRIVE', langue='EN' WHERE name='Lower Canada College';
UPDATE schools SET reseau='PRIVE', langue='EN' WHERE name='North Star Academy Laval';
UPDATE schools SET reseau='PRIVE', langue='EN' WHERE name='West Island College';

COMMIT;
