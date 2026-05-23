/* ─────────────────────────────────────────────────────────────────
   Admin Portal — Mock Data (POC)
───────────────────────────────────────────────────────────────── */

// ── Platform KPIs ────────────────────────────────────────────

export const adminKPIs = {
  totalAthletes: 347,
  verifiedProfiles: 231,
  activeRecruiters: 42,
  activeCoachs: 89,
  pendingContactRequests: 18,
  avgProfileCompletion: 72,
  weeklySignups: [12, 15, 8, 22, 18, 25, 19],
  pendingRecruiterValidations: 5,
  pendingProfileApprovals: 8,
  flaggedContent: 3,
};

// ── Users ────────────────────────────────────────────────────

export interface AdminUserRow {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "coach" | "recruiter" | "director" | "athlete" | "coordinator";
  school_or_cegep: string;
  status: "active" | "suspended" | "pending_validation";
  created_at: string;
  last_login_at: string | null;
}

export const ADMIN_USERS: AdminUserRow[] = [
  // Admins (3)
  { id: "u-001", full_name: "Charles-Alexandre Déry", email: "ca.dery@nexussports.ca", role: "admin", school_or_cegep: "Nexus HQ", status: "active", created_at: "2024-09-01T10:00:00Z", last_login_at: "2026-03-16T08:30:00Z" },
  { id: "u-002", full_name: "Bruno-Philippe Desfossés", email: "bp.desfosses@nexussports.ca", role: "admin", school_or_cegep: "Nexus HQ", status: "active", created_at: "2024-09-01T10:00:00Z", last_login_at: "2026-03-15T19:45:00Z" },
  { id: "u-003", full_name: "Marie-Ève Lavoie", email: "me.lavoie@nexussports.ca", role: "admin", school_or_cegep: "Nexus HQ", status: "active", created_at: "2024-11-15T14:00:00Z", last_login_at: "2026-03-14T11:20:00Z" },

  // Coaches (8 — 7 active, 1 suspended)
  { id: "u-010", full_name: "Marc-André Pelletier", email: "ma.pelletier@rochebelle.qc.ca", role: "coach", school_or_cegep: "École De Rochebelle", status: "active", created_at: "2025-01-10T09:00:00Z", last_login_at: "2026-03-15T14:10:00Z" },
  { id: "u-011", full_name: "Sophie Tremblay", email: "s.tremblay@pdm.qc.ca", role: "coach", school_or_cegep: "Polyvalente Deux-Montagnes", status: "active", created_at: "2025-01-22T11:30:00Z", last_login_at: "2026-03-14T09:00:00Z" },
  { id: "u-012", full_name: "Jean-François Roy", email: "jf.roy@csb.qc.ca", role: "coach", school_or_cegep: "Collège Saint-Bernard", status: "active", created_at: "2025-02-05T08:00:00Z", last_login_at: "2026-03-13T16:30:00Z" },
  { id: "u-013", full_name: "Patrick Bergeron", email: "p.bergeron@sje.qc.ca", role: "coach", school_or_cegep: "É.S. Saint-Jean-Eudes", status: "active", created_at: "2025-02-18T13:00:00Z", last_login_at: "2026-03-16T07:45:00Z" },
  { id: "u-014", full_name: "Isabelle Côté", email: "i.cote@seminaire.qc.ca", role: "coach", school_or_cegep: "Séminaire de Sherbrooke", status: "active", created_at: "2025-03-01T10:00:00Z", last_login_at: "2026-03-12T10:15:00Z" },
  { id: "u-015", full_name: "Mathieu Gagnon", email: "m.gagnon@montmorency.qc.ca", role: "coach", school_or_cegep: "Collège Montmorency", status: "active", created_at: "2025-03-15T09:30:00Z", last_login_at: "2026-03-11T08:00:00Z" },
  { id: "u-016", full_name: "Alexandre Fortin", email: "a.fortin@stlouis.qc.ca", role: "coach", school_or_cegep: "Collège Saint-Louis", status: "active", created_at: "2025-04-02T14:00:00Z", last_login_at: "2026-03-10T17:20:00Z" },
  { id: "u-017", full_name: "David Lapierre", email: "d.lapierre@levis.qc.ca", role: "coach", school_or_cegep: "École secondaire de Lévis", status: "suspended", created_at: "2025-04-20T11:00:00Z", last_login_at: "2026-02-01T09:00:00Z" },

  // Recruiters (6 — 4 active, 2 pending_validation)
  { id: "u-020", full_name: "Pierre Dufour", email: "p.dufour@cegep-garneau.qc.ca", role: "recruiter", school_or_cegep: "CÉGEP Garneau", status: "active", created_at: "2025-01-05T10:00:00Z", last_login_at: "2026-03-16T09:00:00Z" },
  { id: "u-021", full_name: "Caroline Bergeron", email: "c.bergeron@montmorency.qc.ca", role: "recruiter", school_or_cegep: "Collège Montmorency", status: "active", created_at: "2025-01-18T14:00:00Z", last_login_at: "2026-03-15T11:30:00Z" },
  { id: "u-022", full_name: "Martin Lapointe", email: "m.lapointe@cegep-jonquiere.qc.ca", role: "recruiter", school_or_cegep: "CÉGEP de Jonquière", status: "active", created_at: "2025-02-10T09:00:00Z", last_login_at: "2026-03-14T15:00:00Z" },
  { id: "u-023", full_name: "Stéphanie Bouchard", email: "s.bouchard@ste-foy.qc.ca", role: "recruiter", school_or_cegep: "CÉGEP de Sainte-Foy", status: "active", created_at: "2025-03-05T13:00:00Z", last_login_at: "2026-03-13T10:00:00Z" },
  { id: "u-024", full_name: "Éric Tanguay", email: "e.tanguay@edouard-montpetit.qc.ca", role: "recruiter", school_or_cegep: "CÉGEP Édouard-Montpetit", status: "pending_validation", created_at: "2026-03-10T09:00:00Z", last_login_at: null },
  { id: "u-025", full_name: "Gabrielle Morin", email: "g.morin@lionel-groulx.qc.ca", role: "recruiter", school_or_cegep: "CÉGEP Lionel-Groulx", status: "pending_validation", created_at: "2026-03-12T15:00:00Z", last_login_at: null },

  // Directors (7 — 5 owners, 2 collaborators)
  { id: "u-030", full_name: "Nathalie Gagnon", email: "n.gagnon@rochebelle.qc.ca", role: "director", school_or_cegep: "École De Rochebelle", status: "active", created_at: "2025-01-08T10:00:00Z", last_login_at: "2026-03-15T08:00:00Z" },
  { id: "u-031", full_name: "François Simard", email: "f.simard@cegep-garneau.qc.ca", role: "director", school_or_cegep: "CÉGEP Garneau", status: "active", created_at: "2025-01-20T11:00:00Z", last_login_at: "2026-03-14T14:30:00Z" },
  { id: "u-032", full_name: "Josée Bélanger", email: "j.belanger@seminaire.qc.ca", role: "director", school_or_cegep: "Séminaire de Sherbrooke", status: "active", created_at: "2025-02-12T09:00:00Z", last_login_at: "2026-03-12T16:00:00Z" },
  { id: "u-033", full_name: "Marie-Ève Lapointe", email: "me.lapointe@demortagne.qc.ca", role: "director", school_or_cegep: "É.S. De Mortagne", status: "active", created_at: "2025-09-01T10:00:00Z", last_login_at: "2026-03-16T10:00:00Z" },
  { id: "u-034", full_name: "Patrick Bergeron", email: "p.bergeron@sje.qc.ca", role: "director", school_or_cegep: "É.S. Saint-Jean-Eudes", status: "active", created_at: "2025-03-15T09:00:00Z", last_login_at: "2026-01-28T14:00:00Z" },
  { id: "u-035", full_name: "Luc Tremblay", email: "l.tremblay@rochebelle.qc.ca", role: "director", school_or_cegep: "École De Rochebelle", status: "active", created_at: "2025-09-15T11:00:00Z", last_login_at: "2026-03-14T09:30:00Z" },
  { id: "u-036", full_name: "Sylvie Côté", email: "s.cote@cegep-garneau.qc.ca", role: "director", school_or_cegep: "CÉGEP Garneau", status: "active", created_at: "2025-10-01T14:00:00Z", last_login_at: "2026-03-15T16:00:00Z" },

  // Athletes (5 — invited by coaches, have accounts)
  { id: "u-040", full_name: "Marc-Antoine Tremblay", email: "marc-antoine@gmail.com", role: "athlete", school_or_cegep: "É.S. Saint-Jean-Eudes", status: "active", created_at: "2025-10-01T09:00:00Z", last_login_at: "2026-03-18T14:30:00Z" },
  { id: "u-041", full_name: "Samuel Bouchard", email: "samuel.b@outlook.com", role: "athlete", school_or_cegep: "Le Sommet", status: "active", created_at: "2025-11-15T10:00:00Z", last_login_at: "2026-03-17T11:00:00Z" },
  { id: "u-042", full_name: "Émilie Gagnon", email: "emilie.g@gmail.com", role: "athlete", school_or_cegep: "Mont-Royal", status: "active", created_at: "2025-12-01T14:00:00Z", last_login_at: "2026-03-16T09:00:00Z" },
  { id: "u-043", full_name: "Xavier Lapointe", email: "x.lapointe@hotmail.com", role: "athlete", school_or_cegep: "É.S. De Mortagne", status: "active", created_at: "2026-01-10T11:00:00Z", last_login_at: "2026-03-15T16:00:00Z" },
  { id: "u-044", full_name: "Félix Gagnon-Roy", email: "felix.gr@gmail.com", role: "athlete", school_or_cegep: "É.S. De Mortagne", status: "active", created_at: "2026-02-01T09:00:00Z", last_login_at: "2026-03-14T08:00:00Z" },

  // League Coordinators (2)
  { id: "u-lc-001", full_name: "Patrick Roy", email: "p.roy@wildcats.ca", role: "coordinator", school_or_cegep: "Wildcats Lanaudière", status: "active", created_at: "2025-05-01T10:00:00Z", last_login_at: "2026-03-18T09:00:00Z" },
  { id: "u-lc-002", full_name: "Marie-Ève Tremblay", email: "me.tremblay@rempartsaaa.ca", role: "coordinator", school_or_cegep: "Remparts Hockey AAA", status: "active", created_at: "2025-04-10T10:00:00Z", last_login_at: "2026-03-17T14:30:00Z" },
];

// ── Pending Recruiter Validations ────────────────────────────

export interface PendingRecruiter {
  id: string;
  full_name: string;
  email: string;
  declared_cegep: string;
  justification: string;
  submitted_at: string;
}

export const PENDING_RECRUITERS: PendingRecruiter[] = [
  { id: "pr-001", full_name: "Éric Tanguay", email: "e.tanguay@edouard-montpetit.qc.ca", declared_cegep: "CÉGEP Édouard-Montpetit", justification: "Coordonnateur sportif depuis 2019. Responsable du recrutement football et basketball.", submitted_at: "2026-03-10T09:00:00Z" },
  { id: "pr-002", full_name: "Gabrielle Morin", email: "g.morin@lionel-groulx.qc.ca", declared_cegep: "CÉGEP Lionel-Groulx", justification: "Entraîneur-chef volleyball féminin. 8 ans d'expérience au collégial.", submitted_at: "2026-03-12T15:00:00Z" },
  { id: "pr-003", full_name: "Vincent Lacroix", email: "v.lacroix@trois-rivieres.qc.ca", declared_cegep: "CÉGEP de Trois-Rivières", justification: "Responsable du programme Sport-études hockey. Ancien joueur LHJMQ.", submitted_at: "2026-03-13T11:00:00Z" },
  { id: "pr-004", full_name: "Amélie Fournier", email: "a.fournier@andre-laurendeau.qc.ca", declared_cegep: "CÉGEP André-Laurendeau", justification: "Directrice adjointe aux sports. Gère le recrutement pour 5 programmes.", submitted_at: "2026-03-14T08:30:00Z" },
  { id: "pr-005", full_name: "Philippe Marchand", email: "p.marchand@sherbrooke.qc.ca", declared_cegep: "CÉGEP de Sherbrooke", justification: "Entraîneur-chef football division 1 depuis 2021.", submitted_at: "2026-03-15T16:00:00Z" },
];

// ── System Alerts ────────────────────────────────────────────

export interface SystemAlert {
  id: string;
  type: "pending_approval" | "pending_validation" | "flagged_content" | "system" | "ownership_transfer" | "director_join" | "inactive_owner";
  message: string;
  severity: "info" | "warning" | "critical";
  created_at: string;
  link: string;
}

// ── Schools (with Loi 25 compliance) ────────────────────────

export type ContractStatus = "EN_ATTENTE" | "ENVOYE" | "ACCEPTE" | "EXPIRE" | "REFUSE";

export interface Loi25Contract {
  id: string;
  institution_id: string;
  institution_type: "ECOLE_SECONDAIRE" | "CEGEP";
  contract_version: string;
  status: ContractStatus;
  rprp_nom: string;
  rprp_courriel: string;
  rprp_telephone?: string;
  sent_at?: string;
  accepted_at?: string;
  accepted_by?: string;
  expires_at?: string;
  ip_address?: string;
  pdf_url?: string;
}

export interface Loi25AuditEntry {
  date: string;
  action: string;
}

export interface AdminSchoolRow {
  id: string;
  name: string;
  type: "secondaire" | "cegep";
  city: string;
  region: string;
  conference: "sud_ouest" | "nord_est" | null;
  sports: string[];
  coaches_count: number;
  recruiters_count: number;
  directors_count: number;
  athletes_count: number;
  is_active: boolean;
  is_private: boolean;
  status: "ACTIF" | "EN_ATTENTE_CONTRAT" | "INACTIF" | "DESACTIVE";
  contract: Loi25Contract | null;
  onboarding_completed: boolean;
  audit_log: Loi25AuditEntry[];
  subscription_status?: "actif" | "essai" | "inactif";
  created_at: string;
}

