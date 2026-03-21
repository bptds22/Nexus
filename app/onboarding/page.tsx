"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import PlaybookBackground from "../components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Nexus — Onboarding Wizard
   Multi-step, role-adaptive. All data → localStorage.
───────────────────────────────────────────────────────────────── */

const label = "text-[10px] font-bold tracking-[0.25em] uppercase";
const inputClass =
  "w-full h-11 px-4 bg-[#111317] border border-white/10 rounded-lg text-white font-sans text-sm placeholder:text-[#6B7280] focus:border-[#E63946] focus:outline-none transition-colors";

/* ── Shared data ── */
const SPORTS = [
  "Football", "Basketball", "Soccer", "Hockey", "Volleyball",
  "Athlétisme", "Flag football", "Rugby", "Cheerleading",
  "Natation", "Badminton", "Cross-country", "Futsal",
  "Baseball", "Ultimate frisbee", "Golf", "Tennis",
  "Ski alpin", "Ski de fond", "Judo", "Handball", "Water-polo",
];
const REGIONS = ["Montréal", "Québec", "Saguenay-Lac-Saint-Jean", "Estrie", "Outaouais", "Mauricie", "Laurentides", "Lanaudière", "Montérégie", "Chaudière-Appalaches", "Laval", "Centre-du-Québec", "Bas-Saint-Laurent", "Abitibi-Témiscamingue", "Côte-Nord", "Nord-du-Québec", "Gaspésie"];
const MOCK_SCHOOLS = [
  { name: "De Mortagne", city: "Boucherville", region: "Montérégie", conference: "Sud-Ouest", sports: ["Football", "Basketball", "Soccer"] },
  { name: "Saint-Jean-Eudes", city: "Québec", region: "Québec", conference: "Nord-Est", sports: ["Football", "Hockey", "Soccer"] },
  { name: "De Rochebelle", city: "Québec", region: "Québec", conference: "Nord-Est", sports: ["Football", "Basketball", "Volleyball"] },
  { name: "Roger-Comtois", city: "Québec", region: "Québec", conference: "Nord-Est", sports: ["Football", "Basketball"] },
  { name: "Mont-Royal", city: "Montréal", region: "Montréal", conference: "Sud-Ouest", sports: ["Football", "Soccer", "Basketball"] },
  { name: "Académie les Estacades", city: "Trois-Rivières", region: "Mauricie", conference: "Nord-Est", sports: ["Football", "Hockey"] },
  { name: "Armand-Corbeil", city: "Terrebonne", region: "Lanaudière", conference: "Sud-Ouest", sports: ["Football", "Soccer"] },
  { name: "L’Odyssée", city: "Chicoutimi", region: "Saguenay-Lac-Saint-Jean", conference: "Nord-Est", sports: ["Football", "Volleyball"] },
  { name: "Le Sommet", city: "Québec", region: "Québec", conference: "Nord-Est", sports: ["Basketball", "Volleyball"] },
  { name: "Louis-Riel", city: "Montréal", region: "Montréal", conference: "Sud-Ouest", sports: ["Football", "Soccer", "Basketball"] },
  { name: "Curé-Antoine-Labelle", city: "Laval", region: "Laval", conference: "Sud-Ouest", sports: ["Football", "Soccer"] },
  { name: "Saint-Joseph", city: "Saint-Hyacinthe", region: "Montérégie", conference: "Sud-Ouest", sports: ["Football", "Basketball"] },
  { name: "Thérèse-Martin", city: "Joliette", region: "Lanaudière", conference: "Sud-Ouest", sports: ["Football", "Hockey"] },
  { name: "Le Tremplin", city: "Drummondville", region: "Centre-du-Québec", conference: "Nord-Est", sports: ["Hockey", "Volleyball"] },
  { name: "Pierre-Laporte", city: "Montréal", region: "Montréal", conference: "Sud-Ouest", sports: ["Football", "Basketball", "Natation"] },
];
const MOCK_CEGEPS = [
  { name: "Garneau", city: "Québec", region: "Québec", conference: "Nord-Est", type: "Public", programs: ["Sciences nature", "Sciences humaines", "Informatique"], sports: [{ sport: "Football", division: "D1", gender: "Masculin" }, { sport: "Basketball", division: "D2", gender: "Les deux" }] },
  { name: "Sainte-Foy", city: "Québec", region: "Québec", conference: "Nord-Est", type: "Public", programs: ["Sciences nature", "Administration"], sports: [{ sport: "Football", division: "D1", gender: "Masculin" }] },
  { name: "Limoilou", city: "Québec", region: "Québec", conference: "Nord-Est", type: "Public", programs: ["Arts", "Sciences humaines"], sports: [{ sport: "Soccer", division: "D2", gender: "Les deux" }] },
  { name: "Vieux-Montréal", city: "Montréal", region: "Montréal", conference: "Sud-Ouest", type: "Public", programs: ["Sciences nature", "Techniques"], sports: [{ sport: "Football", division: "D1", gender: "Masculin" }] },
  { name: "André-Laurendeau", city: "Montréal", region: "Montréal", conference: "Sud-Ouest", type: "Public", programs: ["Sciences humaines", "Informatique"], sports: [{ sport: "Football", division: "D2", gender: "Masculin" }] },
  { name: "Édouard-Montpetit", city: "Longueuil", region: "Montérégie", conference: "Sud-Ouest", type: "Public", programs: ["Sciences nature", "Administration"], sports: [{ sport: "Football", division: "D1", gender: "Masculin" }, { sport: "Hockey", division: "D1", gender: "Masculin" }] },
  { name: "Sherbrooke", city: "Sherbrooke", region: "Estrie", conference: "Nord-Est", type: "Public", programs: ["Sciences nature", "Sciences humaines", "Arts"], sports: [{ sport: "Football", division: "D2", gender: "Masculin" }] },
  { name: "Jonquière", city: "Saguenay", region: "Saguenay-Lac-Saint-Jean", conference: "Nord-Est", type: "Public", programs: ["Sciences humaines", "Techniques"], sports: [{ sport: "Football", division: "D3", gender: "Masculin" }] },
  { name: "Lévis", city: "Lévis", region: "Chaudière-Appalaches", conference: "Nord-Est", type: "Public", programs: ["Sciences nature", "Administration"], sports: [{ sport: "Football", division: "D2", gender: "Masculin" }] },
  { name: "Saint-Laurent", city: "Montréal", region: "Montréal", conference: "Sud-Ouest", type: "Public", programs: ["Sciences humaines", "Arts"], sports: [{ sport: "Soccer", division: "D1", gender: "Les deux" }] },
  { name: "Bois-de-Boulogne", city: "Montréal", region: "Montréal", conference: "Sud-Ouest", type: "Public", programs: ["Sciences nature", "Informatique"], sports: [{ sport: "Basketball", division: "D1", gender: "Les deux" }] },
  { name: "Champlain-Lennoxville", city: "Sherbrooke", region: "Estrie", conference: "Nord-Est", type: "Public", programs: ["Sciences nature", "Sciences humaines"], sports: [{ sport: "Football", division: "D3", gender: "Masculin" }] },
];
const FOOTBALL_POSITIONS = ["QB", "RB", "WR", "TE", "OL", "DL", "LB", "CB", "S", "K/P"];
const GRAD_YEARS = [2025, 2026, 2027, 2028, 2029];

/* ── Types ── */
interface NexusUser {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  onboarding_complete: boolean;
  institution: Record<string, unknown> | null;
  profile: Record<string, unknown>;
  search_criteria: Record<string, unknown> | null;
  team_needs: Record<string, unknown> | null;
  first_athlete: Record<string, unknown> | null;
}

