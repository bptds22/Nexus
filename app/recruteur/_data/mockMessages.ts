/* ─────────────────────────────────────────────────────────────────
   Mock Messages — Recruiter-perspective conversation threads
───────────────────────────────────────────────────────────────── */

export type RecruiterThreadStatus = "envoye" | "lu" | "reponse_recue" | "archive";

export interface RecruiterMessage {
  id: string;
  sender: "recruiter" | "coach";
  text: string;
  timestamp: string;
}

export interface CoachContext {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  school: string;
  sport: string;
  division?: "Div. 1" | "Div. 2" | "Div. 3";
  region: string;
  email: string;
  phone: string;
}

export interface AthleteContext {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  isVerified: boolean;
  stars: number;
  gradYear?: number;
  jerseyNumber?: number;
  school?: string;
}

export interface RecruiterThread {
  id: string;
  coach: CoachContext;
  athlete: AthleteContext;
  messages: RecruiterMessage[];
  status: RecruiterThreadStatus;
  lastMessagePreview: string;
  lastMessageTime: string;
  unread: boolean;
}

export const RECRUITER_STATUS_CONFIG: Record<RecruiterThreadStatus, {
  label: string; color: string; bg: string; textColor: string;
}> = {
  envoye:       { label: "Envoyé",          color: "#FFFFFF", bg: "bg-white",        textColor: "text-black" },
  lu:           { label: "Lu",              color: "#FFFFFF", bg: "bg-white",        textColor: "text-black" },
  reponse_recue:{ label: "Réponse reçue",   color: "#22C55E", bg: "bg-[#22C55E]",   textColor: "text-black" },
  archive:      { label: "Archivé",         color: "#FFFFFF", bg: "bg-white/20",     textColor: "text-white/60" },
};

