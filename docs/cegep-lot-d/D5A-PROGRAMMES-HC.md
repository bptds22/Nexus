# Lot D5a — programmes universitaires hors Québec (47 universités U SPORTS, lot D1b) : attendu contre obtenu (relevé du 2026-10-28)

Mêmes règles que le Québec (décisions BP du 2026-10-28) : premier cycle (baccalauréats, certificats crédités), une
ligne par programme qui a son propre nom dans le répertoire officiel (unité du répertoire gardée, sujets compris),
variantes de même nom regroupées, doctorats de premier cycle / professionnels exclus. Règle BP sur les blocages
appliquée : aucun contournement, aucun navigateur ; un site bloqué est noté et remplacé par une autre source
officielle (PDF d'annuaire, plan de site, flux JSON public) ou laissé vide. Données :
`scripts/cegep-lot-d/d5a-programmes-hc/NN.json` (NN = rang dans d1b-universites.json ; `exclus` et `blocages` par fichier).

**Total obtenu : 3865 baccalauréats, 740 certificats (4605 programmes), 1122 lignes écartées et justifiées.**

**Décisions BP (2026-10-28) appliquées :** Brock et St. Francis Xavier : aucune autre source officielle accessible
(OUAC, ouinfo, annuaires : 403) → vides, l'université remplira ; Western : noms remis en casse normale (sigles
gardés) ; certificats de métiers exclus (UFV : 10) ; formation continue : seulement les certificats crédités (TMU : 8
gardés sur 56, crédit non confirmé pour les autres ; UFV : 2 réintégrés ; McMaster et York confirmés) ; « General
Studies » gardés (TRU 2, Laurier 2 réintégrés).