export const ADMIN_SCHOOLS: AdminSchoolRow[] = [
  // ── Écoles secondaires (15) ─────────────────────────────────
  // 10 ACCEPTE, 3 EN_ATTENTE, 2 ENVOYE

  // ACCEPTE (10)
  { id: "s-001", name: "De Mortagne", type: "secondaire", city: "Boucherville", region: "Montérégie", conference: "sud_ouest", sports: ["Football", "Basketball", "Soccer"], coaches_count: 4, recruiters_count: 0, directors_count: 1, athletes_count: 18, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, created_at: "2025-06-15T10:00:00Z",
    contract: { id: "loi-001", institution_id: "s-001", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Marie-Ève Lapointe", rprp_courriel: "me.lapointe@demortagne.qc.ca", rprp_telephone: "450-655-7311", sent_at: "2025-06-15T10:00:00Z", accepted_at: "2025-06-18T14:30:00Z", accepted_by: "u-033", expires_at: "2026-06-18T14:30:00Z", ip_address: "24.48.112.34", pdf_url: "/contracts/loi25-s001.pdf" },
    audit_log: [
      { date: "2025-06-15T10:00:00Z", action: "Établissement créé par l'administrateur" },
      { date: "2025-06-15T10:05:00Z", action: "Contrat envoyé à me.lapointe@demortagne.qc.ca" },
      { date: "2025-06-18T14:30:00Z", action: "Contrat accepté par Marie-Ève Lapointe (IP: 24.48.112.34)" },
    ],
  },
  { id: "s-002", name: "Saint-Jean-Eudes", type: "secondaire", city: "Québec", region: "Capitale-Nationale", conference: "nord_est", sports: ["Football", "Hockey", "Basketball"], coaches_count: 5, recruiters_count: 0, directors_count: 1, athletes_count: 22, is_active: true, is_private: true, status: "ACTIF", onboarding_completed: true, created_at: "2025-06-20T09:00:00Z",
    contract: { id: "loi-002", institution_id: "s-002", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Patrick Bergeron", rprp_courriel: "p.bergeron@sje.qc.ca", sent_at: "2025-06-20T09:00:00Z", accepted_at: "2025-06-22T11:00:00Z", accepted_by: "u-034", expires_at: "2026-06-22T11:00:00Z", ip_address: "205.151.44.12", pdf_url: "/contracts/loi25-s002.pdf" },
    audit_log: [
      { date: "2025-06-20T09:00:00Z", action: "Établissement créé par l'administrateur" },
      { date: "2025-06-20T09:05:00Z", action: "Contrat envoyé à p.bergeron@sje.qc.ca" },
      { date: "2025-06-22T11:00:00Z", action: "Contrat accepté par Patrick Bergeron (IP: 205.151.44.12)" },
    ],
  },
  { id: "s-003", name: "De Rochebelle", type: "secondaire", city: "Québec", region: "Capitale-Nationale", conference: "nord_est", sports: ["Football", "Basketball", "Volleyball"], coaches_count: 3, recruiters_count: 0, directors_count: 2, athletes_count: 15, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, created_at: "2025-07-01T10:00:00Z",
    contract: { id: "loi-003", institution_id: "s-003", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Nathalie Gagnon", rprp_courriel: "n.gagnon@rochebelle.qc.ca", rprp_telephone: "418-651-3080", sent_at: "2025-07-01T10:00:00Z", accepted_at: "2025-07-03T16:00:00Z", accepted_by: "u-030", expires_at: "2026-07-03T16:00:00Z", ip_address: "198.45.22.8", pdf_url: "/contracts/loi25-s003.pdf" },
    audit_log: [
      { date: "2025-07-01T10:00:00Z", action: "Contrat envoyé à n.gagnon@rochebelle.qc.ca" },
      { date: "2025-07-03T16:00:00Z", action: "Contrat accepté par Nathalie Gagnon (IP: 198.45.22.8)" },
      { date: "2025-10-01T09:00:00Z", action: "RPRP modifié: Luc Tremblay → Nathalie Gagnon" },
    ],
  },
  { id: "s-004", name: "Roger-Comtois", type: "secondaire", city: "Québec", region: "Capitale-Nationale", conference: "nord_est", sports: ["Football", "Hockey"], coaches_count: 3, recruiters_count: 0, directors_count: 1, athletes_count: 12, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, created_at: "2025-07-10T10:00:00Z",
    contract: { id: "loi-004", institution_id: "s-004", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Catherine Morin", rprp_courriel: "c.morin@roger-comtois.qc.ca", sent_at: "2025-07-10T10:00:00Z", accepted_at: "2025-07-12T09:00:00Z", accepted_by: "u-new-02", expires_at: "2026-07-12T09:00:00Z", pdf_url: "/contracts/loi25-s004.pdf" },
    audit_log: [
      { date: "2025-07-10T10:00:00Z", action: "Contrat envoyé à c.morin@roger-comtois.qc.ca" },
      { date: "2025-07-12T09:00:00Z", action: "Contrat accepté par Catherine Morin" },
    ],
  },
  { id: "s-005", name: "Mont-Royal", type: "secondaire", city: "Montréal", region: "Montréal", conference: "sud_ouest", sports: ["Basketball", "Soccer", "Volleyball"], coaches_count: 4, recruiters_count: 0, directors_count: 1, athletes_count: 14, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, created_at: "2025-07-15T10:00:00Z",
    contract: { id: "loi-005", institution_id: "s-005", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Sylvie Bouchard", rprp_courriel: "s.bouchard@mont-royal.qc.ca", sent_at: "2025-07-15T10:00:00Z", accepted_at: "2025-07-17T10:30:00Z", accepted_by: "u-dir-005", expires_at: "2026-07-17T10:30:00Z", pdf_url: "/contracts/loi25-s005.pdf" },
    audit_log: [
      { date: "2025-07-15T10:00:00Z", action: "Contrat envoyé à s.bouchard@mont-royal.qc.ca" },
      { date: "2025-07-17T10:30:00Z", action: "Contrat accepté par Sylvie Bouchard" },
    ],
  },
  { id: "s-006", name: "Académie les Estacades", type: "secondaire", city: "Trois-Rivières", region: "Mauricie", conference: "nord_est", sports: ["Football", "Hockey", "Natation"], coaches_count: 3, recruiters_count: 0, directors_count: 1, athletes_count: 11, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, created_at: "2025-08-01T10:00:00Z",
    contract: { id: "loi-006", institution_id: "s-006", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Alain Bédard", rprp_courriel: "a.bedard@estacades.qc.ca", sent_at: "2025-08-01T10:00:00Z", accepted_at: "2025-08-05T14:00:00Z", accepted_by: "u-dir-006", expires_at: "2026-08-05T14:00:00Z", pdf_url: "/contracts/loi25-s006.pdf" },
    audit_log: [
      { date: "2025-08-01T10:00:00Z", action: "Contrat envoyé à a.bedard@estacades.qc.ca" },
      { date: "2025-08-05T14:00:00Z", action: "Contrat accepté par Alain Bédard" },
    ],
  },
  { id: "s-007", name: "Armand-Corbeil", type: "secondaire", city: "Terrebonne", region: "Lanaudière", conference: "sud_ouest", sports: ["Football", "Basketball"], coaches_count: 2, recruiters_count: 0, directors_count: 1, athletes_count: 8, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, created_at: "2025-08-10T10:00:00Z",
    contract: { id: "loi-007", institution_id: "s-007", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Diane Pelletier", rprp_courriel: "d.pelletier@armand-corbeil.qc.ca", sent_at: "2025-08-10T10:00:00Z", accepted_at: "2025-08-12T11:00:00Z", accepted_by: "u-dir-007", expires_at: "2026-08-12T11:00:00Z", pdf_url: "/contracts/loi25-s007.pdf" },
    audit_log: [
      { date: "2025-08-10T10:00:00Z", action: "Contrat envoyé à d.pelletier@armand-corbeil.qc.ca" },
      { date: "2025-08-12T11:00:00Z", action: "Contrat accepté par Diane Pelletier" },
    ],
  },
  { id: "s-008", name: "L'Odyssée", type: "secondaire", city: "Chicoutimi", region: "Saguenay–Lac-Saint-Jean", conference: "nord_est", sports: ["Hockey", "Volleyball", "Athlétisme"], coaches_count: 3, recruiters_count: 0, directors_count: 1, athletes_count: 10, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, created_at: "2025-08-20T10:00:00Z",
    contract: { id: "loi-008", institution_id: "s-008", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Pierre Lavoie", rprp_courriel: "p.lavoie@odyssee.qc.ca", sent_at: "2025-08-20T10:00:00Z", accepted_at: "2025-08-22T09:00:00Z", accepted_by: "u-dir-008", expires_at: "2026-08-22T09:00:00Z", pdf_url: "/contracts/loi25-s008.pdf" },
    audit_log: [
      { date: "2025-08-20T10:00:00Z", action: "Contrat envoyé à p.lavoie@odyssee.qc.ca" },
      { date: "2025-08-22T09:00:00Z", action: "Contrat accepté par Pierre Lavoie" },
    ],
  },
  { id: "s-009", name: "Le Sommet", type: "secondaire", city: "Sherbrooke", region: "Estrie", conference: "nord_est", sports: ["Football", "Soccer"], coaches_count: 2, recruiters_count: 0, directors_count: 1, athletes_count: 6, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, created_at: "2025-09-01T10:00:00Z",
    contract: { id: "loi-009", institution_id: "s-009", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Martin Dubois", rprp_courriel: "m.dubois@lesommet.qc.ca", sent_at: "2025-09-01T10:00:00Z", accepted_at: "2025-09-03T15:00:00Z", accepted_by: "u-dir-009", expires_at: "2026-09-03T15:00:00Z", pdf_url: "/contracts/loi25-s009.pdf" },
    audit_log: [
      { date: "2025-09-01T10:00:00Z", action: "Contrat envoyé à m.dubois@lesommet.qc.ca" },
      { date: "2025-09-03T15:00:00Z", action: "Contrat accepté par Martin Dubois" },
    ],
  },
  { id: "s-010", name: "Louis-Riel", type: "secondaire", city: "Montréal", region: "Montréal", conference: "sud_ouest", sports: ["Basketball", "Soccer", "Volleyball", "Athlétisme"], coaches_count: 5, recruiters_count: 0, directors_count: 1, athletes_count: 20, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, created_at: "2025-09-10T10:00:00Z",
    contract: { id: "loi-010", institution_id: "s-010", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Louise Gagnon", rprp_courriel: "l.gagnon@louis-riel.qc.ca", sent_at: "2025-09-10T10:00:00Z", accepted_at: "2025-09-12T10:00:00Z", accepted_by: "u-dir-010", expires_at: "2026-09-12T10:00:00Z", pdf_url: "/contracts/loi25-s010.pdf" },
    audit_log: [
      { date: "2025-09-10T10:00:00Z", action: "Contrat envoyé à l.gagnon@louis-riel.qc.ca" },
      { date: "2025-09-12T10:00:00Z", action: "Contrat accepté par Louise Gagnon" },
    ],
  },

  // EN_ATTENTE_CONTRAT (3)
  { id: "s-011", name: "Curé-Antoine-Labelle", type: "secondaire", city: "Laval", region: "Laval", conference: "sud_ouest", sports: ["Football", "Basketball", "Hockey"], coaches_count: 4, recruiters_count: 0, directors_count: 1, athletes_count: 0, is_active: true, is_private: false, status: "EN_ATTENTE_CONTRAT", onboarding_completed: false, created_at: "2026-03-05T10:00:00Z",
    contract: { id: "loi-011", institution_id: "s-011", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "EN_ATTENTE", rprp_nom: "Francine Roy", rprp_courriel: "f.roy@cal.qc.ca" },
    audit_log: [
      { date: "2026-03-05T10:00:00Z", action: "Établissement créé par l'administrateur" },
    ],
  },
  { id: "s-012", name: "Saint-Joseph", type: "secondaire", city: "Saint-Hyacinthe", region: "Montérégie", conference: "sud_ouest", sports: ["Football", "Hockey"], coaches_count: 2, recruiters_count: 0, directors_count: 0, athletes_count: 0, is_active: true, is_private: true, status: "EN_ATTENTE_CONTRAT", onboarding_completed: false, created_at: "2026-03-08T10:00:00Z",
    contract: { id: "loi-012", institution_id: "s-012", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "EN_ATTENTE", rprp_nom: "Robert Laflamme", rprp_courriel: "r.laflamme@st-joseph.qc.ca" },
    audit_log: [
      { date: "2026-03-08T10:00:00Z", action: "Établissement créé par l'administrateur" },
    ],
  },
  { id: "s-013", name: "Thérèse-Martin", type: "secondaire", city: "Joliette", region: "Lanaudière", conference: "sud_ouest", sports: ["Hockey", "Volleyball"], coaches_count: 2, recruiters_count: 0, directors_count: 0, athletes_count: 0, is_active: true, is_private: false, status: "EN_ATTENTE_CONTRAT", onboarding_completed: false, created_at: "2026-03-10T10:00:00Z",
    contract: { id: "loi-013", institution_id: "s-013", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "EN_ATTENTE", rprp_nom: "Hélène Tremblay", rprp_courriel: "h.tremblay@therese-martin.qc.ca" },
    audit_log: [
      { date: "2026-03-10T10:00:00Z", action: "Établissement créé par l'administrateur" },
    ],
  },

  // ENVOYE (2)
  { id: "s-014", name: "Le Tremplin", type: "secondaire", city: "Gatineau", region: "Outaouais", conference: "sud_ouest", sports: ["Football", "Basketball", "Rugby"], coaches_count: 3, recruiters_count: 0, directors_count: 1, athletes_count: 0, is_active: true, is_private: false, status: "EN_ATTENTE_CONTRAT", onboarding_completed: false, created_at: "2026-02-20T10:00:00Z",
    contract: { id: "loi-014", institution_id: "s-014", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ENVOYE", rprp_nom: "Josée Bélanger", rprp_courriel: "j.belanger@letremplin.qc.ca", sent_at: "2026-03-01T10:00:00Z" },
    audit_log: [
      { date: "2026-02-20T10:00:00Z", action: "Établissement créé par l'administrateur" },
      { date: "2026-03-01T10:00:00Z", action: "Contrat envoyé à j.belanger@letremplin.qc.ca" },
    ],
  },
  { id: "s-015", name: "Pierre-Laporte", type: "secondaire", city: "Montréal", region: "Montréal", conference: "sud_ouest", sports: ["Soccer", "Natation", "Athlétisme"], coaches_count: 3, recruiters_count: 0, directors_count: 1, athletes_count: 0, is_active: true, is_private: false, status: "EN_ATTENTE_CONTRAT", onboarding_completed: false, created_at: "2026-02-25T10:00:00Z",
    contract: { id: "loi-015", institution_id: "s-015", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ENVOYE", rprp_nom: "Caroline Gendron", rprp_courriel: "c.gendron@pierre-laporte.qc.ca", sent_at: "2026-03-15T10:00:00Z" },
    audit_log: [
      { date: "2026-02-25T10:00:00Z", action: "Établissement créé par l'administrateur" },
      { date: "2026-03-15T10:00:00Z", action: "Contrat envoyé à c.gendron@pierre-laporte.qc.ca" },
    ],
  },

  // ── CÉGEPs (12) ─────────────────────────────────────────────
  // 8 ACCEPTE, 2 EN_ATTENTE, 1 ENVOYE, 1 EXPIRE

  // ACCEPTE (8)
  { id: "c-001", name: "CÉGEP Garneau", type: "cegep", city: "Québec", region: "Capitale-Nationale", conference: "nord_est", sports: ["Football", "Basketball", "Soccer", "Volleyball"], coaches_count: 0, recruiters_count: 4, directors_count: 2, athletes_count: 0, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, subscription_status: "actif", created_at: "2025-06-01T10:00:00Z",
    contract: { id: "loi-c01", institution_id: "c-001", institution_type: "CEGEP", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "François Simard", rprp_courriel: "f.simard@cegep-garneau.qc.ca", rprp_telephone: "418-688-8310", sent_at: "2025-06-01T10:00:00Z", accepted_at: "2025-06-03T11:00:00Z", accepted_by: "u-031", expires_at: "2026-06-03T11:00:00Z", ip_address: "142.169.88.5", pdf_url: "/contracts/loi25-c001.pdf" },
    audit_log: [
      { date: "2025-06-01T10:00:00Z", action: "Contrat envoyé à f.simard@cegep-garneau.qc.ca" },
      { date: "2025-06-03T11:00:00Z", action: "Contrat accepté par François Simard (IP: 142.169.88.5)" },
    ],
  },
  { id: "c-002", name: "CÉGEP de Sainte-Foy", type: "cegep", city: "Québec", region: "Capitale-Nationale", conference: "nord_est", sports: ["Football", "Basketball", "Hockey"], coaches_count: 0, recruiters_count: 3, directors_count: 1, athletes_count: 0, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, subscription_status: "actif", created_at: "2025-06-10T10:00:00Z",
    contract: { id: "loi-c02", institution_id: "c-002", institution_type: "CEGEP", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Lucie Mercier", rprp_courriel: "l.mercier@cegep-ste-foy.qc.ca", sent_at: "2025-06-10T10:00:00Z", accepted_at: "2025-06-14T14:00:00Z", accepted_by: "u-dir-c02", expires_at: "2026-06-14T14:00:00Z", pdf_url: "/contracts/loi25-c002.pdf" },
    audit_log: [
      { date: "2025-06-10T10:00:00Z", action: "Contrat envoyé à l.mercier@cegep-ste-foy.qc.ca" },
      { date: "2025-06-14T14:00:00Z", action: "Contrat accepté par Lucie Mercier" },
    ],
  },
  { id: "c-003", name: "CÉGEP Limoilou", type: "cegep", city: "Québec", region: "Capitale-Nationale", conference: "nord_est", sports: ["Football", "Soccer", "Volleyball"], coaches_count: 0, recruiters_count: 3, directors_count: 1, athletes_count: 0, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, subscription_status: "actif", created_at: "2025-07-01T10:00:00Z",
    contract: { id: "loi-c03", institution_id: "c-003", institution_type: "CEGEP", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Jean-Marc Fortier", rprp_courriel: "jm.fortier@cegep-limoilou.qc.ca", sent_at: "2025-07-01T10:00:00Z", accepted_at: "2025-07-04T10:00:00Z", accepted_by: "u-dir-c03", expires_at: "2026-07-04T10:00:00Z", pdf_url: "/contracts/loi25-c003.pdf" },
    audit_log: [
      { date: "2025-07-01T10:00:00Z", action: "Contrat envoyé à jm.fortier@cegep-limoilou.qc.ca" },
      { date: "2025-07-04T10:00:00Z", action: "Contrat accepté par Jean-Marc Fortier" },
    ],
  },
  { id: "c-004", name: "CÉGEP du Vieux-Montréal", type: "cegep", city: "Montréal", region: "Montréal", conference: "sud_ouest", sports: ["Basketball", "Soccer", "Volleyball"], coaches_count: 0, recruiters_count: 3, directors_count: 1, athletes_count: 0, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, subscription_status: "essai", created_at: "2025-07-15T10:00:00Z",
    contract: { id: "loi-c04", institution_id: "c-004", institution_type: "CEGEP", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "André Lévesque", rprp_courriel: "a.levesque@cvm.qc.ca", sent_at: "2025-07-15T10:00:00Z", accepted_at: "2025-07-18T09:00:00Z", accepted_by: "u-dir-c04", expires_at: "2026-07-18T09:00:00Z", pdf_url: "/contracts/loi25-c004.pdf" },
    audit_log: [
      { date: "2025-07-15T10:00:00Z", action: "Contrat envoyé à a.levesque@cvm.qc.ca" },
      { date: "2025-07-18T09:00:00Z", action: "Contrat accepté par André Lévesque" },
    ],
  },
  { id: "c-005", name: "CÉGEP André-Laurendeau", type: "cegep", city: "LaSalle", region: "Montréal", conference: "sud_ouest", sports: ["Football", "Basketball", "Hockey"], coaches_count: 0, recruiters_count: 4, directors_count: 1, athletes_count: 0, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, subscription_status: "actif", created_at: "2025-08-01T10:00:00Z",
    contract: { id: "loi-c05", institution_id: "c-005", institution_type: "CEGEP", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Sophie Larivière", rprp_courriel: "s.lariviere@claurendeau.qc.ca", sent_at: "2025-08-01T10:00:00Z", accepted_at: "2025-08-04T14:00:00Z", accepted_by: "u-dir-c05", expires_at: "2026-08-04T14:00:00Z", pdf_url: "/contracts/loi25-c005.pdf" },
    audit_log: [
      { date: "2025-08-01T10:00:00Z", action: "Contrat envoyé à s.lariviere@claurendeau.qc.ca" },
      { date: "2025-08-04T14:00:00Z", action: "Contrat accepté par Sophie Larivière" },
    ],
  },
  { id: "c-006", name: "CÉGEP Édouard-Montpetit", type: "cegep", city: "Longueuil", region: "Montérégie", conference: "sud_ouest", sports: ["Football", "Basketball", "Hockey", "Soccer"], coaches_count: 0, recruiters_count: 5, directors_count: 1, athletes_count: 0, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, subscription_status: "actif", created_at: "2025-08-15T10:00:00Z",
    contract: { id: "loi-c06", institution_id: "c-006", institution_type: "CEGEP", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Marc Thibodeau", rprp_courriel: "m.thibodeau@cegepmontpetit.ca", sent_at: "2025-08-15T10:00:00Z", accepted_at: "2025-08-18T11:00:00Z", accepted_by: "u-dir-c06", expires_at: "2026-08-18T11:00:00Z", pdf_url: "/contracts/loi25-c006.pdf" },
    audit_log: [
      { date: "2025-08-15T10:00:00Z", action: "Contrat envoyé à m.thibodeau@cegepmontpetit.ca" },
      { date: "2025-08-18T11:00:00Z", action: "Contrat accepté par Marc Thibodeau" },
    ],
  },
  { id: "c-007", name: "CÉGEP de Sherbrooke", type: "cegep", city: "Sherbrooke", region: "Estrie", conference: "nord_est", sports: ["Football", "Hockey", "Volleyball"], coaches_count: 0, recruiters_count: 3, directors_count: 1, athletes_count: 0, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, subscription_status: "actif", created_at: "2025-09-01T10:00:00Z",
    contract: { id: "loi-c07", institution_id: "c-007", institution_type: "CEGEP", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Isabelle Proulx", rprp_courriel: "i.proulx@cegepsherbrooke.qc.ca", sent_at: "2025-09-01T10:00:00Z", accepted_at: "2025-09-04T16:00:00Z", accepted_by: "u-dir-c07", expires_at: "2026-09-04T16:00:00Z", pdf_url: "/contracts/loi25-c007.pdf" },
    audit_log: [
      { date: "2025-09-01T10:00:00Z", action: "Contrat envoyé à i.proulx@cegepsherbrooke.qc.ca" },
      { date: "2025-09-04T16:00:00Z", action: "Contrat accepté par Isabelle Proulx" },
    ],
  },
  { id: "c-008", name: "CÉGEP de Jonquière", type: "cegep", city: "Jonquière", region: "Saguenay–Lac-Saint-Jean", conference: "nord_est", sports: ["Hockey", "Volleyball", "Basketball"], coaches_count: 0, recruiters_count: 2, directors_count: 1, athletes_count: 0, is_active: true, is_private: false, status: "ACTIF", onboarding_completed: true, subscription_status: "actif", created_at: "2025-09-10T10:00:00Z",
    contract: { id: "loi-c08", institution_id: "c-008", institution_type: "CEGEP", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Daniel Tremblay", rprp_courriel: "d.tremblay@cegepjonquiere.ca", sent_at: "2025-09-10T10:00:00Z", accepted_at: "2025-09-13T10:00:00Z", accepted_by: "u-dir-c08", expires_at: "2026-09-13T10:00:00Z", pdf_url: "/contracts/loi25-c008.pdf" },
    audit_log: [
      { date: "2025-09-10T10:00:00Z", action: "Contrat envoyé à d.tremblay@cegepjonquiere.ca" },
      { date: "2025-09-13T10:00:00Z", action: "Contrat accepté par Daniel Tremblay" },
    ],
  },

  // EN_ATTENTE_CONTRAT (2)
  { id: "c-009", name: "CÉGEP de Lévis", type: "cegep", city: "Lévis", region: "Chaudière-Appalaches", conference: "nord_est", sports: ["Football", "Hockey"], coaches_count: 0, recruiters_count: 2, directors_count: 0, athletes_count: 0, is_active: true, is_private: false, status: "EN_ATTENTE_CONTRAT", onboarding_completed: false, subscription_status: "essai", created_at: "2026-03-01T10:00:00Z",
    contract: { id: "loi-c09", institution_id: "c-009", institution_type: "CEGEP", contract_version: "1.0", status: "EN_ATTENTE", rprp_nom: "Stéphane Côté", rprp_courriel: "s.cote@cegeplevis.qc.ca" },
    audit_log: [
      { date: "2026-03-01T10:00:00Z", action: "Établissement créé par l'administrateur" },
    ],
  },
  { id: "c-010", name: "CÉGEP de Saint-Laurent", type: "cegep", city: "Montréal", region: "Montréal", conference: "sud_ouest", sports: ["Basketball", "Soccer", "Athlétisme"], coaches_count: 0, recruiters_count: 3, directors_count: 0, athletes_count: 0, is_active: true, is_private: false, status: "EN_ATTENTE_CONTRAT", onboarding_completed: false, subscription_status: "essai", created_at: "2026-03-05T10:00:00Z",
    contract: { id: "loi-c10", institution_id: "c-010", institution_type: "CEGEP", contract_version: "1.0", status: "EN_ATTENTE", rprp_nom: "Nadia Bouchard", rprp_courriel: "n.bouchard@cegep-st-laurent.qc.ca" },
    audit_log: [
      { date: "2026-03-05T10:00:00Z", action: "Établissement créé par l'administrateur" },
    ],
  },

  // ENVOYE (1)
  { id: "c-011", name: "Collège de Bois-de-Boulogne", type: "cegep", city: "Montréal", region: "Montréal", conference: "sud_ouest", sports: ["Basketball", "Soccer"], coaches_count: 0, recruiters_count: 2, directors_count: 1, athletes_count: 0, is_active: true, is_private: false, status: "EN_ATTENTE_CONTRAT", onboarding_completed: false, subscription_status: "essai", created_at: "2026-02-15T10:00:00Z",
    contract: { id: "loi-c11", institution_id: "c-011", institution_type: "CEGEP", contract_version: "1.0", status: "ENVOYE", rprp_nom: "Michel Gauthier", rprp_courriel: "m.gauthier@bdeb.qc.ca", sent_at: "2026-03-10T10:00:00Z" },
    audit_log: [
      { date: "2026-02-15T10:00:00Z", action: "Établissement créé par l'administrateur" },
      { date: "2026-03-10T10:00:00Z", action: "Contrat envoyé à m.gauthier@bdeb.qc.ca" },
    ],
  },

  // EXPIRE (1)
  { id: "c-012", name: "Champlain Lennoxville", type: "cegep", city: "Sherbrooke", region: "Estrie", conference: "nord_est", sports: ["Football", "Rugby", "Soccer"], coaches_count: 0, recruiters_count: 2, directors_count: 1, athletes_count: 0, is_active: true, is_private: true, status: "ACTIF", onboarding_completed: true, subscription_status: "actif", created_at: "2025-01-15T10:00:00Z",
    contract: { id: "loi-c12", institution_id: "c-012", institution_type: "CEGEP", contract_version: "1.0", status: "EXPIRE", rprp_nom: "James Wilson", rprp_courriel: "j.wilson@crcl.qc.ca", rprp_telephone: "819-564-3666", sent_at: "2025-01-15T10:00:00Z", accepted_at: "2025-01-18T14:00:00Z", accepted_by: "u-dir-c12", expires_at: "2026-01-18T14:00:00Z", ip_address: "70.24.88.102", pdf_url: "/contracts/loi25-c012.pdf" },
    audit_log: [
      { date: "2025-01-15T10:00:00Z", action: "Contrat envoyé à j.wilson@crcl.qc.ca" },
      { date: "2025-01-18T14:00:00Z", action: "Contrat accepté par James Wilson (IP: 70.24.88.102)" },
      { date: "2025-11-18T09:00:00Z", action: "Rappel de renouvellement envoyé (60 jours avant expiration)" },
      { date: "2026-01-18T14:00:00Z", action: "Contrat expiré — renouvellement requis" },
      { date: "2026-03-01T10:00:00Z", action: "Rappel de renouvellement envoyé par l'administrateur" },
    ],
  },
];

// ── Sports ───────────────────────────────────────────────────

export interface AdminSportRow {
  id: string;
  name: string;
  icon: string;
  positions: string[];
  stat_fields: string[];
  athletes_count: number;
  is_active: boolean;
}

export const ADMIN_SPORTS: AdminSportRow[] = [
  { id: "sp-01", name: "Football", icon: "🏈", positions: ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K/P"], stat_fields: ["Yards", "Touchdowns", "Plaqués", "Interceptions", "Réceptions"], athletes_count: 112, is_active: true },
  { id: "sp-02", name: "Basketball", icon: "🏀", positions: ["PG", "SG", "SF", "PF", "C"], stat_fields: ["PPG", "RPG", "APG", "SPG", "BPG", "FG%"], athletes_count: 78, is_active: true },
  { id: "sp-03", name: "Hockey", icon: "🏒", positions: ["C", "LW", "RW", "D", "G"], stat_fields: ["Buts", "Passes", "+/-", "PIM", "SV%"], athletes_count: 64, is_active: true },
  { id: "sp-04", name: "Soccer", icon: "⚽", positions: ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"], stat_fields: ["Buts", "Passes décisives", "Tirs cadrés", "Interceptions"], athletes_count: 45, is_active: true },
  { id: "sp-05", name: "Volleyball", icon: "🏐", positions: ["Passeur", "Attaquant", "Central", "Libéro"], stat_fields: ["Attaques", "Blocs", "Services", "Réceptions"], athletes_count: 28, is_active: true },
  { id: "sp-06", name: "Natation", icon: "🏊", positions: ["Sprint", "Demi-fond", "Fond", "Quatre nages"], stat_fields: ["50m", "100m", "200m", "400m", "Relais"], athletes_count: 10, is_active: true },
  { id: "sp-07", name: "Athlétisme", icon: "🏃", positions: ["Sprint", "Demi-fond", "Fond", "Sauts", "Lancers"], stat_fields: ["100m", "200m", "400m", "800m", "1500m", "Hauteur", "Longueur"], athletes_count: 6, is_active: true },
  { id: "sp-08", name: "Rugby", icon: "🏉", positions: ["Pilier", "Talonneur", "2e ligne", "Flanker", "8", "Demi", "Centre", "Ailier", "Arrière"], stat_fields: ["Essais", "Plaqués", "Passes", "Mêlées gagnées"], athletes_count: 4, is_active: true },
  { id: "sp-09", name: "Cheerleading", icon: "📣", positions: ["Base", "Flyer", "Spotter", "Tumbler"], stat_fields: ["Tumbling", "Stunts", "Pyramides", "Danse"], athletes_count: 8, is_active: true },
  { id: "sp-10", name: "Flag football", icon: "🏴", positions: ["QB", "WR", "RB", "CB", "S", "LB"], stat_fields: ["Touchés", "Interceptions", "Sacks", "Réceptions"], athletes_count: 5, is_active: true },
  { id: "sp-11", name: "Badminton", icon: "🏸", positions: ["Simple", "Double", "Double mixte"], stat_fields: ["Victoires", "Sets gagnés", "Points marqués"], athletes_count: 3, is_active: true },
  { id: "sp-12", name: "Cross-country", icon: "🏃‍♂️", positions: ["Sprint", "Demi-fond", "Fond"], stat_fields: ["3 km", "5 km", "8 km", "Relais"], athletes_count: 4, is_active: true },
  { id: "sp-13", name: "Futsal", icon: "⚽", positions: ["Gardien", "Fixo", "Ala", "Pivot"], stat_fields: ["Buts", "Passes décisives", "Arrêts"], athletes_count: 2, is_active: true },
  { id: "sp-14", name: "Baseball", icon: "⚾", positions: ["Lanceur", "Receveur", "1B", "2B", "3B", "AC", "Voltigeur"], stat_fields: ["AB", "H", "RBI", "ERA", "AVG"], athletes_count: 3, is_active: true },
  { id: "sp-15", name: "Ultimate frisbee", icon: "🥏", positions: ["Handler", "Cutter", "Deep"], stat_fields: ["Buts", "Passes décisives", "Blocs", "Turnovers"], athletes_count: 1, is_active: true },
  { id: "sp-16", name: "Autre", icon: "🏅", positions: [], stat_fields: [], athletes_count: 0, is_active: true },
];

// ── Athletes (admin view) ────────────────────────────────────

export interface AdminAthleteRow {
  id: string;
  full_name: string;
  school: string;
  sport: string;
  position: string;
  division: "D1" | "D2" | "D3";
  graduation_year: number;
  status: "draft" | "pending_approval" | "approved" | "rejected" | "archived";
  is_verified: boolean;
  profile_completeness: number;
  coach_name: string;
  views_this_month: number;
  favorites_count: number;
  is_flagged?: boolean;
  flag_reason?: string;
  flag_category?: string;
  flagged_by?: string;
  flagged_at?: string;
  created_at: string;
}

export const ADMIN_ATHLETES: AdminAthleteRow[] = [
  // Approved (15)
  { id: "at-001", full_name: "Marc-Antoine Tremblay", school: "Saint-Jean-Eudes", sport: "Football", position: "QB", division: "D1", graduation_year: 2026, status: "approved", is_verified: true, profile_completeness: 95, coach_name: "Patrick Bergeron", views_this_month: 34, favorites_count: 8, created_at: "2025-09-15T10:00:00Z" },
  { id: "at-002", full_name: "Bruno Lafleur", school: "De Rochebelle", sport: "Football", position: "LB", division: "D1", graduation_year: 2027, status: "approved", is_verified: true, profile_completeness: 88, coach_name: "Marc-André Pelletier", views_this_month: 28, favorites_count: 6, created_at: "2025-09-20T11:00:00Z" },
  { id: "at-003", full_name: "Félix Gagnon-Roy", school: "De Mortagne", sport: "Football", position: "RB", division: "D1", graduation_year: 2026, status: "approved", is_verified: true, profile_completeness: 82, coach_name: "Marc-André Pelletier", views_this_month: 22, favorites_count: 5, created_at: "2025-10-01T09:00:00Z" },
  { id: "at-004", full_name: "Émilie Gagnon", school: "Mont-Royal", sport: "Basketball", position: "PG", division: "D2", graduation_year: 2026, status: "approved", is_verified: true, profile_completeness: 78, coach_name: "Sophie Tremblay", views_this_month: 18, favorites_count: 4, created_at: "2025-10-05T14:00:00Z" },
  { id: "at-005", full_name: "Samuel Bouchard", school: "Le Sommet", sport: "Hockey", position: "C", division: "D1", graduation_year: 2026, status: "approved", is_verified: true, profile_completeness: 91, coach_name: "Jean-François Roy", views_this_month: 31, favorites_count: 7, created_at: "2025-10-10T10:00:00Z" },
  { id: "at-006", full_name: "Camille Roy", school: "Louis-Riel", sport: "Soccer", position: "ST", division: "D2", graduation_year: 2027, status: "approved", is_verified: true, profile_completeness: 72, coach_name: "Isabelle Côté", views_this_month: 15, favorites_count: 3, created_at: "2025-10-15T11:00:00Z" },
  { id: "at-007", full_name: "Alexis Tremblay", school: "De Mortagne", sport: "Football", position: "WR", division: "D1", graduation_year: 2026, status: "approved", is_verified: true, profile_completeness: 85, coach_name: "Marc-André Pelletier", views_this_month: 26, favorites_count: 5, created_at: "2025-10-20T09:00:00Z" },
  { id: "at-008", full_name: "Raphaël Dubois", school: "Armand-Corbeil", sport: "Basketball", position: "SG", division: "D2", graduation_year: 2027, status: "approved", is_verified: true, profile_completeness: 68, coach_name: "Sophie Tremblay", views_this_month: 12, favorites_count: 2, is_flagged: true, flag_category: "Données statistiques douteuses", flag_reason: "Stats de 40 verges douteuses — 3.2s pour un secondaire 3, semble irréaliste", flagged_by: "Pierre Dufour (Recruteur, CÉGEP Garneau)", flagged_at: "2026-03-14T16:30:00Z", created_at: "2025-11-01T13:00:00Z" },
  { id: "at-009", full_name: "Maxime Pelletier", school: "Roger-Comtois", sport: "Hockey", position: "D", division: "D1", graduation_year: 2026, status: "approved", is_verified: true, profile_completeness: 76, coach_name: "Jean-François Roy", views_this_month: 20, favorites_count: 4, created_at: "2025-11-05T10:00:00Z" },
  { id: "at-010", full_name: "Laurence Simard", school: "De Rochebelle", sport: "Volleyball", position: "Passeur", division: "D1", graduation_year: 2026, status: "approved", is_verified: true, profile_completeness: 80, coach_name: "Isabelle Côté", views_this_month: 16, favorites_count: 3, created_at: "2025-11-10T14:00:00Z" },
  { id: "at-011", full_name: "Thomas Côté", school: "Curé-Antoine-Labelle", sport: "Football", position: "OL", division: "D2", graduation_year: 2027, status: "approved", is_verified: true, profile_completeness: 62, coach_name: "Alexandre Fortin", views_this_month: 8, favorites_count: 1, created_at: "2025-11-15T09:00:00Z" },
  { id: "at-012", full_name: "Jade Bergeron", school: "Pierre-Laporte", sport: "Natation", position: "Sprint", division: "D1", graduation_year: 2026, status: "approved", is_verified: true, profile_completeness: 70, coach_name: "Mathieu Gagnon", views_this_month: 9, favorites_count: 2, created_at: "2025-11-20T11:00:00Z" },
  { id: "at-013", full_name: "Émile Tanguay", school: "L'Odyssée", sport: "Hockey", position: "RW", division: "D2", graduation_year: 2027, status: "approved", is_verified: false, profile_completeness: 55, coach_name: "Jean-François Roy", views_this_month: 5, favorites_count: 0, is_flagged: true, flag_category: "Photo ou contenu inapproprié", flag_reason: "Lien YouTube dans le profil redirige vers un site externe non lié au sport", flagged_by: "Stéphanie Bouchard (Recruteur, CÉGEP de Sainte-Foy)", flagged_at: "2026-03-12T09:15:00Z", created_at: "2025-12-01T10:00:00Z" },
  { id: "at-014", full_name: "Léa Fortin", school: "Saint-Joseph", sport: "Soccer", position: "CM", division: "D3", graduation_year: 2027, status: "approved", is_verified: false, profile_completeness: 48, coach_name: "Isabelle Côté", views_this_month: 3, favorites_count: 0, created_at: "2025-12-05T14:00:00Z" },
  { id: "at-015", full_name: "Gabriel Martin", school: "Thérèse-Martin", sport: "Volleyball", position: "Attaquant", division: "D2", graduation_year: 2026, status: "approved", is_verified: false, profile_completeness: 52, coach_name: "Alexandre Fortin", views_this_month: 4, favorites_count: 1, created_at: "2025-12-10T09:00:00Z" },

  // Pending approval (5)
  { id: "at-016", full_name: "Xavier Lemieux", school: "De Mortagne", sport: "Football", position: "CB", division: "D1", graduation_year: 2026, status: "pending_approval", is_verified: false, profile_completeness: 75, coach_name: "Marc-André Pelletier", views_this_month: 0, favorites_count: 0, created_at: "2026-03-10T10:00:00Z" },
  { id: "at-017", full_name: "Noémie Lavoie", school: "Mont-Royal", sport: "Basketball", position: "SF", division: "D2", graduation_year: 2027, status: "pending_approval", is_verified: false, profile_completeness: 82, coach_name: "Sophie Tremblay", views_this_month: 0, favorites_count: 0, created_at: "2026-03-11T11:00:00Z" },
  { id: "at-018", full_name: "Olivier Gauthier", school: "Roger-Comtois", sport: "Hockey", position: "G", division: "D1", graduation_year: 2026, status: "pending_approval", is_verified: false, profile_completeness: 90, coach_name: "Jean-François Roy", views_this_month: 0, favorites_count: 0, created_at: "2026-03-12T09:00:00Z" },
  { id: "at-019", full_name: "Florence Deschênes", school: "Louis-Riel", sport: "Soccer", position: "GK", division: "D2", graduation_year: 2027, status: "pending_approval", is_verified: false, profile_completeness: 65, coach_name: "Isabelle Côté", views_this_month: 0, favorites_count: 0, created_at: "2026-03-13T14:00:00Z" },
  { id: "at-020", full_name: "William Therrien", school: "Académie les Estacades", sport: "Football", position: "S", division: "D2", graduation_year: 2027, status: "pending_approval", is_verified: false, profile_completeness: 71, coach_name: "Patrick Bergeron", views_this_month: 0, favorites_count: 0, created_at: "2026-03-14T10:00:00Z" },

  // Draft (3)
  { id: "at-021", full_name: "Antoine Leclerc", school: "Le Tremplin", sport: "Rugby", position: "Centre", division: "D3", graduation_year: 2027, status: "draft", is_verified: false, profile_completeness: 35, coach_name: "Mathieu Gagnon", views_this_month: 0, favorites_count: 0, created_at: "2026-03-05T09:00:00Z" },
  { id: "at-022", full_name: "Sarah-Maude Plante", school: "Pierre-Laporte", sport: "Athlétisme", position: "Sprint", division: "D2", graduation_year: 2027, status: "draft", is_verified: false, profile_completeness: 30, coach_name: "Mathieu Gagnon", views_this_month: 0, favorites_count: 0, created_at: "2026-03-06T11:00:00Z" },
  { id: "at-023", full_name: "Étienne Fortin", school: "Armand-Corbeil", sport: "Football", position: "DL", division: "D2", graduation_year: 2027, status: "draft", is_verified: false, profile_completeness: 42, coach_name: "Alexandre Fortin", views_this_month: 0, favorites_count: 0, created_at: "2026-03-07T10:00:00Z" },

  // Rejected (1)
  { id: "at-024", full_name: "Michaël Poirier", school: "L'Odyssée", sport: "Hockey", position: "LW", division: "D3", graduation_year: 2027, status: "rejected", is_verified: false, profile_completeness: 40, coach_name: "Jean-François Roy", views_this_month: 0, favorites_count: 0, is_flagged: true, flag_category: "Informations incorrectes", flag_reason: "Bio contient le numéro de téléphone personnel d'un mineur et son adresse", flagged_by: "Nathalie Gagnon (Directrice, École De Rochebelle)", flagged_at: "2026-03-15T22:00:00Z", created_at: "2026-02-20T14:00:00Z" },

  // Archived (1)
  { id: "at-025", full_name: "Mathis Gendron", school: "De Rochebelle", sport: "Football", position: "K/P", division: "D1", graduation_year: 2025, status: "archived", is_verified: true, profile_completeness: 88, coach_name: "Marc-André Pelletier", views_this_month: 0, favorites_count: 0, created_at: "2024-09-15T10:00:00Z" },
];

// ── Moderation ───────────────────────────────────────────────

export interface ModerationItem {
  id: string;
  type: "profile_report" | "message_report" | "contact_abuse";
  reported_content: string;
  reported_user: string;
  reported_user_role: "coach" | "recruiter";
  reporter_name: string;
  reason: string;
  severity: "low" | "medium" | "high";
  status: "open" | "under_review" | "resolved" | "dismissed";
  created_at: string;
}

export const MODERATION_ITEMS: ModerationItem[] = [
  { id: "mod-001", type: "profile_report", reported_content: "Bio contenant des informations personnelles sensibles (numéro de téléphone d'un mineur).", reported_user: "David Lapierre", reported_user_role: "coach", reporter_name: "Nathalie Gagnon", reason: "Informations sensibles d'un mineur", severity: "high", status: "open", created_at: "2026-03-15T22:15:00Z" },
  { id: "mod-002", type: "message_report", reported_content: "Salut, j'ai un programme privé de développement. Contacte-moi en dehors de Nexus sur mon cell...", reported_user: "Martin Lapointe", reported_user_role: "recruiter", reporter_name: "Patrick Bergeron", reason: "Sollicitation hors plateforme", severity: "high", status: "open", created_at: "2026-03-15T18:00:00Z" },
  { id: "mod-003", type: "contact_abuse", reported_content: "8 demandes de contact envoyées au même coach en 48h sans réponse.", reported_user: "Pierre Dufour", reported_user_role: "recruiter", reporter_name: "Système automatique", reason: "Volume de contacts excessif", severity: "medium", status: "open", created_at: "2026-03-15T14:00:00Z" },
  { id: "mod-004", type: "profile_report", reported_content: "Évaluation coach avec des commentaires subjectifs sur le caractère familial de l'athlète.", reported_user: "Alexandre Fortin", reported_user_role: "coach", reporter_name: "François Simard", reason: "Évaluation contestée par un directeur", severity: "medium", status: "under_review", created_at: "2026-03-14T14:00:00Z" },
  { id: "mod-005", type: "message_report", reported_content: "Ton joueur est pas D1 pantoute. Arrête de perdre le temps des recruteurs.", reported_user: "Caroline Bergeron", reported_user_role: "recruiter", reporter_name: "Marc-André Pelletier", reason: "Message irrespectueux", severity: "medium", status: "under_review", created_at: "2026-03-13T09:30:00Z" },
  { id: "mod-006", type: "profile_report", reported_content: "Lien YouTube redirige vers un site externe non lié au sport.", reported_user: "Mathieu Gagnon", reported_user_role: "coach", reporter_name: "Stéphanie Bouchard", reason: "Lien vidéo suspect", severity: "low", status: "resolved", created_at: "2026-03-10T11:00:00Z" },
  { id: "mod-007", type: "contact_abuse", reported_content: "Demande de contact contenant des questions sur la situation financière de la famille.", reported_user: "Martin Lapointe", reported_user_role: "recruiter", reporter_name: "Sophie Tremblay", reason: "Questions inappropriées", severity: "high", status: "resolved", created_at: "2026-03-08T16:00:00Z" },
  { id: "mod-008", type: "profile_report", reported_content: "Stats de 40 verges clairement erronées (3.2s pour un secondaire 3).", reported_user: "Jean-François Roy", reported_user_role: "coach", reporter_name: "Pierre Dufour", reason: "Statistiques douteuses", severity: "low", status: "dismissed", created_at: "2026-03-05T10:00:00Z" },
];

// ── Pipeline aggregated ──────────────────────────────────────

export interface PipelineAggregated {
  status: string;
  label_fr: string;
  count: number;
  percentage: number;
  color: string;
  trend: number;
}

export const PIPELINE_AGGREGATED: PipelineAggregated[] = [
  { status: "IDENTIFIE", label_fr: "Identifiés", count: 64, percentage: 100, color: "#3B82F6", trend: 12 },
  { status: "CONTACTE", label_fr: "Contactés", count: 38, percentage: 59.4, color: "#8B5CF6", trend: 8 },
  { status: "EN_DISCUSSION", label_fr: "En discussion", count: 27, percentage: 42.2, color: "#EAB308", trend: 5 },
  { status: "VISITE_PLANIFIEE", label_fr: "Visite planifiée", count: 12, percentage: 18.8, color: "#F97316", trend: 3 },
  { status: "ENGAGE", label_fr: "Engagés", count: 8, percentage: 12.5, color: "#22C55E", trend: 2 },
  { status: "LETTRE_SIGNEE", label_fr: "Lettre signée", count: 6, percentage: 9.4, color: "#F59E0B", trend: 1 },
];

export const PIPELINE_RETIRED = { count: 26, trend: 4 };

export const PIPELINE_STAGE_DAYS = [
  { from: "Identifié", to: "Contacté", days: 4.2 },
  { from: "Contacté", to: "En discussion", days: 2.8 },
  { from: "En discussion", to: "Visite", days: 12.5 },
  { from: "Visite", to: "Engagé", days: 8.1 },
  { from: "Engagé", to: "Lettre", days: 15.3 },
];

// ── Per-school pipeline data ─────────────────────────────────

export interface SchoolPipelineData {
  schoolId: string;
  schoolName: string;
  type: "secondaire" | "cegep";
  funnel: PipelineAggregated[];
  retired: { count: number; trend: number };
  stageDays: { from: string; to: string; days: number }[];
  conversionRate: number;
  conversionTrend: number;
}

export const PIPELINE_BY_SCHOOL: SchoolPipelineData[] = [
  // Écoles secondaires
  {
    schoolId: "s-001", schoolName: "De Mortagne", type: "secondaire",
    funnel: [
      { status: "IDENTIFIE", label_fr: "Identifiés", count: 11, percentage: 100, color: "#3B82F6", trend: 3 },
      { status: "CONTACTE", label_fr: "Contactés", count: 7, percentage: 63.6, color: "#8B5CF6", trend: 2 },
      { status: "EN_DISCUSSION", label_fr: "En discussion", count: 5, percentage: 45.5, color: "#EAB308", trend: 1 },
      { status: "VISITE_PLANIFIEE", label_fr: "Visite planifiée", count: 3, percentage: 27.3, color: "#F97316", trend: 1 },
      { status: "ENGAGE", label_fr: "Engagés", count: 2, percentage: 18.2, color: "#22C55E", trend: 1 },
      { status: "LETTRE_SIGNEE", label_fr: "Lettre signée", count: 1, percentage: 9.1, color: "#F59E0B", trend: 0 },
    ],
    retired: { count: 4, trend: 1 },
    stageDays: [{ from: "Identifié", to: "Contacté", days: 3.8 }, { from: "Contacté", to: "En discussion", days: 2.5 }, { from: "En discussion", to: "Visite", days: 11.0 }, { from: "Visite", to: "Engagé", days: 7.5 }, { from: "Engagé", to: "Lettre", days: 14.0 }],
    conversionRate: 9.1, conversionTrend: 1.8,
  },
  {
    schoolId: "s-002", schoolName: "Saint-Jean-Eudes", type: "secondaire",
    funnel: [
      { status: "IDENTIFIE", label_fr: "Identifiés", count: 9, percentage: 100, color: "#3B82F6", trend: 2 },
      { status: "CONTACTE", label_fr: "Contactés", count: 6, percentage: 66.7, color: "#8B5CF6", trend: 1 },
      { status: "EN_DISCUSSION", label_fr: "En discussion", count: 4, percentage: 44.4, color: "#EAB308", trend: 1 },
      { status: "VISITE_PLANIFIEE", label_fr: "Visite planifiée", count: 2, percentage: 22.2, color: "#F97316", trend: 0 },
      { status: "ENGAGE", label_fr: "Engagés", count: 1, percentage: 11.1, color: "#22C55E", trend: 0 },
      { status: "LETTRE_SIGNEE", label_fr: "Lettre signée", count: 1, percentage: 11.1, color: "#F59E0B", trend: 1 },
    ],
    retired: { count: 3, trend: 0 },
    stageDays: [{ from: "Identifié", to: "Contacté", days: 5.1 }, { from: "Contacté", to: "En discussion", days: 3.2 }, { from: "En discussion", to: "Visite", days: 14.0 }, { from: "Visite", to: "Engagé", days: 9.0 }, { from: "Engagé", to: "Lettre", days: 12.0 }],
    conversionRate: 11.1, conversionTrend: 3.2,
  },
  {
    schoolId: "s-003", schoolName: "De Rochebelle", type: "secondaire",
    funnel: [
      { status: "IDENTIFIE", label_fr: "Identifiés", count: 8, percentage: 100, color: "#3B82F6", trend: 1 },
      { status: "CONTACTE", label_fr: "Contactés", count: 5, percentage: 62.5, color: "#8B5CF6", trend: 1 },
      { status: "EN_DISCUSSION", label_fr: "En discussion", count: 3, percentage: 37.5, color: "#EAB308", trend: 0 },
      { status: "VISITE_PLANIFIEE", label_fr: "Visite planifiée", count: 1, percentage: 12.5, color: "#F97316", trend: 0 },
      { status: "ENGAGE", label_fr: "Engagés", count: 1, percentage: 12.5, color: "#22C55E", trend: 1 },
      { status: "LETTRE_SIGNEE", label_fr: "Lettre signée", count: 1, percentage: 12.5, color: "#F59E0B", trend: 0 },
    ],
    retired: { count: 2, trend: 0 },
    stageDays: [{ from: "Identifié", to: "Contacté", days: 3.5 }, { from: "Contacté", to: "En discussion", days: 2.0 }, { from: "En discussion", to: "Visite", days: 10.5 }, { from: "Visite", to: "Engagé", days: 6.0 }, { from: "Engagé", to: "Lettre", days: 13.0 }],
    conversionRate: 12.5, conversionTrend: 2.5,
  },
  {
    schoolId: "s-005", schoolName: "Mont-Royal", type: "secondaire",
    funnel: [
      { status: "IDENTIFIE", label_fr: "Identifiés", count: 7, percentage: 100, color: "#3B82F6", trend: 2 },
      { status: "CONTACTE", label_fr: "Contactés", count: 4, percentage: 57.1, color: "#8B5CF6", trend: 1 },
      { status: "EN_DISCUSSION", label_fr: "En discussion", count: 3, percentage: 42.9, color: "#EAB308", trend: 1 },
      { status: "VISITE_PLANIFIEE", label_fr: "Visite planifiée", count: 1, percentage: 14.3, color: "#F97316", trend: 0 },
      { status: "ENGAGE", label_fr: "Engagés", count: 1, percentage: 14.3, color: "#22C55E", trend: 0 },
      { status: "LETTRE_SIGNEE", label_fr: "Lettre signée", count: 0, percentage: 0, color: "#F59E0B", trend: 0 },
    ],
    retired: { count: 3, trend: 1 },
    stageDays: [{ from: "Identifié", to: "Contacté", days: 4.8 }, { from: "Contacté", to: "En discussion", days: 3.0 }, { from: "En discussion", to: "Visite", days: 15.0 }, { from: "Visite", to: "Engagé", days: 10.0 }, { from: "Engagé", to: "Lettre", days: 18.0 }],
    conversionRate: 0, conversionTrend: -1.5,
  },
  {
    schoolId: "s-010", schoolName: "Louis-Riel", type: "secondaire",
    funnel: [
      { status: "IDENTIFIE", label_fr: "Identifiés", count: 6, percentage: 100, color: "#3B82F6", trend: 1 },
      { status: "CONTACTE", label_fr: "Contactés", count: 3, percentage: 50, color: "#8B5CF6", trend: 1 },
      { status: "EN_DISCUSSION", label_fr: "En discussion", count: 2, percentage: 33.3, color: "#EAB308", trend: 0 },
      { status: "VISITE_PLANIFIEE", label_fr: "Visite planifiée", count: 1, percentage: 16.7, color: "#F97316", trend: 1 },
      { status: "ENGAGE", label_fr: "Engagés", count: 1, percentage: 16.7, color: "#22C55E", trend: 0 },
      { status: "LETTRE_SIGNEE", label_fr: "Lettre signée", count: 1, percentage: 16.7, color: "#F59E0B", trend: 0 },
    ],
    retired: { count: 2, trend: 0 },
    stageDays: [{ from: "Identifié", to: "Contacté", days: 4.0 }, { from: "Contacté", to: "En discussion", days: 2.2 }, { from: "En discussion", to: "Visite", days: 9.5 }, { from: "Visite", to: "Engagé", days: 7.0 }, { from: "Engagé", to: "Lettre", days: 11.0 }],
    conversionRate: 16.7, conversionTrend: 4.2,
  },
  // CÉGEPs
  {
    schoolId: "c-001", schoolName: "CÉGEP Garneau", type: "cegep",
    funnel: [
      { status: "IDENTIFIE", label_fr: "Identifiés", count: 14, percentage: 100, color: "#3B82F6", trend: 3 },
      { status: "CONTACTE", label_fr: "Contactés", count: 9, percentage: 64.3, color: "#8B5CF6", trend: 2 },
      { status: "EN_DISCUSSION", label_fr: "En discussion", count: 6, percentage: 42.9, color: "#EAB308", trend: 1 },
      { status: "VISITE_PLANIFIEE", label_fr: "Visite planifiée", count: 3, percentage: 21.4, color: "#F97316", trend: 1 },
      { status: "ENGAGE", label_fr: "Engagés", count: 2, percentage: 14.3, color: "#22C55E", trend: 0 },
      { status: "LETTRE_SIGNEE", label_fr: "Lettre signée", count: 1, percentage: 7.1, color: "#F59E0B", trend: 0 },
    ],
    retired: { count: 5, trend: 1 },
    stageDays: [{ from: "Identifié", to: "Contacté", days: 3.5 }, { from: "Contacté", to: "En discussion", days: 2.0 }, { from: "En discussion", to: "Visite", days: 11.0 }, { from: "Visite", to: "Engagé", days: 7.5 }, { from: "Engagé", to: "Lettre", days: 14.5 }],
    conversionRate: 7.1, conversionTrend: 1.5,
  },
  {
    schoolId: "c-005", schoolName: "CÉGEP André-Laurendeau", type: "cegep",
    funnel: [
      { status: "IDENTIFIE", label_fr: "Identifiés", count: 12, percentage: 100, color: "#3B82F6", trend: 2 },
      { status: "CONTACTE", label_fr: "Contactés", count: 8, percentage: 66.7, color: "#8B5CF6", trend: 2 },
      { status: "EN_DISCUSSION", label_fr: "En discussion", count: 5, percentage: 41.7, color: "#EAB308", trend: 1 },
      { status: "VISITE_PLANIFIEE", label_fr: "Visite planifiée", count: 2, percentage: 16.7, color: "#F97316", trend: 0 },
      { status: "ENGAGE", label_fr: "Engagés", count: 1, percentage: 8.3, color: "#22C55E", trend: 1 },
      { status: "LETTRE_SIGNEE", label_fr: "Lettre signée", count: 1, percentage: 8.3, color: "#F59E0B", trend: 0 },
    ],
    retired: { count: 4, trend: 1 },
    stageDays: [{ from: "Identifié", to: "Contacté", days: 4.5 }, { from: "Contacté", to: "En discussion", days: 3.0 }, { from: "En discussion", to: "Visite", days: 13.5 }, { from: "Visite", to: "Engagé", days: 9.0 }, { from: "Engagé", to: "Lettre", days: 16.0 }],
    conversionRate: 8.3, conversionTrend: 2.0,
  },
  {
    schoolId: "c-006", schoolName: "CÉGEP Édouard-Montpetit", type: "cegep",
    funnel: [
      { status: "IDENTIFIE", label_fr: "Identifiés", count: 10, percentage: 100, color: "#3B82F6", trend: 2 },
      { status: "CONTACTE", label_fr: "Contactés", count: 6, percentage: 60, color: "#8B5CF6", trend: 1 },
      { status: "EN_DISCUSSION", label_fr: "En discussion", count: 4, percentage: 40, color: "#EAB308", trend: 1 },
      { status: "VISITE_PLANIFIEE", label_fr: "Visite planifiée", count: 2, percentage: 20, color: "#F97316", trend: 1 },
      { status: "ENGAGE", label_fr: "Engagés", count: 1, percentage: 10, color: "#22C55E", trend: 0 },
      { status: "LETTRE_SIGNEE", label_fr: "Lettre signée", count: 1, percentage: 10, color: "#F59E0B", trend: 1 },
    ],
    retired: { count: 3, trend: 0 },
    stageDays: [{ from: "Identifié", to: "Contacté", days: 5.0 }, { from: "Contacté", to: "En discussion", days: 3.5 }, { from: "En discussion", to: "Visite", days: 14.0 }, { from: "Visite", to: "Engagé", days: 8.5 }, { from: "Engagé", to: "Lettre", days: 17.0 }],
    conversionRate: 10, conversionTrend: 3.5,
  },
  {
    schoolId: "c-002", schoolName: "CÉGEP de Sainte-Foy", type: "cegep",
    funnel: [
      { status: "IDENTIFIE", label_fr: "Identifiés", count: 8, percentage: 100, color: "#3B82F6", trend: 1 },
      { status: "CONTACTE", label_fr: "Contactés", count: 5, percentage: 62.5, color: "#8B5CF6", trend: 1 },
      { status: "EN_DISCUSSION", label_fr: "En discussion", count: 3, percentage: 37.5, color: "#EAB308", trend: 0 },
      { status: "VISITE_PLANIFIEE", label_fr: "Visite planifiée", count: 1, percentage: 12.5, color: "#F97316", trend: 0 },
      { status: "ENGAGE", label_fr: "Engagés", count: 0, percentage: 0, color: "#22C55E", trend: 0 },
      { status: "LETTRE_SIGNEE", label_fr: "Lettre signée", count: 0, percentage: 0, color: "#F59E0B", trend: 0 },
    ],
    retired: { count: 3, trend: 1 },
    stageDays: [{ from: "Identifié", to: "Contacté", days: 4.0 }, { from: "Contacté", to: "En discussion", days: 2.5 }, { from: "En discussion", to: "Visite", days: 12.0 }, { from: "Visite", to: "Engagé", days: 8.0 }, { from: "Engagé", to: "Lettre", days: 15.0 }],
    conversionRate: 0, conversionTrend: -0.5,
  },
  {
    schoolId: "c-008", schoolName: "CÉGEP de Jonquière", type: "cegep",
    funnel: [
      { status: "IDENTIFIE", label_fr: "Identifiés", count: 5, percentage: 100, color: "#3B82F6", trend: 1 },
      { status: "CONTACTE", label_fr: "Contactés", count: 3, percentage: 60, color: "#8B5CF6", trend: 0 },
      { status: "EN_DISCUSSION", label_fr: "En discussion", count: 2, percentage: 40, color: "#EAB308", trend: 1 },
      { status: "VISITE_PLANIFIEE", label_fr: "Visite planifiée", count: 1, percentage: 20, color: "#F97316", trend: 0 },
      { status: "ENGAGE", label_fr: "Engagés", count: 0, percentage: 0, color: "#22C55E", trend: 0 },
      { status: "LETTRE_SIGNEE", label_fr: "Lettre signée", count: 0, percentage: 0, color: "#F59E0B", trend: 0 },
    ],
    retired: { count: 2, trend: 1 },
    stageDays: [{ from: "Identifié", to: "Contacté", days: 5.5 }, { from: "Contacté", to: "En discussion", days: 3.8 }, { from: "En discussion", to: "Visite", days: 16.0 }, { from: "Visite", to: "Engagé", days: 10.0 }, { from: "Engagé", to: "Lettre", days: 18.0 }],
    conversionRate: 0, conversionTrend: 0,
  },
];

// ── Analytics ────────────────────────────────────────────────

export const ANALYTICS = {
  response_rate: 87,
  avg_response_time_hours: 6.2,
  conversion_funnel: [
    { step: "Inscription", count: 347, rate: 100 },
    { step: "Profil créé", count: 298, rate: 85.9 },
    { step: "Profil complété", count: 231, rate: 66.6 },
    { step: "Vérifié", count: 231, rate: 66.6 },
    { step: "Contacté", count: 142, rate: 40.9 },
  ],
  top_sports: [
    { sport: "Football", athletes: 112, views: 2840 },
    { sport: "Basketball", athletes: 78, views: 1560 },
    { sport: "Hockey", athletes: 64, views: 1920 },
    { sport: "Soccer", athletes: 45, views: 810 },
    { sport: "Volleyball", athletes: 28, views: 420 },
  ],
  top_cegeps: [
    { name: "CÉGEP Édouard-Montpetit", contacts: 48, signed: 5 },
    { name: "CÉGEP Garneau", contacts: 42, signed: 4 },
    { name: "CÉGEP André-Laurendeau", contacts: 38, signed: 3 },
    { name: "CÉGEP de Sainte-Foy", contacts: 35, signed: 4 },
    { name: "Collège Montmorency", contacts: 31, signed: 2 },
    { name: "CÉGEP de Sherbrooke", contacts: 28, signed: 3 },
    { name: "CÉGEP Limoilou", contacts: 22, signed: 2 },
    { name: "CÉGEP de Jonquière", contacts: 18, signed: 1 },
  ],
  monthly_signups: [
    { month: "Oct", coaches: 8, recruiters: 4 },
    { month: "Nov", coaches: 12, recruiters: 6 },
    { month: "Déc", coaches: 6, recruiters: 3 },
    { month: "Jan", coaches: 18, recruiters: 9 },
    { month: "Fév", coaches: 22, recruiters: 11 },
    { month: "Mar", coaches: 23, recruiters: 9 },
  ],
};

// ── Per-school analytics ─────────────────────────────────────

export interface SchoolAnalytics {
  schoolId: string;
  schoolName: string;
  type: "secondaire" | "cegep";
  response_rate: number;
  avg_response_time_hours: number;
  conversion_funnel: { step: string; count: number; rate: number }[];
  top_sports: { sport: string; athletes: number; views: number }[];
  monthly_signups: { month: string; coaches: number; recruiters: number }[];
}

export const ANALYTICS_BY_SCHOOL: SchoolAnalytics[] = [
  // Secondaires
  {
    schoolId: "s-001", schoolName: "De Mortagne", type: "secondaire",
    response_rate: 92, avg_response_time_hours: 4.5,
    conversion_funnel: [{ step: "Inscription", count: 52, rate: 100 }, { step: "Profil créé", count: 45, rate: 86.5 }, { step: "Profil complété", count: 38, rate: 73.1 }, { step: "Vérifié", count: 35, rate: 67.3 }, { step: "Contacté", count: 22, rate: 42.3 }],
    top_sports: [{ sport: "Football", athletes: 24, views: 680 }, { sport: "Basketball", athletes: 12, views: 210 }, { sport: "Soccer", athletes: 8, views: 120 }],
    monthly_signups: [{ month: "Oct", coaches: 2, recruiters: 0 }, { month: "Nov", coaches: 3, recruiters: 0 }, { month: "Déc", coaches: 1, recruiters: 0 }, { month: "Jan", coaches: 4, recruiters: 0 }, { month: "Fév", coaches: 3, recruiters: 0 }, { month: "Mar", coaches: 2, recruiters: 0 }],
  },
  {
    schoolId: "s-002", schoolName: "Saint-Jean-Eudes", type: "secondaire",
    response_rate: 95, avg_response_time_hours: 3.8,
    conversion_funnel: [{ step: "Inscription", count: 48, rate: 100 }, { step: "Profil créé", count: 42, rate: 87.5 }, { step: "Profil complété", count: 35, rate: 72.9 }, { step: "Vérifié", count: 33, rate: 68.8 }, { step: "Contacté", count: 20, rate: 41.7 }],
    top_sports: [{ sport: "Football", athletes: 20, views: 620 }, { sport: "Hockey", athletes: 14, views: 480 }, { sport: "Basketball", athletes: 10, views: 180 }],
    monthly_signups: [{ month: "Oct", coaches: 1, recruiters: 0 }, { month: "Nov", coaches: 2, recruiters: 0 }, { month: "Déc", coaches: 1, recruiters: 0 }, { month: "Jan", coaches: 3, recruiters: 0 }, { month: "Fév", coaches: 4, recruiters: 0 }, { month: "Mar", coaches: 3, recruiters: 0 }],
  },
  {
    schoolId: "s-003", schoolName: "De Rochebelle", type: "secondaire",
    response_rate: 88, avg_response_time_hours: 5.2,
    conversion_funnel: [{ step: "Inscription", count: 38, rate: 100 }, { step: "Profil créé", count: 32, rate: 84.2 }, { step: "Profil complété", count: 25, rate: 65.8 }, { step: "Vérifié", count: 22, rate: 57.9 }, { step: "Contacté", count: 14, rate: 36.8 }],
    top_sports: [{ sport: "Football", athletes: 16, views: 380 }, { sport: "Basketball", athletes: 8, views: 140 }, { sport: "Volleyball", athletes: 6, views: 90 }],
    monthly_signups: [{ month: "Oct", coaches: 1, recruiters: 0 }, { month: "Nov", coaches: 2, recruiters: 0 }, { month: "Déc", coaches: 1, recruiters: 0 }, { month: "Jan", coaches: 2, recruiters: 0 }, { month: "Fév", coaches: 3, recruiters: 0 }, { month: "Mar", coaches: 2, recruiters: 0 }],
  },
  {
    schoolId: "s-005", schoolName: "Mont-Royal", type: "secondaire",
    response_rate: 82, avg_response_time_hours: 7.1,
    conversion_funnel: [{ step: "Inscription", count: 35, rate: 100 }, { step: "Profil créé", count: 28, rate: 80 }, { step: "Profil complété", count: 20, rate: 57.1 }, { step: "Vérifié", count: 18, rate: 51.4 }, { step: "Contacté", count: 11, rate: 31.4 }],
    top_sports: [{ sport: "Basketball", athletes: 18, views: 320 }, { sport: "Soccer", athletes: 10, views: 160 }, { sport: "Volleyball", athletes: 5, views: 60 }],
    monthly_signups: [{ month: "Oct", coaches: 1, recruiters: 0 }, { month: "Nov", coaches: 1, recruiters: 0 }, { month: "Déc", coaches: 0, recruiters: 0 }, { month: "Jan", coaches: 2, recruiters: 0 }, { month: "Fév", coaches: 3, recruiters: 0 }, { month: "Mar", coaches: 2, recruiters: 0 }],
  },
  {
    schoolId: "s-010", schoolName: "Louis-Riel", type: "secondaire",
    response_rate: 79, avg_response_time_hours: 8.5,
    conversion_funnel: [{ step: "Inscription", count: 30, rate: 100 }, { step: "Profil créé", count: 24, rate: 80 }, { step: "Profil complété", count: 18, rate: 60 }, { step: "Vérifié", count: 15, rate: 50 }, { step: "Contacté", count: 9, rate: 30 }],
    top_sports: [{ sport: "Basketball", athletes: 12, views: 180 }, { sport: "Soccer", athletes: 10, views: 150 }, { sport: "Volleyball", athletes: 8, views: 90 }, { sport: "Athlétisme", athletes: 4, views: 30 }],
    monthly_signups: [{ month: "Oct", coaches: 1, recruiters: 0 }, { month: "Nov", coaches: 2, recruiters: 0 }, { month: "Déc", coaches: 1, recruiters: 0 }, { month: "Jan", coaches: 3, recruiters: 0 }, { month: "Fév", coaches: 2, recruiters: 0 }, { month: "Mar", coaches: 2, recruiters: 0 }],
  },
  // CÉGEPs
  {
    schoolId: "c-001", schoolName: "CÉGEP Garneau", type: "cegep",
    response_rate: 91, avg_response_time_hours: 5.0,
    conversion_funnel: [{ step: "Inscription", count: 42, rate: 100 }, { step: "Profil créé", count: 38, rate: 90.5 }, { step: "Profil complété", count: 30, rate: 71.4 }, { step: "Vérifié", count: 28, rate: 66.7 }, { step: "Contacté", count: 18, rate: 42.9 }],
    top_sports: [{ sport: "Football", athletes: 18, views: 520 }, { sport: "Basketball", athletes: 10, views: 210 }, { sport: "Soccer", athletes: 8, views: 130 }, { sport: "Volleyball", athletes: 4, views: 50 }],
    monthly_signups: [{ month: "Oct", coaches: 0, recruiters: 1 }, { month: "Nov", coaches: 0, recruiters: 2 }, { month: "Déc", coaches: 0, recruiters: 1 }, { month: "Jan", coaches: 0, recruiters: 3 }, { month: "Fév", coaches: 0, recruiters: 2 }, { month: "Mar", coaches: 0, recruiters: 2 }],
  },
  {
    schoolId: "c-005", schoolName: "CÉGEP André-Laurendeau", type: "cegep",
    response_rate: 85, avg_response_time_hours: 6.8,
    conversion_funnel: [{ step: "Inscription", count: 38, rate: 100 }, { step: "Profil créé", count: 32, rate: 84.2 }, { step: "Profil complété", count: 26, rate: 68.4 }, { step: "Vérifié", count: 24, rate: 63.2 }, { step: "Contacté", count: 15, rate: 39.5 }],
    top_sports: [{ sport: "Football", athletes: 16, views: 420 }, { sport: "Basketball", athletes: 12, views: 280 }, { sport: "Hockey", athletes: 8, views: 190 }],
    monthly_signups: [{ month: "Oct", coaches: 0, recruiters: 1 }, { month: "Nov", coaches: 0, recruiters: 1 }, { month: "Déc", coaches: 0, recruiters: 0 }, { month: "Jan", coaches: 0, recruiters: 2 }, { month: "Fév", coaches: 0, recruiters: 2 }, { month: "Mar", coaches: 0, recruiters: 1 }],
  },
  {
    schoolId: "c-006", schoolName: "CÉGEP Édouard-Montpetit", type: "cegep",
    response_rate: 90, avg_response_time_hours: 5.5,
    conversion_funnel: [{ step: "Inscription", count: 48, rate: 100 }, { step: "Profil créé", count: 44, rate: 91.7 }, { step: "Profil complété", count: 36, rate: 75 }, { step: "Vérifié", count: 34, rate: 70.8 }, { step: "Contacté", count: 22, rate: 45.8 }],
    top_sports: [{ sport: "Football", athletes: 22, views: 580 }, { sport: "Basketball", athletes: 10, views: 200 }, { sport: "Hockey", athletes: 8, views: 240 }, { sport: "Soccer", athletes: 6, views: 80 }],
    monthly_signups: [{ month: "Oct", coaches: 0, recruiters: 1 }, { month: "Nov", coaches: 0, recruiters: 2 }, { month: "Déc", coaches: 0, recruiters: 1 }, { month: "Jan", coaches: 0, recruiters: 3 }, { month: "Fév", coaches: 0, recruiters: 3 }, { month: "Mar", coaches: 0, recruiters: 2 }],
  },
  {
    schoolId: "c-002", schoolName: "CÉGEP de Sainte-Foy", type: "cegep",
    response_rate: 88, avg_response_time_hours: 6.0,
    conversion_funnel: [{ step: "Inscription", count: 35, rate: 100 }, { step: "Profil créé", count: 30, rate: 85.7 }, { step: "Profil complété", count: 24, rate: 68.6 }, { step: "Vérifié", count: 22, rate: 62.9 }, { step: "Contacté", count: 14, rate: 40 }],
    top_sports: [{ sport: "Football", athletes: 14, views: 350 }, { sport: "Basketball", athletes: 10, views: 180 }, { sport: "Hockey", athletes: 8, views: 200 }],
    monthly_signups: [{ month: "Oct", coaches: 0, recruiters: 1 }, { month: "Nov", coaches: 0, recruiters: 1 }, { month: "Déc", coaches: 0, recruiters: 1 }, { month: "Jan", coaches: 0, recruiters: 2 }, { month: "Fév", coaches: 0, recruiters: 2 }, { month: "Mar", coaches: 0, recruiters: 1 }],
  },
  {
    schoolId: "c-008", schoolName: "CÉGEP de Jonquière", type: "cegep",
    response_rate: 76, avg_response_time_hours: 9.2,
    conversion_funnel: [{ step: "Inscription", count: 18, rate: 100 }, { step: "Profil créé", count: 14, rate: 77.8 }, { step: "Profil complété", count: 10, rate: 55.6 }, { step: "Vérifié", count: 8, rate: 44.4 }, { step: "Contacté", count: 5, rate: 27.8 }],
    top_sports: [{ sport: "Hockey", athletes: 8, views: 120 }, { sport: "Volleyball", athletes: 5, views: 60 }, { sport: "Basketball", athletes: 4, views: 40 }],
    monthly_signups: [{ month: "Oct", coaches: 0, recruiters: 0 }, { month: "Nov", coaches: 0, recruiters: 1 }, { month: "Déc", coaches: 0, recruiters: 0 }, { month: "Jan", coaches: 0, recruiters: 1 }, { month: "Fév", coaches: 0, recruiters: 1 }, { month: "Mar", coaches: 0, recruiters: 0 }],
  },
];

// ── System Settings ──────────────────────────────────────────

export const SYSTEM_SETTINGS = {
  verification_threshold: 60,
  current_season: "2025-2026",
  recruitment_period: { start: "2025-09-01", end: "2026-06-30" },
  maintenance_mode: false,
  auto_advance_pipeline: true,
  intro_message_template: "Bonjour [Coach], je suis [Recruteur] du CÉGEP [CÉGEP]. J'aimerais en savoir plus sur [Athlète] pour notre programme de [Sport]. Pourriez-vous me contacter à votre convenance?",
};

// ── System Alerts (generated from data above) ────────────────
/* Business Rules:
   1. pending_validation — ADMIN_USERS with status "pending_validation" → warning
   2. pending_approval   — ADMIN_ATHLETES with status "pending_approval" → info (warning if >5)
   3. flagged_content     — MODERATION_ITEMS with status "open" → critical if high severity
   4. inactive_coach      — Coach last_login > 30 days ago → warning
   5. low_completion      — Approved athletes with completeness < 40% → info
   6. suspended_user      — ADMIN_USERS with status "suspended" → info
*/

function generateAlerts(): SystemAlert[] {
  const now = new Date("2026-03-16T12:00:00Z").getTime();
  const alerts: SystemAlert[] = [];
  let id = 1;

  const pendingUsers = ADMIN_USERS.filter((u) => u.status === "pending_validation");
  if (pendingUsers.length > 0) {
    alerts.push({ id: `a-${String(id++).padStart(3, "0")}`, type: "pending_validation", message: `${pendingUsers.length} recruteur${pendingUsers.length > 1 ? "s" : ""} en attente de validation`, severity: "warning", created_at: pendingUsers.map((u) => u.created_at).sort().reverse()[0], link: "/admin/users" });
  }

  const pendingAthletes = ADMIN_ATHLETES.filter((a) => a.status === "pending_approval");
  if (pendingAthletes.length > 0) {
    alerts.push({ id: `a-${String(id++).padStart(3, "0")}`, type: "pending_approval", message: `${pendingAthletes.length} profil${pendingAthletes.length > 1 ? "s" : ""} d'athlètes en attente d'approbation`, severity: pendingAthletes.length > 5 ? "warning" : "info", created_at: pendingAthletes.map((a) => a.created_at).sort().reverse()[0], link: "/admin/athletes" });
  }

  const openMod = MODERATION_ITEMS.filter((m) => m.status === "open");
  for (const item of openMod) {
    alerts.push({ id: `a-${String(id++).padStart(3, "0")}`, type: "flagged_content", message: `${item.reason} — ${item.reported_user} (${item.reported_user_role})`, severity: item.severity === "high" ? "critical" : "warning", created_at: item.created_at, link: "/admin/moderation" });
  }

  const THIRTY_DAYS = 30 * 24 * 3600 * 1000;
  const inactiveCoaches = ADMIN_USERS.filter((u) => u.role === "coach" && u.status === "active" && u.last_login_at && now - new Date(u.last_login_at).getTime() > THIRTY_DAYS);
  for (const coach of inactiveCoaches) {
    const days = Math.floor((now - new Date(coach.last_login_at!).getTime()) / (24 * 3600 * 1000));
    alerts.push({ id: `a-${String(id++).padStart(3, "0")}`, type: "system", message: `Coach ${coach.full_name} inactif depuis ${days} jours`, severity: "warning", created_at: coach.last_login_at!, link: "/admin/users" });
  }

  const lowCompletion = ADMIN_ATHLETES.filter((a) => a.status === "approved" && a.profile_completeness < 40);
  if (lowCompletion.length > 0) {
    alerts.push({ id: `a-${String(id++).padStart(3, "0")}`, type: "system", message: `${lowCompletion.length} profil${lowCompletion.length > 1 ? "s" : ""} approuvé${lowCompletion.length > 1 ? "s" : ""} sous 40% de complétion`, severity: "info", created_at: new Date(now - 24 * 3600 * 1000).toISOString(), link: "/admin/athletes" });
  }

  const suspended = ADMIN_USERS.filter((u) => u.status === "suspended");
  if (suspended.length > 0) {
    alerts.push({ id: `a-${String(id++).padStart(3, "0")}`, type: "system", message: `${suspended.length} utilisateur${suspended.length > 1 ? "s" : ""} suspendu${suspended.length > 1 ? "s" : ""} — révision recommandée`, severity: "info", created_at: new Date(now - 2 * 24 * 3600 * 1000).toISOString(), link: "/admin/users" });
  }

  // Director ownership alerts
  alerts.push({ id: `a-${String(id++).padStart(3, "0")}`, type: "ownership_transfer", message: "Demande de transfert de propriété — É.S. De Mortagne: Marie-Ève Lapointe → Luc Tremblay", severity: "warning", created_at: "2026-03-10T09:00:00Z", link: "/admin/users?tab=directors" });
  alerts.push({ id: `a-${String(id++).padStart(3, "0")}`, type: "director_join", message: "Nouvelle demande de directeur — Jean Tremblay veut rejoindre É.S. Saint-Jean-Eudes", severity: "info", created_at: "2026-03-14T10:00:00Z", link: "/admin/users?tab=directors" });
  alerts.push({ id: `a-${String(id++).padStart(3, "0")}`, type: "inactive_owner", message: "Directeur principal inactif depuis 47 jours — É.S. Saint-Jean-Eudes — Patrick Bergeron", severity: "critical", created_at: "2026-03-15T08:00:00Z", link: "/admin/users?tab=directors" });

  // League alerts
  alerts.push({ id: `a-${String(id++).padStart(3, "0")}`, type: "system", message: "Ligue sans coordonnateur — Élite Baseball Québec", severity: "warning", created_at: "2026-03-16T09:00:00Z", link: "/admin/schools" });
  alerts.push({ id: `a-${String(id++).padStart(3, "0")}`, type: "system", message: "Ligue sans coordonnateur — Titans Rugby Montréal", severity: "warning", created_at: "2026-03-16T09:30:00Z", link: "/admin/schools" });
  alerts.push({ id: `a-${String(id++).padStart(3, "0")}`, type: "pending_validation", message: "Entraîneur ligue en attente — Alain Tremblay, Remparts Hockey AAA", severity: "info", created_at: "2026-03-10T10:00:00Z", link: "/admin/users" });

  const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => (sevOrder[a.severity] - sevOrder[b.severity]) || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  return alerts;
}

export const SYSTEM_ALERTS: SystemAlert[] = generateAlerts();

// ── Subscription Tiers ───────────────────────────────────────

export interface SubscriptionTier {
  id: string;
  name: string;
  customer_type: "cegep" | "school" | "athlete";
  price_monthly: number;
  price_yearly: number;
  features: string[];
  limits: {
    max_recruiters?: number;
    max_coaches?: number;
    max_sports?: number;
    max_contacts_month?: number;
  };
  is_popular: boolean;
}

export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  { id: "tier-cegep-free", name: "Découverte", customer_type: "cegep", price_monthly: 0, price_yearly: 0, features: ["Recherche de base", "1 recruteur", "1 sport", "5 contacts/mois"], limits: { max_recruiters: 1, max_sports: 1, max_contacts_month: 5 }, is_popular: false },
  { id: "tier-cegep-standard", name: "Standard", customer_type: "cegep", price_monthly: 149, price_yearly: 1490, features: ["3 recruteurs", "3 sports", "Contacts illimités", "Pipeline de recrutement", "Analytique de base"], limits: { max_recruiters: 3, max_sports: 3, max_contacts_month: -1 }, is_popular: true },
  { id: "tier-cegep-premium", name: "Premium", customer_type: "cegep", price_monthly: 299, price_yearly: 2990, features: ["10 recruteurs", "Tous les sports", "Analytique avancée", "Priorité dans les résultats", "Support dédié", "Export de données"], limits: { max_recruiters: 10, max_sports: -1, max_contacts_month: -1 }, is_popular: false },
  { id: "tier-cegep-enterprise", name: "Entreprise", customer_type: "cegep", price_monthly: -1, price_yearly: -1, features: ["Recruteurs illimités", "API d'intégration", "SSO / SAML", "Onboarding personnalisé", "SLA garanti", "Gestionnaire de compte dédié"], limits: { max_recruiters: -1, max_sports: -1, max_contacts_month: -1 }, is_popular: false },
  { id: "tier-school-free", name: "Essentiel", customer_type: "school", price_monthly: 0, price_yearly: 0, features: ["1 coach", "Profils de base", "Visibilité standard"], limits: { max_coaches: 1, max_sports: 1 }, is_popular: false },
  { id: "tier-school-pro", name: "Pro", customer_type: "school", price_monthly: 79, price_yearly: 790, features: ["3 coachs", "Profils détaillés", "Analytique vues recruteurs", "Badge école vérifiée", "Rapport mensuel"], limits: { max_coaches: 3, max_sports: 3 }, is_popular: true },
  { id: "tier-school-elite", name: "Élite", customer_type: "school", price_monthly: 149, price_yearly: 1490, features: ["Coachs illimités", "Tous les sports", "Analytique avancée", "Promotion prioritaire", "Support dédié"], limits: { max_coaches: -1, max_sports: -1 }, is_popular: false },
  { id: "tier-athlete-free", name: "Gratuit", customer_type: "athlete", price_monthly: 0, price_yearly: 0, features: ["Profil de base créé par le coach", "Visible dans la recherche"], limits: {}, is_popular: false },
  { id: "tier-athlete-pro", name: "Pro", customer_type: "athlete", price_monthly: 2.99, price_yearly: 24, features: ["Profil boosté (priorité dans résultats)", "Notifications quand un recruteur consulte", "Tableau de bord personnel", "Badge « Profil actif »"], limits: {}, is_popular: true },
];

// ── Institution Subscriptions ────────────────────────────────

export interface InstitutionSubscription {
  id: string;
  institution_name: string;
  institution_type: "cegep" | "school";
  city: string;
  conference: "sud_ouest" | "nord_est" | null;
  tier_id: string;
  billing_cycle: "monthly" | "yearly" | "free";
  status: "active" | "trial" | "past_due" | "cancelled" | "expired";
  current_period_start: string;
  current_period_end: string;
  trial_ends_at: string | null;
  seats_used: number;
  seats_max: number;
  sports_active: string[];
  monthly_revenue: number;
  created_at: string;
  cancelled_at: string | null;
  last_payment_at: string | null;
  contact_name: string;
  contact_email: string;
}

export const INSTITUTION_SUBSCRIPTIONS: InstitutionSubscription[] = [
  // CÉGEPs — Standard (8)
  { id: "sub-c01", institution_name: "CÉGEP Garneau", institution_type: "cegep", city: "Québec", conference: "nord_est", tier_id: "tier-cegep-standard", billing_cycle: "yearly", status: "active", current_period_start: "2025-09-01", current_period_end: "2026-08-31", trial_ends_at: null, seats_used: 3, seats_max: 3, sports_active: ["Football", "Basketball", "Soccer"], monthly_revenue: 124.17, created_at: "2025-08-15T10:00:00Z", cancelled_at: null, last_payment_at: "2025-09-01T00:00:00Z", contact_name: "François Simard", contact_email: "f.simard@cegep-garneau.qc.ca" },
  { id: "sub-c02", institution_name: "CÉGEP de Sainte-Foy", institution_type: "cegep", city: "Québec", conference: "nord_est", tier_id: "tier-cegep-standard", billing_cycle: "monthly", status: "active", current_period_start: "2026-03-01", current_period_end: "2026-03-31", trial_ends_at: null, seats_used: 2, seats_max: 3, sports_active: ["Football", "Basketball"], monthly_revenue: 149, created_at: "2025-10-01T09:00:00Z", cancelled_at: null, last_payment_at: "2026-03-01T00:00:00Z", contact_name: "Stéphanie Bouchard", contact_email: "s.bouchard@ste-foy.qc.ca" },
  { id: "sub-c03", institution_name: "CÉGEP Limoilou", institution_type: "cegep", city: "Québec", conference: "nord_est", tier_id: "tier-cegep-standard", billing_cycle: "yearly", status: "active", current_period_start: "2025-09-01", current_period_end: "2026-08-31", trial_ends_at: null, seats_used: 2, seats_max: 3, sports_active: ["Football", "Soccer"], monthly_revenue: 124.17, created_at: "2025-08-20T11:00:00Z", cancelled_at: null, last_payment_at: "2025-09-01T00:00:00Z", contact_name: "Julie Mercier", contact_email: "j.mercier@limoilou.qc.ca" },
  { id: "sub-c04", institution_name: "CÉGEP du Vieux-Montréal", institution_type: "cegep", city: "Montréal", conference: "sud_ouest", tier_id: "tier-cegep-standard", billing_cycle: "monthly", status: "active", current_period_start: "2026-03-01", current_period_end: "2026-03-31", trial_ends_at: null, seats_used: 3, seats_max: 3, sports_active: ["Basketball", "Soccer", "Volleyball"], monthly_revenue: 149, created_at: "2025-11-15T14:00:00Z", cancelled_at: null, last_payment_at: "2026-03-01T00:00:00Z", contact_name: "Pierre Lavoie", contact_email: "p.lavoie@cvm.qc.ca" },
  { id: "sub-c05", institution_name: "CÉGEP de Lévis", institution_type: "cegep", city: "Lévis", conference: "nord_est", tier_id: "tier-cegep-standard", billing_cycle: "yearly", status: "active", current_period_start: "2026-01-01", current_period_end: "2026-12-31", trial_ends_at: null, seats_used: 1, seats_max: 3, sports_active: ["Football"], monthly_revenue: 124.17, created_at: "2025-12-15T10:00:00Z", cancelled_at: null, last_payment_at: "2026-01-01T00:00:00Z", contact_name: "Martin Roy", contact_email: "m.roy@cegeplevis.qc.ca" },
  { id: "sub-c06", institution_name: "CÉGEP de Saint-Laurent", institution_type: "cegep", city: "Montréal", conference: "sud_ouest", tier_id: "tier-cegep-standard", billing_cycle: "monthly", status: "active", current_period_start: "2026-03-01", current_period_end: "2026-03-31", trial_ends_at: null, seats_used: 2, seats_max: 3, sports_active: ["Basketball", "Soccer"], monthly_revenue: 149, created_at: "2026-01-10T09:00:00Z", cancelled_at: null, last_payment_at: "2026-03-01T00:00:00Z", contact_name: "Nadia Tremblay", contact_email: "n.tremblay@cegep-st-laurent.qc.ca" },
  { id: "sub-c07", institution_name: "Collège de Bois-de-Boulogne", institution_type: "cegep", city: "Montréal", conference: "sud_ouest", tier_id: "tier-cegep-standard", billing_cycle: "yearly", status: "active", current_period_start: "2025-09-01", current_period_end: "2026-08-31", trial_ends_at: null, seats_used: 1, seats_max: 3, sports_active: ["Basketball"], monthly_revenue: 124.17, created_at: "2025-08-25T13:00:00Z", cancelled_at: null, last_payment_at: "2025-09-01T00:00:00Z", contact_name: "Catherine Dubois", contact_email: "c.dubois@bdeb.qc.ca" },
  { id: "sub-c08", institution_name: "Champlain Lennoxville", institution_type: "cegep", city: "Sherbrooke", conference: "nord_est", tier_id: "tier-cegep-standard", billing_cycle: "monthly", status: "active", current_period_start: "2026-03-01", current_period_end: "2026-03-31", trial_ends_at: null, seats_used: 2, seats_max: 3, sports_active: ["Football", "Rugby"], monthly_revenue: 149, created_at: "2026-02-01T10:00:00Z", cancelled_at: null, last_payment_at: "2026-03-01T00:00:00Z", contact_name: "James Wilson", contact_email: "j.wilson@champlain.qc.ca" },
  // CÉGEPs — Premium (4)
  { id: "sub-c09", institution_name: "CÉGEP Édouard-Montpetit", institution_type: "cegep", city: "Longueuil", conference: "sud_ouest", tier_id: "tier-cegep-premium", billing_cycle: "yearly", status: "active", current_period_start: "2025-09-01", current_period_end: "2026-08-31", trial_ends_at: null, seats_used: 5, seats_max: 10, sports_active: ["Football", "Basketball", "Hockey", "Soccer"], monthly_revenue: 249.17, created_at: "2025-08-10T10:00:00Z", cancelled_at: null, last_payment_at: "2025-09-01T00:00:00Z", contact_name: "Éric Tanguay", contact_email: "e.tanguay@edouard-montpetit.qc.ca" },
  { id: "sub-c10", institution_name: "CÉGEP André-Laurendeau", institution_type: "cegep", city: "LaSalle", conference: "sud_ouest", tier_id: "tier-cegep-premium", billing_cycle: "monthly", status: "active", current_period_start: "2026-03-01", current_period_end: "2026-03-31", trial_ends_at: null, seats_used: 4, seats_max: 10, sports_active: ["Football", "Basketball", "Hockey"], monthly_revenue: 299, created_at: "2025-09-15T11:00:00Z", cancelled_at: null, last_payment_at: "2026-03-01T00:00:00Z", contact_name: "Michel Gagnon", contact_email: "m.gagnon@claurendeau.qc.ca" },
  { id: "sub-c11", institution_name: "Collège Montmorency", institution_type: "cegep", city: "Laval", conference: "sud_ouest", tier_id: "tier-cegep-premium", billing_cycle: "yearly", status: "active", current_period_start: "2025-10-01", current_period_end: "2026-09-30", trial_ends_at: null, seats_used: 3, seats_max: 10, sports_active: ["Football", "Basketball"], monthly_revenue: 249.17, created_at: "2025-09-20T14:00:00Z", cancelled_at: null, last_payment_at: "2025-10-01T00:00:00Z", contact_name: "Caroline Bergeron", contact_email: "c.bergeron@montmorency.qc.ca" },
  { id: "sub-c12", institution_name: "CÉGEP de Sherbrooke", institution_type: "cegep", city: "Sherbrooke", conference: "nord_est", tier_id: "tier-cegep-premium", billing_cycle: "monthly", status: "active", current_period_start: "2026-03-01", current_period_end: "2026-03-31", trial_ends_at: null, seats_used: 3, seats_max: 10, sports_active: ["Football", "Hockey", "Volleyball"], monthly_revenue: 299, created_at: "2025-11-01T09:00:00Z", cancelled_at: null, last_payment_at: "2026-03-01T00:00:00Z", contact_name: "Josée Bélanger", contact_email: "j.belanger@cegepsherbrooke.qc.ca" },
  // CÉGEPs — Découverte (3)
  { id: "sub-c13", institution_name: "CÉGEP de Matane", institution_type: "cegep", city: "Matane", conference: "nord_est", tier_id: "tier-cegep-free", billing_cycle: "free", status: "active", current_period_start: "2026-01-15", current_period_end: "2099-12-31", trial_ends_at: null, seats_used: 1, seats_max: 1, sports_active: ["Volleyball"], monthly_revenue: 0, created_at: "2026-01-15T10:00:00Z", cancelled_at: null, last_payment_at: null, contact_name: "Luc Pelletier", contact_email: "l.pelletier@cegep-matane.qc.ca" },
  { id: "sub-c14", institution_name: "CÉGEP de Rivière-du-Loup", institution_type: "cegep", city: "Rivière-du-Loup", conference: "nord_est", tier_id: "tier-cegep-free", billing_cycle: "free", status: "active", current_period_start: "2026-02-01", current_period_end: "2099-12-31", trial_ends_at: null, seats_used: 1, seats_max: 1, sports_active: ["Hockey"], monthly_revenue: 0, created_at: "2026-02-01T11:00:00Z", cancelled_at: null, last_payment_at: null, contact_name: "Anne Deschênes", contact_email: "a.deschenes@cegep-rdl.qc.ca" },
  { id: "sub-c15", institution_name: "CÉGEP de Victoriaville", institution_type: "cegep", city: "Victoriaville", conference: "nord_est", tier_id: "tier-cegep-free", billing_cycle: "free", status: "trial", current_period_start: "2026-03-01", current_period_end: "2026-03-31", trial_ends_at: "2026-03-20T00:00:00Z", seats_used: 1, seats_max: 1, sports_active: ["Football"], monthly_revenue: 0, created_at: "2026-03-01T09:00:00Z", cancelled_at: null, last_payment_at: null, contact_name: "Simon Fournier", contact_email: "s.fournier@cegep-victo.qc.ca" },
  // CÉGEPs — Entreprise (2)
  { id: "sub-c16", institution_name: "CÉGEP de l'Outaouais", institution_type: "cegep", city: "Gatineau", conference: "sud_ouest", tier_id: "tier-cegep-enterprise", billing_cycle: "yearly", status: "active", current_period_start: "2025-09-01", current_period_end: "2026-08-31", trial_ends_at: null, seats_used: 8, seats_max: -1, sports_active: ["Football", "Basketball", "Hockey", "Soccer", "Volleyball"], monthly_revenue: 416.67, created_at: "2025-08-01T10:00:00Z", cancelled_at: null, last_payment_at: "2025-09-01T00:00:00Z", contact_name: "Isabelle Lemieux", contact_email: "i.lemieux@cegepoutaouais.qc.ca" },
  { id: "sub-c17", institution_name: "Collège Dawson", institution_type: "cegep", city: "Montréal", conference: "sud_ouest", tier_id: "tier-cegep-enterprise", billing_cycle: "yearly", status: "active", current_period_start: "2025-09-01", current_period_end: "2026-08-31", trial_ends_at: null, seats_used: 12, seats_max: -1, sports_active: ["Football", "Basketball", "Hockey", "Soccer", "Rugby", "Volleyball"], monthly_revenue: 500, created_at: "2025-07-15T14:00:00Z", cancelled_at: null, last_payment_at: "2025-09-01T00:00:00Z", contact_name: "David Chen", contact_email: "d.chen@dawsoncollege.qc.ca" },
  // CÉGEPs — Inactive (3)
  { id: "sub-c18", institution_name: "CÉGEP de Jonquière", institution_type: "cegep", city: "Jonquière", conference: "nord_est", tier_id: "tier-cegep-standard", billing_cycle: "monthly", status: "past_due", current_period_start: "2026-02-01", current_period_end: "2026-02-28", trial_ends_at: null, seats_used: 2, seats_max: 3, sports_active: ["Hockey", "Volleyball"], monthly_revenue: 0, created_at: "2025-10-15T10:00:00Z", cancelled_at: null, last_payment_at: "2026-02-01T00:00:00Z", contact_name: "Martin Lapointe", contact_email: "m.lapointe@cegep-jonquiere.qc.ca" },
  { id: "sub-c19", institution_name: "CÉGEP de Drummondville", institution_type: "cegep", city: "Drummondville", conference: "sud_ouest", tier_id: "tier-cegep-standard", billing_cycle: "monthly", status: "cancelled", current_period_start: "2026-01-01", current_period_end: "2026-01-31", trial_ends_at: null, seats_used: 0, seats_max: 3, sports_active: [], monthly_revenue: 0, created_at: "2025-09-01T09:00:00Z", cancelled_at: "2026-01-28T15:00:00Z", last_payment_at: "2026-01-01T00:00:00Z", contact_name: "Alain Côté", contact_email: "a.cote@cegepdrummond.qc.ca" },
  { id: "sub-c20", institution_name: "CÉGEP de Thetford", institution_type: "cegep", city: "Thetford Mines", conference: "nord_est", tier_id: "tier-cegep-standard", billing_cycle: "yearly", status: "expired", current_period_start: "2025-01-01", current_period_end: "2025-12-31", trial_ends_at: null, seats_used: 0, seats_max: 3, sports_active: [], monthly_revenue: 0, created_at: "2024-12-15T10:00:00Z", cancelled_at: null, last_payment_at: "2025-01-01T00:00:00Z", contact_name: "Diane Poulin", contact_email: "d.poulin@cegepmines.qc.ca" },
  // Écoles — Pro (6)
  { id: "sub-s01", institution_name: "De Mortagne", institution_type: "school", city: "Boucherville", conference: "sud_ouest", tier_id: "tier-school-pro", billing_cycle: "yearly", status: "active", current_period_start: "2025-09-01", current_period_end: "2026-08-31", trial_ends_at: null, seats_used: 3, seats_max: 3, sports_active: ["Football", "Basketball", "Soccer"], monthly_revenue: 65.83, created_at: "2025-08-15T10:00:00Z", cancelled_at: null, last_payment_at: "2025-09-01T00:00:00Z", contact_name: "Nathalie Gagnon", contact_email: "n.gagnon@demortagne.qc.ca" },
  { id: "sub-s02", institution_name: "Saint-Jean-Eudes", institution_type: "school", city: "Québec", conference: "nord_est", tier_id: "tier-school-pro", billing_cycle: "monthly", status: "active", current_period_start: "2026-03-01", current_period_end: "2026-03-31", trial_ends_at: null, seats_used: 3, seats_max: 3, sports_active: ["Football", "Hockey", "Basketball"], monthly_revenue: 79, created_at: "2025-09-01T09:00:00Z", cancelled_at: null, last_payment_at: "2026-03-01T00:00:00Z", contact_name: "Patrick Bergeron", contact_email: "p.bergeron@sje.qc.ca" },
  { id: "sub-s03", institution_name: "De Rochebelle", institution_type: "school", city: "Québec", conference: "nord_est", tier_id: "tier-school-pro", billing_cycle: "yearly", status: "active", current_period_start: "2025-09-01", current_period_end: "2026-08-31", trial_ends_at: null, seats_used: 2, seats_max: 3, sports_active: ["Football", "Volleyball"], monthly_revenue: 65.83, created_at: "2025-08-20T11:00:00Z", cancelled_at: null, last_payment_at: "2025-09-01T00:00:00Z", contact_name: "Marc-André Pelletier", contact_email: "ma.pelletier@rochebelle.qc.ca" },
  { id: "sub-s04", institution_name: "Mont-Royal", institution_type: "school", city: "Montréal", conference: "sud_ouest", tier_id: "tier-school-pro", billing_cycle: "monthly", status: "active", current_period_start: "2026-03-01", current_period_end: "2026-03-31", trial_ends_at: null, seats_used: 3, seats_max: 3, sports_active: ["Basketball", "Soccer", "Volleyball"], monthly_revenue: 79, created_at: "2025-10-01T14:00:00Z", cancelled_at: null, last_payment_at: "2026-03-01T00:00:00Z", contact_name: "Sophie Tremblay", contact_email: "s.tremblay@mont-royal.qc.ca" },
  { id: "sub-s05", institution_name: "Roger-Comtois", institution_type: "school", city: "Québec", conference: "nord_est", tier_id: "tier-school-pro", billing_cycle: "yearly", status: "active", current_period_start: "2025-10-01", current_period_end: "2026-09-30", trial_ends_at: null, seats_used: 2, seats_max: 3, sports_active: ["Football", "Hockey"], monthly_revenue: 65.83, created_at: "2025-09-15T10:00:00Z", cancelled_at: null, last_payment_at: "2025-10-01T00:00:00Z", contact_name: "Jean-François Roy", contact_email: "jf.roy@roger-comtois.qc.ca" },
  { id: "sub-s06", institution_name: "Louis-Riel", institution_type: "school", city: "Montréal", conference: "sud_ouest", tier_id: "tier-school-pro", billing_cycle: "monthly", status: "trial", current_period_start: "2026-03-01", current_period_end: "2026-03-31", trial_ends_at: "2026-03-22T00:00:00Z", seats_used: 2, seats_max: 3, sports_active: ["Basketball", "Soccer"], monthly_revenue: 0, created_at: "2026-03-01T09:00:00Z", cancelled_at: null, last_payment_at: null, contact_name: "Isabelle Côté", contact_email: "i.cote@louis-riel.qc.ca" },
  // Écoles — Essentiel (4)
  { id: "sub-s07", institution_name: "Armand-Corbeil", institution_type: "school", city: "Terrebonne", conference: "sud_ouest", tier_id: "tier-school-free", billing_cycle: "free", status: "active", current_period_start: "2025-11-01", current_period_end: "2099-12-31", trial_ends_at: null, seats_used: 1, seats_max: 1, sports_active: ["Football"], monthly_revenue: 0, created_at: "2025-11-01T10:00:00Z", cancelled_at: null, last_payment_at: null, contact_name: "Alexandre Fortin", contact_email: "a.fortin@armand-corbeil.qc.ca" },
  { id: "sub-s08", institution_name: "Pierre-Laporte", institution_type: "school", city: "Montréal", conference: "sud_ouest", tier_id: "tier-school-free", billing_cycle: "free", status: "active", current_period_start: "2025-12-01", current_period_end: "2099-12-31", trial_ends_at: null, seats_used: 1, seats_max: 1, sports_active: ["Natation"], monthly_revenue: 0, created_at: "2025-12-01T11:00:00Z", cancelled_at: null, last_payment_at: null, contact_name: "Mathieu Gagnon", contact_email: "m.gagnon@pierre-laporte.qc.ca" },
  { id: "sub-s09", institution_name: "Le Tremplin", institution_type: "school", city: "Gatineau", conference: "sud_ouest", tier_id: "tier-school-free", billing_cycle: "free", status: "active", current_period_start: "2026-01-15", current_period_end: "2099-12-31", trial_ends_at: null, seats_used: 1, seats_max: 1, sports_active: ["Rugby"], monthly_revenue: 0, created_at: "2026-01-15T09:00:00Z", cancelled_at: null, last_payment_at: null, contact_name: "Francis Leblanc", contact_email: "f.leblanc@letremplin.qc.ca" },
  { id: "sub-s10", institution_name: "Thérèse-Martin", institution_type: "school", city: "Joliette", conference: "sud_ouest", tier_id: "tier-school-free", billing_cycle: "free", status: "trial", current_period_start: "2026-03-10", current_period_end: "2026-04-10", trial_ends_at: "2026-03-24T00:00:00Z", seats_used: 1, seats_max: 1, sports_active: ["Hockey"], monthly_revenue: 0, created_at: "2026-03-10T10:00:00Z", cancelled_at: null, last_payment_at: null, contact_name: "Daniel Rioux", contact_email: "d.rioux@therese-martin.qc.ca" },
  // Écoles — Élite (3)
  { id: "sub-s11", institution_name: "Académie les Estacades", institution_type: "school", city: "Trois-Rivières", conference: "nord_est", tier_id: "tier-school-elite", billing_cycle: "yearly", status: "active", current_period_start: "2025-09-01", current_period_end: "2026-08-31", trial_ends_at: null, seats_used: 3, seats_max: -1, sports_active: ["Football", "Hockey", "Natation"], monthly_revenue: 124.17, created_at: "2025-08-10T10:00:00Z", cancelled_at: null, last_payment_at: "2025-09-01T00:00:00Z", contact_name: "Marie-Claude Lavoie", contact_email: "mc.lavoie@estacades.qc.ca" },
  { id: "sub-s12", institution_name: "Curé-Antoine-Labelle", institution_type: "school", city: "Laval", conference: "sud_ouest", tier_id: "tier-school-elite", billing_cycle: "monthly", status: "active", current_period_start: "2026-03-01", current_period_end: "2026-03-31", trial_ends_at: null, seats_used: 4, seats_max: -1, sports_active: ["Football", "Basketball", "Hockey"], monthly_revenue: 149, created_at: "2025-10-15T14:00:00Z", cancelled_at: null, last_payment_at: "2026-03-01T00:00:00Z", contact_name: "André Simard", contact_email: "a.simard@cal.qc.ca" },
  { id: "sub-s13", institution_name: "Le Sommet", institution_type: "school", city: "Sherbrooke", conference: "nord_est", tier_id: "tier-school-elite", billing_cycle: "yearly", status: "active", current_period_start: "2025-10-01", current_period_end: "2026-09-30", trial_ends_at: null, seats_used: 2, seats_max: -1, sports_active: ["Football", "Soccer"], monthly_revenue: 124.17, created_at: "2025-09-20T09:00:00Z", cancelled_at: null, last_payment_at: "2025-10-01T00:00:00Z", contact_name: "Pierre-Luc Bergeron", contact_email: "pl.bergeron@lesommet.qc.ca" },
  // Écoles — Inactive (2)
  { id: "sub-s14", institution_name: "Saint-Joseph", institution_type: "school", city: "Saint-Hyacinthe", conference: "sud_ouest", tier_id: "tier-school-pro", billing_cycle: "monthly", status: "cancelled", current_period_start: "2025-12-01", current_period_end: "2025-12-31", trial_ends_at: null, seats_used: 0, seats_max: 3, sports_active: [], monthly_revenue: 0, created_at: "2025-06-01T10:00:00Z", cancelled_at: "2025-12-20T14:00:00Z", last_payment_at: "2025-12-01T00:00:00Z", contact_name: "Josée Bélanger", contact_email: "j.belanger@saint-joseph.qc.ca" },
  { id: "sub-s15", institution_name: "L'Odyssée", institution_type: "school", city: "Chicoutimi", conference: "nord_est", tier_id: "tier-school-pro", billing_cycle: "yearly", status: "expired", current_period_start: "2025-01-01", current_period_end: "2025-12-31", trial_ends_at: null, seats_used: 0, seats_max: 3, sports_active: [], monthly_revenue: 0, created_at: "2024-12-01T11:00:00Z", cancelled_at: null, last_payment_at: "2025-01-01T00:00:00Z", contact_name: "Marc Gaudreault", contact_email: "m.gaudreault@odyssee.qc.ca" },
];

// ── Revenue Stats ────────────────────────────────────────────

export interface RevenueStats {
  mrr: number;
  arr: number;
  mrr_cegep: number;
  mrr_school: number;
  mrr_athlete: number;
  total_subscribers: number;
  active_cegeps: number;
  active_schools: number;
  active_athletes: number;
  trial_count: number;
  churn_rate: number;
  avg_revenue_per_institution: number;
  monthly_revenue_trend: { month: string; cegep_revenue: number; school_revenue: number; athlete_revenue: number }[];
}

export const REVENUE_STATS: RevenueStats = {
  mrr: 4470,
  arr: 53640,
  mrr_cegep: 3245,
  mrr_school: 1225,
  mrr_athlete: 0,
  total_subscribers: 35,
  active_cegeps: 17,
  active_schools: 13,
  active_athletes: 0,
  trial_count: 5,
  churn_rate: 4.8,
  avg_revenue_per_institution: 149,
  monthly_revenue_trend: [
    { month: "Oct 2025", cegep_revenue: 2100, school_revenue: 640, athlete_revenue: 0 },
    { month: "Nov 2025", cegep_revenue: 2450, school_revenue: 790, athlete_revenue: 0 },
    { month: "Déc 2025", cegep_revenue: 2680, school_revenue: 870, athlete_revenue: 0 },
    { month: "Jan 2026", cegep_revenue: 2890, school_revenue: 980, athlete_revenue: 0 },
    { month: "Fév 2026", cegep_revenue: 3100, school_revenue: 1100, athlete_revenue: 0 },
    { month: "Mar 2026", cegep_revenue: 3245, school_revenue: 1225, athlete_revenue: 0 },
  ],
};

/* ═══════════════════════════════════════════════════════════════
   DIRECTOR OWNERSHIP — Ownership hierarchy system
   Each school/CÉGEP has ONE owner + zero or more collaborators
═══════════════════════════════════════════════════════════════ */


/* ── Ownership Transfer Requests ─────────────────────────────── */

export interface OwnershipTransferRequest {
  id: string;
  school_id: string;
  school_name: string;
  school_type: "secondaire" | "cegep";
  current_owner_id: string;
  current_owner_name: string;
  requested_new_owner_id: string;
  requested_new_owner_name: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_at: string;
  requested_by: "owner" | "admin";
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export const OWNERSHIP_TRANSFER_REQUESTS: OwnershipTransferRequest[] = [
  {
    id: "ot-001",
    school_id: "s-001", school_name: "De Mortagne", school_type: "secondaire",
    current_owner_id: "u-033", current_owner_name: "Marie-Ève Lapointe",
    requested_new_owner_id: "u-035", requested_new_owner_name: "Luc Tremblay",
    reason: "Je quitte l'école en juin 2026. Luc Tremblay me remplace comme coordonnateur sportif.",
    status: "pending", requested_at: "2026-03-10T09:00:00Z", requested_by: "owner",
    reviewed_at: null, reviewed_by: null,
  },
  {
    id: "ot-002",
    school_id: "c-001", school_name: "CÉGEP Garneau", school_type: "cegep",
    current_owner_id: "u-031", current_owner_name: "François Simard",
    requested_new_owner_id: "u-036", requested_new_owner_name: "Sylvie Côté",
    reason: "Rotation annuelle de la direction sportive. Sylvie prend le relais pour 2026-2027.",
    status: "approved", requested_at: "2026-02-01T10:00:00Z", requested_by: "owner",
    reviewed_at: "2026-02-03T14:00:00Z", reviewed_by: "u-001",
  },
  {
    id: "ot-003",
    school_id: "s-002", school_name: "Saint-Jean-Eudes", school_type: "secondaire",
    current_owner_id: "u-034", current_owner_name: "Patrick Bergeron",
    requested_new_owner_id: "", requested_new_owner_name: "(à déterminer)",
    reason: "Directeur actuel inactif depuis 47 jours. Aucun collaborateur disponible.",
    status: "pending", requested_at: "2026-03-15T08:00:00Z", requested_by: "admin",
    reviewed_at: null, reviewed_by: null,
  },
];

/* ── Director Join Requests ──────────────────────────────────── */

export interface DirectorJoinRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  school_id: string;
  school_name: string;
  school_type: "secondaire" | "cegep";
  current_owner_name: string | null;
  status: "pending_owner" | "pending_admin" | "approved" | "rejected";
  requested_at: string;
  message: string;
}

export const DIRECTOR_JOIN_REQUESTS: DirectorJoinRequest[] = [
  {
    id: "dj-001",
    user_id: "u-new-01", user_name: "Jean Tremblay", user_email: "j.tremblay@sje.qc.ca",
    school_id: "s-002", school_name: "Saint-Jean-Eudes", school_type: "secondaire",
    current_owner_name: "Patrick Bergeron",
    status: "pending_admin",
    requested_at: "2026-03-14T10:00:00Z",
    message: "Je suis le nouveau coordonnateur sportif depuis janvier 2026, remplaçant M. Bergeron qui est en congé.",
  },
  {
    id: "dj-002",
    user_id: "u-new-02", user_name: "Catherine Morin", user_email: "c.morin@roger-comtois.qc.ca",
    school_id: "s-004", school_name: "Roger-Comtois", school_type: "secondaire",
    current_owner_name: null,
    status: "pending_admin",
    requested_at: "2026-03-12T14:00:00Z",
    message: "Aucun directeur n'est assigné à notre école. Je suis la responsable du programme sport-études.",
  },
];

// ── Leagues (Civil Leagues) ─────────────────────────────────

export interface AdminLeagueRow {
  id: string;
  name: string;
  sport: string;
  city: string;
  region: string;
  level: "AAA" | "AA" | "A" | "Club" | "Civil";
  website: string | null;
  coordinator_name: string | null;
  coordinator_id: string | null;
  teams_count: number;
  coaches_count: number;
  athletes_count: number;
  is_active: boolean;
  status: "ACTIF" | "EN_ATTENTE_CONTRAT" | "INACTIF" | "DESACTIVE";
  contract: Loi25Contract | null;
  onboarding_completed: boolean;
  audit_log: Loi25AuditEntry[];
  created_at: string;
}

export const ADMIN_LEAGUES: AdminLeagueRow[] = [
  {
    id: "lg-001", name: "Wildcats Lanaudière", sport: "Football", city: "Repentigny", region: "Lanaudière", level: "AAA",
    website: "wildcatslanaudiere.ca", coordinator_name: "Patrick Roy", coordinator_id: "u-lc-001",
    teams_count: 4, coaches_count: 6, athletes_count: 88, is_active: true, status: "ACTIF", onboarding_completed: true, created_at: "2025-05-01T10:00:00Z",
    contract: { id: "loi-lg01", institution_id: "lg-001", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Patrick Roy", rprp_courriel: "p.roy@wildcats.ca", sent_at: "2025-05-01T10:00:00Z", accepted_at: "2025-05-03T14:00:00Z", accepted_by: "u-lc-001", expires_at: "2026-05-03T14:00:00Z", pdf_url: "/contracts/loi25-lg001.pdf" },
    audit_log: [{ date: "2025-05-01T10:00:00Z", action: "Ligue créée par l'administrateur" }, { date: "2025-05-03T14:00:00Z", action: "Contrat accepté par Patrick Roy" }],
  },
  {
    id: "lg-002", name: "Élite Baseball Québec", sport: "Baseball", city: "Québec", region: "Capitale-Nationale", level: "AAA",
    website: "elitebaseballqc.ca", coordinator_name: null, coordinator_id: null,
    teams_count: 3, coaches_count: 4, athletes_count: 54, is_active: true, status: "ACTIF", onboarding_completed: true, created_at: "2025-06-15T10:00:00Z",
    contract: { id: "loi-lg02", institution_id: "lg-002", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Jean Simard", rprp_courriel: "j.simard@elitebaseball.ca", sent_at: "2025-06-15T10:00:00Z", accepted_at: "2025-06-18T11:00:00Z", accepted_by: "admin", expires_at: "2026-06-18T11:00:00Z", pdf_url: "/contracts/loi25-lg002.pdf" },
    audit_log: [{ date: "2025-06-15T10:00:00Z", action: "Ligue créée par l'administrateur" }, { date: "2025-06-18T11:00:00Z", action: "Contrat accepté (contrat papier)" }],
  },
  {
    id: "lg-003", name: "Remparts Hockey AAA", sport: "Hockey", city: "Québec", region: "Capitale-Nationale", level: "AAA",
    website: "rempartsaaa.ca", coordinator_name: "Marie-Ève Tremblay", coordinator_id: "u-lc-002",
    teams_count: 5, coaches_count: 8, athletes_count: 110, is_active: true, status: "ACTIF", onboarding_completed: true, created_at: "2025-04-10T10:00:00Z",
    contract: { id: "loi-lg03", institution_id: "lg-003", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Marie-Ève Tremblay", rprp_courriel: "me.tremblay@rempartsaaa.ca", sent_at: "2025-04-10T10:00:00Z", accepted_at: "2025-04-12T09:00:00Z", accepted_by: "u-lc-002", expires_at: "2026-04-12T09:00:00Z", pdf_url: "/contracts/loi25-lg003.pdf" },
    audit_log: [{ date: "2025-04-10T10:00:00Z", action: "Ligue créée par l'administrateur" }, { date: "2025-04-12T09:00:00Z", action: "Contrat accepté par Marie-Ève Tremblay" }],
  },
  {
    id: "lg-004", name: "Club Basketball Brookwood", sport: "Basketball", city: "Montréal", region: "Montréal", level: "AA",
    website: null, coordinator_name: "James Wilson", coordinator_id: "u-lc-003",
    teams_count: 6, coaches_count: 6, athletes_count: 72, is_active: true, status: "ACTIF", onboarding_completed: true, created_at: "2025-07-01T10:00:00Z",
    contract: { id: "loi-lg04", institution_id: "lg-004", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "James Wilson", rprp_courriel: "j.wilson@brookwood.ca", sent_at: "2025-07-01T10:00:00Z", accepted_at: "2025-07-04T10:00:00Z", accepted_by: "u-lc-003", expires_at: "2026-07-04T10:00:00Z", pdf_url: "/contracts/loi25-lg004.pdf" },
    audit_log: [{ date: "2025-07-01T10:00:00Z", action: "Ligue créée par l'administrateur" }, { date: "2025-07-04T10:00:00Z", action: "Contrat accepté par James Wilson" }],
  },
  {
    id: "lg-005", name: "Storm Volleyball Québec", sport: "Volleyball", city: "Lévis", region: "Chaudière-Appalaches", level: "AA",
    website: "stormvb.ca", coordinator_name: "Sylvie Morin", coordinator_id: "u-lc-004",
    teams_count: 4, coaches_count: 4, athletes_count: 48, is_active: true, status: "ACTIF", onboarding_completed: true, created_at: "2025-08-01T10:00:00Z",
    contract: { id: "loi-lg05", institution_id: "lg-005", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Sylvie Morin", rprp_courriel: "s.morin@stormvb.ca", sent_at: "2025-08-01T10:00:00Z", accepted_at: "2025-08-04T14:00:00Z", accepted_by: "u-lc-004", expires_at: "2026-08-04T14:00:00Z", pdf_url: "/contracts/loi25-lg005.pdf" },
    audit_log: [{ date: "2025-08-01T10:00:00Z", action: "Ligue créée par l'administrateur" }, { date: "2025-08-04T14:00:00Z", action: "Contrat accepté par Sylvie Morin" }],
  },
  {
    id: "lg-006", name: "RSL Québec Academy", sport: "Soccer", city: "Québec", region: "Capitale-Nationale", level: "AAA",
    website: "rslquebec.ca", coordinator_name: "Diego Martinez", coordinator_id: "u-lc-005",
    teams_count: 8, coaches_count: 10, athletes_count: 160, is_active: true, status: "ACTIF", onboarding_completed: true, created_at: "2025-03-01T10:00:00Z",
    contract: { id: "loi-lg06", institution_id: "lg-006", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Diego Martinez", rprp_courriel: "d.martinez@rslquebec.ca", sent_at: "2025-03-01T10:00:00Z", accepted_at: "2025-03-04T10:00:00Z", accepted_by: "u-lc-005", expires_at: "2026-03-04T10:00:00Z", pdf_url: "/contracts/loi25-lg006.pdf" },
    audit_log: [{ date: "2025-03-01T10:00:00Z", action: "Ligue créée par l'administrateur" }, { date: "2025-03-04T10:00:00Z", action: "Contrat accepté par Diego Martinez" }],
  },
  {
    id: "lg-007", name: "Titans Rugby Montréal", sport: "Rugby", city: "Montréal", region: "Montréal", level: "Club",
    website: null, coordinator_name: null, coordinator_id: null,
    teams_count: 3, coaches_count: 3, athletes_count: 45, is_active: true, status: "ACTIF", onboarding_completed: true, created_at: "2025-09-01T10:00:00Z",
    contract: { id: "loi-lg07", institution_id: "lg-007", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "Marc Leblanc", rprp_courriel: "m.leblanc@titansrugby.ca", sent_at: "2025-09-01T10:00:00Z", accepted_at: "2025-09-05T11:00:00Z", accepted_by: "admin", expires_at: "2026-09-05T11:00:00Z", pdf_url: "/contracts/loi25-lg007.pdf" },
    audit_log: [{ date: "2025-09-01T10:00:00Z", action: "Ligue créée par l'administrateur" }, { date: "2025-09-05T11:00:00Z", action: "Contrat accepté (contrat papier)" }],
  },
  {
    id: "lg-008", name: "FC Gatineau Élite", sport: "Soccer", city: "Gatineau", region: "Outaouais", level: "AA",
    website: "fcgatineau.ca", coordinator_name: "François Leblanc", coordinator_id: "u-lc-006",
    teams_count: 4, coaches_count: 5, athletes_count: 64, is_active: true, status: "ACTIF", onboarding_completed: true, created_at: "2025-07-15T10:00:00Z",
    contract: { id: "loi-lg08", institution_id: "lg-008", institution_type: "ECOLE_SECONDAIRE", contract_version: "1.0", status: "ACCEPTE", rprp_nom: "François Leblanc", rprp_courriel: "f.leblanc@fcgatineau.ca", sent_at: "2025-07-15T10:00:00Z", accepted_at: "2025-07-18T10:00:00Z", accepted_by: "u-lc-006", expires_at: "2026-07-18T10:00:00Z", pdf_url: "/contracts/loi25-lg008.pdf" },
    audit_log: [{ date: "2025-07-15T10:00:00Z", action: "Ligue créée par l'administrateur" }, { date: "2025-07-18T10:00:00Z", action: "Contrat accepté par François Leblanc" }],
  },
];