export const MOCK_RECRUITER_THREADS: RecruiterThread[] = [
  /* 1 — Réponse reçue — Coach Bergeron about Marc-Antoine */
  {
    id: "rth-001",
    coach: { id: "coach-001", firstName: "Michel", lastName: "Bergeron", title: "Entraîneur-chef", school: "É.S. Saint-Jean-Eudes", sport: "Football", division: "Div. 1", region: "Québec, QC", email: "m.bergeron@sje.qc.ca", phone: "(418) 555-0147" },
    athlete: { id: "r-001", firstName: "Marc-Antoine", lastName: "Tremblay", position: "QB", isVerified: true, stars: 5, gradYear: 2026, jerseyNumber: 12, school: "É.S. Saint-Jean-Eudes" },
    messages: [
      { id: "rm-001a", sender: "recruiter", text: "Bonjour Coach Bergeron, j'ai consulté le profil de Marc-Antoine Tremblay et son vidéo de faits saillants m'a vraiment impressionné. Nous avons un besoin au poste de QB pour la saison 2026-2027. Serait-il possible d'organiser une visite au CÉGEP Garneau?", timestamp: "2026-03-05T10:00:00" },
      { id: "rm-001b", sender: "coach", text: "Bonjour M. Dufour! Merci pour votre intérêt envers Marc-Antoine. Il serait effectivement très intéressé par votre programme. Le 22 mars lui conviendrait parfaitement pour une visite. Souhaitez-vous que je coordonne avec ses parents?", timestamp: "2026-03-06T14:00:00" },
      { id: "rm-001c", sender: "recruiter", text: "Excellent! Oui, ce serait idéal. Le 22 mars fonctionne très bien de notre côté. Nous lui ferons visiter le campus et nos installations sportives.", timestamp: "2026-03-06T16:00:00" },
      { id: "rm-001d", sender: "coach", text: "Parfait, c'est confirmé. Marc-Antoine et ses parents seront présents le 22 mars à 10h. Il a très hâte de découvrir votre programme!", timestamp: "2026-03-08T09:00:00" },
    ],
    status: "reponse_recue",
    lastMessagePreview: "Parfait, c'est confirmé. Marc-Antoine et ses parents seront présents le 22 mars...",
    lastMessageTime: "2026-03-08T09:00:00",
    unread: true,
  },

  /* 2 — Réponse reçue — Coach Bergeron about Jérémy */
  {
    id: "rth-002",
    coach: { id: "coach-001", firstName: "Michel", lastName: "Bergeron", title: "Entraîneur-chef", school: "É.S. Saint-Jean-Eudes", sport: "Football", division: "Div. 1", region: "Québec, QC", email: "m.bergeron@sje.qc.ca", phone: "(418) 555-0147" },
    athlete: { id: "r-002", firstName: "Jérémy", lastName: "Lavoie", position: "WR", isVerified: true, stars: 4, gradYear: 2026, jerseyNumber: 7, school: "É.S. Saint-Jean-Eudes" },
    messages: [
      { id: "rm-002a", sender: "recruiter", text: "Coach, votre receveur Jérémy Lavoie a attiré notre attention. Ses stats de réception sont excellentes cette saison. Pouvons-nous en discuter?", timestamp: "2026-03-07T11:00:00" },
      { id: "rm-002b", sender: "coach", text: "Absolument! Jérémy est un joueur exceptionnel. 48 réceptions pour 720 verges cette saison. Il est très motivé à poursuivre au CÉGEP. Quelles sont les prochaines étapes?", timestamp: "2026-03-09T10:00:00" },
    ],
    status: "reponse_recue",
    lastMessagePreview: "Absolument! Jérémy est un joueur exceptionnel. 48 réceptions pour 720 verges...",
    lastMessageTime: "2026-03-09T10:00:00",
    unread: true,
  },

  /* 3 — En attente — Coach Lafleur about Félix */
  {
    id: "rth-003",
    coach: { id: "coach-002", firstName: "Jean", lastName: "Lafleur", title: "Coordonnateur football", school: "É.S. De Mortagne", sport: "Football", division: "Div. 1", region: "Montérégie, QC", email: "j.lafleur@demortagne.qc.ca", phone: "(450) 555-0233" },
    athlete: { id: "r-003", firstName: "Félix", lastName: "Gagnon-Roy", position: "LB", isVerified: true, stars: 4, gradYear: 2026, jerseyNumber: 55, school: "É.S. De Mortagne" },
    messages: [
      { id: "rm-003a", sender: "recruiter", text: "Bonjour Coach Lafleur, nous recherchons un secondeur de calibre pour compléter notre effectif défensif. Le profil de Félix Gagnon-Roy correspond exactement à ce que nous cherchons. Est-il ouvert à une discussion?", timestamp: "2026-03-07T09:00:00" },
    ],
    status: "envoye",
    lastMessagePreview: "Bonjour Coach Lafleur, nous recherchons un secondeur de calibre pour compléter...",
    lastMessageTime: "2026-03-07T09:00:00",
    unread: false,
  },

  /* 4 — Envoyé — Coach Tremblay about Xavier */
  {
    id: "rth-004",
    coach: { id: "coach-003", firstName: "Patrick", lastName: "Tremblay", title: "Entraîneur adjoint", school: "É.S. De Mortagne", sport: "Football", division: "Div. 1", region: "Montérégie, QC", email: "p.tremblay@demortagne.qc.ca", phone: "(450) 555-0189" },
    athlete: { id: "r-004", firstName: "Xavier", lastName: "Lapointe", position: "RB", isVerified: true, stars: 4, gradYear: 2026, jerseyNumber: 22, school: "É.S. De Mortagne" },
    messages: [
      { id: "rm-004a", sender: "recruiter", text: "Bonjour Coach Tremblay, Xavier Lapointe a un profil très intéressant. Nous aurions une place pour un porteur de ballon de son calibre chez les Élans. Serait-il ouvert à discuter?", timestamp: "2026-03-10T08:30:00" },
    ],
    status: "envoye",
    lastMessagePreview: "Bonjour Coach Tremblay, Xavier Lapointe a un profil très intéressant...",
    lastMessageTime: "2026-03-10T08:30:00",
    unread: false,
  },

  /* 5 — Archivé — Coach Martin about Samuel */
  {
    id: "rth-005",
    coach: { id: "coach-004", firstName: "Luc", lastName: "Martin", title: "Entraîneur-chef", school: "É.S. Roger-Comtois", sport: "Football", division: "Div. 2", region: "Québec, QC", email: "l.martin@rogercomtois.qc.ca", phone: "(418) 555-0312" },
    athlete: { id: "r-006", firstName: "Samuel", lastName: "Côté", position: "OL", isVerified: true, stars: 3, gradYear: 2026, jerseyNumber: 74, school: "É.S. Roger-Comtois" },
    messages: [
      { id: "rm-005a", sender: "recruiter", text: "Bonjour Coach Martin, nous aurions un intérêt pour Samuel Côté à la position de joueur de ligne offensive.", timestamp: "2026-02-01T09:00:00" },
      { id: "rm-005b", sender: "coach", text: "Merci pour l'intérêt! Samuel est un joueur solide. Il mesure 6'3\" et pèse 265 lbs. Son éthique de travail est exemplaire.", timestamp: "2026-02-03T10:00:00" },
      { id: "rm-005c", sender: "recruiter", text: "Merci pour les informations. Après discussion avec notre équipe, nous allons prioriser d'autres profils pour le moment. Samuel reste sur notre radar pour l'avenir.", timestamp: "2026-02-15T14:00:00" },
    ],
    status: "archive",
    lastMessagePreview: "Merci pour les informations. Après discussion avec notre équipe, nous allons...",
    lastMessageTime: "2026-02-15T14:00:00",
    unread: false,
  },
];

export function getRecruiterThread(id: string): RecruiterThread | undefined {
  return MOCK_RECRUITER_THREADS.find((t) => t.id === id);
}
