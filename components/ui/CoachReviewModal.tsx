"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

interface CoachReviewModalProps {
  coachId: string;
  coachName: string;
  athleteId: string;
  athleteName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const CRITERIA = [
  { key: "qualite_profils", label: "Qualité des profils", desc: "Les profils d'athlètes sont-ils complets et précis?" },
  { key: "reactivite", label: "Réactivité", desc: "Rapidité de réponse aux messages" },
  { key: "honnetete_evaluations", label: "Honnêteté des évaluations", desc: "Les évaluations reflètent-elles la réalité?" },
  { key: "professionnalisme", label: "Professionnalisme", desc: "Attitude et communication professionnelle" },
] as const;

type CriterionKey = typeof CRITERIA[number]["key"];

function ClickableStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: 5 }, (_, i) => {
        const star = i + 1;
        const filled = hover ? star <= hover : star <= value;
        return (
          <button
            key={i}
            type="button"
            aria-label={`${star} étoile${star > 1 ? "s" : ""}`}
            onClick={() => onChange(star)}
            onMouseEnter={() => setHover(star)}
            className="transition-transform hover:scale-110"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "#F59E0B" : "#4a4d56"} stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

export default function CoachReviewModal({
  coachId, coachName, athleteId, athleteName, onClose, onSubmitted,
}: CoachReviewModalProps) {
  const [ratings, setRatings] = useState<Record<CriterionKey, number>>({
    qualite_profils: 0, reactivite: 0, honnetete_evaluations: 0, professionnalisme: 0,
  });
  const [recommande, setRecommande] = useState<boolean | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing review
  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: existing } = await supabase
        .from("coach_reviews")
        .select("id, qualite_profils, reactivite, honnetete_evaluations, professionnalisme, recommande, commentaire")
        .eq("recruiter_id", user.id)
        .eq("coach_id", coachId)
        .eq("athlete_id", athleteId)
        .maybeSingle();

      if (existing) {
        setExistingId(existing.id);
        setRatings({
          qualite_profils: existing.qualite_profils || 0,
          reactivite: existing.reactivite || 0,
          honnetete_evaluations: existing.honnetete_evaluations || 0,
          professionnalisme: existing.professionnalisme || 0,
        });
        setRecommande(existing.recommande ?? null);
        setCommentaire(existing.commentaire || "");
      }
      setLoading(false);
    }
    check();
  }, [coachId, athleteId]);

  const noteGlobale = useMemo(() => {
    const vals = Object.values(ratings);
    const rated = vals.filter(v => v > 0);
    if (rated.length === 0) return 0;
    return Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10;
  }, [ratings]);

  const allRated = Object.values(ratings).every(v => v > 0);
  const canSubmit = allRated && recommande !== null && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const avg = (ratings.qualite_profils + ratings.reactivite + ratings.honnetete_evaluations + ratings.professionnalisme) / 4;
    const payload = {
      recruiter_id: user.id,
      coach_id: coachId,
      athlete_id: athleteId,
      qualite_profils: ratings.qualite_profils,
      reactivite: ratings.reactivite,
      honnetete_evaluations: ratings.honnetete_evaluations,
      professionnalisme: ratings.professionnalisme,
      note_globale: Math.round(avg * 10) / 10,
      recommande,
      commentaire: commentaire.trim() || null,
    };

    let error;
    if (existingId) {
      ({ error } = await supabase.from("coach_reviews").update(payload).eq("id", existingId));
    } else {
      ({ error } = await supabase.from("coach_reviews").insert(payload));
    }

    console.log("[Coach review submit]", { error, noteGlobale: avg });

    if (!error) {
      onSubmitted();
      onClose();
    }
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto animate-[modalIn_0.2s_ease-out]">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="font-head text-[18px] font-black text-white uppercase tracking-tight">Évaluer {coachName}</h3>
            <p className="text-[13px] text-[#9CA3AF] mt-1">À propos de {athleteName}</p>
          </div>
          <button type="button" aria-label="Fermer" onClick={onClose} className="w-8 h-8 rounded-full bg-[#111317] border border-[#2D3748] flex items-center justify-center text-[#6b7280] hover:text-white transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
          </button>
        </div>

        {loading ? (
          <p className="text-[13px] text-[#6b7280] py-8 text-center">Chargement...</p>
        ) : (
          <>
            {existingId && (
              <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg px-4 py-2.5 mb-5">
                <p className="text-[12px] font-bold text-[#F59E0B]">Vous avez déjà évalué ce coach pour cet athlète. Modifiez votre avis ci-dessous.</p>
              </div>
            )}

            {/* Criteria */}
            <div className="space-y-5">
              {CRITERIA.map(c => (
                <div key={c.key}>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-white">{c.label}</span>
                    <ClickableStars value={ratings[c.key]} onChange={(v) => setRatings(prev => ({ ...prev, [c.key]: v }))} />
                  </div>
                  <p className="text-[11px] text-[#6b7280] mt-0.5">{c.desc}</p>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-[#2D3748] my-5" />

            {/* Note globale */}
            <div className="flex items-center justify-between mb-5">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#6b7280]">Note globale</span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill={noteGlobale >= i + 1 ? "#F59E0B" : noteGlobale >= i + 0.5 ? "#F59E0B" : "#4a4d56"} stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                <span className="text-[16px] font-bold text-white">{noteGlobale > 0 ? noteGlobale.toFixed(1) : "—"}<span className="text-[12px] text-[#6b7280]">/5</span></span>
              </div>
            </div>

            {/* Recommendation */}
            <div className="mb-5">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#6b7280] block mb-2">Recommandez-vous ce coach?</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setRecommande(true)}
                  className={`px-5 py-2.5 rounded-lg text-[13px] font-bold transition-colors ${
                    recommande === true ? "bg-[#22C55E]/15 border border-[#22C55E] text-[#22C55E]" : "border border-[#2D3748] text-[#6b7280] hover:border-[#4a4d56]"
                  }`}
                >
                  Oui
                </button>
                <button
                  type="button"
                  onClick={() => setRecommande(false)}
                  className={`px-5 py-2.5 rounded-lg text-[13px] font-bold transition-colors ${
                    recommande === false ? "bg-[#E63946]/15 border border-[#E63946] text-[#E63946]" : "border border-[#2D3748] text-[#6b7280] hover:border-[#4a4d56]"
                  }`}
                >
                  Non
                </button>
              </div>
            </div>

            {/* Comment */}
            <div className="mb-5">
              <span className="text-[12px] font-bold uppercase tracking-wider text-[#6b7280] block mb-2">Commentaire <span className="font-normal text-[#4a4d56]">(optionnel)</span></span>
              <textarea
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                rows={3}
                placeholder="Partagez votre expérience..."
                className="w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors resize-none"
              />
              <p className="text-[11px] text-[#6b7280] italic mt-2 flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                Votre évaluation est anonyme. Le coach verra uniquement la note et le commentaire, jamais votre identité.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">Annuler</button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`px-5 py-2.5 text-[13px] font-bold rounded-lg transition-colors ${
                  canSubmit ? "bg-[#E63946] hover:bg-[#D42B22] text-white" : "bg-[#2D3748] text-[#4a4d56] cursor-not-allowed"
                }`}
              >
                {submitting ? "Envoi..." : existingId ? "Mettre à jour" : "Soumettre l'avis"}
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
