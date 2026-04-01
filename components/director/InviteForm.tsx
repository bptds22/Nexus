"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ── style constants (matching recruiter settings) ── */
const labelCls =
  "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";
const inputCls =
  "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";

/* ── props ── */
interface InviteFormProps {
  portalType: "ecole" | "cegep";
  sports: string[];
}

const ROLE_OPTIONS = ["Entraîneur-chef", "Entraîneur adjoint", "Coordonnateur"];

export default function InviteForm({ portalType, sports }: InviteFormProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [role, setRole] = useState(ROLE_OPTIONS[0]);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  /* ── helpers ── */
  const toggleSport = (s: string) =>
    setSelectedSports((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = "Requis";
    else if (!isValidEmail(email)) e.email = "Format invalide";
    if (!firstName.trim()) e.firstName = "Requis";
    if (!lastName.trim()) e.lastName = "Requis";
    if (selectedSports.length === 0) e.sports = "Sélectionnez au moins 1 sport";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: userRow } = await supabase
      .from("users")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!userRow?.school_id) {
      setToast("École introuvable.");
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const { error } = await supabase
      .from("director_invitations")
      .insert({
        school_id: userRow.school_id,
        invited_by: user.id,
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        sports: selectedSports,
        message: message.trim() || null,
        status: "PENDING",
      });

    if (error) {
      console.error("Invite error:", error);
      setToast("Erreur lors de l'envoi.");
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setToast(`Invitation envoyée à ${email}`);
    setTimeout(() => setToast(null), 3000);

    setEmail("");
    setFirstName("");
    setLastName("");
    setSelectedSports([]);
    setRole(ROLE_OPTIONS[0]);
    setMessage("");
    setErrors({});

    window.dispatchEvent(new Event("invitation-sent"));
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="bg-[#1A1D24] rounded-xl border border-[#1e2128] p-6 sm:p-7"
      >
        <div className="space-y-5">
          {/* Courriel */}
          <div>
            <label className={labelCls}>Courriel</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@ecole.qc.ca"
              className={`${inputCls} ${errors.email ? "border-[#E63946]" : ""}`}
            />
            {errors.email && (
              <p className="text-[#E63946] text-[12px] mt-1">{errors.email}</p>
            )}
          </div>

          {/* Prénom + Nom */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Prénom</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jean"
                className={`${inputCls} ${errors.firstName ? "border-[#E63946]" : ""}`}
              />
              {errors.firstName && (
                <p className="text-[#E63946] text-[12px] mt-1">{errors.firstName}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Nom</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Tremblay"
                className={`${inputCls} ${errors.lastName ? "border-[#E63946]" : ""}`}
              />
              {errors.lastName && (
                <p className="text-[#E63946] text-[12px] mt-1">{errors.lastName}</p>
              )}
            </div>
          </div>

          {/* Sport(s) chips */}
          <div>
            <label className={labelCls}>Sport(s)</label>
            <div className="flex flex-wrap gap-2">
              {sports.map((s) => {
                const sel = selectedSports.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSport(s)}
                    className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
                      sel
                        ? "bg-[#E63946] text-white"
                        : "bg-transparent border border-[#2A2D35] text-[#9CA3AF] hover:border-[#E63946] hover:text-white"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            {errors.sports && (
              <p className="text-[#E63946] text-[12px] mt-1">{errors.sports}</p>
            )}
          </div>

          {/* Rôle (CÉGEP only) */}
          {portalType === "cegep" && (
            <div>
              <label className={labelCls}>Rôle</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={inputCls}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Message personnalisé */}
          <div>
            <label className={labelCls}>Message personnalisé</label>
            <textarea
              value={message}
              onChange={(e) =>
                e.target.value.length <= 500 && setMessage(e.target.value)
              }
              placeholder="Joignez-vous à Nexus pour mettre en valeur vos athlètes!"
              rows={3}
              className={`${inputCls} resize-none`}
            />
            <p className="text-[11px] text-[#6B7280] mt-1 text-right">
              {message.length}/500
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="bg-[#E63946] hover:bg-[#D93C3C] text-white font-head font-bold text-[13px] uppercase tracking-[0.12em] rounded-lg px-6 h-11 transition-colors"
          >
            Envoyer l&apos;invitation
          </button>
        </div>
      </form>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1A1D24] border border-[#22C55E] text-[#22C55E] text-[13px] font-medium px-5 py-3 rounded-lg shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
    </>
  );
}