/* ═══════════════════════════════════════════════════════════════
   STEP INDICATOR
═══════════════════════════════════════════════════════════════ */
function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((stepLabel, i) => {
        const completed = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center">
            {i > 0 && (
              <div className={`w-12 sm:w-20 h-0.5 ${completed ? "bg-[#22C55E]" : "bg-[#6B7280]/30"}`} />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-colors ${
                completed ? "bg-[#22C55E] text-white" : active ? "bg-[#E63946] text-white" : "border-2 border-[#6B7280] text-[#6B7280]"
              }`}>
                {completed ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`hidden sm:block text-[9px] font-bold uppercase tracking-wider ${active ? "text-white" : "text-[#6B7280]"}`}>
                {stepLabel}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SEARCHABLE DROPDOWN
═══════════════════════════════════════════════════════════════ */
function SearchableDropdown<T extends { name: string }>({
  items,
  value,
  onChange,
  placeholder,
  renderItem,
}: {
  items: T[];
  value: string;
  onChange: (item: T | null) => void;
  placeholder: string;
  renderItem?: (item: T) => React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="relative">
      <div className="relative">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input
          type="text"
          placeholder={placeholder}
          value={value || query}
          onChange={(e) => { setQuery(e.target.value); onChange(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className={`${inputClass} pl-10`}
        />
      </div>
      {open && query.length > 0 && filtered.length > 0 && (
        <div className="absolute z-20 w-full mt-1 bg-[#1A1D24] border border-white/10 rounded-lg max-h-60 overflow-y-auto shadow-xl animate-fade-slide-down">
          {filtered.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => { onChange(item); setQuery(""); setOpen(false); }}
              className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
            >
              {renderItem ? renderItem(item) : item.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PILL TOGGLE
═══════════════════════════════════════════════════════════════ */
function PillToggle({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const isOn = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              isOn ? "bg-[rgba(230,57,70,0.1)] border border-[#E63946] text-white" : "bg-[#1A1D24] border border-white/10 text-[#9CA3AF] hover:border-white/20"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN WIZARD
═══════════════════════════════════════════════════════════════ */
export default function OnboardingPage() {
  const router = useRouter();
  const [user, setUser] = useState<NexusUser | null>(null);
  const [step, setStep] = useState(0);
  const [slideDir, setSlideDir] = useState<"right" | "left">("right");
  const [showSuccess, setShowSuccess] = useState(false);

  /* ── Load user from localStorage ── */
  useEffect(() => {
    const raw = localStorage.getItem("nexus_user");
    if (!raw) { router.replace("/auth"); return; }
    const parsed = JSON.parse(raw) as NexusUser;
    if (parsed.onboarding_complete) {
      const dashMap: Record<string, string> = {
        coach: "/coach/tableau-de-bord",
        director_school: "/directeur-ecole/dashboard",
        director_cegep: "/directeur-cegep/dashboard",
        recruiter: "/recruteur/tableau-de-bord",
        coach_league: "/coach/tableau-de-bord",
        coordinator_league: "/directeur-ecole/dashboard",
      };
      router.replace(dashMap[parsed.role] || "/");
      return;
    }
    setUser(parsed);
  }, [router]);

  /* ── Save to localStorage (no state update to avoid re-render loops) ── */
  const save = useCallback((updates: Partial<NexusUser>) => {
    const raw = localStorage.getItem("nexus_user");
    if (!raw) return;
    const current = JSON.parse(raw) as NexusUser;
    const next = { ...current, ...updates };
    localStorage.setItem("nexus_user", JSON.stringify(next));
  }, []);

  const totalSteps = 3;
  const progress = ((step + 1) / totalSteps) * 100;

  const next = () => {
    if (step < totalSteps - 1) {
      setSlideDir("right");
      setStep((s) => s + 1);
    }
  };
  const prev = () => {
    if (step > 0) {
      setSlideDir("left");
      setStep((s) => s - 1);
    }
  };

  const finish = () => {
    save({ onboarding_complete: true });
    // Also update local state for the redirect
    setUser((prev) => prev ? { ...prev, onboarding_complete: true } : prev);
    setShowSuccess(true);
    const dashMap: Record<string, string> = {
      coach: "/coach/tableau-de-bord",
      director_school: "/directeur-ecole/dashboard",
      director_cegep: "/directeur-cegep/dashboard",
      recruiter: "/recruteur/tableau-de-bord",
      coach_league: "/coach/tableau-de-bord",
      coordinator_league: "/directeur-ecole/dashboard",
    };
    setTimeout(() => {
      router.push(dashMap[user?.role || "coach"] || "/");
    }, 1500);
  };

  if (!user) return null;

  if (showSuccess) {
    return (
      <div className="bg-[#111317] min-h-screen flex items-center justify-center">
        <div className="text-center animate-scale-fade-in">
          <div className="w-20 h-20 rounded-full bg-[#22C55E] flex items-center justify-center mx-auto mb-6">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <h2 className="font-head text-2xl font-black text-white uppercase">Ton compte est prêt!</h2>
          <p className="text-sm text-[#9CA3AF] mt-2">Redirection en cours...</p>
        </div>
      </div>
    );
  }

  /* ── Step labels per role ── */
  const stepLabelsMap: Record<string, string[]> = {
    coach: ["Profil", "École", "Athlète"],
    director_school: ["Profil", "École", "Invitations"],
    director_cegep: ["Profil", "CÉGEP", "Invitations"],
    recruiter: ["Profil", "Critères", "Besoins"],
    coach_league: ["Profil", "Ligue", "Confirmer"],
    coordinator_league: ["Profil", "Ligue", "Invitations"],
  };
  const stepLabels = stepLabelsMap[user.role] || ["1", "2", "3"];

  return (
    <div className="hero-playbook bg-[#111317] min-h-screen flex flex-col relative">
      <PlaybookBackground />

      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-[#1A1D24]">
        <div className="h-full bg-[#E63946] transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
      </div>

      {/* Logo */}
      <div className="relative z-10 pt-8 pb-2 flex justify-center">
        <Image src="/brand/White%20red%20logo%20@4x.png" alt="Nexus" width={32} height={32} className="object-contain" />
      </div>

      {/* Wizard card */}
      <div className="relative z-10 flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-[640px] bg-[#1A1D24] border border-white/5 rounded-xl p-6 sm:p-8">
          <StepIndicator steps={stepLabels} current={step} />

          {/* Step content with slide animation */}
          <div key={`${user.role}-${step}`} className={slideDir === "right" ? "animate-slide-right" : "animate-slide-left"}>
            {user.role === "coach" && <CoachStep step={step} user={user} save={save} onFinish={finish} />}
            {user.role === "director_school" && <DirectorEcoleStep step={step} user={user} save={save} onFinish={finish} />}
            {user.role === "director_cegep" && <DirectorCegepStep step={step} user={user} save={save} onFinish={finish} />}
            {user.role === "recruiter" && <RecruiterStep step={step} user={user} save={save} onFinish={finish} />}
            {user.role === "coach_league" && <LeagueCoachStep step={step} user={user} save={save} onFinish={finish} />}
            {user.role === "coordinator_league" && <LeagueCoordinatorStep step={step} user={user} save={save} onFinish={finish} />}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
            {step > 0 ? (
              <button type="button" onClick={prev} className="h-11 px-6 rounded-lg border border-white/10 text-sm font-bold text-white hover:border-white/20 transition-colors">
                &larr; Précédent
              </button>
            ) : <div />}
            {step < totalSteps - 1 ? (
              <button type="button" onClick={next} className="h-11 px-8 rounded-lg bg-[#E63946] text-sm font-bold text-white hover:bg-[#D42B22] transition-colors">
                Suivant &rarr;
              </button>
            ) : (
              <button type="button" onClick={finish} className="h-11 px-6 rounded-lg bg-[#E63946] text-sm font-bold text-white hover:bg-[#D42B22] transition-colors">
                Terminer et accéder à Nexus &rarr;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Animations CSS */}
      <style jsx global>{`
        @keyframes slide-right { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slide-left { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes scale-fade-in { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
        @keyframes fade-slide-down { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 50% { transform: translateX(6px); } 75% { transform: translateX(-4px); } }
        @keyframes slide-in { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-slide-right { animation: slide-right 200ms ease-out; }
        .animate-slide-left { animation: slide-left 200ms ease-out; }
        .animate-scale-fade-in { animation: scale-fade-in 400ms ease-out; }
        .animate-fade-slide-down { animation: fade-slide-down 200ms ease-out; }
        .animate-shake { animation: shake 400ms ease-out; }
        .animate-slide-in { animation: slide-in 300ms ease-out; }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   COACH ONBOARDING STEPS
═══════════════════════════════════════════════════════════════ */
function CoachStep({ step, user, save }: { step: number; user: NexusUser; save: (u: Partial<NexusUser>) => void; onFinish: () => void }) {
  const p = (user.profile || {}) as Record<string, unknown>;

  if (step === 0) return <CoachProfile profile={p} save={save} />;
  if (step === 1) return <SchoolStep user={user} save={save} />;
  return <CoachConfirmation user={user} />;
}

function CoachProfile({ profile, save }: { profile: Record<string, unknown>; save: (u: Partial<NexusUser>) => void }) {
  const [bio, setBio] = useState((profile.bio as string) || "");
  const [sport, setSport] = useState((profile.sport_principal as string) || "");
  const [secondary, setSecondary] = useState<string[]>((profile.sports_secondaires as string[]) || []);
  const [experience, setExperience] = useState((profile.experience_years as number) || 0);
  const [phone, setPhone] = useState((profile.phone as string) || "");

  useEffect(() => {
    save({ profile: { ...profile, bio, sport_principal: sport, sports_secondaires: secondary, experience_years: experience, phone } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bio, sport, secondary, experience, phone]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Parle-nous de toi</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Ces informations seront visibles par les recruteurs qui consultent tes athlètes.</p>
      </div>

      {/* Photo placeholder */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#111317] border-2 border-dashed border-white/10 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
        <div>
          <p className="text-xs font-bold text-white uppercase tracking-wider">Photo de profil</p>
          <p className="text-[10px] text-[#6B7280]">Optionnel — visible par les recruteurs</p>
        </div>
      </div>

      {/* Bio */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Bio courte</label>
        <textarea
          maxLength={300}
          rows={3}
          placeholder="Ex: Entraîneur-chef football depuis 8 ans à l'école De Mortagne. Spécialiste développement des quarts-arrières."
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className={`${inputClass} h-auto py-3 resize-none`}
        />
        <p className="text-[10px] text-[#6B7280] text-right mt-1">{bio.length}/300</p>
      </div>

      {/* Sport principal */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Sport principal</label>
        <select value={sport} onChange={(e) => { setSport(e.target.value); setSecondary(secondary.filter((s) => s !== e.target.value)); }} className={`${inputClass} appearance-none cursor-pointer`}>
          <option value="">Sélectionner...</option>
          {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Sports secondaires */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-2 block`}>Sports secondaires</label>
        <PillToggle options={SPORTS.filter((s) => s !== sport)} selected={secondary} onToggle={(v) => setSecondary((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])} />
      </div>

      {/* Experience + Phone */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Années d&apos;expérience</label>
          <input type="number" min="1" max="40" value={experience || ""} onChange={(e) => setExperience(parseInt(e.target.value) || 0)} className={inputClass} />
        </div>
        <div>
          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Téléphone (opt.)</label>
          <input type="text" placeholder="514-555-1234" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
      </div>
    </div>
  );
}

/* ── School step (shared by Coach + Director École) ── */
function SchoolStep({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  const [selected, setSelected] = useState<(typeof MOCK_SCHOOLS)[0] | null>(
    user.institution ? MOCK_SCHOOLS.find((s) => s.name === (user.institution as Record<string, unknown>)?.name) || null : null
  );
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [customRegion, setCustomRegion] = useState("");

  useEffect(() => {
    if (selected) {
      save({ institution: { name: selected.name, city: selected.city, region: selected.region, conference: selected.conference, sports: selected.sports } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Associe-toi à ton école secondaire</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Tes athlètes seront automatiquement liés à cette école.</p>
      </div>

      <SearchableDropdown
        items={MOCK_SCHOOLS}
        value={selected?.name || ""}
        onChange={(item) => setSelected(item)}
        placeholder="Rechercher ton école..."
        renderItem={(item) => (
          <div>
            <p className="font-bold">{item.name}</p>
            <p className="text-[10px] text-[#6B7280]">{item.city} — {item.region}</p>
          </div>
        )}
      />

      {/* Selected school card */}
      {selected && (
        <div className="bg-[#111317] border border-white/10 rounded-lg p-5 space-y-3">
          <h3 className="font-head font-black text-lg text-white">{selected.name}</h3>
          <p className="text-xs text-[#9CA3AF]">{selected.city}, {selected.region}</p>
          <p className="text-xs text-[#6B7280]">Conférence RSEQ: {selected.conference}</p>
          <div className="flex flex-wrap gap-2">
            {selected.sports.map((s) => (
              <span key={s} className="px-3 py-1 rounded-full bg-[rgba(230,57,70,0.1)] border border-[#E63946]/20 text-[10px] font-bold text-[#E63946] uppercase tracking-wider">{s}</span>
            ))}
          </div>
          <p className="text-xs text-[#22C55E] font-bold flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            C&apos;est mon école
          </p>
        </div>
      )}

      {/* Custom school */}
      {!selected && (
        <>
          <button type="button" onClick={() => setShowCustom(!showCustom)} className="text-xs text-[#9CA3AF] hover:text-white transition-colors underline">
            Mon école n&apos;est pas dans la liste
          </button>
          {showCustom && (
            <div className="space-y-3 bg-[#111317] border border-white/10 rounded-lg p-4">
              <input type="text" placeholder="Nom de l'école" value={customName} onChange={(e) => setCustomName(e.target.value)} className={inputClass} />
              <input type="text" placeholder="Ville" value={customCity} onChange={(e) => setCustomCity(e.target.value)} className={inputClass} />
              <select value={customRegion} onChange={(e) => setCustomRegion(e.target.value)} className={`${inputClass} appearance-none`}>
                <option value="">Région</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button type="button" onClick={() => { save({ institution: { name: customName, city: customCity, region: customRegion, conference: "", sports: [] } }); setShowCustom(false); }} className="h-10 px-6 rounded-lg bg-[#E63946] text-xs font-bold text-white hover:bg-[#D42B22] transition-colors">
                Soumettre une demande
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Coach confirmation (step 3) ── */
function CoachConfirmation({ user }: { user: NexusUser }) {
  const p = (user.profile || {}) as Record<string, unknown>;
  const inst = (user.institution || {}) as Record<string, unknown>;

  const rows: { label: string; value: string }[] = [
    { label: "Nom", value: `${user.firstName} ${user.lastName}` },
    { label: "Courriel", value: user.email },
    p.sport_principal ? { label: "Sport principal", value: p.sport_principal as string } : null,
    (p.sports_secondaires as string[] | undefined)?.length ? { label: "Sports secondaires", value: (p.sports_secondaires as string[]).join(", ") } : null,
    p.experience_years ? { label: "Expérience", value: `${p.experience_years} ans` } : null,
    p.phone ? { label: "Téléphone", value: p.phone as string } : null,
    inst.name ? { label: "École", value: inst.name as string } : null,
    inst.city ? { label: "Ville", value: `${inst.city}, ${inst.region || ""}` } : null,
    inst.conference ? { label: "Conférence RSEQ", value: inst.conference as string } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Confirme ton profil</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Vérifie que tout est correct avant de continuer.</p>
      </div>

      <div className="bg-[#111317] border border-white/10 rounded-xl overflow-hidden">
        {rows.map((row, i) => (
          <div key={i} className={`flex items-center justify-between px-5 py-3.5 ${i < rows.length - 1 ? "border-b border-white/5" : ""}`}>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B7280]">{row.label}</span>
            <span className="text-sm text-white font-medium text-right">{row.value}</span>
          </div>
        ))}
      </div>

      {typeof p.bio === "string" && p.bio && (
        <div className="bg-[#111317] border border-white/10 rounded-xl px-5 py-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6B7280] block mb-2">Bio</span>
          <p className="text-sm text-[#9CA3AF] leading-relaxed italic">&ldquo;{p.bio}&rdquo;</p>
        </div>
      )}

      <div className="flex items-center gap-3 p-4 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
        <p className="text-xs text-[#22C55E] font-bold">Tout est bon? Clique sur Terminer pour accéder à ton tableau de bord.</p>
      </div>
    </div>
  );
}

/* ── Director School Step (ownership-aware) ──────────────── */

const MOCK_SCHOOL_OWNERS: Record<string, { name: string; email: string; lastLogin: string }> = {
  "Saint-Jean-Eudes": { name: "Patrick Bergeron", email: "p.b***@sje.qc.ca", lastLogin: "2026-01-28T14:00:00Z" },
  "De Mortagne": { name: "Marie-Ève Lapointe", email: "m.l***@demortagne.qc.ca", lastLogin: "2026-03-16T10:00:00Z" },
  "De Rochebelle": { name: "Nathalie Gagnon", email: "n.g***@rochebelle.qc.ca", lastLogin: "2026-03-15T08:00:00Z" },
};

function DirectorSchoolStep({ user, save, type }: { user: NexusUser; save: (u: Partial<NexusUser>) => void; type: "ecole" | "cegep" }) {
  const [joinMessage, setJoinMessage] = useState("");
  const [joinSent, setJoinSent] = useState(false);
  const inst = user.institution as Record<string, unknown> | null;
  const schoolName = inst?.name as string | undefined;
  const owner = schoolName ? MOCK_SCHOOL_OWNERS[schoolName] : undefined;

  // Check if owner is inactive (30+ days)
  const ownerInactiveDays = owner ? Math.floor((Date.now() - new Date(owner.lastLogin).getTime()) / 86400000) : 0;
  const ownerInactive = ownerInactiveDays > 30;

  // If join request was sent, show confirmation
  if (joinSent) {
    return (
      <div className="space-y-6 text-center py-8">
        <div className="w-16 h-16 rounded-full bg-[#22C55E]/15 flex items-center justify-center mx-auto">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
        <h2 className="font-head text-xl font-black text-white uppercase">Ta demande a été envoyée!</h2>
        <p className="text-sm text-[#9CA3AF] max-w-md mx-auto leading-relaxed">
          {ownerInactive
            ? "Un administrateur Nexus examinera ta demande."
            : `Le directeur principal de ${schoolName} et un administrateur Nexus examineront ta demande.`
          }
        </p>
        <p className="text-xs text-[#6B7280]">Tu recevras un courriel lorsque ta demande sera traitée.</p>
        <a href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-[#E63946] text-white rounded-lg font-head font-bold text-[13px] uppercase tracking-widest hover:bg-[#D42B22] transition-colors">
          Retour à l&apos;accueil
        </a>
      </div>
    );
  }

  // If school has no owner → show Case A (normal claim with crown)
  if (schoolName && !owner) {
    return (
      <div className="space-y-4">
        {type === "ecole" ? <SchoolStep user={user} save={save} /> : <CegepStep user={user} save={save} />}
        {schoolName && (
          <div className="bg-[#111317] border-l-4 border-[#DAB65A] rounded-r-lg p-4 flex items-start gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#DAB65A" stroke="none" className="mt-0.5 shrink-0">
              <path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" />
              <circle cx="5" cy="6" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="19" cy="6" r="2" />
            </svg>
            <p className="text-sm text-[#DAB65A] font-bold">Tu seras le directeur principal de {schoolName}</p>
          </div>
        )}
      </div>
    );
  }

  // Case B/C — school has an owner
  return (
    <div className="space-y-5">
      {type === "ecole" ? <SchoolStep user={user} save={save} /> : <CegepStep user={user} save={save} />}

      {schoolName && owner && (
        <>
          {/* Owner info card */}
          <div className={`bg-[#1A1D24] rounded-xl p-5 border-l-4 space-y-2 ${ownerInactive ? "border-[#E63946]" : "border-[#EAB308]"}`}>
            <p className="text-[14px] font-bold text-white">
              {ownerInactive
                ? "Le directeur principal de cette école semble inactif"
                : "Cette école a déjà un directeur principal"
              }
            </p>
            <p className="text-[13px] text-[#9CA3AF]">{owner.name} · {owner.email}</p>
            {ownerInactive && (
              <p className="text-[12px] text-[#E63946] font-bold">Dernière connexion: il y a {ownerInactiveDays} jours</p>
            )}
            <p className="text-[12px] text-[#6B7280]">
              {ownerInactive
                ? "Ta demande sera envoyée directement à l'administrateur Nexus pour examen."
                : "Tu seras ajouté comme directeur collaborateur si ta demande est approuvée."
              }
            </p>
          </div>

          {/* Join request form */}
          <div className="space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] block">
              Pourquoi veux-tu rejoindre cette école? <span className="text-[#E63946]">*</span>
            </label>
            <textarea
              value={joinMessage}
              onChange={(e) => setJoinMessage(e.target.value)}
              rows={3}
              placeholder="Ex: Je suis le nouveau coordonnateur sportif depuis septembre 2025, remplaçant M. Tremblay."
              className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none resize-none"
            />
            <button
              type="button"
              disabled={!joinMessage.trim()}
              onClick={() => {
                localStorage.setItem("nexus_join_request", JSON.stringify({
                  school: schoolName,
                  message: joinMessage,
                  status: ownerInactive ? "pending_admin" : "pending_owner",
                  date: new Date().toISOString(),
                }));
                setJoinSent(true);
              }}
              className="w-full py-3 bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 disabled:cursor-not-allowed text-white font-head font-bold text-[13px] uppercase tracking-widest rounded-lg transition-colors"
            >
              Envoyer la demande
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DIRECTEUR ÉCOLE ONBOARDING STEPS
═══════════════════════════════════════════════════════════════ */
function DirectorEcoleStep({ step, user, save, onFinish }: { step: number; user: NexusUser; save: (u: Partial<NexusUser>) => void; onFinish: () => void }) {
  if (step === 0) return <DirectorProfile user={user} save={save} subtitle="En tant que directeur sportif, tu supervises les coachs et les athlètes de ton école." />;
  if (step === 1) return <DirectorSchoolStep user={user} save={save} type="ecole" />;
  return <InviteStep role="coach" onFinish={onFinish} />;
}

/* ═══════════════════════════════════════════════════════════════
   DIRECTEUR CÉGEP ONBOARDING STEPS
═══════════════════════════════════════════════════════════════ */
function DirectorCegepStep({ step, user, save, onFinish }: { step: number; user: NexusUser; save: (u: Partial<NexusUser>) => void; onFinish: () => void }) {
  if (step === 0) return <DirectorProfile user={user} save={save} subtitle="En tant que directeur sportif collégial, tu supervises le recrutement de ton CÉGEP." />;
  if (step === 1) return <DirectorSchoolStep user={user} save={save} type="cegep" />;
  return <InviteStep role="recruteur" onFinish={onFinish} />;
}

/* ── Director profile (shared) ── */
function DirectorProfile({ user, save, subtitle }: { user: NexusUser; save: (u: Partial<NexusUser>) => void; subtitle: string }) {
  const p = (user.profile || {}) as Record<string, unknown>;
  const [titre, setTitre] = useState((p.titre as string) || "");
  const [phone, setPhone] = useState((p.phone as string) || "");

  useEffect(() => {
    save({ profile: { ...p, titre, phone } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titre, phone]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Parle-nous de toi</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">{subtitle}</p>
      </div>

      {/* Photo */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#111317] border-2 border-dashed border-white/10 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
        <div>
          <p className="text-xs font-bold text-white uppercase tracking-wider">Photo de profil</p>
          <p className="text-[10px] text-[#6B7280]">Optionnel</p>
        </div>
      </div>

      <div>
        <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Titre / Poste</label>
        <input type="text" placeholder="Ex: Directeur des services aux élèves et du sport" value={titre} onChange={(e) => setTitre(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Téléphone (optionnel)</label>
        <input type="text" placeholder="418-555-1234" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
      </div>
    </div>
  );
}

/* ── CÉGEP step ── */
function CegepStep({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  const [selected, setSelected] = useState<(typeof MOCK_CEGEPS)[0] | null>(
    user.institution ? MOCK_CEGEPS.find((c) => c.name === (user.institution as Record<string, unknown>)?.name) || null : null
  );

  useEffect(() => {
    if (selected) {
      save({ institution: { name: selected.name, city: selected.city, region: selected.region, conference: selected.conference, type: selected.type, programs: selected.programs, sports: selected.sports } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Configure ton établissement</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Associe-toi à ton CÉGEP pour gérer tes recruteurs.</p>
      </div>

      <SearchableDropdown
        items={MOCK_CEGEPS}
        value={selected?.name || ""}
        onChange={(item) => setSelected(item)}
        placeholder="Rechercher ton CÉGEP..."
        renderItem={(item) => (
          <div>
            <p className="font-bold">{item.name}</p>
            <p className="text-[10px] text-[#6B7280]">{item.city} — {item.region}</p>
          </div>
        )}
      />

      {selected && (
        <div className="bg-[#111317] border border-white/10 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="font-head font-black text-lg text-white">{selected.name}</h3>
            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20">{selected.type}</span>
          </div>
          <p className="text-xs text-[#9CA3AF]">{selected.city}, {selected.region} — {selected.conference}</p>
          <div className="flex flex-wrap gap-1.5">
            {selected.programs.map((p) => (
              <span key={p} className="px-2 py-1 rounded bg-white/5 text-[9px] text-[#9CA3AF]">{p}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {selected.sports.map((s) => (
              <span key={s.sport} className="px-3 py-1 rounded-full bg-[rgba(230,57,70,0.1)] border border-[#E63946]/20 text-[10px] font-bold text-[#E63946] uppercase tracking-wider">
                {s.sport} {s.division}
              </span>
            ))}
          </div>
          <p className="text-xs text-[#22C55E] font-bold flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            Réclamer ce CÉGEP
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Invite step (shared by directors) ── */
function InviteStep({ role }: { role: string; onFinish: () => void }) {
  const [emails, setEmails] = useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = useState("");
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);

  const addEmail = () => {
    if (currentEmail && emails.length < 10 && currentEmail.includes("@")) {
      setEmails([...emails, currentEmail]);
      setCurrentEmail("");
    }
  };

  const removeEmail = (i: number) => setEmails(emails.filter((_, idx) => idx !== i));

  const copyLink = () => {
    navigator.clipboard.writeText("https://nexus-brown-zeta.vercel.app/auth?mode=signup");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">
          Invite tes {role === "coach" ? "entraîneurs" : "recruteurs"}
        </h2>
        <p className="text-sm text-[#9CA3AF] mt-1">
          {role === "recruteur"
            ? "Ils auront accès à la base de données d’athlètes une fois validés par un admin."
            : "Ils pourront créer des profils athlètes pour ton école."}
        </p>
      </div>

      {/* Email input */}
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="courriel@exemple.ca"
          value={currentEmail}
          onChange={(e) => setCurrentEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
          className={`${inputClass} flex-1`}
        />
        <button type="button" onClick={addEmail} className="h-11 px-4 rounded-lg bg-[#E63946] text-xs font-bold text-white hover:bg-[#D42B22] transition-colors shrink-0">
          Ajouter
        </button>
      </div>

      {/* Email pills */}
      {emails.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {emails.map((em, i) => (
            <span key={i} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#111317] border border-white/10 text-xs text-white">
              {em}
              <button type="button" onClick={() => removeEmail(i)} className="text-[#6B7280] hover:text-[#EF4444] transition-colors">&times;</button>
            </span>
          ))}
        </div>
      )}

      {emails.length > 0 && (
        <button type="button" onClick={() => setToast("Invitations envoyées (POC)")} className="h-10 px-6 rounded-lg bg-[#E63946] text-xs font-bold text-white hover:bg-[#D42B22] transition-colors">
          Envoyer les invitations ({emails.length})
        </button>
      )}

      {toast && (
        <p className="text-xs text-[#22C55E] font-bold">{toast}</p>
      )}

      {/* Share link */}
      <div className="border-t border-white/5 pt-5 space-y-2">
        <p className="text-xs text-[#9CA3AF]">Ou partage ce lien d&apos;inscription</p>
        <div className="flex gap-2">
          <input type="text" readOnly value="https://nexus-brown-zeta.vercel.app/auth?mode=signup" className={`${inputClass} text-[#6B7280] flex-1`} />
          <button type="button" onClick={copyLink} className="h-11 px-4 rounded-lg border border-white/10 text-xs font-bold text-white hover:border-white/20 transition-colors shrink-0">
            {copied ? "✓ Copié!" : "Copier"}
          </button>
        </div>
      </div>

      {role === "recruteur" && (
        <p className="text-[10px] text-[#6B7280] italic">
          Les recruteurs invités devront quand même être validés par un administrateur Nexus avant d&apos;accéder à la plateforme.
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RECRUITER ONBOARDING STEPS
═══════════════════════════════════════════════════════════════ */
function RecruiterStep({ step, user, save }: { step: number; user: NexusUser; save: (u: Partial<NexusUser>) => void; onFinish: () => void }) {
  if (step === 0) return <RecruiterProfile user={user} save={save} />;
  if (step === 1) return <RecruiterCriteria user={user} save={save} />;
  return <RecruiterNeeds user={user} save={save} />;
}

/* ── Recruiter profile ── */
function RecruiterProfile({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  const p = (user.profile || {}) as Record<string, unknown>;
  const [bio, setBio] = useState((p.bio as string) || "");
  const [sport, setSport] = useState((p.sport_principal as string) || "");
  const [secondary, setSecondary] = useState<string[]>((p.sports_secondaires as string[]) || []);
  const [experience, setExperience] = useState((p.experience_years as number) || 0);
  const [phone, setPhone] = useState((p.phone as string) || "");

  useEffect(() => {
    save({ profile: { ...p, bio, sport_principal: sport, sports_secondaires: secondary, experience_years: experience, phone } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bio, sport, secondary, experience, phone]);

  const cegepName = (user.institution as Record<string, unknown>)?.name as string || null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Bienvenue sur Nexus!</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Les coachs verront ces informations quand tu les contacteras.</p>
      </div>

      {cegepName && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/20">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
          <span className="text-xs font-bold text-[#22C55E]">Tu recrutes pour : {cegepName}</span>
        </div>
      )}

      {/* Photo */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#111317] border-2 border-dashed border-white/10 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
        <div>
          <p className="text-xs font-bold text-white uppercase tracking-wider">Photo de profil</p>
          <p className="text-[10px] text-[#6B7280]">Optionnel</p>
        </div>
      </div>

      <div>
        <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Bio courte</label>
        <textarea maxLength={300} rows={3} placeholder="Ex: Recruteur football au CÉGEP Garneau depuis 5 ans. Je cherche des joueurs de ligne et des demis défensifs." value={bio} onChange={(e) => setBio(e.target.value)} className={`${inputClass} h-auto py-3 resize-none`} />
        <p className="text-[10px] text-[#6B7280] text-right mt-1">{bio.length}/300</p>
      </div>

      <div>
        <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Sport principal recruté</label>
        <select value={sport} onChange={(e) => setSport(e.target.value)} className={`${inputClass} appearance-none cursor-pointer`}>
          <option value="">Sélectionner...</option>
          {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div>
        <label className={`${label} text-[#9CA3AF] mb-2 block`}>Sports secondaires recrutés</label>
        <PillToggle options={SPORTS.filter((s) => s !== sport)} selected={secondary} onToggle={(v) => setSecondary((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Années d&apos;expérience</label>
          <input type="number" min="1" max="40" value={experience || ""} onChange={(e) => setExperience(parseInt(e.target.value) || 0)} className={inputClass} />
        </div>
        <div>
          <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Téléphone (opt.)</label>
          <input type="text" placeholder="418-555-1234" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </div>
      </div>
    </div>
  );
}

/* ── Recruiter search criteria ── */
function RecruiterCriteria({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  const sc = (user.search_criteria || {}) as Record<string, unknown>;
  const [positions, setPositions] = useState<string[]>((sc.positions as string[]) || []);
  const [divisions, setDivisions] = useState<string[]>((sc.divisions as string[]) || []);
  const [regions, setRegions] = useState<string[]>((sc.regions as string[]) || [...REGIONS]);
  const [gradYears, setGradYears] = useState<number[]>((sc.grad_years as number[]) || [2026, 2027]);
  const [minGpa, setMinGpa] = useState((sc.min_gpa as number) || 70);
  const [programs, setPrograms] = useState<string[]>((sc.programs as string[]) || []);

  const sportPrincipal = ((user.profile || {}) as Record<string, unknown>).sport_principal as string || "Football";
  const positionOptions = sportPrincipal === "Football" ? FOOTBALL_POSITIONS : ["Joueur", "Gardien", "Ailier", "Centre", "Défenseur"];

  useEffect(() => {
    save({ search_criteria: { positions, divisions, regions, grad_years: gradYears, min_gpa: minGpa, programs } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, divisions, regions, gradYears, minGpa, programs]);

  const toggleArr = <T,>(arr: T[], val: T, set: (a: T[]) => void) => {
    set(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Qu&apos;est-ce que tu cherches?</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">On utilisera ces critères pour te montrer les athlètes les plus pertinents.</p>
      </div>

      {/* Positions */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-2 block`}>Positions recherchées</label>
        <PillToggle options={positionOptions} selected={positions} onToggle={(v) => toggleArr(positions, v, setPositions)} />
      </div>

      {/* Divisions */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-2 block`}>Divisions</label>
        <div className="flex gap-3">
          {["D1", "D2", "D3"].map((d) => (
            <label key={d} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={divisions.includes(d)} onChange={() => toggleArr(divisions, d, setDivisions)} className="accent-[#E63946] w-4 h-4" />
              <span className="text-sm text-white">{d}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Regions */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-2 block`}>Régions préférées</label>
        <PillToggle options={REGIONS} selected={regions} onToggle={(v) => toggleArr(regions, v, setRegions)} />
      </div>

      {/* Grad years */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-2 block`}>Année de graduation ciblée</label>
        <div className="flex gap-3">
          {GRAD_YEARS.map((y) => (
            <label key={y} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={gradYears.includes(y)} onChange={() => toggleArr(gradYears, y, setGradYears)} className="accent-[#E63946] w-4 h-4" />
              <span className="text-sm text-white">{y}</span>
            </label>
          ))}
        </div>
      </div>

      {/* GPA slider */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-2 block`}>Moyenne générale minimum: <span className="text-white">{minGpa}%</span></label>
        <input type="range" min="50" max="90" step="5" value={minGpa} onChange={(e) => setMinGpa(parseInt(e.target.value))} className="w-full accent-[#E63946]" />
        <div className="flex justify-between text-[9px] text-[#6B7280]"><span>50%</span><span>90%</span></div>
      </div>

      {/* Programs */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-2 block`}>Programme préféré</label>
        <PillToggle options={["Sport-études", "Sciences", "Général", "Tous les programmes"]} selected={programs} onToggle={(v) => toggleArr(programs, v, setPrograms)} />
      </div>
    </div>
  );
}

/* ── Recruiter team needs ── */
function RecruiterNeeds({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  const tn = (user.team_needs || {}) as Record<string, unknown>;
  const [rows, setRows] = useState<{ position: string; count: number; priority: string }[]>(
    (tn.positions_needed as { position: string; count: number; priority: string }[]) || []
  );
  const [notes, setNotes] = useState((tn.notes as string) || "");

  const sportPrincipal = ((user.profile || {}) as Record<string, unknown>).sport_principal as string || "Football";
  const positionOptions = sportPrincipal === "Football" ? FOOTBALL_POSITIONS : ["Joueur", "Gardien", "Ailier", "Centre", "Défenseur"];

  useEffect(() => {
    save({ team_needs: { positions_needed: rows, notes } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, notes]);

  const addRow = () => {
    if (rows.length < 10) setRows([...rows, { position: "", count: 1, priority: "Moyenne" }]);
  };

  const updateRow = (i: number, key: string, val: string | number) => {
    setRows(rows.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  };

  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Des postes à combler cette saison?</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Dis-nous quels postes tu dois remplir — on t&apos;enverra des suggestions.</p>
      </div>

      {/* Position rows */}
      {rows.map((row, i) => (
        <div key={i} className="flex items-end gap-2 bg-[#111317] border border-white/10 rounded-lg p-3">
          <div className="flex-1">
            <label className={`${label} text-[#9CA3AF] mb-1 block`}>Position</label>
            <select value={row.position} onChange={(e) => updateRow(i, "position", e.target.value)} className={`${inputClass} appearance-none text-xs`}>
              <option value="">Sélectionner</option>
              {positionOptions.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="w-16">
            <label className={`${label} text-[#9CA3AF] mb-1 block`}>Nb</label>
            <input type="number" min="1" max="5" value={row.count} onChange={(e) => updateRow(i, "count", parseInt(e.target.value) || 1)} className={`${inputClass} text-xs text-center`} />
          </div>
          <div className="w-28">
            <label className={`${label} text-[#9CA3AF] mb-1 block`}>Priorité</label>
            <div className="flex gap-1">
              {["Haute", "Moyenne", "Basse"].map((p) => {
                const colors: Record<string, string> = { Haute: "#EF4444", Moyenne: "#EAB308", Basse: "#6B7280" };
                return (
                  <button key={p} type="button" onClick={() => updateRow(i, "priority", p)} className={`flex-1 h-8 rounded text-[8px] font-bold uppercase transition-colors ${row.priority === p ? `text-white` : "text-[#6B7280] bg-transparent"}`} style={row.priority === p ? { backgroundColor: `${colors[p]}20`, color: colors[p], border: `1px solid ${colors[p]}40` } : { border: "1px solid rgba(255,255,255,0.05)" }}>
                    {p[0]}
                  </button>
                );
              })}
            </div>
          </div>
          <button type="button" onClick={() => removeRow(i)} className="h-11 w-8 flex items-center justify-center text-[#6B7280] hover:text-[#EF4444] transition-colors">
            &times;
          </button>
        </div>
      ))}

      {rows.length < 10 && (
        <button type="button" onClick={addRow} className="text-xs text-[#E63946] hover:text-white transition-colors font-bold flex items-center gap-1">
          <span className="text-lg leading-none">+</span> Ajouter un poste
        </button>
      )}

      {/* Notes */}
      <div>
        <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Notes internes</label>
        <textarea rows={3} placeholder="Ex: Besoin urgent d&apos;un QB pour remplacer notre finissant. Budget de bourse disponible." value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputClass} h-auto py-3 resize-none`} />
      </div>

      <button type="button" onClick={() => {}} className="text-xs text-[#6B7280] hover:text-white transition-colors underline">
        Passer cette étape
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEAGUE DATA + SHARED COMPONENTS
═══════════════════════════════════════════════════════════════ */

const MOCK_LEAGUES = [
  { name: "Wildcats Lanaudière", sport: "Football", city: "Repentigny", region: "Lanaudière", level: "AAA" },
  { name: "Élite Baseball Québec", sport: "Baseball", city: "Québec", region: "Québec", level: "AAA" },
  { name: "Remparts AAA U18", sport: "Hockey", city: "Québec", region: "Québec", level: "AAA" },
  { name: "Club Basketball Brookwood", sport: "Basketball", city: "Montréal", region: "Montréal", level: "AA" },
  { name: "Storm Volleyball Québec", sport: "Volleyball", city: "Québec", region: "Québec", level: "Club" },
  { name: "RSL Québec Academy", sport: "Soccer", city: "Québec", region: "Québec", level: "AAA" },
  { name: "Titans Rugby Montréal", sport: "Rugby", city: "Montréal", region: "Montréal", level: "Club" },
  { name: "FC Gatineau Élite", sport: "Soccer", city: "Gatineau", region: "Outaouais", level: "AA" },
];

const LEAGUE_LEVELS = ["AAA", "AA", "A", "Club", "Civil"];
const TEAM_CATEGORIES = ["U15", "U16", "U17", "U18", "Juvénile", "Cadet", "Midget", "Senior", "Autre"];

/* ── League search + select (shared by coach + coordinator) ── */
function LeagueSelectStep({ user, save, onRequestNew }: {
  user: NexusUser;
  save: (u: Partial<NexusUser>) => void;
  onRequestNew: () => void;
}) {
  const [selected, setSelected] = useState<(typeof MOCK_LEAGUES)[0] | null>(
    user.institution ? MOCK_LEAGUES.find((l) => l.name === (user.institution as Record<string, unknown>)?.name) || null : null
  );

  useEffect(() => {
    if (selected) {
      save({ institution: { name: selected.name, sport: selected.sport, city: selected.city, region: selected.region, level: selected.level, type: "ligue_civile" } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  return (
    <>
      <SearchableDropdown
        items={MOCK_LEAGUES}
        value={selected?.name || ""}
        onChange={(item) => setSelected(item)}
        placeholder="Rechercher ta ligue ou ton club..."
        renderItem={(item) => (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">{item.name}</p>
              <p className="text-[10px] text-[#6B7280]">{item.city} — {item.region}</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#E63946]/10 text-[9px] font-bold text-[#E63946] uppercase">{item.sport}</span>
          </div>
        )}
      />

      {selected && (
        <div className="bg-[#111317] border border-white/10 rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="font-head font-black text-lg text-white">{selected.name}</h3>
            <span className="px-2 py-0.5 rounded-full bg-[#E63946]/10 text-[9px] font-bold text-[#E63946] uppercase border border-[#E63946]/20">{selected.sport}</span>
          </div>
          <p className="text-xs text-[#9CA3AF]">{selected.city}, {selected.region}</p>
          <p className="text-xs text-[#6B7280]">Niveau: {selected.level}</p>
          <p className="text-xs text-[#22C55E] font-bold flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
            C&apos;est ma ligue
          </p>
        </div>
      )}

      {!selected && (
        <button type="button" onClick={onRequestNew} className="text-xs text-[#9CA3AF] hover:text-white transition-colors underline">
          Ma ligue n&apos;est pas dans la liste
        </button>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEAGUE COACH ONBOARDING (3 steps)
═══════════════════════════════════════════════════════════════ */
function LeagueCoachStep({ step, user, save }: { step: number; user: NexusUser; save: (u: Partial<NexusUser>) => void; onFinish: () => void }) {
  const p = (user.profile || {}) as Record<string, unknown>;
  if (step === 0) return <CoachProfile profile={p} save={save} />;
  if (step === 1) return <LeagueCoachLeagueStep user={user} save={save} />;
  return <CoachConfirmation user={user} />;
}

function LeagueCoachLeagueStep({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customSport, setCustomSport] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [customRegion, setCustomRegion] = useState("");
  const [customLevel, setCustomLevel] = useState("");
  const [customSubmitted, setCustomSubmitted] = useState(false);

  // Team info
  const inst = user.institution as Record<string, unknown> | null;
  const hasLeague = !!inst?.name;
  const [teamName, setTeamName] = useState("");
  const [teamCategory, setTeamCategory] = useState("");
  const [teamGender, setTeamGender] = useState("");
  const teamSeason = "2025-2026";

  useEffect(() => {
    if (hasLeague && teamName) {
      const raw = localStorage.getItem("nexus_user");
      if (!raw) return;
      const current = JSON.parse(raw) as NexusUser;
      const updated = {
        ...current,
        profile: { ...(current.profile || {}), league_team: { name: teamName, category: teamCategory, gender: teamGender, season: teamSeason } },
      };
      localStorage.setItem("nexus_user", JSON.stringify(updated));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamName, teamCategory, teamGender, hasLeague]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Associe-toi à ta ligue ou ton club sportif</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Ton équipe et tes athlètes seront liés à cette organisation.</p>
      </div>

      {!showCustom ? (
        <LeagueSelectStep user={user} save={save} onRequestNew={() => setShowCustom(true)} />
      ) : (
        <>
          {customSubmitted ? (
            <div className="bg-[#111317] border border-[#22C55E]/20 rounded-lg p-5 text-center space-y-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" className="mx-auto"><path d="M20 6L9 17l-5-5"/></svg>
              <p className="text-sm text-[#22C55E] font-bold">Demande soumise!</p>
              <p className="text-xs text-[#6B7280]">Un administrateur créera ta ligue. Tu pourras continuer entre-temps.</p>
            </div>
          ) : (
            <div className="space-y-3 bg-[#111317] border border-white/10 rounded-lg p-4">
              <p className="text-xs font-bold text-white uppercase tracking-wider mb-2">Soumettre une nouvelle ligue</p>
              <input type="text" placeholder="Nom de la ligue / du club" value={customName} onChange={(e) => setCustomName(e.target.value)} className={inputClass} />
              <select title="Sport" value={customSport} onChange={(e) => setCustomSport(e.target.value)} className={`${inputClass} appearance-none`}>
                <option value="">Sport</option>
                {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="Ville" value={customCity} onChange={(e) => setCustomCity(e.target.value)} className={inputClass} />
                <select title="Région" value={customRegion} onChange={(e) => setCustomRegion(e.target.value)} className={`${inputClass} appearance-none`}>
                  <option value="">Région</option>
                  {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <select title="Niveau" value={customLevel} onChange={(e) => setCustomLevel(e.target.value)} className={`${inputClass} appearance-none`}>
                <option value="">Niveau</option>
                {LEAGUE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowCustom(false)} className="h-10 px-4 rounded-lg border border-white/10 text-xs font-bold text-white hover:border-white/20 transition-colors">
                  Annuler
                </button>
                <button type="button" disabled={!customName || !customSport} onClick={() => {
                  save({ institution: { name: customName, sport: customSport, city: customCity, region: customRegion, level: customLevel, type: "ligue_civile", pending: true } });
                  setCustomSubmitted(true);
                }} className="h-10 px-6 rounded-lg bg-[#E63946] text-xs font-bold text-white hover:bg-[#D42B22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Soumettre la demande
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Team section — appears after league is selected */}
      {hasLeague && (
        <div className="space-y-4 pt-2 border-t border-white/5 animate-fade-slide-down">
          <div>
            <h3 className="font-head text-base font-black text-white uppercase">Ton équipe</h3>
            <p className="text-xs text-[#9CA3AF] mt-0.5">Quelle équipe entraînes-tu dans cette ligue?</p>
          </div>
          <input type="text" placeholder="Ex: U18 Division 1" value={teamName} onChange={(e) => setTeamName(e.target.value)} className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Catégorie</label>
              <select title="Catégorie" value={teamCategory} onChange={(e) => setTeamCategory(e.target.value)} className={`${inputClass} appearance-none`}>
                <option value="">Sélectionner</option>
                {TEAM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Genre</label>
              <div className="flex gap-2">
                {["Masculin", "Féminin", "Mixte"].map((g) => (
                  <button key={g} type="button" onClick={() => setTeamGender(g)} className={`flex-1 h-11 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${teamGender === g ? "bg-[rgba(230,57,70,0.1)] border border-[#E63946] text-white" : "bg-[#111317] border border-white/10 text-[#9CA3AF] hover:border-white/20"}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Saison:</span>
            <span className="text-sm text-white">{teamSeason}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEAGUE COORDINATOR ONBOARDING (3 steps)
═══════════════════════════════════════════════════════════════ */
function LeagueCoordinatorStep({ step, user, save, onFinish }: { step: number; user: NexusUser; save: (u: Partial<NexusUser>) => void; onFinish: () => void }) {
  if (step === 0) return <DirectorProfile user={user} save={save} subtitle="En tant que coordonnateur, tu supervises les entraîneurs et les athlètes de ta ligue." />;
  if (step === 1) return <CoordinatorLeagueStep user={user} save={save} />;
  return <InviteStep role="coach" onFinish={onFinish} />;
}

function CoordinatorLeagueStep({ user, save }: { user: NexusUser; save: (u: Partial<NexusUser>) => void }) {
  const [mode, setMode] = useState<"existing" | "create" | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newSport, setNewSport] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newRegion, setNewRegion] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [newWebsite, setNewWebsite] = useState("");
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [newGender, setNewGender] = useState("");

  const handleCreate = () => {
    save({
      institution: {
        name: newName, sport: newSport, city: newCity, region: newRegion,
        level: newLevel, website: newWebsite, categories: newCategories,
        gender: newGender, type: "ligue_civile", created_by_coordinator: true,
      },
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-head text-xl font-black text-white uppercase">Configure ta ligue ou ton club</h2>
        <p className="text-sm text-[#9CA3AF] mt-1">Associe-toi à une ligue existante ou crée la tienne.</p>
      </div>

      {/* Two option cards */}
      {!mode && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" onClick={() => setMode("existing")} className="flex flex-col items-center gap-3 p-6 rounded-xl border border-white/10 hover:border-[#E63946]/30 transition-all text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <span className="font-head font-black text-xs text-white uppercase tracking-wider">Ma ligue existe déjà</span>
            <span className="text-[9px] text-[#6B7280]">Recherche et réclame ta ligue</span>
          </button>
          <button type="button" onClick={() => setMode("create")} className="flex flex-col items-center gap-3 p-6 rounded-xl border border-white/10 hover:border-[#E63946]/30 transition-all text-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span className="font-head font-black text-xs text-white uppercase tracking-wider">Créer ma ligue</span>
            <span className="text-[9px] text-[#6B7280]">Configure une nouvelle organisation</span>
          </button>
        </div>
      )}

      {/* Existing league search */}
      {mode === "existing" && (
        <div className="space-y-4 animate-fade-slide-down">
          <button type="button" onClick={() => setMode(null)} className="text-xs text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Retour
          </button>
          <LeagueSelectStep user={user} save={save} onRequestNew={() => setMode("create")} />
          {/* Ownership notice */}
          {!!(user.institution as Record<string, unknown>)?.name && (
            <div className="bg-[#111317] border-l-4 border-[#DAB65A] rounded-r-lg p-4 flex items-start gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#DAB65A" stroke="none" className="mt-0.5 shrink-0">
                <path d="M2 20h20v2H2zm1-2l3-10 6 6 6-6 3 10z" />
                <circle cx="5" cy="6" r="2" /><circle cx="12" cy="3" r="2" /><circle cx="19" cy="6" r="2" />
              </svg>
              <p className="text-sm text-[#DAB65A] font-bold">Tu seras le coordonnateur principal de cette ligue</p>
            </div>
          )}
        </div>
      )}

      {/* Create new league */}
      {mode === "create" && (
        <div className="space-y-4 animate-fade-slide-down">
          <button type="button" onClick={() => setMode(null)} className="text-xs text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Retour
          </button>

          <input type="text" placeholder="Nom de la ligue / du club" value={newName} onChange={(e) => setNewName(e.target.value)} className={inputClass} />

          <div>
            <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Sport principal</label>
            <select title="Sport principal" value={newSport} onChange={(e) => setNewSport(e.target.value)} className={`${inputClass} appearance-none`}>
              <option value="">Sélectionner...</option>
              {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Ville" value={newCity} onChange={(e) => setNewCity(e.target.value)} className={inputClass} />
            <select title="Région" value={newRegion} onChange={(e) => setNewRegion(e.target.value)} className={`${inputClass} appearance-none`}>
              <option value="">Région</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Niveau principal</label>
            <div className="flex flex-wrap gap-2">
              {LEAGUE_LEVELS.map((l) => (
                <button key={l} type="button" onClick={() => setNewLevel(l)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${newLevel === l ? "bg-[rgba(230,57,70,0.1)] border border-[#E63946] text-white" : "bg-[#1A1D24] border border-white/10 text-[#9CA3AF] hover:border-white/20"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <input type="url" placeholder="Site web (optionnel)" value={newWebsite} onChange={(e) => setNewWebsite(e.target.value)} className={inputClass} />

          <div>
            <label className={`${label} text-[#9CA3AF] mb-2 block`}>Catégories offertes</label>
            <div className="flex flex-wrap gap-2">
              {TEAM_CATEGORIES.filter((c) => c !== "Autre").map((cat) => {
                const isOn = newCategories.includes(cat);
                return (
                  <button key={cat} type="button" onClick={() => setNewCategories(isOn ? newCategories.filter((c) => c !== cat) : [...newCategories, cat])} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isOn ? "bg-[rgba(230,57,70,0.1)] border border-[#E63946] text-white" : "bg-[#1A1D24] border border-white/10 text-[#9CA3AF] hover:border-white/20"}`}>
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={`${label} text-[#9CA3AF] mb-1.5 block`}>Genre</label>
            <div className="flex gap-2">
              {["Masculin", "Féminin", "Les deux"].map((g) => (
                <button key={g} type="button" onClick={() => setNewGender(g)} className={`flex-1 h-11 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${newGender === g ? "bg-[rgba(230,57,70,0.1)] border border-[#E63946] text-white" : "bg-[#111317] border border-white/10 text-[#9CA3AF] hover:border-white/20"}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>

          <button type="button" disabled={!newName || !newSport} onClick={handleCreate} className="w-full h-11 rounded-lg bg-[#E63946] text-sm font-bold text-white hover:bg-[#D42B22] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Créer ma ligue
          </button>

          {!!(user.institution as Record<string, unknown>)?.created_by_coordinator && (
            <div className="bg-[#111317] border-l-4 border-[#22C55E] rounded-r-lg p-4 flex items-start gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>
              <p className="text-xs text-[#22C55E] font-bold">Ligue créée! Continue pour inviter tes entraîneurs.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
