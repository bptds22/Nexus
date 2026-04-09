"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import SportPositionSelect from "@/app/coach/components/SportPositionSelect";
import DatePicker from "@/app/coach/components/DatePicker";

const SPORTS = [
  "Football", "Basketball", "Soccer", "Hockey", "Volleyball",
  "Athlétisme", "Flag football", "Rugby", "Cheerleading",
  "Natation", "Badminton", "Cross-country", "Futsal",
  "Baseball", "Ultimate frisbee", "Autre",
];
import PlaybookBackground from "@/app/components/PlaybookBackground";

/* ─────────────────────────────────────────────────────────────────
   Athlete Onboarding — Same fields as coach create form,
   adapted for athlete self-registration.
   Steps: 1. Identité  2. Académique  3. Physique  4. Sport & Médias
───────────────────────────────────────────────────────────────── */

const STEPS = [
  { number: 1, name: "Identité" },
  { number: 2, name: "Académique" },
  { number: 3, name: "Physique" },
  { number: 4, name: "Sport & Médias" },
];

const CEGEP_REGIONS = [
  "Montréal", "Québec", "Laurentides", "Lanaudière",
  "Montérégie", "Outaouais", "Estrie", "Sherbrooke",
];

const SUBJECTS = [
  "Éducation physique", "Mathématiques", "Sciences", "Français",
  "Anglais", "Histoire", "Arts", "Informatique",
];

const cardCls = "bg-[#1A1D24] rounded-xl border border-[#2D3748] p-6 sm:p-8";
const inputCls = "w-full h-11 px-4 bg-[#111317] border border-[#2D3748] rounded-lg text-[14px] text-white placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const labelCls = "text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-1.5 block";
const sectionTitle = "text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280] mb-4 flex items-center gap-2";

