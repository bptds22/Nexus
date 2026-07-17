// lib/mock/teamPages.ts
// Fixture MOCK v2 des pages équipe — câblage Bloc 2 (team_athletes JOIN athletes).
// Positions = abréviations RÉELLES public.positions (diagnostic). Saison 2026 →
// annee_fin === 2026 = un départ. viewer = athlète connecté (perfect match), mock.

import type { RosterPlayer, TeamData } from "@/components/team-page/content";

const SEASON = 2026;
// helper : joueurs à un poste, chaque entrée = annee_fin (number ou null).
const P = (pos: string, years: (number | null)[]): RosterPlayer[] =>
  years.map((annee_fin) => ({ pos, annee_fin }));

const GR = { nickname: "Phénix", schoolName: "Collège André-Grasset", schoolInitial: "P",
  logoUrl: "/logos/logo-phenix.png", // crest réel Phénix (PNG transparent)
  // Couleurs Grasset : PRIMAIRE / PRIMAIRE ÉCLAIRCIE / FONCÉE / CLAIRE.
  // teamColorLt est un choix de design (accents clairs), pas un dérivé calculé.
  teamColor: "#A6192E", teamColorLt: "#D8394C", teamColorDark: "#191414", teamColorNeutral: "#F1EBDD",
  coachName: "M. Tremblay",
  // Vocabulaire du mur Grasset (même set que la page école) → fantômes derrière le terrain.
  wallWords: ["ALLEZ", "LA TRIBU", "PHÉNIX", "BOL D'OR", "ENSEMBLE"] };
const SOC = [
  { platform: "instagram" as const, href: "#" },
  { platform: "facebook" as const, href: "#" },
];

