/* ═══════════════════════════════════════════════════════════════
   Mock data — Ambassador program
═══════════════════════════════════════════════════════════════ */

export interface Ambassador {
  id: string;
  user_id: string;
  name: string;
  type: "coach" | "recruteur";
  referral_code: string;
  status: "active" | "elite" | "inactive";
  region: string;
  institution: string;
  total_referrals: number;
  active_referrals: number;
  paying_referrals: number;
  total_commission: number;
  commission_paid: number;
  free_months_earned: number;
  free_months_used: number;
  created_at: string;
}

export interface Referral {
  id: string;
  ambassador_id: string;
  referred_name: string;
  signed_up_at: string;
  status: "inscrit" | "actif" | "payant" | "inactif";
  profiles_created: number;
  subscription_tier: string;
  commission_per_month: number;
}

export interface AmbassadorApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "coach" | "recruteur";
  institution: string;
  region: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
}

/* ── Ambassadors ──────────────────────────────────────────── */

export const MOCK_AMBASSADORS: Ambassador[] = [
  {
    id: "amb-001", user_id: "u-amb-001", name: "Patrick Martin", type: "coach",
    referral_code: "COACH-MARTIN-MTL", status: "elite", region: "Montréal",
    institution: "É.S. Saint-Jean-Eudes", total_referrals: 22, active_referrals: 18,
    paying_referrals: 5, total_commission: 232, commission_paid: 180,
    free_months_earned: 22, free_months_used: 12, created_at: "2025-03-15",
  },
  {
    id: "amb-002", user_id: "u-amb-002", name: "Sophie Tremblay", type: "recruteur",
    referral_code: "REC-TREMBLAY-QC", status: "active", region: "Québec",
    institution: "CÉGEP Garneau", total_referrals: 12, active_referrals: 10,
    paying_referrals: 3, total_commission: 112, commission_paid: 85,
    free_months_earned: 12, free_months_used: 6, created_at: "2025-05-20",
  },
  {
    id: "amb-003", user_id: "u-amb-003", name: "Jean Bergeron", type: "coach",
    referral_code: "COACH-BERGERON-MO", status: "active", region: "Montérégie",
    institution: "É.S. De Mortagne", total_referrals: 15, active_referrals: 12,
    paying_referrals: 3, total_commission: 58.05, commission_paid: 42,
    free_months_earned: 8, free_months_used: 3, created_at: "2025-06-10",
  },
  {
    id: "amb-004", user_id: "u-amb-004", name: "Marie Lapointe", type: "coach",
    referral_code: "COACH-LAPOINTE-ES", status: "active", region: "Estrie",
    institution: "É.S. Le Tremplin", total_referrals: 8, active_referrals: 5,
    paying_referrals: 1, total_commission: 19.35, commission_paid: 0,
    free_months_earned: 5, free_months_used: 4, created_at: "2025-08-01",
  },
  {
    id: "amb-005", user_id: "u-amb-005", name: "Alexis Dufour", type: "recruteur",
    referral_code: "REC-DUFOUR-LAV", status: "active", region: "Laval",
    institution: "CÉGEP Bois-de-Boulogne", total_referrals: 4, active_referrals: 2,
    paying_referrals: 0, total_commission: 0, commission_paid: 0,
    free_months_earned: 2, free_months_used: 2, created_at: "2025-10-15",
  },
  {
    id: "amb-006", user_id: "u-amb-006", name: "François Simard", type: "coach",
    referral_code: "COACH-SIMARD-SAG", status: "inactive", region: "Saguenay",
    institution: "É.S. L'Odyssée", total_referrals: 0, active_referrals: 0,
    paying_referrals: 0, total_commission: 0, commission_paid: 0,
    free_months_earned: 0, free_months_used: 0, created_at: "2025-11-01",
  },
];

/* ── Referrals (for amb-003 Jean Bergeron — used in coach dashboard) ── */

export const MOCK_REFERRALS: Referral[] = [
  { id: "ref-001", ambassador_id: "amb-003", referred_name: "J*** Bergeron", signed_up_at: "2026-03-08", status: "actif", profiles_created: 12, subscription_tier: "Coach Pro", commission_per_month: 2.25 },
  { id: "ref-002", ambassador_id: "amb-003", referred_name: "M*** Lapointe", signed_up_at: "2026-02-20", status: "actif", profiles_created: 8, subscription_tier: "Gratuit", commission_per_month: 0 },
  { id: "ref-003", ambassador_id: "amb-003", referred_name: "S*** Dufour", signed_up_at: "2026-02-10", status: "payant", profiles_created: 15, subscription_tier: "Coach Pro", commission_per_month: 2.25 },
  { id: "ref-004", ambassador_id: "amb-003", referred_name: "P*** Roy", signed_up_at: "2026-03-15", status: "inscrit", profiles_created: 0, subscription_tier: "Gratuit", commission_per_month: 0 },
  { id: "ref-005", ambassador_id: "amb-003", referred_name: "A*** Gagnon", signed_up_at: "2026-01-28", status: "actif", profiles_created: 6, subscription_tier: "Gratuit", commission_per_month: 0 },
  { id: "ref-006", ambassador_id: "amb-003", referred_name: "L*** Simard", signed_up_at: "2025-12-15", status: "inactif", profiles_created: 3, subscription_tier: "Gratuit", commission_per_month: 0 },
  { id: "ref-007", ambassador_id: "amb-003", referred_name: "N*** Côté", signed_up_at: "2026-01-05", status: "actif", profiles_created: 10, subscription_tier: "Gratuit", commission_per_month: 0 },
  { id: "ref-008", ambassador_id: "amb-003", referred_name: "T*** Martin", signed_up_at: "2025-11-20", status: "payant", profiles_created: 11, subscription_tier: "Coach Pro", commission_per_month: 2.25 },
];

