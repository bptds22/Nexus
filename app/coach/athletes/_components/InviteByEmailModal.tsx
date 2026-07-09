"use client";

/* ═══════════════════════════════════════════════════════════════
   InviteByEmailModal — CTA roster « Inviter par courriel ».

   Le coach tape le courriel d'un orphelin (athlète coach-créé, non
   réclamé). Recherche EXACTE via autocompleteCivilUnclaimedByEmail
   (plomberie réutilisée). Match → carte + « Inviter » → RPC
   create_athlete_invitation(p_email) → le trigger envoie l'email.
   Pas de match → invite à créer l'athlète d'abord.

   Aucun nouveau chemin d'invitation : c'est le flux athlete_invitations
   (claim) existant, avec email posé.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  autocompleteMyOrphansByEmail,
  type AthleteEmailSuggestion,
} from "@/lib/coach/athleteEmailAutocomplete";
import { createAthleteInvitationLink } from "@/lib/queries/coach/createAthleteInvitation";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function InviteByEmailModal({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [looking, setLooking] = useState(false);
  const [match, setMatch] = useState<AthleteEmailSuggestion | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset complet à la fermeture.
  useEffect(() => {
    if (!open) {
      setEmail(""); setMatch(null); setNoMatch(false);
      setResult(null); setSubmitting(false); setLooking(false);
    }
  }, [open]);

  // Lookup EXACT debouncé : ne part que sur un email de format valide.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMatch(null); setNoMatch(false); setResult(null);
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) { setLooking(false); return; }
    setLooking(true);
    timerRef.current = setTimeout(async () => {
      try {
        const supabase = createClient();
        const res = await autocompleteMyOrphansByEmail(supabase, e);
        const exact = res.suggestions.find((s) => s.email.toLowerCase() === e) ?? null;
        setMatch(exact);
        setNoMatch(!exact);
      } catch {
        setNoMatch(true);
      } finally {
        setLooking(false);
      }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [email]);

  const handleInvite = useCallback(async () => {
    if (!match || submitting) return;
    setSubmitting(true);
    setResult(null);
    const supabase = createClient();
    // Email CANONIQUE de l'orphelin (pas la saisie brute) — garde-fou typo.
    const res = await createAthleteInvitationLink(supabase, match.athleteId, match.email);
    setSubmitting(false);
    if (res.error) { setResult({ ok: false, msg: res.error }); return; }
    setResult({ ok: true, msg: `Invitation envoyée à ${match.email}.` });
    onInvited?.();
  }, [match, submitting, onInvited]);

  if (!open) return null;

  const labelCls = "block text-[12px] font-bold tracking-wider uppercase text-[#6b7280] mb-1";
  const inputCls = "w-full bg-[#111317] border border-white/10 rounded-xl px-4 py-3 text-[15px] text-white placeholder:text-white/35 outline-none focus:border-[#E63946]/50";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#1A1D24] border border-[#2D3748] rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-head text-lg font-black text-white uppercase tracking-tight">Inviter par courriel</h2>
            <p className="text-[13px] text-[#9CA3AF] mt-1">Le courriel d&apos;un athlète que tu as déjà créé.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-[#6b7280] hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
          </button>
        </div>

        <label htmlFor="invite-email" className={labelCls}>Courriel de l&apos;athlète</label>
        <input
          id="invite-email"
          type="email"
          inputMode="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="athlete@exemple.ca"
          className={inputCls}
        />

        {/* États : recherche / match / pas de match / résultat */}
        <div className="mt-4 min-h-[64px]">
          {looking && (
            <p className="text-[13px] text-[#9CA3AF]">Recherche…</p>
          )}

          {!looking && match && !result && (
            <div className="bg-[#111317] border border-[#2D3748] rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold text-white truncate">{match.firstName} {match.lastName}</p>
                <p className="text-[13px] text-[#9CA3AF] truncate">{match.sportName || "—"} · {match.email}</p>
              </div>
              <button
                type="button"
                onClick={handleInvite}
                disabled={submitting}
                className="shrink-0 bg-[#E63946] text-white rounded-lg px-4 py-2.5 font-head font-bold text-[12px] uppercase tracking-widest hover:bg-[#D42B22] active:scale-95 transition-all disabled:opacity-40"
              >
                {submitting ? "Envoi…" : "Inviter"}
              </button>
            </div>
          )}

          {!looking && noMatch && !result && (
            <div className="bg-[#111317] border border-[#2D3748] rounded-xl p-4">
              <p className="text-[13px] text-[#9CA3AF]">
                Aucun athlète à ce courriel. Crée-le d&apos;abord, puis invite-le.
              </p>
              <Link
                href="/coach/athletes/create"
                className="inline-flex items-center gap-1.5 mt-2 text-[13px] font-bold text-[#E63946] hover:text-[#D42B22] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                Ajouter un athlète
              </Link>
            </div>
          )}

          {result && (
            <p className={`text-[14px] font-semibold ${result.ok ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
              {result.ok ? "✓ " : ""}{result.msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
