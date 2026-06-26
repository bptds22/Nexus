/* ─────────────────────────────────────────────────────────────────
   Mock Threads Data — Gérer les Demandes
   7 threads across all status types.
───────────────────────────────────────────────────────────────── */

export type ThreadStatus = "nouveau" | "repondu" | "reponse_recue" | "envoye" | "archive";

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
  /** sender_id du DERNIER message du fil (null si aucun). Filtre "Sans réponse"
      coach desktop : lastSenderId === coach courant → en attente. */
  lastSenderId: string | null;
  unread: boolean;
}

/* ── Status config ───────────────────────────────────────────── */

export const STATUS_CONFIG: Record<ThreadStatus, { label: string; color: string; bg: string; textColor: string }> = {
  nouveau:       { label: "Nouveau",         color: "#E63946", bg: "bg-[#E63946]",   textColor: "text-white" },
  repondu:       { label: "Répondu",         color: "#22C55E", bg: "bg-[#22C55E]",   textColor: "text-black" },
  reponse_recue: { label: "Réponse reçue",  color: "#3B82F6", bg: "bg-[#3B82F6]",   textColor: "text-white" },
  envoye:        { label: "Envoyé",          color: "#FFFFFF", bg: "bg-white",        textColor: "text-black" },
  archive:       { label: "Archivé",         color: "#FFFFFF", bg: "bg-white/20",     textColor: "text-white/60" },
};

/* ── Helper: map DB status to ThreadStatus ─────────────────── */
export function mapDbStatus(dbStatus: string | null, coachReplied?: boolean, recruiterReplied?: boolean): ThreadStatus {
  const s = (dbStatus || "").toLowerCase();
  if (s === "archived" || s === "archive") return "archive";
  if (coachReplied && recruiterReplied) return "reponse_recue";
  if (coachReplied) return "repondu";
  return "nouveau";
}
