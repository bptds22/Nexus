/* ─────────────────────────────────────────────────────────────────
   Mock Threads Data — Gérer les Demandes
   7 threads across all status types.
───────────────────────────────────────────────────────────────── */

export type ThreadStatus = "reponse_recue" | "envoye" | "archive";

export interface RecruiterProfile {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  cegep: string;
  cegepTeamName?: string;
  division: "Div. 1" | "Div. 2" | "Div. 3";
  sport: string;
  region: string;
  email: string;
  phone: string;
}

export interface ThreadAthleteContext {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  niveau: "Sec. 4" | "Sec. 5";
  profilePercent: number;
  isVerified: boolean;              // true if profilePercent >= 60
  views: number;
  favorites: number;
  stars: number;
  missingFields?: string[];
}

export interface Message {
  id: string;
  sender: "recruiter" | "coach";
  text: string;
  timestamp: string;
}

export interface ConversationThread {
  id: string;
  recruiter: RecruiterProfile;
  athlete: ThreadAthleteContext;
  messages: Message[];
  status: ThreadStatus;
  lastMessagePreview: string;
  lastMessageTime: string;
  unread: boolean;
}

/* ── Status config ───────────────────────────────────────────── */

export const STATUS_CONFIG: Record<ThreadStatus, { label: string; color: string; bg: string; textColor: string }> = {
  reponse_recue: { label: "Réponse reçue",  color: "#22C55E", bg: "bg-[#22C55E]",   textColor: "text-black" },
  envoye:        { label: "Envoyé",          color: "#FFFFFF", bg: "bg-white",        textColor: "text-black" },
  archive:       { label: "Archivé",         color: "#FFFFFF", bg: "bg-white/20",     textColor: "text-white/60" },
};

/* ── 7 Threads ───────────────────────────────────────────────── */

