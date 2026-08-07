"use client";

/* ═══════════════════════════════════════════════════════════════
   InviteByEmailModal — CTA roster « Inviter par courriel », point d'entrée
   unique, 3 états (RPC lookup_invitable_athletes_by_email) :

   1. INVITABLE → carte + « Inviter » ; route sur has_account :
        - orphelin sans compte → createAthleteInvitationLink (email de claim)
        - compte sans coach     → inviteAthleteToTeam (team_invitations in-app)
   2. EXISTE MAIS NON-INVITABLE (rattaché) → message neutre, AUCUNE PII.
   3. INEXISTANT → « crée-le d'abord ».

   Réutilise la plomberie : lookupInvitableByEmail, createAthleteInvitationLink,
   loadCoachTeams + inviteAthleteToTeam (partagés avec le wizard).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  lookupInvitableByEmail,
  type AthleteEmailSuggestion,
} from "@/lib/coach/athleteEmailAutocomplete";
import { createAthleteInvitationLink } from "@/lib/queries/coach/createAthleteInvitation";
import { loadCoachTeams, inviteAthleteToTeam, type CoachTeamOption } from "@/lib/queries/coach/teamInvite";
import { inviteAnchoredAthlete } from "@/lib/queries/coach/inviteAnchoredAthlete";

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
  const [notInvitable, setNotInvitable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [teams, setTeams] = useState<CoachTeamOption[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  /* ── ANCRÉ AILLEURS — la sortie du cul-de-sac.
     Cet état rendait un message TERMINAL : « déjà rattaché … ne peut pas être
     invité ici », sans action. C'était la dernière des quatre surfaces à ne pas
     proposer le transfert (les deux wizards et la feuille mobile le font déjà).
     Le coach peut maintenant PROPOSER ; c'est l'athlète qui décidera. */
  const [transfertMsg, setTransfertMsg] = useState<string | null>(null);
  const [transfertOk, setTransfertOk] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Charge les équipes du coach à l'ouverture (pour la branche compte).
  useEffect(() => {
    if (!open) {
      setEmail(""); setMatch(null); setNotInvitable(false); setTransfertMsg(null); setTransfertOk(false);
      setResult(null); setSubmitting(false); setLooking(false); setTeamId(null);
      return;
    }
    (async () => {
      const t = await loadCoachTeams(createClient());
      setTeams(t);
      if (t.length === 1) setTeamId(t[0].id);
    })();
  }, [open]);

  // Lookup unifié (3 états), match sur l'email EXACT tapé.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMatch(null); setNotInvitable(false); setTransfertMsg(null); setTransfertOk(false); setResult(null);
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) { setLooking(false); return; }
    setLooking(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await lookupInvitableByEmail(createClient(), e);
        const exact = res.suggestions.find((s) => s.email.toLowerCase() === e) ?? null;
        setMatch(exact);
        setNotInvitable(!exact && res.existsNotInvitable);
      } catch {
        setNotInvitable(false); setTransfertMsg(null); setTransfertOk(false);
      } finally {
        setLooking(false);
      }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [email]);

  /* Transfert proposé à un athlète ancré ailleurs. DISTINCT de handleInvite :
     celui-là part d'un athlète IDENTIFIÉ par une suggestion (athleteId connu) ;
     ici on part d'un courriel OPAQUE — le drapeau `notInvitable` arrive seul,
     sans nom ni identifiant (choix Loi 25). La RPC résout le courriel côté
     serveur et ne rend qu'un code de statut, donc le coach n'apprend rien de
     plus qu'avant. N'écrit QUE dans team_invitations. */
  const handleTransfert = useCallback(async () => {
    const e = email.trim().toLowerCase();
    if (!e || !teamId || submitting) return;
    setSubmitting(true);
    setTransfertMsg(null);
    const r = await inviteAnchoredAthlete(createClient(), e, teamId);
    setSubmitting(false);
    setTransfertOk(r.ok);
    setTransfertMsg(r.message || "Invitation envoyée — il devra l'accepter.");
  }, [email, teamId, submitting]);

  const handleInvite = useCallback(async () => {
    if (!match || submitting) return;
    setSubmitting(true);
    setResult(null);
    const supabase = createClient();
    if (match.hasAccount) {
      // Compte existant → invitation d'équipe in-app (team_invitations).
      if (!teamId) { setResult({ ok: false, msg: "Choisis une équipe." }); setSubmitting(false); return; }
      const res = await inviteAthleteToTeam(supabase, match.athleteId, teamId);
      setSubmitting(false);
      if (res.error) { setResult({ ok: false, msg: res.error }); return; }
      setResult({ ok: true, msg: `Invitation d'équipe envoyée à ${match.firstName} ${match.lastName}.` });
    } else {
      // Orphelin sans compte → email de claim (email CANONIQUE, anti-typo).
      const res = await createAthleteInvitationLink(supabase, match.athleteId, match.email);
      setSubmitting(false);
      if (res.error) { setResult({ ok: false, msg: res.error }); return; }
      setResult({ ok: true, msg: `Invitation envoyée à ${match.email}.` });
    }
    onInvited?.();
  }, [match, submitting, teamId, onInvited]);

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
            <p className="text-[13px] text-[#9CA3AF] mt-1">Le courriel d&apos;un athlète à inviter.</p>
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

        <div className="mt-4 min-h-[64px]">
          {looking && <p className="text-[13px] text-[#9CA3AF]">Recherche…</p>}

          {/* État 1 : invitable → carte + invite */}
          {!looking && match && !result && (
            <div className="bg-[#111317] border border-[#2D3748] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-white truncate">{match.firstName} {match.lastName}</p>
                  <p className="text-[13px] text-[#9CA3AF] truncate">{match.sportName || "—"} · {match.email}</p>
                </div>
                <button
                  type="button"
                  onClick={handleInvite}
                  disabled={submitting || (match.hasAccount && !teamId && teams.length !== 1)}
                  className="shrink-0 bg-[#E63946] text-white rounded-lg px-4 py-2.5 font-head font-bold text-[12px] uppercase tracking-widest hover:bg-[#D42B22] active:scale-95 transition-all disabled:opacity-40"
                >
                  {submitting ? "Envoi…" : "Inviter"}
                </button>
              </div>

              {/* Branche compte → équipe requise */}
              {match.hasAccount && teams.length > 1 && (
                <div>
                  <label className={labelCls}>Inviter sur quelle équipe ?</label>
                  <select
                    value={teamId ?? ""}
                    onChange={(e) => setTeamId(e.target.value || null)}
                    className={`${inputCls} appearance-none`}
                    title="Équipe d'invitation"
                  >
                    <option value="">Sélectionne une équipe</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              {match.hasAccount && teams.length === 1 && (
                <p className="text-[13px] text-[#9CA3AF]">Équipe : <span className="text-white font-semibold">{teams[0].name}</span></p>
              )}
              {match.hasAccount && teams.length === 0 && (
                <p className="text-[13px] text-[#F59E0B]">Aucune équipe — crées-en une dans « Mes équipes » pour inviter un athlète avec compte.</p>
              )}
              {match.hasAccount && (
                <p className="text-[12px] text-[#6b7280]">Compte existant → invitation d&apos;équipe (in-app).</p>
              )}
            </div>
          )}

          {/* État 2 : existe mais ANCRÉ AILLEURS (zéro PII).
              Le message terminal a disparu : le coach peut PROPOSER. */}
          {!looking && !match && notInvitable && !result && (
            <div className="bg-[#111317] border border-[#F59E0B]/30 rounded-xl p-4 space-y-3">
              <p className="text-[13px] text-[#9CA3AF] leading-relaxed">
                Cet athlète est déjà rattaché à une autre équipe. Tu peux l&apos;inviter
                à rejoindre la tienne — <span className="text-white">c&apos;est lui qui décidera.</span>
              </p>
              {teams.length === 0 ? (
                <p className="text-[13px] text-[#F59E0B]">
                  Aucune équipe — crées-en une dans « Mes équipes ».
                </p>
              ) : (
                <>
                  {teams.length > 1 && (
                    <div>
                      <label className={labelCls}>Inviter sur quelle équipe ?</label>
                      <select
                        value={teamId ?? ""}
                        onChange={(e) => setTeamId(e.target.value || null)}
                        className={`${inputCls} appearance-none`}
                        title="Équipe d'accueil"
                      >
                        <option value="">Sélectionne une équipe</option>
                        {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  )}
                  {teams.length === 1 && (
                    <p className="text-[13px] text-[#9CA3AF]">
                      Équipe : <span className="text-white font-semibold">{teams[0].name}</span>
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleTransfert()}
                    disabled={submitting || !teamId || transfertOk}
                    className="w-full px-4 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Envoi…" : "Inviter à rejoindre mon équipe"}
                  </button>
                </>
              )}
              {transfertMsg && (
                <p className={`text-[13px] font-semibold ${transfertOk ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                  {transfertOk ? "✓ " : ""}{transfertMsg}
                </p>
              )}
            </div>
          )}

          {/* État 3 : inexistant */}
          {!looking && !match && !notInvitable && !result && EMAIL_RE.test(email.trim().toLowerCase()) && (
            <div className="bg-[#111317] border border-[#2D3748] rounded-xl p-4">
              <p className="text-[13px] text-[#9CA3AF]">Aucun athlète à ce courriel. Crée-le d&apos;abord, puis invite-le.</p>
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
