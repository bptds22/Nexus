"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import PlaybookBackground from "@/app/components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Athlete Onboarding — 4-step setup wizard
   1. Identité  2. École  3. Sport & Position  4. Profil physique
───────────────────────────────────────────────────────────────── */

const STEPS = ["Identité", "École", "Sport & Position", "Profil physique"];

export default function AthleteOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [existingAthleteId, setExistingAthleteId] = useState<string | null>(null);

  // Step 1 — Identity
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [graduationYear, setGraduationYear] = useState("2026");

  // Step 2 — School
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schools, setSchools] = useState<{ id: string; name: string; region: string }[]>([]);
  const [filteredSchools, setFilteredSchools] = useState<{ id: string; name: string; region: string }[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [selectedSchoolName, setSelectedSchoolName] = useState("");

  // Step 3 — Sport & Position
  const [sports, setSports] = useState<{ id: string; nom: string }[]>([]);
  const [selectedSportId, setSelectedSportId] = useState("");
  const [positions, setPositions] = useState<{ id: string; nom: string; abreviation: string }[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState("");

  // Step 4 — Physical
  const [taillePieds, setTaillePieds] = useState("");
  const [taillePouces, setTaillePouces] = useState("");
  const [poidsLbs, setPoidsLbs] = useState("");

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      setUserId(user.id);

      // Check if athlete row exists already
      const { data: existing } = await supabase
        .from("athletes")
        .select("id, first_name, last_name, school_id, sport_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        setExistingAthleteId(existing.id);
        if (existing.first_name) setFirstName(existing.first_name);
        if (existing.last_name) setLastName(existing.last_name);
        // If profile already complete, redirect to dashboard
        if (existing.first_name && existing.last_name && existing.school_id && existing.sport_id) {
          router.replace("/athlete/dashboard");
          return;
        }
      }

      // Load schools
      const { data: schoolData } = await supabase.from("schools").select("id, name, region").order("name");
      if (schoolData) {
        setSchools(schoolData);
        setFilteredSchools(schoolData.slice(0, 20));
      }

      // Load sports
      const { data: sportData } = await supabase.from("sports").select("id, nom").order("nom");
      if (sportData) setSports(sportData);

      setLoading(false);
    }
    init();
  }, [router]);

  // Filter schools on search
  useEffect(() => {
    if (schoolSearch.length < 2) {
      setFilteredSchools(schools.slice(0, 20));
    } else {
      const q = schoolSearch.toLowerCase();
      setFilteredSchools(schools.filter((s) => s.name.toLowerCase().includes(q) || s.region.toLowerCase().includes(q)).slice(0, 20));
    }
  }, [schoolSearch, schools]);

  // Load positions when sport changes
  useEffect(() => {
    if (!selectedSportId) { setPositions([]); setSelectedPositionId(""); return; }
    const loadPositions = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("positions").select("id, nom, abreviation").eq("sport_id", selectedSportId).order("nom");
      if (data) setPositions(data);
    };
    loadPositions();
  }, [selectedSportId]);

  const canProceed = () => {
    switch (step) {
      case 0: return firstName.trim() && lastName.trim() && graduationYear;
      case 1: return !!selectedSchoolId;
      case 2: return !!selectedSportId;
      case 3: return true; // physical is optional
      default: return false;
    }
  };

  async function handleComplete() {
    if (!userId) return;
    setSaving(true);

    const supabase = createClient();
    const payload = {
      user_id: userId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_naissance: dateNaissance || null,
      annee_diplomation: parseInt(graduationYear) || 2026,
      school_id: selectedSchoolId || null,
      sport_id: selectedSportId || null,
      position_id: selectedPositionId || null,
      taille_pieds: taillePieds ? parseInt(taillePieds) : null,
      taille_pouces: taillePouces ? parseInt(taillePouces) : null,
      poids_lbs: poidsLbs ? parseInt(poidsLbs) : null,
      status: "ACTIF",
    };

    if (existingAthleteId) {
      const { error } = await supabase.from("athletes").update(payload).eq("id", existingAthleteId);
      console.log("[Onboarding] update athlete:", error);
    } else {
      const { error } = await supabase.from("athletes").insert(payload);
      console.log("[Onboarding] insert athlete:", error);
    }

    // Mark onboarding complete
    await supabase.from("users").update({ onboarding_complete: true }).eq("id", userId);

    setSaving(false);
    router.replace("/athlete/dashboard");
  }

  const inputCls = "w-full h-11 px-4 bg-[#111317] border border-[#2D3748] rounded-lg text-[14px] text-white placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
  const labelCls = "text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5 block";

  if (loading) {
    return (
      <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex items-center justify-center">
        <PlaybookBackground />
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <PlaybookBackground />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Image src="/brand/White%20red%20logo%20@4x.png" alt="Nexus" width={32} height={32} className="object-contain" />
          <span className="font-head font-black text-white text-base tracking-[0.06em] uppercase">Nexus</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                i < step ? "bg-[#22C55E] text-white" : i === step ? "bg-[#E63946] text-white" : "bg-[#2D3748] text-[#6b7280]"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < step ? "bg-[#22C55E]" : "bg-[#2D3748]"}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-[12px] text-[#6b7280] mb-6">Étape {step + 1}/{STEPS.length} — {STEPS[step]}</p>

        {/* Card */}
        <div className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 sm:p-8 space-y-5">
          <h2 className="font-head text-xl font-black text-white uppercase tracking-tight">{STEPS[step]}</h2>

          {/* Step 0 — Identity */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Prénom <span className="text-[#EF4444]">*</span></label>
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Marc-Antoine" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Nom <span className="text-[#EF4444]">*</span></label>
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Tremblay" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Date de naissance</label>
                <input type="date" value={dateNaissance} onChange={(e) => setDateNaissance(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Année de graduation <span className="text-[#EF4444]">*</span></label>
                <select value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} className={inputCls}>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                  <option value="2028">2028</option>
                  <option value="2029">2029</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 1 — School */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Rechercher ton école <span className="text-[#EF4444]">*</span></label>
                <input
                  type="text"
                  value={schoolSearch}
                  onChange={(e) => setSchoolSearch(e.target.value)}
                  placeholder="Commence à taper le nom..."
                  className={inputCls}
                />
              </div>
              <div className="max-h-[240px] overflow-y-auto space-y-1">
                {filteredSchools.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSelectedSchoolId(s.id); setSelectedSchoolName(s.name); }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      selectedSchoolId === s.id
                        ? "bg-[#E63946]/10 border border-[#E63946]/30 text-white"
                        : "bg-[#111317] border border-[#2D3748] text-[#9CA3AF] hover:border-[#4a4d56] hover:text-white"
                    }`}
                  >
                    <p className="text-[13px] font-bold">{s.name}</p>
                    <p className="text-[11px] text-[#6b7280]">{s.region}</p>
                  </button>
                ))}
              </div>
              {selectedSchoolName && (
                <p className="text-[12px] text-[#22C55E] font-bold">Sélectionné : {selectedSchoolName}</p>
              )}
            </div>
          )}

          {/* Step 2 — Sport & Position */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Sport principal <span className="text-[#EF4444]">*</span></label>
                <div className="grid grid-cols-3 gap-2">
                  {sports.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSelectedSportId(s.id); setSelectedPositionId(""); }}
                      className={`py-2.5 rounded-lg text-[11px] font-bold transition-all ${
                        selectedSportId === s.id
                          ? "bg-[#E63946] text-white"
                          : "bg-[#111317] border border-[#2D3748] text-[#9CA3AF] hover:border-[#4a4d56] hover:text-white"
                      }`}
                    >
                      {s.nom}
                    </button>
                  ))}
                </div>
              </div>
              {positions.length > 0 && (
                <div>
                  <label className={labelCls}>Position</label>
                  <select value={selectedPositionId} onChange={(e) => setSelectedPositionId(e.target.value)} className={inputCls}>
                    <option value="">Sélectionner une position</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>{p.abreviation} — {p.nom}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Step 3 — Physical */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-[13px] text-[#6b7280]">Ces informations sont optionnelles mais aident les recruteurs à évaluer ton profil.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Taille (pieds)</label>
                  <select value={taillePieds} onChange={(e) => setTaillePieds(e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    <option value="4">4&apos;</option>
                    <option value="5">5&apos;</option>
                    <option value="6">6&apos;</option>
                    <option value="7">7&apos;</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Taille (pouces)</label>
                  <select value={taillePouces} onChange={(e) => setTaillePouces(e.target.value)} className={inputCls}>
                    <option value="">—</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={String(i)}>{i}&quot;</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Poids (lbs)</label>
                <input type="number" value={poidsLbs} onChange={(e) => setPoidsLbs(e.target.value)} placeholder="175" className={inputCls} />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-3 pt-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="flex-1 py-3 rounded-lg border border-[#2D3748] text-[#9CA3AF] font-head font-bold text-[13px] uppercase tracking-widest hover:text-white hover:border-[#4a4d56] transition-colors"
              >
                Retour
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className={`flex-1 py-3 rounded-lg font-head font-bold text-[13px] uppercase tracking-widest transition-all ${
                  canProceed()
                    ? "bg-[#E63946] text-white hover:bg-[#D42B22]"
                    : "bg-[#2D3748] text-[#6b7280] cursor-not-allowed"
                }`}
              >
                Suivant
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={saving}
                className="flex-1 py-3 rounded-lg bg-[#E63946] text-white font-head font-bold text-[13px] uppercase tracking-widest hover:bg-[#D42B22] transition-all disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : "Compléter mon profil"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