export default function AthleteOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [existingAthleteId, setExistingAthleteId] = useState<string | null>(null);

  // Step 1 — Identity
  const [photo, setPhoto] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gradYear, setGradYear] = useState("2026");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // School
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schools, setSchools] = useState<{ id: string; name: string; region: string }[]>([]);
  const [filteredSchools, setFilteredSchools] = useState<{ id: string; name: string; region: string }[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [selectedSchoolName, setSelectedSchoolName] = useState("");

  // Step 2 — Academic
  const [gpa, setGpa] = useState("");
  const [strongSubjects, setStrongSubjects] = useState<string[]>([]);
  const [academicHonors, setAcademicHonors] = useState<string[]>([]);
  const [cegepType, setCegepType] = useState("");
  const [cegepProgramDetail, setCegepProgramDetail] = useState("");
  const [openToPrivate, setOpenToPrivate] = useState(false);
  const [openToAnglophone, setOpenToAnglophone] = useState(false);
  const [openToRelocate, setOpenToRelocate] = useState(false);
  const [cegepRegions, setCegepRegions] = useState<string[]>([]);

  // Step 3 — Physical
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [dominantHand, setDominantHand] = useState("");
  const [dominantFoot, setDominantFoot] = useState("");

  // Step 4 — Sport & Media
  const [primarySport, setPrimarySport] = useState("");
  const [primaryPosition, setPrimaryPosition] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [highlightVideo, setHighlightVideo] = useState("");
  const [hudlLink, setHudlLink] = useState("");
  const [youtubeLink, setYoutubeLink] = useState("");
  const [instagramLink, setInstagramLink] = useState("");

  // Parent / Guardian
  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentRelationship, setParentRelationship] = useState("");
  const [consentProfile, setConsentProfile] = useState(false);
  const [consentVisibility, setConsentVisibility] = useState(false);
  const [consentComms, setConsentComms] = useState(false);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      setUserId(user.id);
      if (user.email) setEmail(user.email);

      // Pre-fill from user_metadata (set during signUp), then users table as fallback
      const meta = user.user_metadata || {};
      if (meta.first_name) setFirstName(meta.first_name as string);
      if (meta.last_name) setLastName(meta.last_name as string);
      if (meta.sport) setPrimarySport(meta.sport as string);

      // Fallback: try users table if metadata is empty
      if (!meta.first_name) {
        const { data: userRow } = await supabase.from("users").select("first_name, last_name").eq("id", user.id).single();
        if (userRow?.first_name) setFirstName(userRow.first_name);
        if (userRow?.last_name) setLastName(userRow.last_name);
      }

      console.log("[Onboarding] pre-fill from metadata:", { first_name: meta.first_name, last_name: meta.last_name, sport: meta.sport });

      // Check if athlete row exists
      const { data: existing } = await supabase
        .from("athletes")
        .select("id, first_name, last_name, school_id, sport_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        setExistingAthleteId(existing.id);
        if (existing.first_name && existing.last_name && existing.school_id && existing.sport_id) {
          router.replace("/athlete/dashboard");
          return;
        }
      }

      // Load schools
      const { data: schoolData } = await supabase.from("schools").select("id, name, region").order("name");
      if (schoolData) {
        setSchools(schoolData);
        setFilteredSchools(schoolData.slice(0, 15));
      }

      setLoading(false);
    }
    init();
  }, [router]);

  // Filter schools on search
  useEffect(() => {
    if (schoolSearch.length < 2) {
      setFilteredSchools(schools.slice(0, 15));
    } else {
      const q = schoolSearch.toLowerCase();
      setFilteredSchools(schools.filter((s) => (s.name && s.name.toLowerCase().includes(q)) || (s.region && s.region.toLowerCase().includes(q))).slice(0, 15));
    }
  }, [schoolSearch, schools]);

  function canProceed(): boolean {
    switch (step) {
      case 1: return !!(firstName.trim() && lastName.trim() && selectedSchoolId && gradYear && parentFirstName.trim() && parentLastName.trim() && parentEmail.trim() && consentProfile && consentVisibility);
      case 2: return true; // academic is optional
      case 3: return true; // physical is optional
      case 4: return !!primarySport;
      default: return false;
    }
  }

  async function handleSubmit() {
    if (!userId || !primarySport) return;
    if (!consentProfile || !consentVisibility) return;
    setSaving(true);
    console.log("[Onboarding] submitting...", { userId, firstName, lastName, primarySport, selectedSchoolId });

    try {
    const supabase = createClient();

    // Resolve sport_id
    const { data: sportData } = await supabase.from("sports").select("id").eq("nom", primarySport).single();

    // Resolve position_id
    let positionId = null;
    if (primaryPosition && sportData?.id) {
      const { data: posData } = await supabase.from("positions").select("id").eq("abreviation", primaryPosition).eq("sport_id", sportData.id).maybeSingle();
      positionId = posData?.id || null;
    }

    const athleteRecord = {
      user_id: userId,
      school_id: selectedSchoolId || null,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_naissance: dateOfBirth || null,
      genre: gender || null,
      photo_url: photo || null,
      email: email || null,
      telephone: phone || null,
      annee_diplomation: gradYear ? parseInt(gradYear) : null,
      moyenne_generale: gpa ? parseFloat(gpa) : null,
      matieres_fortes: strongSubjects,
      mentions_academiques: academicHonors,
      programme_cegep_vise: (() => {
        if (cegepType === "dec_general") return ["DEC général"];
        if (cegepType === "technique" && cegepProgramDetail) return ["Technique — " + cegepProgramDetail];
        if (cegepType === "technique") return ["Programme technique"];
        return [];
      })(),
      ouvert_cegep_prive: openToPrivate,
      ouvert_cegep_anglophone: openToAnglophone,
      pret_changer_region: openToRelocate,
      regions_cegep_preferees: cegepRegions,
      taille_pieds: heightFeet ? parseInt(heightFeet) : null,
      taille_pouces: heightInches ? parseInt(heightInches) : null,
      poids_lbs: weightLbs ? parseFloat(weightLbs) : null,
      main_dominante: dominantHand || null,
      pied_dominant: dominantFoot || null,
      sport_id: sportData?.id || null,
      position_id: positionId,
      numero_jersey: jerseyNumber || null,
      video_faits_saillants_url: highlightVideo || null,
      hudl_url: hudlLink || null,
      youtube_url: youtubeLink || null,
      instagram_url: instagramLink || null,
      // Parent / Guardian
      nom_parent: `${parentFirstName.trim()} ${parentLastName.trim()}`.trim() || null,
      parent_first_name: parentFirstName.trim() || null,
      parent_last_name: parentLastName.trim() || null,
      parent_email: parentEmail.trim() || null,
      telephone_parent: parentPhone.trim() || null,
      parent_relationship: parentRelationship || null,
      consentement_parental: consentProfile && consentVisibility,
      consentement_parental_date: (consentProfile && consentVisibility) ? new Date().toISOString() : null,
      status: "ACTIF",
      verified: false,
    };

    if (existingAthleteId) {
      const { error } = await supabase.from("athletes").update(athleteRecord).eq("id", existingAthleteId);
      console.log("[Onboarding] update:", error);
      if (error) { console.error("[Onboarding] update failed:", error); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("athletes").insert(athleteRecord);
      console.log("[Onboarding] insert:", error);
      if (error) { console.error("[Onboarding] insert failed:", error); setSaving(false); return; }
    }

    await supabase.from("users").update({ onboarding_complete: true }).eq("id", userId);
    setSaving(false);
    router.replace("/athlete/dashboard");
    } catch (err) {
      console.error("[Onboarding] unexpected error:", err);
      setSaving(false);
    }
  }

  function toggleInArray(arr: string[], item: string, setter: (v: string[]) => void) {
    setter(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  }

  const pillCls = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors cursor-pointer ${
      active ? "bg-[#E63946]/15 text-[#E63946] border border-[#E63946]/30" : "bg-[#13151a] text-[#6b7280] border border-[#2D3748] hover:text-white hover:border-[#4a4d56]"
    }`;

  if (loading) {
    return (
      <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex items-center justify-center">
        <PlaybookBackground />
        <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="hero-playbook nx-no-glow bg-[#111317] min-h-screen flex flex-col items-center px-4 py-8">
      <PlaybookBackground />

      <div className="relative z-10 w-full max-w-2xl space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <Image src="/brand/White%20red%20logo%20@4x.png" alt="Nexus" width={32} height={32} className="object-contain" />
          <span className="font-head font-black text-white text-base tracking-[0.06em] uppercase">Nexus</span>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.number} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => { if (s.number < step || canProceed()) setStep(s.number); }}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                  s.number < step ? "bg-[#22C55E] text-white" : s.number === step ? "bg-[#E63946] text-white" : "bg-[#2D3748] text-[#6b7280]"
                }`}
              >
                {s.number < step ? "✓" : s.number}
              </button>
              {i < STEPS.length - 1 && <div className={`w-6 sm:w-10 h-0.5 ${s.number < step ? "bg-[#22C55E]" : "bg-[#2D3748]"}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-[12px] text-[#6b7280]">Étape {step}/{STEPS.length} — {STEPS[step - 1].name}</p>

        {/* ═══════ STEP 1: IDENTITÉ ═══════ */}
        {step === 1 && (
          <div className={cardCls}>
            <h2 className="font-head text-xl font-black text-white uppercase tracking-tight mb-1">Identité</h2>
            <p className="text-[14px] text-[#6b7280] mb-6">Tes informations personnelles de base</p>

            {/* Photo */}
            <div className="flex items-center gap-5 mb-6">
              <div className="relative group shrink-0">
                {photo ? (
                  <img src={photo} alt="Photo" className="w-[80px] h-[80px] rounded-xl object-cover border-2 border-[#2a2d36]" />
                ) : (
                  <div className="w-[80px] h-[80px] rounded-xl bg-[#13151a] border-2 border-dashed border-[#2a2d36] flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                  <input type="file" accept="image/*" className="hidden" title="Photo" onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setPhoto(URL.createObjectURL(f));
                    const supabase = createClient();
                    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
                    const path = `athletes/${user.id}/${Date.now()}.${f.name.split(".").pop()}`;
                    await supabase.storage.from("avatars").upload(path, f, { upsert: true });
                    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
                    setPhoto(urlData.publicUrl);
                  }} />
                </label>
              </div>
              <div>
                <p className="text-[13px] font-bold text-white">Ta photo</p>
                <p className="text-[12px] text-[#4a4d56]">Pour ta carte joueur. JPG ou PNG.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className={labelCls}>Prénom <span className="text-[#EF4444]">*</span></label><input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Prénom" className={inputCls} /></div>
              <div><label className={labelCls}>Nom <span className="text-[#EF4444]">*</span></label><input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nom" className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className={labelCls}>Genre</label>
                <select title="Genre" value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}><option value="">—</option><option value="M">Masculin</option><option value="F">Féminin</option><option value="X">Autre</option></select>
              </div>
              <div><label className={labelCls}>Date de naissance</label><DatePicker value={dateOfBirth} onChange={setDateOfBirth} placeholder="Sélectionner une date" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className={labelCls}>Année de graduation <span className="text-[#EF4444]">*</span></label>
                <select title="Graduation" value={gradYear} onChange={(e) => setGradYear(e.target.value)} className={inputCls}><option value="2026">2026</option><option value="2027">2027</option><option value="2028">2028</option><option value="2029">2029</option></select>
              </div>
              <div><label className={labelCls}>Courriel</label><input type="email" title="Courriel" placeholder="courriel@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputCls} text-[#6b7280]`} readOnly /></div>
            </div>
            <div className="mb-4"><label className={labelCls}>Téléphone</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="514-000-0000" className={inputCls} /></div>

            {/* School selection */}
            <div className={sectionTitle}><div className="w-0.5 h-4 bg-[#E63946] rounded-full" />Mon école <span className="text-[#EF4444]">*</span></div>
            <input type="text" value={schoolSearch} onChange={(e) => setSchoolSearch(e.target.value)} placeholder="Rechercher ton école..." className={`${inputCls} mb-3`} />
            <div className="max-h-[180px] overflow-y-auto space-y-1 mb-2">
              {filteredSchools.map((s) => (
                <button key={s.id} type="button" onClick={() => { setSelectedSchoolId(s.id); setSelectedSchoolName(s.name); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors text-[13px] ${selectedSchoolId === s.id ? "bg-[#E63946]/10 border border-[#E63946]/30 text-white font-bold" : "bg-[#111317] border border-[#2D3748] text-[#9CA3AF] hover:border-[#4a4d56]"}`}>
                  {s.name} <span className="text-[11px] text-[#4a4d56]">· {s.region}</span>
                </button>
              ))}
            </div>
            {selectedSchoolName && <p className="text-[12px] text-[#22C55E] font-bold mb-6">✓ {selectedSchoolName}</p>}

            {/* Parent / Guardian */}
            <div className={sectionTitle}><div className="w-0.5 h-4 bg-[#E63946] rounded-full" />Parent / Tuteur</div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className={labelCls}>Prénom du parent <span className="text-[#EF4444]">*</span></label><input type="text" value={parentFirstName} onChange={(e) => setParentFirstName(e.target.value)} placeholder="Prénom" className={inputCls} /></div>
              <div><label className={labelCls}>Nom du parent <span className="text-[#EF4444]">*</span></label><input type="text" value={parentLastName} onChange={(e) => setParentLastName(e.target.value)} placeholder="Nom" className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className={labelCls}>Courriel du parent <span className="text-[#EF4444]">*</span></label><input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} placeholder="courriel@exemple.com" className={inputCls} /></div>
              <div><label className={labelCls}>Téléphone du parent</label><input type="tel" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="514-000-0000" className={inputCls} /></div>
            </div>
            <div className="mb-6">
              <label className={labelCls}>Lien de parenté</label>
              <select title="Lien de parenté" value={parentRelationship} onChange={(e) => setParentRelationship(e.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="Père">Père</option>
                <option value="Mère">Mère</option>
                <option value="Tuteur légal">Tuteur légal</option>
                <option value="Autre">Autre</option>
              </select>
            </div>

            {/* Parental Consent */}
            <div className={sectionTitle}><div className="w-0.5 h-4 bg-[#E63946] rounded-full" />Consentement parental</div>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={consentProfile} onChange={(e) => setConsentProfile(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentProfile ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56] group-hover:border-[#6b7280]"}`}>
                  {consentProfile && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span className="text-[12px] text-[#9CA3AF] leading-snug">Je confirme que mon parent ou tuteur légal autorise la création de mon profil athlète sur Nexus. <span className="text-[#EF4444]">*</span></span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={consentVisibility} onChange={(e) => setConsentVisibility(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentVisibility ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56] group-hover:border-[#6b7280]"}`}>
                  {consentVisibility && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span className="text-[12px] text-[#9CA3AF] leading-snug">Mon parent ou tuteur légal consent à ce que mes informations sportives et académiques soient visibles par les recruteurs des CÉGEP. <span className="text-[#EF4444]">*</span></span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input type="checkbox" checked={consentComms} onChange={(e) => setConsentComms(e.target.checked)} className="sr-only" />
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${consentComms ? "bg-[#E63946] border-[#E63946]" : "border-[#4a4d56] group-hover:border-[#6b7280]"}`}>
                  {consentComms && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                </div>
                <span className="text-[12px] text-[#6b7280] leading-snug">Mon parent ou tuteur accepte de recevoir des communications de Nexus concernant mon recrutement. <span className="text-[10px] text-[#4a4d56]">(optionnel)</span></span>
              </label>
            </div>
          </div>
        )}

        {/* ═══════ STEP 2: ACADÉMIQUE ═══════ */}
        {step === 2 && (
          <div className={cardCls}>
            <h2 className="font-head text-xl font-black text-white uppercase tracking-tight mb-1">Académique</h2>
            <p className="text-[14px] text-[#6b7280] mb-6">Ton parcours scolaire et tes préférences CÉGEP</p>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div><label className={labelCls}>Moyenne générale (%)</label><input type="number" value={gpa} onChange={(e) => setGpa(e.target.value)} placeholder="78" min="0" max="100" className={inputCls} /></div>
              <div><label className={labelCls}>Programme CÉGEP visé</label>
                <select title="Programme" value={cegepType} onChange={(e) => setCegepType(e.target.value)} className={inputCls}><option value="">—</option><option value="dec_general">DEC général</option><option value="technique">Programme technique</option></select>
              </div>
            </div>
            {cegepType === "technique" && (
              <div className="mb-5"><label className={labelCls}>Précise le programme</label><input type="text" value={cegepProgramDetail} onChange={(e) => setCegepProgramDetail(e.target.value)} placeholder="Ex: Soins infirmiers" className={inputCls} /></div>
            )}

            <div className={sectionTitle}><div className="w-0.5 h-4 bg-[#E63946] rounded-full" />Matières fortes</div>
            <div className="flex flex-wrap gap-2 mb-5">
              {SUBJECTS.map((s) => <button key={s} type="button" onClick={() => toggleInArray(strongSubjects, s, setStrongSubjects)} className={pillCls(strongSubjects.includes(s))}>{s}</button>)}
            </div>

            <div className={sectionTitle}><div className="w-0.5 h-4 bg-[#E63946] rounded-full" />Mentions académiques</div>
            <div className="flex flex-wrap gap-2 mb-5">
              {["Tableau d'honneur", "Bourse sportive", "Étudiant-athlète de l'année", "Mention du directeur"].map((h) => (
                <button key={h} type="button" onClick={() => toggleInArray(academicHonors, h, setAcademicHonors)} className={pillCls(academicHonors.includes(h))}>{h}</button>
              ))}
            </div>

            <div className={sectionTitle}><div className="w-0.5 h-4 bg-[#E63946] rounded-full" />Préférences CÉGEP</div>
            <div className="flex flex-wrap gap-3 mb-4">
              {[
                { label: "Ouvert au privé", val: openToPrivate, set: setOpenToPrivate },
                { label: "Ouvert anglophone", val: openToAnglophone, set: setOpenToAnglophone },
                { label: "Ouvert à déménager", val: openToRelocate, set: setOpenToRelocate },
              ].map((p) => (
                <button key={p.label} type="button" onClick={() => p.set(!p.val)} className={pillCls(p.val)}>{p.label}</button>
              ))}
            </div>
            {openToRelocate && (
              <div className="mb-4">
                <label className={labelCls}>Régions CÉGEP préférées</label>
                <div className="flex flex-wrap gap-2">
                  {CEGEP_REGIONS.map((r) => <button key={r} type="button" onClick={() => toggleInArray(cegepRegions, r, setCegepRegions)} className={pillCls(cegepRegions.includes(r))}>{r}</button>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ STEP 3: PHYSIQUE ═══════ */}
        {step === 3 && (
          <div className={cardCls}>
            <h2 className="font-head text-xl font-black text-white uppercase tracking-tight mb-1">Profil physique</h2>
            <p className="text-[14px] text-[#6b7280] mb-6">Tes mensurations aident les recruteurs à évaluer ton profil</p>

            <div className="grid grid-cols-3 gap-4 mb-5">
              <div><label className={labelCls}>Taille (pieds)</label>
                <select title="Pieds" value={heightFeet} onChange={(e) => setHeightFeet(e.target.value)} className={inputCls}><option value="">—</option>{[4,5,6,7].map((v) => <option key={v} value={String(v)}>{v}&apos;</option>)}</select>
              </div>
              <div><label className={labelCls}>Taille (pouces)</label>
                <select title="Pouces" value={heightInches} onChange={(e) => setHeightInches(e.target.value)} className={inputCls}><option value="">—</option>{Array.from({length:12},(_,i)=><option key={i} value={String(i)}>{i}&quot;</option>)}</select>
              </div>
              <div><label className={labelCls}>Poids (lbs)</label><input type="number" value={weightLbs} onChange={(e) => setWeightLbs(e.target.value)} placeholder="175" className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Main dominante</label>
                <select title="Main dominante" value={dominantHand} onChange={(e) => setDominantHand(e.target.value)} className={inputCls}><option value="">—</option><option value="Droite">Droite</option><option value="Gauche">Gauche</option><option value="Ambidextre">Ambidextre</option></select>
              </div>
              <div><label className={labelCls}>Pied dominant</label>
                <select title="Pied dominant" value={dominantFoot} onChange={(e) => setDominantFoot(e.target.value)} className={inputCls}><option value="">—</option><option value="Droit">Droit</option><option value="Gauche">Gauche</option><option value="Les deux">Les deux</option></select>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ STEP 4: SPORT & MÉDIAS ═══════ */}
        {step === 4 && (
          <div className={cardCls}>
            <h2 className="font-head text-xl font-black text-white uppercase tracking-tight mb-1">Sport & Médias</h2>
            <p className="text-[14px] text-[#6b7280] mb-6">Ton sport principal et tes liens vidéo</p>

            <div className="space-y-4">
              <div>
                <label className={labelCls}>Sport principal <span className="text-[#EF4444]">*</span></label>
                <div className="grid grid-cols-4 gap-2">
                  {SPORTS.map((s) => (
                    <button key={s} type="button" onClick={() => { setPrimarySport(s); setPrimaryPosition(""); }}
                      className={`py-2 rounded-lg text-[11px] font-bold transition-all ${primarySport === s ? "bg-[#E63946] text-white" : "bg-[#111317] border border-[#2D3748] text-[#9CA3AF] hover:border-[#4a4d56] hover:text-white"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {primarySport && (
                <SportPositionSelect
                  sport={primarySport}
                  value={primaryPosition}
                  onChange={setPrimaryPosition}
                  label="Position"
                />
              )}
            </div>

            <div className="mt-5 mb-5">
              <label className={labelCls}>Numéro de jersey</label>
              <input type="text" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} placeholder="12" className={`${inputCls} max-w-[120px]`} />
            </div>

            <div className={sectionTitle}><div className="w-0.5 h-4 bg-[#E63946] rounded-full" />Liens vidéo</div>
            <div className="space-y-3">
              <div><label className={labelCls}>Faits saillants</label><input type="url" value={highlightVideo} onChange={(e) => setHighlightVideo(e.target.value)} placeholder="https://..." className={inputCls} /></div>
              <div><label className={labelCls}>Hudl</label><input type="url" value={hudlLink} onChange={(e) => setHudlLink(e.target.value)} placeholder="https://hudl.com/..." className={inputCls} /></div>
              <div><label className={labelCls}>YouTube</label><input type="url" value={youtubeLink} onChange={(e) => setYoutubeLink(e.target.value)} placeholder="https://youtube.com/..." className={inputCls} /></div>
              <div><label className={labelCls}>Instagram</label><input type="url" value={instagramLink} onChange={(e) => setInstagramLink(e.target.value)} placeholder="https://instagram.com/..." className={inputCls} /></div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button type="button" onClick={() => setStep(step - 1)}
              className="flex-1 py-3.5 rounded-lg border border-[#2D3748] text-[#9CA3AF] font-head font-bold text-[13px] uppercase tracking-widest hover:text-white hover:border-[#4a4d56] transition-colors">
              Retour
            </button>
          )}
          {step < 4 ? (
            <button type="button" onClick={() => setStep(step + 1)} disabled={!canProceed()}
              className={`flex-1 py-3.5 rounded-lg font-head font-bold text-[13px] uppercase tracking-widest transition-all ${
                canProceed() ? "bg-[#E63946] text-white hover:bg-[#D42B22]" : "bg-[#2D3748] text-[#6b7280] cursor-not-allowed"
              }`}>
              Suivant
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving || !canProceed()}
              className="flex-1 py-3.5 rounded-lg bg-[#E63946] text-white font-head font-bold text-[13px] uppercase tracking-widest hover:bg-[#D42B22] transition-all disabled:opacity-50">
              {saving ? "Enregistrement..." : "Compléter mon profil"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