export const MOCK_THREADS: ConversationThread[] = [
  /* 1 — RÉPONSE REÇUE (recruiter wrote, coach hasn't replied) */
  {
    id: "th-001",
    recruiter: {
      id: "rec-001", firstName: "Pierre", lastName: "Dufour",
      title: "Coordonnateur football", cegep: "CÉGEP Garneau", cegepTeamName: "Élans",
      division: "Div. 1", sport: "Football", region: "Québec, QC",
      email: "p.dufour@cegep-garneau.qc.ca", phone: "418-555-0142",
    },
    athlete: {
      id: "r-001", firstName: "Marc-Antoine", lastName: "Tremblay",
      position: "QB", niveau: "Sec. 5", profilePercent: 100, isVerified: true, views: 34, favorites: 3, stars: 5,
    },
    messages: [
      {
        id: "m-001", sender: "recruiter",
        text: "Bonjour Coach Bergeron, j'ai consulté le profil de Marc-Antoine Tremblay et son vidéo de faits saillants m'a vraiment impressionné. Nous avons un besoin au poste de QB pour la saison 2026-2027. Serait-il possible d'organiser une visite au CÉGEP Garneau?",
        timestamp: "2026-03-10T08:00:00",
      },
    ],
    status: "reponse_recue",
    lastMessagePreview: "Bonjour Coach Bergeron, j'ai consulté le profil de Marc-Antoine Tremblay et son vidéo...",
    lastMessageTime: "2026-03-10T08:00:00",
    unread: true,
  },

  /* 2 — RÉPONSE REÇUE */
  {
    id: "th-002",
    recruiter: {
      id: "rec-002", firstName: "François", lastName: "Leclerc",
      title: "Entraîneur-chef", cegep: "CÉGEP du Vieux Montréal", cegepTeamName: "Spartiates",
      division: "Div. 1", sport: "Football", region: "Montréal, QC",
      email: "f.leclerc@cvm.qc.ca", phone: "514-555-0287",
    },
    athlete: {
      id: "r-002", firstName: "Jérémy", lastName: "Lavoie",
      position: "WR", niveau: "Sec. 5", profilePercent: 100, isVerified: true, views: 28, favorites: 2, stars: 4,
    },
    messages: [
      {
        id: "m-002", sender: "recruiter",
        text: "Coach, je suis François Leclerc des Spartiates. Votre receveur Jérémy Lavoie a attiré notre attention. Ses stats de réception sont excellentes. Pouvons-nous en discuter?",
        timestamp: "2026-03-10T05:00:00",
      },
    ],
    status: "reponse_recue",
    lastMessagePreview: "Coach, je suis François Leclerc des Spartiates. Votre receveur Jérémy Lavoie a attiré...",
    lastMessageTime: "2026-03-10T05:00:00",
    unread: true,
  },

  /* 3 — RÉPONSE REÇUE (recruiter followed up) */
  {
    id: "th-003",
    recruiter: {
      id: "rec-003", firstName: "Marie-Claire", lastName: "Bouchard",
      title: "Coord. recrutement", cegep: "CÉGEP Limoilou", cegepTeamName: "Titans",
      division: "Div. 1", sport: "Football", region: "Québec, QC",
      email: "mc.bouchard@cegep-limoilou.qc.ca", phone: "418-555-0319",
    },
    athlete: {
      id: "r-003", firstName: "Félix", lastName: "Gagnon-Roy",
      position: "LB", niveau: "Sec. 5", profilePercent: 100, isVerified: true, views: 22, favorites: 1, stars: 4,
    },
    messages: [
      {
        id: "m-003a", sender: "recruiter",
        text: "Bonjour Coach, nous recherchons un secondeur de calibre pour compléter notre effectif défensif pour la prochaine saison. Le profil de Félix Gagnon-Roy correspond exactement à ce que nous cherchons.",
        timestamp: "2026-03-05T14:00:00",
      },
      {
        id: "m-003b", sender: "recruiter",
        text: "Coach, avez-vous eu la chance de consulter mon message? J'aimerais beaucoup discuter de Félix. Notre fenêtre de recrutement se termine bientôt.",
        timestamp: "2026-03-08T10:00:00",
      },
    ],
    status: "reponse_recue",
    lastMessagePreview: "Coach, avez-vous eu la chance de consulter mon message? J'aimerais beaucoup discuter de...",
    lastMessageTime: "2026-03-08T10:00:00",
    unread: false,
  },

  /* 4 — ENVOYÉ (coach replied, waiting on recruiter) */
  {
    id: "th-004",
    recruiter: {
      id: "rec-004", firstName: "Jean-François", lastName: "Tremblay",
      title: "Entraîneur adjoint", cegep: "CÉGEP Saint-Jean-sur-Richelieu", cegepTeamName: "Géants",
      division: "Div. 1", sport: "Football", region: "Montérégie, QC",
      email: "jf.tremblay@cstjean.qc.ca", phone: "450-555-0173",
    },
    athlete: {
      id: "r-005", firstName: "Alexis", lastName: "Bouchard",
      position: "RB", niveau: "Sec. 4", profilePercent: 100, isVerified: true, views: 18, favorites: 0, stars: 3,
    },
    messages: [
      {
        id: "m-004a", sender: "recruiter",
        text: "Nous suivons Alexis Bouchard depuis le début de la saison. Ses stats au sol sont impressionnantes pour un joueur de Sec. 4. Nous aimerions le garder sur notre radar pour 2027.",
        timestamp: "2026-03-07T09:00:00",
      },
      {
        id: "m-004b", sender: "coach",
        text: "Merci pour votre intérêt, M. Tremblay! Alexis est effectivement un talent exceptionnel. Il sera admissible pour la saison 2027. Je serai heureux de vous tenir informé de sa progression.",
        timestamp: "2026-03-07T14:00:00",
      },
      {
        id: "m-004c", sender: "recruiter",
        text: "Parfait. Nous aimerions l'inviter à notre camp d'évaluation au printemps. Quelle serait sa disponibilité en avril?",
        timestamp: "2026-03-08T11:00:00",
      },
      {
        id: "m-004d", sender: "coach",
        text: "Je vérifie avec lui et ses parents cette semaine. Je vous reviens d'ici vendredi avec ses disponibilités.",
        timestamp: "2026-03-09T10:00:00",
      },
    ],
    status: "envoye",
    lastMessagePreview: "Je vérifie avec lui et ses parents cette semaine. Je vous reviens d'ici vendredi...",
    lastMessageTime: "2026-03-09T10:00:00",
    unread: false,
  },

  /* 5 — ENVOYÉ (coach confirmed visit) */
  {
    id: "th-005",
    recruiter: {
      id: "rec-005", firstName: "André", lastName: "Carpentier",
      title: "Coordonnateur football", cegep: "Collège André-Grasset", cegepTeamName: "Phénix",
      division: "Div. 1", sport: "Football", region: "Montréal, QC",
      email: "a.carpentier@grasset.qc.ca", phone: "514-555-0456",
    },
    athlete: {
      id: "r-004", firstName: "Xavier", lastName: "Lapointe",
      position: "RB", niveau: "Sec. 5", profilePercent: 100, isVerified: true, views: 15, favorites: 1, stars: 4,
    },
    messages: [
      {
        id: "m-005a", sender: "recruiter",
        text: "Bonjour Coach, Xavier Lapointe a un profil très intéressant. Nous aurions une place pour un porteur de ballon de son calibre.",
        timestamp: "2026-03-01T09:00:00",
      },
      {
        id: "m-005b", sender: "coach",
        text: "Merci M. Carpentier! Xavier serait très intéressé. Il a toujours admiré le programme des Phénix.",
        timestamp: "2026-03-01T15:00:00",
      },
      {
        id: "m-005c", sender: "recruiter",
        text: "Excellent! Nous organisons des visites pour les recrues le 22 mars. Xavier serait-il disponible?",
        timestamp: "2026-03-03T10:00:00",
      },
      {
        id: "m-005d", sender: "coach",
        text: "Je confirme que le 22 mars fonctionne. Xavier sera présent à la visite. Il a très hâte de découvrir votre programme et vos installations.",
        timestamp: "2026-03-03T16:00:00",
      },
    ],
    status: "envoye",
    lastMessagePreview: "Je confirme que le 22 mars fonctionne. Xavier sera présent à la visite...",
    lastMessageTime: "2026-03-03T16:00:00",
    unread: false,
  },

  /* 6 — ENVOYÉ (coach replied last) */
  {
    id: "th-006",
    recruiter: {
      id: "rec-006", firstName: "Paul", lastName: "Martineau",
      title: "Entraîneur-chef", cegep: "CÉGEP Garneau", cegepTeamName: "Élans",
      division: "Div. 1", sport: "Football", region: "Québec, QC",
      email: "p.martineau@cegep-garneau.qc.ca", phone: "418-555-0208",
    },
    athlete: {
      id: "r-014", firstName: "Thomas", lastName: "Carrier-Brault",
      position: "TE", niveau: "Sec. 5", profilePercent: 100, isVerified: true, views: 0, favorites: 0, stars: 5,
    },
    messages: [
      {
        id: "m-006a", sender: "recruiter",
        text: "Bonjour, Thomas Carrier-Brault est exactement le type d'ailier rapproché que nous recherchons pour notre offensive.",
        timestamp: "2026-01-15T10:00:00",
      },
      {
        id: "m-006b", sender: "coach",
        text: "Thomas est un joueur exceptionnel. Il serait très intéressé par votre programme.",
        timestamp: "2026-01-15T16:00:00",
      },
      {
        id: "m-006c", sender: "recruiter",
        text: "Nous l'avons invité à notre journée portes ouvertes le 8 février.",
        timestamp: "2026-01-20T09:00:00",
      },
      {
        id: "m-006d", sender: "coach",
        text: "Il sera présent! Merci pour cette opportunité.",
        timestamp: "2026-01-20T14:00:00",
      },
      {
        id: "m-006e", sender: "recruiter",
        text: "La visite s'est très bien passée. Thomas a adoré le campus et notre programme. Nous souhaitons lui offrir une place officielle.",
        timestamp: "2026-02-10T11:00:00",
      },
      {
        id: "m-006f", sender: "coach",
        text: "Quelle nouvelle fantastique! Thomas et sa famille sont ravis. Nous procédons avec la lettre d'intention.",
        timestamp: "2026-02-10T17:00:00",
      },
      {
        id: "m-006g", sender: "recruiter",
        text: "Coach, c'est officiel! Thomas a signé sa lettre d'intention. Bienvenue chez les Élans! Merci pour votre collaboration tout au long du processus.",
        timestamp: "2026-02-28T10:00:00",
      },
      {
        id: "m-006h", sender: "coach",
        text: "Félicitations à Thomas et à votre programme! C'est un grand jour. Merci pour votre professionnalisme, M. Martineau.",
        timestamp: "2026-02-28T14:00:00",
      },
    ],
    status: "envoye",
    lastMessagePreview: "Félicitations à Thomas et à votre programme! C'est un grand jour...",
    lastMessageTime: "2026-02-28T14:00:00",
    unread: false,
  },

  /* 7 — ARCHIVÉ */
  {
    id: "th-007",
    recruiter: {
      id: "rec-007", firstName: "Simon", lastName: "Lafleur",
      title: "Adjoint football", cegep: "CÉGEP de Sherbrooke",
      division: "Div. 2", sport: "Football", region: "Estrie, QC",
      email: "s.lafleur@cegepsherbrooke.qc.ca", phone: "819-555-0391",
    },
    athlete: {
      id: "r-006", firstName: "Samuel", lastName: "Côté",
      position: "OL", niveau: "Sec. 5", profilePercent: 100, isVerified: true, views: 12, favorites: 0, stars: 3,
    },
    messages: [
      {
        id: "m-007a", sender: "recruiter",
        text: "Bonjour, nous aurions un intérêt pour Samuel Côté à la position de joueur de ligne offensive.",
        timestamp: "2026-02-01T09:00:00",
      },
      {
        id: "m-007b", sender: "coach",
        text: "Merci pour l'intérêt! Samuel est un joueur solide. Je vous envoie ses stats détaillées.",
        timestamp: "2026-02-03T10:00:00",
      },
      {
        id: "m-007c", sender: "recruiter",
        text: "Merci pour les informations. Après discussion avec notre équipe d'entraîneurs, nous allons considérer d'autres options pour le moment. Bonne continuation à Samuel.",
        timestamp: "2026-02-15T14:00:00",
      },
    ],
    status: "archive",
    lastMessagePreview: "Merci pour les informations. Après discussion avec notre équipe d'entraîneurs...",
    lastMessageTime: "2026-02-15T14:00:00",
    unread: false,
  },
];

/* ── Helper: lookup thread by ID ─────────────────────────────── */
export function getThread(id: string): ConversationThread | undefined {
  return MOCK_THREADS.find((t) => t.id === id);
}
