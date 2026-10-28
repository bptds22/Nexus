# Lot D5a — programmes universitaires du Québec : liste attendue contre liste obtenue (relevé du 2026-10-28)

Premier cycle seulement (baccalauréats, certificats), relevé sur le site officiel de chaque université. Une ligne par
programme, avec son lien et sa source. Données : `scripts/cegep-lot-d/d5a-programmes-qc/<université>.json` (champ
`exclus` : chaque programme écarté et pourquoi). HEC Montréal et Polytechnique Montréal sont sous l'Université de
Montréal (décision BP), faculté « HEC Montréal » / « Polytechnique Montréal ».

**Total obtenu : 804 baccalauréats, 488 certificats (1292 programmes), 379 lignes écartées et justifiées.**

« Attendu » = le compte affiché par le répertoire officiel quand il en affiche un ; sinon le compte des entrées du
répertoire, avant regroupement des variantes (campus, DEC-BAC, concentrations à code propre). L'écart attendu −
obtenu est entièrement dans `exclus`.

| Université | Bacc. attendus | Bacc. obtenus | Cert. attendus | Cert. obtenus | Écartés | Source principale |
|---|---|---|---|---|---|---|
| Université Laval | 109 | 109 | 82 | 82 | 3 | https://www.ulaval.ca/etudes/programmes |
|  | *Répertoire officiel ulaval.ca/etudes/programmes : le filtre « Baccalauréats et doctorats de premier cycle » annonce 112 résultats, dont 3 doctorats de premier cycle (médecine, médecine dentaire, pharmacie) exclus, soit 109 baccalauréats ; le filtre « Certificats » annonce 82 résultats. Aucune entrée « (majeure) » n'apparaît sous ces filtres ; aucune page de programme ne mentionne d'admission suspe* | | | | | |
| Université de Montréal | 135 | 101 | 79 | 78 | 55 | https://admission.umontreal.ca/programmes-detudes/ |
|  | *UdeM (hors HEC/Poly) : facettes du répertoire admission.umontreal.ca « Baccalauréat (122) » et « Certificat de 1er cycle (41) » ; ces totaux excluent les programmes à admission suspendue (liste complète : 126 bacc., 47 cert.). Obtenu UdeM : 88 bacc. / 40 cert., après retrait de 3 orientations, 2 pages génériques, 22 baccalauréats par cumul thématiques sans code, 4 bacc. et 6 cert. suspendus, et re* | | | | | |
| Université du Québec à Montréal | 71 | 67 | 69 | 68 | 5 | https://etudier.uqam.ca/programmes |
|  | *Comptés sur le répertoire https://etudier.uqam.ca/programmes (tableau complet, Type = Baccalauréat / Certificat, cycle 1) : 71 lignes baccalauréat, 69 lignes certificat ; le site n'affiche pas de total. Écarts : 13 lignes baccalauréat sont des concentrations/profils/cheminements à code distinct, regroupées sous 7 programmes parents (le lien pointe vers la page de l'une des variantes) ; 1 certifica* | | | | | |
| École de technologie supérieure | 11 | 10 | 1 | 1 | 5 | https://www.etsmtl.ca/programmes-formations/baccalaureats |
|  | *Comptés sur le répertoire officiel (pages Baccalauréats et Certificats, alimentées par l'API JSON du site /api/search/programme-index, cycle « 1er cycle ») : 11 baccalauréats dont 1 « à venir » (génie de l'environnement, exclu) et 1 seul certificat de 1er cycle. Le site n'affiche pas de total.* | | | | | |
| Université McGill | 157 | 157 | 22 | 22 | 124 | https://www.mcgill.ca/undergraduate-admissions/programs |
|  | *Baccalauréats : le répertoire d’admission (mcgill.ca/undergraduate-admissions/programs, protégé par un défi WAF, lu au navigateur) liste des « programs » disciplinaires typés Major / Honours / Minor / Concentration / Domain..., sans total global ni nom de grade. Parcouru en entier via ses 11 facettes « Area of interest » (totaux affichés 40, 19, 33, 67, 69, 83, 34, 53, 75, 29, 17) et ses 2 facette* | | | | | |
| Université Concordia | 110 | 110 | 18 | 18 | 41 | https://www.concordia.ca/academics/undergraduate.html |
|  | *Le répertoire officiel (concordia.ca/academics/undergraduate.html) n'affiche pas de total ; décompte fait sur ses 166 fiches (balises cachées degree/credential de chaque fiche). Unité retenue = la fiche du répertoire : une ligne par programme listé (ex. « Psychology (BA, BSc) » = 1 ligne ; Major/Honours/Specialization non dédoublés). Baccalauréats : 111 fiches portant un grade Bachelor, moins le d* | | | | | |
| Université de Sherbrooke | 53 | 49 | 50 | 49 | 7 | https://www.usherbrooke.ca/admission/programmes?cycle=1er%2Bcycle |
|  | *Facette « Niveaux » du répertoire officiel filtré 1er cycle (179 résultats) : Baccalauréat (53), Certificat (50), Microprogramme de 1er cycle (74), Mineure (2). Les 53 « Baccalauréat » incluent Doctorat en médecine, Maîtrise en ergothérapie, Maîtrise en physiothérapie et le Bacc. en études anglaises et interculturelles (admissions suspendues), tous exclus : 53 - 4 = 49 retenus. Certificats : 50 - * | | | | | |
| Université Bishop's | 64 | 64 | 13 | 13 | 6 | https://www.ubishops.ca/academic-programs/ |
|  | *Le répertoire (ubishops.ca/academic-programs, moteur WordPress) annonce « 82 results » dont 77 « Undergraduate » et 5 « Graduate » (vérifié via l'API officielle wp-json/wp/v2/program, X-WP-Total = 82). Le grade de chaque fiche est lu sur la page programme (champ « Degree: ») : 64 fiches Bachelor (B.A., B.Sc., B.B.A., B.Ed.) et 13 fiches « Certificate » ; 77 = 64 + 13, attendu = compté. Unité reten* | | | | | |
| Université du Québec à Trois-Rivières | 94 | 41 | 64 | 43 | 82 | https://oraprdnt.uqtr.uquebec.ca/portail/triw084.afficher?owa_TOUT |
|  | *Répertoire officiel triw084 (uqtr.ca/programmes y redirige). Filtre « Baccalauréats et doctorats » = 94 fiches (une par code : campus, concentration, profil, cheminement DEC-BAC, bidiplôme, cumul, + 2 doctorats de 1er cycle). Filtre « Certificats et microprogrammes » = 111 fiches dont 64 commencent par « Certificat » (variantes de lieu incluses). Après regroupement en programmes parents : 40 bacca* | | | | | |
| Université du Québec à Chicoutimi | 52 | 41 | 53 | 51 | 13 | https://www.uqac.ca/programmes/ |
|  | *Répertoire officiel uqac.ca/programmes (286 programmes annoncés, liste complète dans le HTML) : 50 fiches de 1er cycle de type « BACCALAUREAT » + 2 fiches de type « MAJEURE » intitulées « Baccalauréat avec majeure en … » (programmes de 90 crédits avec code propre 6110 et 6803, retenus comme baccalauréats) = 52 ; 53 fiches de type « CERTIFICAT ». Les variantes portant le même nom (DEC-BAC, lieu Sep* | | | | | |
| Université du Québec à Rimouski | 36 | 28 | 28 | 27 | 15 | https://www.uqar.ca/programmes-formations-et-admission/domaines-etudes/resultats-de-recherche-de-programmes/ |
|  | *Le répertoire officiel (page de recherche de programmes, rendue en JS) est alimenté par l’API WordPress officielle uqar.ca/wp-json/wp/v2/programmes (192 fiches) ; la taxonomie « Categorie » annonce 36 fiches « Baccalauréat » et 28 « Certificat ». Des 36 fiches baccalauréat : 7 « Baccalauréat avec majeure en … » ramenées à la ligne « Baccalauréat par cumul et baccalauréat avec majeure », 4 doublons* | | | | | |
| Université du Québec en Outaouais | 42 | 27 | 36 | 36 | 23 | https://etudier.uqo.ca/programmes |
|  | *Répertoire officiel etudier.uqo.ca/programmes (uqo.ca/programmes y redirige) ; données JSON embarquées dans la page (jsonLstRes, 447 lignes). Catégorie BACC : 78 lignes = 42 codes d'admission distincts (un code par campus / régime coopératif / concentration / cheminement) ; CERT : 81 lignes = 36 codes. Le répertoire n'affiche pas de total. Après regroupement des variantes (campus, coop, concentrat* | | | | | |

**Décisions BP (2026-10-28) appliquées :** 1. une ligne par programme qui a son propre nom sur le site (seules les
variantes de même nom — campus, DEC-BAC, coop, temps partiel — sont regroupées) : 20 concentrations et profils à nom
propre réintégrés (UQAM 9, UQO 6, UQAR 4, UQTR 1 ; lien laissé vide quand il n'était pas dans les pages relevées) ;
2. McGill et Concordia gardent l'unité de leur répertoire (sujets) ; 3. exclus : baccalauréats-maîtrises intégrés de
Sherbrooke, baccalauréats par cumul thématiques de l'UdeM ; gardés : certificats crédités de l'éducation permanente
de McGill ; 4. sources Polytechnique (brochures officielles) acceptées ; facultés absentes des sites laissées vides.