| Université | Prov. | Bacc. att. | Bacc. obt. | Cert. att. | Cert. obt. | Écartés | Source principale | Blocages |
|---|---|---|---|---|---|---|---|---|
| Algoma University | ON | 21 | 21 | 13 | 13 | 0 | https://algomau.ca/academics/programs/ | — |
| Brock University | ON | None | 0 | None | 0 | 0 | — | https://brocku.ca/programs/ : HTTP 403 (refus du serveur) — aucune source de remplacement atteignable; https://brocku.ca/webcal/current/undergrad/ (calendrier officiel) : HTTP 403; https://calendar.brocku.ca/ (calendrier |
| Carleton University | ON | 131 | 129 | 7 | 7 | 2 | https://admissions.carleton.ca/cu-programs/ | https://admissions.carleton.ca/programs/ : répertoire filtrable rendu en JavaScript (« No Programs found »), pas un blocage ; remplacé par la liste A-Z officielle https://admissions.carleton.ca/cu-programs/ |
| University of Guelph | ON | 90 | 89 | 11 | 11 | 5 | https://calendar.uoguelph.ca/undergraduate-calendar/degree-programs/ | https://www.uoguelph.ca/programs/undergraduate/ et https://www.uoguelph.ca/explore-all-programs/ : répertoire d'admission rendu en JavaScript (contenu vide à la lecture), pas un blocage HTTP ; remplacé par le calendrier  |
| Lakehead University | ON | 58 | 50 | 18 | 17 | 9 | https://www.lakeheadu.ca/programs | — |
| Université Laurentienne | ON | 72 | 68 | 14 | 14 | 4 | https://laurentienne.ca/etudes/programmes-de-premier-cycle | — |
| McMaster University | ON | 25 | 23 | 71 | 69 | 4 | https://future.mcmaster.ca/programs/ | https://academiccalendars.romcmaster.ca/content.php?catoid=65&navoid=14803 (Programs by Degree) et navoid=14835 (Certificate and Diploma Programs) : réponse HTTP 202 vide (défi anti-robot) — non contourné ; remplacé par  |
| Nipissing University | ON | 39 | 32 | 2 | 0 | 9 | https://future.nipissingu.ca/programs-archive/ | https://future.nipissingu.ca/programs/ : la liste filtrable n'affiche que 21 fiches à la lecture (chargement dynamique), pas un blocage ; complétée par l'archive paginée officielle /programs-archive/ (6 pages) et le site |
| Ontario Tech University | ON | 146 | 110 | 0 | 0 | 36 | https://ontariotechu.ca/programs/undergraduate/index.php | https://calendar.ontariotechu.ca/content.php?catoid=92&navoid=4144 (calendrier 2026-2027, Programs by degree) : réponse HTTP 202 vide (défi anti-robot) — non contourné.; https://ontariotechu.ca/programs/undergraduate/... |
| Université d'Ottawa | ON | 235 | 171 | 10 | 10 | 64 | https://catalogue.uottawa.ca/fr/premier-cycle/ | https://www.uottawa.ca/etudes/programmes : HTTP 402 (refus du serveur) — non contourné ; remplacé par le catalogue officiel https://catalogue.uottawa.ca/fr/premier-cycle/. |
| Queen's University | ON | 88 | 85 | 30 | 15 | 24 | https://www.queensu.ca/admission/undergraduate-programs | — |
| Toronto Metropolitan University | ON | 72 | 68 | 61 | 8 | 64 | https://www.torontomu.ca/calendar/2026-2027/programs/ | https://continuing.torontomu.ca/certificates/ : pas bloqué, mais la liste des certificats est chargée en JavaScript (« loading certificates ») et la recherche publique ne rend aucun résultat côté serveur ; remplacé par l |
| University of Toronto | ON | 376 | 270 | 17 | 17 | 110 | https://www.utoronto.ca/academics/programs-directory | — |
| Trent University | ON | 70 | 66 | 0 | 0 | 9 | https://www.trentu.ca/advising/course-selection-and-registration/course-selection/first-year-course-suggestions-major | https://www.trentu.ca/futurestudents/programs (et /futurestudents/undergraduate/programs, /futurestudents/program/<programme>, /registrar/academic-calendar/past-academic-calendars) : HTTP 500 Internal Server Error, non c |
| University of Waterloo | ON | 113 | 99 | 3 | 1 | 13 | https://uwaterloo.ca/future-students/programs | https://uwaterloo.ca/academic-calendar/undergraduate-studies/catalog : catalogue chargé en JavaScript (non bloqué, mais illisible) ; certificats relevés sur la page officielle Future Students « Minors and specializations |
| Western University | ON | 357 | 270 | 34 | 32 | 171 | https://westerncalendar.uwo.ca/Modules.cfm?ArchiveID=&SelectedCalendar=Live | — |
| Wilfrid Laurier University | ON | 68 | 63 | 18 | 15 | 14 | https://academic-calendar.wlu.ca/index_old.php?cal=1&y=93 | https://www.wlu.ca/programs/index.html : pas bloqué, mais le contenu récupéré est tronqué après « Faith and Community » (lettre F) ; filtres côté client. Remplacé par le calendrier officiel 2026/2027 (sections de faculté |
| University of Windsor | ON | 150 | 139 | 26 | 19 | 69 | https://www.uwindsor.ca/secretariat/sites/uwindsor.ca.secretariat/files/undergraduate_calendar_winter_2027.pdf | https://www.future.uwindsor.ca/program-listing/ (répertoire Future Students) : liste chargée en JavaScript, aucune entrée lisible (pas un blocage) ; remplacé par le calendrier officiel de premier cycle Winter 2027 (PDF d |
| York University | ON | 139 | 123 | 62 | 59 | 10 | https://futurestudents.yorku.ca/programs/ | — |
| Acadia University | NS | 32 | 32 | 7 | 5 | 9 | https://www2.acadiau.ca/academics.html | — |
| Cape Breton University | NS | 51 | 37 | 19 | 16 | 23 | https://www.cbu.ca/academics/program-types/undergraduate/ | https://pressbooks.atlanticoer-relatlantique.ca/2627version/ (official 2026-2027 calendar on Pressbooks) and its /wp-json/pressbooks/v2/toc returned HTTP 403 to WebFetch; replaced by the official CBU Academic Calendar 20 |
| Dalhousie University | NS | 89 | 80 | 70 | 70 | 18 | https://www.dal.ca/study/programs.html | https://www.dal.ca/study/programs.html (official program finder) renders its list by script and is empty to WebFetch (not a block); replaced by each faculty's official program page and the 2026/2027 undergraduate calenda |
| Memorial University of Newfoundland | NL | 52 | 38 | 11 | 8 | 20 | https://www.mun.ca/undergrad/programs/ | — |
| Mount Allison University | NB | 55 | 40 | 16 | 16 | 18 | https://mta.ca/programs | https://www.mta.ca/programs redirects to http://mta.ca/programs (followed; not a block) |
| Université de Moncton | NB | 109 | 67 | 12 | 12 | 46 | https://www.umoncton.ca/repertoire/programmes | https://www.umoncton.ca/repertoire/programmes (Répertoire 2026-2027) and the campus 'programmes' pages render their program dropdown by script (empty to WebFetch, not a block); replaced by the official 'Feuilles de route |
| University of New Brunswick | NB | 129 | 101 | 24 | 20 | 35 | https://www.unb.ca/academics/programs/index.html | — |
| University of Prince Edward Island | PE | 64 | 43 | 6 | 5 | 23 | https://www.upei.ca/programs | — |
| Saint Mary's University | NS | 50 | 50 | 16 | 16 | 7 | https://www.smu.ca/future-students/ba-programs/ | https://www.smu.ca/academics/programs.html returned HTTP 404 (moved, not a block); the official BA/BSc/BComm program pages and academic-programs landing page were used |
| St. Francis Xavier University | NS | 0 | 0 | 0 | 0 | 0 | — | https://www.stfx.ca/programs - HTTP 403 Forbidden to WebFetch; https://www.stfx.ca/sites/default/files/documents/2026-2027%20Academic%20Calendar_Oct16.pdf (official 2026-2027 academic calendar) - HTTP 403 Forbidden; http |
| St. Thomas University | NB | 42 | 35 | 5 | 4 | 9 | https://www.stu.ca/academics/search/ | — |
| University of Alberta | AB | 358 | 293 | 2 | 2 | 66 | https://www.ualberta.ca/en/undergraduate-programs/sitemap.xml | https://www.ualberta.ca/en/undergraduate-programs/index.html — répertoire rendu en JavaScript (liste vide à la lecture) ; remplacé par le sitemap officiel du même répertoire (undergraduate-programs/sitemap.xml, 376 URL)  |
| Brandon University | MB | 11 | 10 | 4 | 4 | 4 | https://www.brandonu.ca/programs/ | — |
| University of British Columbia | BC | 141 | 131 | 0 | 0 | 11 | https://you.ubc.ca/programs/ | https://you.ubc.ca/programs/ — liste des programmes chargée en JavaScript (vide à la lecture) ; remplacée par le sitemap officiel des pages programmes (ubc_programs-sitemap.xml, 197 URL, deux campus) et la lecture de cha |
| University of British Columbia Okanagan | BC | 58 | 55 | 0 | 0 | 4 | https://you.ubc.ca/programs/ | https://you.ubc.ca/programs/ — liste des programmes chargée en JavaScript (vide à la lecture) ; remplacée par le sitemap officiel des pages programmes (ubc_programs-sitemap.xml, 197 URL, deux campus) et la lecture de cha |
| University of Calgary | AB | 99 | 86 | 0 | 0 | 14 | https://www.ucalgary.ca/future-students/undergraduate/explore-programs?items_per_page=All | — |
| University of the Fraser Valley | BC | 53 | 52 | 66 | 38 | 30 | https://www.ufv.ca/programs/ | — |
| University of Lethbridge | AB | 89 | 80 | 1 | 1 | 10 | https://www.ulethbridge.ca/future-student/programs | — |
| University of Manitoba | MB | 236 | 215 | 1 | 1 | 23 | https://catalog.umanitoba.ca/undergraduate-studies/academic-programs/ | — |
| MacEwan University | AB | 50 | 45 | 17 | 9 | 14 | https://calendar.macewan.ca/programs/ | https://www.macewan.ca/academics/programs/ — page d'accueil « Browse Programs » sans liste lisible (contenu dynamique) ; remplacée par l'annuaire officiel calendar.macewan.ca/programs/ (Programs A-Z) |
| Mount Royal University | AB | 40 | 38 | 7 | 5 | 4 | https://www.mtroyal.ca/ProgramsCourses/ProgramsOffered/index.htm | — |
| University of Northern British Columbia | BC | 49 | 49 | 15 | 12 | 3 | https://www.unbc.ca/programs-and-admissions/undergraduate/programs | — |
| University of Regina | SK | 109 | 89 | 68 | 59 | 29 | https://www.uregina.ca/academics/programs/index.html | — |
| University of Saskatchewan | SK | 95 | 89 | 68 | 62 | 12 | https://admissions.usask.ca/programs/find-a-program.php | — |
| Thompson Rivers University | BC | 80 | 61 | 61 | 36 | 44 | https://www.tru.ca/programs.html | — |
| Trinity Western University | BC | 29 | 29 | 7 | 7 | 6 | https://www.twu.ca/academics/programs | — |
| University of Victoria | BC | 92 | 84 | 13 | 13 | 8 | https://www.uvic.ca/undergraduate/programs/undergraduate-programs/programs.php | https://www.uvic.ca/undergraduate/programs/ (répertoire nu, sans page d'index) renvoie 403 à une requête simple ; aucune tentative de contournement — la même liste officielle a été lue sur https://www.uvic.ca/undergradua |
| University of Winnipeg | MB | 63 | 60 | 17 | 12 | 15 | https://www.uwinnipeg.ca/academics/calendar/docs/degreeandmajorrequirements.pdf | https://www.uwinnipeg.ca/ (toutes les pages HTML essayées : /, /academics/programs/index.html, /programs/index.html, /academics/calendar/, /future-student/index.html) ainsi que https://library.uwinnipeg.ca/ et https://ne |