export const teamPages: TeamData[] = [
  // ── FOOTBALL — 3 facettes + perfect match + joueur sans année ──────────────
  {
    id: "grasset-football-m", sportNom: "Football", division: "D1", genre: "Masculin",
    sportKey: "football", nom: "Football\nmasculin", ...GR,
    heroImage: "/heroes/hero-football-grasset.jpg", // PLACEHOLDER stand-in (autres équipes → fallback thémé)
    recordSaison: "9–1", recordLabel: "Saison 24-25", playoffResult: "½ finale", playoffLabel: "Séries RSEQ",
    socials: [...SOC, { platform: "youtube", href: "#" }], engagesCount: 3, season: SEASON,
    roster: [
      // OFFENSE
      ...P("OT", [2026, 2027]), ...P("OG", [2026]), ...P("C", [2028]),      // O-LINE : 2 départs → besoin élevé
      ...P("QB", [2026, 2028]),                                             // QB : 1 → moyen
      ...P("RB", [2028]), ...P("FB", [2027]),                              // PORTEURS : 0 → complet
      ...P("WR", [2026, 2026, 2026]), ...P("TE", [2028]),                  // RECEVEURS : 3 → priorité
      // DÉFENSE
      ...P("DE", [2027]), ...P("DT", [2028]), ...P("DL", [2028]),          // D-LINE : 0 → complet
      ...P("LB", [2026, 2026]), ...P("ILB", [2028]),                       // SECONDEURS : 2 → besoin élevé
      ...P("CB", [2026, 2026, 2028]),                                       // DEMIS : 2 → besoin élevé (match athlète)
      ...P("S", [2026]), ...P("FS", [2026, 2026]), ...P("SS", [2028]),     // MARAUDEURS : 3 → priorité
      // SPÉCIALISTES
      ...P("K", [2026]), ...P("P", [2027]), ...P("RET", [2026, 2026]), ...P("LS", [2028]),
      // joueur sans année de fin (compteur coach)
      ...P("OT", [null]),
    ],
    viewer: {
      sport: "Football", pos: "CB", pos2: "QB",
      posLabel: "Demi défensif", posLabelPlural: "demis défensifs",
    },
    // team_content (MOCK, câblage Bloc 2 : table + modération). Fixture COMPLÈTE.
    content: {
      presentationText:
        "Depuis près d'un siècle, le programme de football du Phénix forme des " +
        "étudiants-athlètes complets. Petites cohortes, encadrement serré, culture " +
        "d'exigence : ici, on vise le Bol d'Or autant que le diplôme. Chaque joueur " +
        "repart avec un plan de match pour la suite, sur le terrain comme en classe.",
      championships: 4,
      staffSince: 2019,
      headCoach: {
        nom: "Marc Tremblay",
        photoUrl: null, // placeholder tant que pas d'upload (adulte, Bloc 2)
        bio:
          "Ancien porteur de ballon universitaire, Marc dirige le Phénix depuis 2019. " +
          "Il a placé une douzaine d'athlètes au collégial et mise sur la discipline avant tout.",
      },
      staff: [
        { nom: "Julien Bédard", role: "Coordonnateur offensif" },
        { nom: "Sophie Lavoie", role: "Adjointe" },
        { nom: "David Roy", role: "Préparateur physique" },
      ],
      palmares: [
        { titre: "Champions", annee: 2022, type: "championnat" },
        { titre: "Finale", annee: 2024, type: "finale" },
      ],
    },
    // commits (MOCK) — 3 recrues (masculin → « Ils ont déjà dit oui »).
    commits: [
      { prenom: "Nathan", nom: "Côté", ecoleProvenance: "École secondaire Saint-Jean-Eudes", promo: 2027, etoiles: 5, visiblePublic: true },
      { prenom: "Liam", nom: "Tremblay", ecoleProvenance: "Collège de Montréal", promo: 2027, etoiles: 4, visiblePublic: true },
      { prenom: "Thomas", nom: "Girard", ecoleProvenance: "Polyvalente Deux-Montagnes", promo: 2028, etoiles: 3, visiblePublic: true },
    ],
  },
  // ── FLAG — 2 facettes (.flat) ──────────────────────────────────────────────
  {
    id: "grasset-flag-f", sportNom: "Flag football", division: "D2", genre: "Féminin",
    sportKey: "flag", nom: "Flag football\nféminin", ...GR,
    heroImage: "/heroes/hero-flag-grasset.jpg", // PHOTO RÉELLE flag féminin (petite réso, HD à venir)
    // Point focal du crop (format object-position). Source carrée 447×447 dans un
    // cadre ≈2.6:1 → le débord est vertical : seul Y compte ici. 22% = les visages.
    // Bloc 2 : viendra de hero_image.focal_x / hero_image.focal_y (saisie coach),
    // composé en `${focal_x}% ${focal_y}%`. Absent → défaut "50% 25%".
    heroFocal: "50% 22%",
    recordSaison: "7–2", recordLabel: "Saison 24-25", playoffResult: "Finale", playoffLabel: "Séries RSEQ",
    socials: SOC, engagesCount: 4, season: SEASON,
    roster: [
      ...P("QB", [2026, 2028]), ...P("C", [2027]), ...P("RB", [2026, 2027]), ...P("WR", [2026, 2026, 2028]),
      ...P("RU", [2026, 2026]), ...P("LB", [2026]), ...P("DB", [2028]), ...P("S", [2026, 2026, 2026]),
    ],
    // Athlète connectée = RECEVEUSE (WR) → poste en besoin ici → « Match parfait » (démo).
    viewer: {
      sport: "Flag football", pos: "WR",
      posLabel: "Receveuse", posLabelPlural: "receveuses",
    },
    // team_content (MOCK, Bloc 2) — pour que la section Présentation vive sur la démo.
    content: {
      presentationText:
        "Jeune mais ambitieux, le flag féminin du Phénix a atteint la finale dès sa " +
        "deuxième saison. Un noyau tissé serré, un jeu rapide et beaucoup de plaisir : " +
        "on développe des athlètes complètes, prêtes pour le collégial.",
      championships: 2,
      staffSince: 2021,
      headCoach: {
        nom: "Marc Tremblay",
        photoUrl: null, // placeholder tant que pas d'upload (adulte, Bloc 2)
        bio:
          "Marc a lancé le programme féminin en 2021 et l'a mené en finale RSEQ. " +
          "Il mise sur l'autonomie et la lecture de jeu.",
      },
      staff: [
        { nom: "Sophie Lavoie", role: "Coordonnatrice offensive" },
        { nom: "David Roy", role: "Préparateur physique" },
      ],
      palmares: [
        { titre: "Championnes", annee: 2023, type: "championnat" },
        { titre: "Championnes", annee: 2024, type: "championnat" },
        { titre: "Finale", annee: 2025, type: "finale" },
      ],
    },
    // team_events (MOCK, Bloc 2) : camp (à venir, en tête) + matchs passés/à venir (sans score).
    events: [
      { type: "camp", date: "2026-08-15", domicile: true, heure: "09:00", lieu: "Complexe sportif Grasset" },
      { type: "match", date: "2026-06-07", adversaire: "André-Laurendeau", domicile: true, heure: "12:30", lieu: "Terrain Grasset" },
      { type: "match", date: "2026-06-21", adversaire: "Lionel-Groulx", domicile: false, heure: "14:00", lieu: "Sainte-Thérèse" },
      { type: "match", date: "2026-08-30", adversaire: "Limoilou", domicile: true, heure: "13:00", lieu: "Terrain Grasset" },
      { type: "match", date: "2026-09-13", adversaire: "Montmorency", domicile: false, heure: "14:30", lieu: "Montmorency" },
      { type: "match", date: "2026-09-27", adversaire: "Édouard-Montpetit", domicile: true, heure: "13:00", lieu: "Terrain Grasset" },
      { type: "match", date: "2026-10-11", adversaire: "Vieux Montréal", domicile: false, heure: "15:00", lieu: "CVM" },
    ],
    // commits (MOCK, Bloc 2) — 4 recrues engagées (féminin). visiblePublic = consentement (Bloc 2).
    commits: [
      { prenom: "Maya", nom: "Bélanger", ecoleProvenance: "École secondaire Mont-Royal", promo: 2027, etoiles: 5, visiblePublic: true },
      { prenom: "Léa", nom: "Gagnon", ecoleProvenance: "Collège Regina Assumpta", promo: 2027, etoiles: 4, visiblePublic: true },
      { prenom: "Zoé", nom: "Fournier", ecoleProvenance: "École secondaire Saint-Luc", promo: 2028, etoiles: 4, visiblePublic: true },
      { prenom: "Camille", nom: "Roy", ecoleProvenance: "Polyvalente de Charlesbourg", promo: 2027, etoiles: 3, visiblePublic: true },
    ],
  },
  // ── BASKETBALL — 1 facette (pas de toggle), pas d'asset → fallback ─────────
  {
    id: "grasset-basket-m", sportNom: "Basketball", division: "D3", genre: "Masculin",
    sportKey: "basketball", nom: "Basketball\nmasculin", ...GR,
    recordSaison: "18–6", recordLabel: "Saison 24-25", playoffResult: "½ finale", playoffLabel: "Séries RSEQ",
    socials: SOC, engagesCount: 1, season: SEASON,
    roster: [
      ...P("PG", [2026]), ...P("SG", [2026, 2026]), ...P("SF", [2027]), ...P("PF", [2028]), ...P("C", [2026]),
    ],
    // Athlète connecté AU POSTE COMPLET (ailier, 0 départ) → box « sans match » (§A).
    viewer: {
      sport: "Basketball", pos: "SF",
      posLabel: "Ailier", posLabelPlural: "ailiers",
    },
    // team_content PARTIEL — bio du head coach absente (→ élément omis, pas de trou).
    content: {
      presentationText:
        "Le programme de basketball du Phénix carbure au développement : jeu rapide, " +
        "beaucoup de minutes pour les jeunes, et un vestiaire tissé serré. On bâtit pour durer.",
      championships: 1,
      staffSince: 2022,
      headCoach: { nom: "Marc Tremblay", photoUrl: null, bio: "" }, // bio absente
      staff: [
        { nom: "Karim Haddad", role: "Adjoint" },
        { nom: "Éric Fortin", role: "Préparateur physique" },
      ],
      palmares: [], // aucun fanion → l'espace se resserre (validation « 0 fanion »)
    },
    commits: [
      { prenom: "Adam", nom: "Bouchard", ecoleProvenance: "École secondaire De Rochebelle", promo: 2027, etoiles: 4, visiblePublic: true },
    ],
  },
  // ── HOCKEY — 1 facette, photo réelle ──────────────────────────────────────
  {
    id: "grasset-hockey-m", sportNom: "Hockey", division: "D2", genre: "Masculin",
    sportKey: "hockey", nom: "Hockey\nmasculin", ...GR,
    recordSaison: "22–10", recordLabel: "Saison 24-25", playoffResult: "Quart de finale", playoffLabel: "Séries RSEQ",
    socials: SOC, engagesCount: 1, season: SEASON,
    roster: [
      ...P("C", [2026, 2026, 2026, 2028]), ...P("LW", [2026, 2028]), ...P("RW", [2027]),
      ...P("LD", [2026, 2026]), ...P("RD", [2026, 2028]), ...P("G", [2028]),
    ],
    viewer: null,
  },
  // ── BASEBALL — 1 facette, photo réelle (⚠ placeholder Dodger Stadium) ──────
  {
    id: "grasset-baseball-m", sportNom: "Baseball", division: "D1", genre: "Masculin",
    sportKey: "baseball", nom: "Baseball\nmasculin", ...GR,
    recordSaison: "24–8", recordLabel: "Saison 24-25", playoffResult: "Finale", playoffLabel: "Séries RSEQ",
    socials: SOC, engagesCount: 2, season: SEASON,
    roster: [
      ...P("CF", [2026]), ...P("LF", [2028]), ...P("RF", [2026]), ...P("SS", [2026, 2026]),
      ...P("2B", [2026]), ...P("3B", [2027]), ...P("1B", [2026]), ...P("P", [2026, 2026, 2026]), ...P("C", [2028]),
    ],
    viewer: null,
  },
  // ── SOCCER — 1 facette, pas d'asset → fallback pelouse ────────────────────
  {
    id: "grasset-soccer-m", sportNom: "Soccer", division: "D1", genre: "Masculin",
    sportKey: "soccer", nom: "Soccer\nmasculin", ...GR,
    recordSaison: "12–3", recordLabel: "Saison 24-25", playoffResult: "Finale", playoffLabel: "Séries RSEQ",
    socials: SOC, engagesCount: 1, season: SEASON,
    roster: [
      ...P("ST", [2026, 2026]), ...P("CF", [2028]),                         // ATTAQUANTS : 2 → élevé
      ...P("CM", [2026]), ...P("CDM", [2027]), ...P("CAM", [2028]),         // MILIEUX : 1 → moyen
      ...P("CB", [2026, 2026, 2026]), ...P("RB", [2028]), ...P("LB", [2027]), // DÉFENSEURS : 3 → priorité
      ...P("GK", [2028]),                                                    // GARDIEN : 0 → complet
    ],
    viewer: null,
  },
  // ── VOLLEYBALL — CARDS-ONLY (pas de terrain) ; stand-in classe Rugby/Ultimate ─
  {
    id: "grasset-volley-m", sportNom: "Volleyball", division: "D1", genre: "Masculin",
    sportKey: "volleyball", nom: "Volleyball\nmasculin", ...GR,
    recordSaison: "16–4", recordLabel: "Saison 24-25", playoffResult: "½ finale", playoffLabel: "Séries RSEQ",
    socials: SOC, engagesCount: 1, season: SEASON,
    roster: [
      ...P("P", [2026]), ...P("OH", [2026, 2026]), ...P("OPP", [2027]),
      ...P("MB", [2026]), ...P("L", [2028]), ...P("DS", [2026, 2026, 2026]),
    ],
    viewer: null,
  },
];
