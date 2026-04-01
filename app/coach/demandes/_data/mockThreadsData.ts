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

/* ── Helper: map DB status to ThreadStatus ─────────────────── */
export function mapDbStatus(dbStatus: string | null): ThreadStatus {
  const s = (dbStatus || "").toLowerCase();
  if (s === "reponse_recue") return "reponse_recue";
  if (s === "archive") return "archive";
  return "envoye";
}