/* ── Ambassador Applications ──────────────────────────────── */

export const MOCK_APPLICATIONS: AmbassadorApplication[] = [
  {
    id: "app-001", name: "Patrick Tremblay", email: "p.tremblay@ecole.qc.ca",
    phone: "514-555-1234", role: "coach", institution: "É.S. Louis-Riel",
    region: "Montérégie",
    message: "Je connais personnellement 15 coachs dans la région de la Montérégie. Je suis impliqué dans le RSEQ depuis 8 ans et j'ai un bon réseau dans le football et le basketball scolaire.",
    status: "pending", submitted_at: "2026-03-20",
  },
  {
    id: "app-002", name: "Isabelle Gagnon", email: "i.gagnon@cegep-ste-foy.qc.ca",
    phone: "418-555-5678", role: "recruteur", institution: "CÉGEP de Sainte-Foy",
    region: "Québec",
    message: "En tant que recruteuse pour le volleyball et le basketball au CÉGEP, je côtoie régulièrement 8 recruteurs d'autres programmes. Je pourrais facilement en recruter 5+.",
    status: "pending", submitted_at: "2026-03-18",
  },
  {
    id: "app-003", name: "Marc-André Bouchard", email: "ma.bouchard@ecole.qc.ca",
    phone: "819-555-9012", role: "coach", institution: "É.S. Thérèse-Martin",
    region: "Laurentides",
    message: "Coach football depuis 12 ans. Je suis sur les comités RSEQ Laurentides et Lanaudière. Mon réseau couvre facilement 20+ coachs multi-sport.",
    status: "pending", submitted_at: "2026-03-15",
  },
];

/* ── Regional Coverage ────────────────────────────────────── */

export interface RegionCoverage {
  region: string;
  ambassador_coach: string | null;
  ambassador_recruteur: string | null;
  schools_count: number;
  status: "active" | "searching" | "phase2" | "phase3";
}

export const MOCK_REGION_COVERAGE: RegionCoverage[] = [
  { region: "Montréal", ambassador_coach: "Patrick Martin", ambassador_recruteur: null, schools_count: 42, status: "active" },
  { region: "Québec", ambassador_coach: null, ambassador_recruteur: "Sophie Tremblay", schools_count: 28, status: "active" },
  { region: "Montérégie", ambassador_coach: "Jean Bergeron", ambassador_recruteur: null, schools_count: 35, status: "searching" },
  { region: "Laval", ambassador_coach: null, ambassador_recruteur: "Alexis Dufour", schools_count: 14, status: "searching" },
  { region: "Laurentides", ambassador_coach: null, ambassador_recruteur: null, schools_count: 18, status: "searching" },
  { region: "Estrie", ambassador_coach: "Marie Lapointe", ambassador_recruteur: null, schools_count: 15, status: "searching" },
  { region: "Saguenay–Lac-Saint-Jean", ambassador_coach: "François Simard", ambassador_recruteur: null, schools_count: 12, status: "phase2" },
  { region: "Mauricie", ambassador_coach: null, ambassador_recruteur: null, schools_count: 10, status: "phase2" },
  { region: "Outaouais", ambassador_coach: null, ambassador_recruteur: null, schools_count: 11, status: "phase2" },
  { region: "Lanaudière", ambassador_coach: null, ambassador_recruteur: null, schools_count: 13, status: "phase2" },
  { region: "Centre-du-Québec", ambassador_coach: null, ambassador_recruteur: null, schools_count: 8, status: "phase3" },
  { region: "Chaudière-Appalaches", ambassador_coach: null, ambassador_recruteur: null, schools_count: 12, status: "phase3" },
  { region: "Bas-Saint-Laurent", ambassador_coach: null, ambassador_recruteur: null, schools_count: 7, status: "phase3" },
  { region: "Abitibi-Témiscamingue", ambassador_coach: null, ambassador_recruteur: null, schools_count: 5, status: "phase3" },
  { region: "Côte-Nord", ambassador_coach: null, ambassador_recruteur: null, schools_count: 4, status: "phase3" },
  { region: "Gaspésie–Îles-de-la-Madeleine", ambassador_coach: null, ambassador_recruteur: null, schools_count: 3, status: "phase3" },
  { region: "Nord-du-Québec", ambassador_coach: null, ambassador_recruteur: null, schools_count: 2, status: "phase3" },
];

/* ── Ambassador KPIs (current user: amb-003) ──────────────── */

export const MOCK_AMBASSADOR_SELF = MOCK_AMBASSADORS[2]; // Jean Bergeron

export const MOCK_LEADERBOARD = [
  { rank: 1, name: "Coach Martin", referrals: 22, status: "elite" as const },
  { rank: 2, name: "Toi", referrals: 15, status: "active" as const },
  { rank: 3, name: "Coach Lavoie", referrals: 8, status: "active" as const },
];

/* ── Admin KPIs ───────────────────────────────────────────── */

export const ADMIN_AMBASSADOR_KPIS = {
  active_ambassadors: 5,
  elite_ambassadors: 1,
  total_referrals: 61,
  revenue_from_referrals: 4215,
};
