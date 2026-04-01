"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/* ── Props ── */
interface CareerToggleProps {
  initialOpen: boolean;
  initialSports: string[];
  initialRegions: string[];
  initialRole: "head" | "assistant" | "both" | undefined;
  initialBio: string;
  allSports: string[];
  allRegions: string[];
}

/* ── Style constants ── */
const labelCls =
  "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";
const inputCls =
  "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";

/* ── Component ── */
export default function CareerToggle({
  initialOpen,
  initialSports,
  initialRegions,
  initialRole,
  initialBio,
  allSports,
  allRegions,
}: CareerToggleProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedSports, setSelectedSports] = useState<string[]>(initialSports);
  const [selectedRegions, setSelectedRegions] = useState<string[]>(initialRegions);
  const [role, setRole] = useState<"head" | "assistant" | "both" | undefined>(initialRole);
  const [bio, setBio] = useState(initialBio);
  const [showToast, setShowToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const BIO_MAX = 300;

  /* ── Dirty check ── */
  const isDirty = useMemo(() => {
    if (isOpen !== initialOpen) return true;
    if (JSON.stringify(selectedSports.sort()) !== JSON.stringify([...initialSports].sort())) return true;
    if (JSON.stringify(selectedRegions.sort()) !== JSON.stringify([...initialRegions].sort())) return true;
    if (role !== initialRole) return true;
    if (bio !== initialBio) return true;
    return false;
  }, [isOpen, selectedSports, selectedRegions, role, bio, initialOpen, initialSports, initialRegions, initialRole, initialBio]);

  /* ── Toggle handler ── */
  const handleToggle = () => {
    if (isOpen) {
      setShowConfirm(true);
    } else {
      setIsOpen(true);
    }
  };

  const confirmOff = () => {
    setIsOpen(false);
    setShowConfirm(false);
  };

  /* ── Chip toggle ── */
  const toggleChip = (list: string[], setList: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
    setList((prev) => (prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]));
  };

  /* ── Save ── */
  const handleSave = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("coach_career_preferences")
      .upsert({
        user_id: user.id,
        is_open: isOpen,
        target_sports: selectedSports,
        target_regions: selectedRegions,
        role_type: role || null,
        bio: bio,
      }, { onConflict: "user_id" });

    if (error) {
      console.error("CareerToggle save error:", error);
      return;
    }

    if (toastTimer.current) clearTimeout(toastTimer.current);
    setShowToast(true);
    toastTimer.current = setTimeout(() => setShowToast(false), 3000);
  };

  /* ── Load existing preferences ── */
  useEffect(() => {
    async function loadPrefs() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("coach_career_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setIsOpen(data.is_open);
        setSelectedSports(data.target_sports || []);
        setSelectedRegions(data.target_regions || []);
        setRole(data.role_type);
        setBio(data.bio || "");
      }
    }
    loadPrefs();
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const radioOptions: { value: "head" | "assistant" | "both"; label: string }[] = [
    { value: "head", label: "Entraîneur-chef" },
    { value: "assistant", label: "Entraîneur adjoint" },
    { value: "both", label: "Les deux" },
  ];

  return (
    <>
      <div className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-6 border-l-[3px] border-l-[#E63946]">
        {/* Header */}
        <h3 className="font-head text-[16px] font-bold text-white">
          Opportunités d&apos;entraînement collégial
        </h3>
        <p className="text-[13px] text-[#6B7280] mt-1 mb-5">
          Rendez votre profil visible aux directeurs sportifs des CÉGEPs.
        </p>

        {/* Toggle row */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-[14px] text-white">
            Je suis ouvert aux opportunités d&apos;entraînement en CÉGEP
          </span>
          <button
            onClick={handleToggle}
            className="relative shrink-0 cursor-pointer bg-transparent border-none p-0"
            aria-label="Toggle opportunités"
          >
            <div
              className="rounded-full transition-colors duration-200"
              style={{
                width: 44,
                height: 24,
                backgroundColor: isOpen ? "#E63946" : "#2A2D35",
              }}
            >
              <div
                className="absolute top-[2px] w-[20px] h-[20px] bg-white rounded-full transition-transform duration-200"
                style={{
                  transform: isOpen ? "translateX(22px)" : "translateX(2px)",
                }}
              />
            </div>
          </button>
        </div>

        {/* Confirm dialog */}
        {showConfirm && (
          <div className="bg-[#22262E] rounded-lg p-4 mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-[13px] text-[#D1D5DB] flex-1">
              Votre profil ne sera plus visible par les directeurs CÉGEP. Continuer ?
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmOff}
                className="bg-[#E63946] text-white text-[12px] px-3 py-1.5 rounded-lg hover:bg-[#d63040] transition-colors"
              >
                Oui
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="border border-[#2A2D35] text-[#9CA3AF] text-[12px] px-3 py-1.5 rounded-lg hover:bg-[#2A2D35] transition-colors bg-transparent"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Conditional fields */}
        <div
          className="overflow-hidden transition-all duration-200 ease-out"
          style={{
            maxHeight: isOpen ? 1200 : 0,
            opacity: isOpen ? 1 : 0,
          }}
        >
          <div className="pt-5 flex flex-col gap-5">
            {/* Sports */}
            <div>
              <label className={labelCls}>Sport(s) visé(s)</label>
              <div className="flex flex-wrap gap-2">
                {allSports.map((sport) => {
                  const selected = selectedSports.includes(sport);
                  return (
                    <button
                      key={sport}
                      onClick={() => toggleChip(selectedSports, setSelectedSports, sport)}
                      className={`px-3 py-1.5 rounded-full text-[13px] transition-colors cursor-pointer border ${
                        selected
                          ? "bg-[#E63946] text-white border-[#E63946]"
                          : "bg-transparent border-[#2A2D35] text-[#9CA3AF] hover:border-[#4B5563]"
                      }`}
                    >
                      {sport}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Regions */}
            <div>
              <label className={labelCls}>Région(s) visée(s)</label>
              <div className="flex flex-wrap gap-2">
                {allRegions.map((region) => {
                  const selected = selectedRegions.includes(region);
                  return (
                    <button
                      key={region}
                      onClick={() => toggleChip(selectedRegions, setSelectedRegions, region)}
                      className={`px-3 py-1.5 rounded-full text-[13px] transition-colors cursor-pointer border ${
                        selected
                          ? "bg-[#E63946] text-white border-[#E63946]"
                          : "bg-transparent border-[#2A2D35] text-[#9CA3AF] hover:border-[#4B5563]"
                      }`}
                    >
                      {region}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Role radio group */}
            <div>
              <label className={labelCls}>Type de poste</label>
              <div className="flex flex-col gap-2.5">
                {radioOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2.5 cursor-pointer"
                  >
                    <span
                      className="flex items-center justify-center rounded-full border-2 transition-colors"
                      style={{
                        width: 18,
                        height: 18,
                        borderColor: role === opt.value ? "#E63946" : "#2A2D35",
                      }}
                    >
                      {role === opt.value && (
                        <span
                          className="rounded-full"
                          style={{
                            width: 10,
                            height: 10,
                            backgroundColor: "#E63946",
                          }}
                        />
                      )}
                    </span>
                    <span className="text-[14px] text-white">{opt.label}</span>
                    <input
                      type="radio"
                      name="career-role"
                      value={opt.value}
                      checked={role === opt.value}
                      onChange={() => setRole(opt.value)}
                      className="sr-only"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className={labelCls}>Mini-bio carrière</label>
              <textarea
                value={bio}
                onChange={(e) => {
                  if (e.target.value.length <= BIO_MAX) setBio(e.target.value);
                }}
                placeholder="8 ans d'expérience en football au secondaire, 12 athlètes placés en CÉGEP, certifié NCCP Compétition..."
                className={`${inputCls} resize-none`}
                rows={3}
              />
              <span className="text-[11px] text-[#4B5563] mt-1 block text-right">
                {bio.length}/{BIO_MAX}
              </span>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className={`self-start px-5 py-2.5 rounded-lg text-[14px] font-bold transition-colors ${
                isDirty
                  ? "bg-[#E63946] text-white hover:bg-[#d63040] cursor-pointer"
                  : "bg-[#2A2D35] text-[#4B5563] cursor-not-allowed"
              }`}
            >
              Enregistrer
            </button>

            {/* Info box */}
            <div className="bg-[rgba(230,57,70,0.04)] border-l-[3px] border-l-[#6B7280] rounded-r-lg p-4">
              <p className="text-[13px] text-[#6B7280]">
                Votre score de réputation, vos badges et votre nombre d&apos;athlètes placés
                seront visibles par les directeurs sportifs CÉGEP. Vos informations de contact
                ne seront partagées qu&apos;après votre accord explicite.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-[#22C55E] text-white text-[14px] font-bold px-5 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          Modifications enregistrées
        </div>
      )}
    </>
  );
}
