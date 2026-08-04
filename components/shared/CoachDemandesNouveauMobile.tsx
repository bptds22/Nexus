"use client";

/* ═══════════════════════════════════════════════════════════════
   CoachDemandesNouveauMobile — Compose Page (Coach, Capacitor).

   Coach picks ANY recruiter + one of their OWN athletes + writes
   a message. Submits through the same shared layer the web
   /coach/demandes/nouveau uses :

     lib/queries/messaging/createCoachConversation
       ├─ RLS-enforced INSERT on conversations (own athlete only)
       ├─ INSERT on messages (sender_id = coach)
       └─ Recruiter notified via existing log_coach_reply trigger
          (writes COACH_REPLY row into recruiter_activity_log) — no
          notification code lives here.

   UX :
   - Single screen, three sections : athlete card (own roster
     picker drill-down), recruiter card (directory picker
     drill-down with search), composer textarea + sticky Envoyer.
   - Each picker collapses into a "selected" card with a "Changer"
     affordance ; both must be filled before the composer unlocks.
   - On error, mobile toast surfaces RLS denial / generic failure.
   - On success, navigate to /coach/demandes/[id] and invalidate
     ["conversations"] so the new thread shows up at the top of
     CoachDemandesMobile.

   Tab bar is hidden on this route by MobileTabBar's coach
   drill-down clause (/coach/demandes/<anything-but-the-list>).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useMobileToast } from "@/components/mobile/MobileToast";
import AthletePhoto from "@/components/shared/AthletePhoto";
import { createCoachConversation } from "@/lib/queries/messaging/createCoachConversation";
import { triggerHaptic } from "@/lib/haptics";


/* ── Data shapes ─────────────────────────────────────────────── */

interface PickerAthlete {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  photoUrl: string | null;
}

interface PickerCegep {
  id: string;
  name: string;
}

interface PickerRecruiter {
  id: string;
  firstName: string;
  lastName: string;
  cegep: string;
  photoUrl: string | null;
}

function flatten<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

/* ═══════════════════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════════════════ */

type DrillDown = "none" | "athlete" | "cegep" | "recruiter";

export function CoachDemandesNouveauMobile() {
  const router = useRouter();
  const toast = useMobileToast();
  const queryClient = useQueryClient();

  const [athletes, setAthletes] = useState<PickerAthlete[]>([]);
  const [cegeps, setCegeps] = useState<PickerCegep[]>([]);
  const [recruitersAtCegep, setRecruitersAtCegep] = useState<PickerRecruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecruiters, setLoadingRecruiters] = useState(false);
  const [coachUserId, setCoachUserId] = useState<string | null>(null);

  const [selectedAthlete, setSelectedAthlete] = useState<PickerAthlete | null>(null);
  const [selectedCegep, setSelectedCegep] = useState<PickerCegep | null>(null);
  const [selectedRecruiter, setSelectedRecruiter] = useState<PickerRecruiter | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);

  const [drillDown, setDrillDown] = useState<DrillDown>("none");
  const [athleteSearch, setAthleteSearch] = useState("");
  const [cegepSearch, setCegepSearch] = useState("");
  const [recruiterSearch, setRecruiterSearch] = useState("");

  /* ── Load coach roster + recruiter directory ─────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      if (!cancelled) setCoachUserId(user.id);

      const [athRes, cegepRes] = await Promise.all([
        // Own roster — RLS forces coach_id = auth.uid() anyway, but
        // we filter explicitly so the request fails fast on a server
        // misconfig.
        supabase
          .from("athletes")
          .select("id, first_name, last_name, photo_url, positions!position_id(abreviation, nom)")
          .eq("coach_id", user.id)
          .order("last_name", { ascending: true }),
        // CÉGEPs that HAVE at least one registered recruiter. PII-minimal :
        // fetches only school_id + the joined school name, never recruiter
        // names. The CÉGEP list dedups client-side. Recruiters at the
        // chosen CÉGEP are fetched lazily (see selectedCegep useEffect).
        supabase
          .from("users")
          .select("school_id, schools!school_id(id, name)")
          .eq("role", "RECRUTEUR")
          .not("school_id", "is", null),
      ]);

      if (cancelled) return;

      const mappedAthletes: PickerAthlete[] = (athRes.data || []).map((a: any) => {
        const pos = flatten(a.positions) as { abreviation?: string; nom?: string } | null;
        return {
          id: a.id,
          firstName: a.first_name || "",
          lastName: a.last_name || "",
          position: pos?.abreviation || pos?.nom || "",
          photoUrl: a.photo_url ?? null,
        };
      });

      const seenCegeps = new Set<string>();
      const mappedCegeps: PickerCegep[] = [];
      for (const row of cegepRes.data || []) {
        const sid = (row as any).school_id as string | null;
        if (!sid || seenCegeps.has(sid)) continue;
        seenCegeps.add(sid);
        const school = flatten((row as any).schools) as { id?: string; name?: string } | null;
        mappedCegeps.push({ id: sid, name: school?.name || "" });
      }
      mappedCegeps.sort((a, b) => a.name.localeCompare(b.name));

      setAthletes(mappedAthletes);
      setCegeps(mappedCegeps);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── Lazy recruiters-at-CÉGEP loader ────────────────────── */
  useEffect(() => {
    if (!selectedCegep) {
      setRecruitersAtCegep([]);
      return;
    }
    let cancelled = false;
    setLoadingRecruiters(true);
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("users")
        .select("id, first_name, last_name, photo_url, avatar_url, schools!school_id(name)")
        .eq("role", "RECRUTEUR")
        .eq("school_id", selectedCegep.id)
        .order("last_name", { ascending: true });
      if (cancelled) return;
      const mapped: PickerRecruiter[] = (data || []).map((r: any) => {
        const school = flatten(r.schools) as { name?: string } | null;
        return {
          id: r.id,
          firstName: r.first_name || "",
          lastName: r.last_name || "",
          cegep: school?.name || selectedCegep.name,
          photoUrl: r.photo_url ?? r.avatar_url ?? null,
        };
      });
      setRecruitersAtCegep(mapped);
      setLoadingRecruiters(false);
    })();
    return () => { cancelled = true; };
  }, [selectedCegep]);

  /* ── Filtered lists for the drill-downs ──────────────────── */
  const filteredAthletes = useMemo(() => {
    const q = athleteSearch.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((a) =>
      `${a.firstName} ${a.lastName}`.toLowerCase().includes(q),
    );
  }, [athletes, athleteSearch]);

  const filteredCegeps = useMemo(() => {
    const q = cegepSearch.trim().toLowerCase();
    if (!q) return cegeps;
    return cegeps.filter((c) => c.name.toLowerCase().includes(q));
  }, [cegeps, cegepSearch]);

  const filteredRecruiters = useMemo(() => {
    const q = recruiterSearch.trim().toLowerCase();
    if (!q) return recruitersAtCegep;
    return recruitersAtCegep.filter((r) =>
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(q),
    );
  }, [recruitersAtCegep, recruiterSearch]);

  /* ── Auto-seed message body when both are picked ────────── */
  useEffect(() => {
    if (!selectedAthlete || !selectedRecruiter) return;
    if (messageBody.trim().length > 0) return;
    setMessageBody(
      `Bonjour ${selectedRecruiter.firstName},

Je vous écris au sujet de ${selectedAthlete.firstName} ${selectedAthlete.lastName}${selectedAthlete.position ? ` (${selectedAthlete.position})` : ""}, un athlète de notre programme que je crois pourrait intéresser votre équipe.

`,
    );
    // We only auto-fill once on first pick ; if the coach clears the body
    // intentionally we don't re-seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAthlete, selectedRecruiter]);

  /* ── Handlers ────────────────────────────────────────────── */

  const handleBack = useCallback(() => {
    triggerHaptic("Light");
    if (drillDown !== "none") {
      setDrillDown("none");
      return;
    }
    router.push("/coach/demandes");
  }, [drillDown, router]);

  const handleSelectAthlete = (a: PickerAthlete) => {
    triggerHaptic("Light");
    setSelectedAthlete(a);
    setDrillDown("none");
    setAthleteSearch("");
  };

  const handleSelectCegep = (c: PickerCegep) => {
    triggerHaptic("Light");
    setSelectedCegep(c);
    // Swapping the CÉGEP invalidates the previously chosen recruiter
    // (they belong to a different school). The lazy useEffect kicks in
    // and refetches the recruiters at the new CÉGEP.
    setSelectedRecruiter(null);
    setMessageBody("");
    setDrillDown("none");
    setCegepSearch("");
  };

  const handleSelectRecruiter = (r: PickerRecruiter) => {
    triggerHaptic("Light");
    setSelectedRecruiter(r);
    setDrillDown("none");
    setRecruiterSearch("");
  };

  const canSend =
    !!selectedAthlete &&
    !!selectedRecruiter &&
    !!coachUserId &&
    messageBody.trim().length >= 10 &&
    !sending;

  const handleSend = useCallback(async () => {
    if (!canSend || !selectedAthlete || !selectedRecruiter || !coachUserId) return;
    triggerHaptic("Light");
    setSending(true);

    const supabase = createClient();
    const { conversationId, error } = await createCoachConversation(supabase, {
      coachUserId,
      recruiterId: selectedRecruiter.id,
      athleteId: selectedAthlete.id,
      message: messageBody,
    });

    if (error || !conversationId) {
      const code = (error as { code?: string } | undefined)?.code;
      const isRlsDeny =
        code === "42501" ||
        /permission denied|row-level security|policy/i.test((error as { message?: string } | undefined)?.message ?? "");
      toast.error({
        message: isRlsDeny ? "Permission refusée" : "Envoi impossible",
        detail: isRlsDeny
          ? "Tu ne peux écrire qu'au sujet d'un athlète de ton programme."
          : "Réessaie dans un instant.",
      });
      setSending(false);
      return;
    }

    // Catch the coach list cache so the new thread appears at the top.
    queryClient.invalidateQueries({ queryKey: ["conversations"] });

    triggerHaptic("Medium");
    toast.success({ message: "Message envoyé" });
    router.replace(`/coach/demandes/${conversationId}`);
  }, [canSend, selectedAthlete, selectedRecruiter, coachUserId, messageBody, toast, queryClient, router]);

  /* ─────────────────────────────────────────────────────────── */

  return (
    // min-h-[100dvh] (pas min-h-screen/100vh) : suit le frame sous Keyboard
    // Native → le composer sticky ne flotte plus au milieu. Scroll via <main>.
    <div className="min-h-[100dvh] bg-[#111317] text-white flex flex-col">
      {/* Header sticky */}
      <div
        className="sticky top-0 z-30 bg-[#111317]/95 backdrop-blur-md border-b border-white/[0.06]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center px-4 py-2 gap-2 min-h-[64px]">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Retour"
            className="w-11 h-11 rounded-full flex items-center justify-center active:bg-white/5 flex-shrink-0"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="font-head text-[20px] font-black text-white uppercase tracking-tight flex-1 truncate">
            {drillDown === "athlete"
              ? "Choisir un athlète"
              : drillDown === "cegep"
                ? "Choisir un CÉGEP"
                : drillDown === "recruiter"
                  ? "Choisir un recruteur"
                  : "Nouveau message"}
          </h1>
        </div>
      </div>

      {/* ── Default screen : two pickers + composer ──────────── */}
      {drillDown === "none" && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 px-4 pt-4 space-y-4 nx-mobile-pb-tabbar">
            {/* Athlete row */}
            <section>
              <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-white/40 mb-2">
                Athlète
              </p>
              {selectedAthlete ? (
                <SelectedCard
                  label={`${selectedAthlete.firstName} ${selectedAthlete.lastName}`}
                  sublabel={selectedAthlete.position || "—"}
                  photoUrl={selectedAthlete.photoUrl}
                  firstName={selectedAthlete.firstName}
                  lastName={selectedAthlete.lastName}
                  onChange={() => { setDrillDown("athlete"); triggerHaptic("Light"); }}
                />
              ) : (
                <PickerCTA
                  label="Choisir un athlète"
                  helper="Un athlète de ton programme"
                  onTap={() => { setDrillDown("athlete"); triggerHaptic("Light"); }}
                />
              )}
            </section>

            {/* CÉGEP row — picked BEFORE the recruiter so the recruiter
                list can be scoped to the chosen school. Only CÉGEPs that
                already have ≥1 registered recruiter are shown (no dead
                ends). */}
            <section>
              <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-white/40 mb-2">
                CÉGEP
              </p>
              {selectedCegep ? (
                <CegepSelectedCard
                  name={selectedCegep.name}
                  onChange={() => { setDrillDown("cegep"); triggerHaptic("Light"); }}
                />
              ) : (
                <PickerCTA
                  label="Choisir un CÉGEP"
                  helper="Seuls les CÉGEPs avec un recruteur sont listés"
                  onTap={() => { setDrillDown("cegep"); triggerHaptic("Light"); }}
                />
              )}
            </section>

            {/* Recruiter row — gated on the CÉGEP. The lazy loader
                refetches the list of recruiters at the chosen school each
                time the coach swaps the CÉGEP. */}
            <section>
              <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-white/40 mb-2">
                Recruteur {selectedCegep ? `au ${selectedCegep.name}` : ""}
              </p>
              {!selectedCegep ? (
                <div className="w-full flex items-center gap-3 p-4 bg-[#1A1D24] border border-dashed border-white/10 rounded-2xl">
                  <div className="w-11 h-11 rounded-full bg-[#111317] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <p className="text-[14px] text-white/55">
                    Choisis d&apos;abord un CÉGEP.
                  </p>
                </div>
              ) : selectedRecruiter ? (
                <SelectedCard
                  label={`${selectedRecruiter.firstName} ${selectedRecruiter.lastName}`}
                  sublabel={selectedRecruiter.cegep || "—"}
                  photoUrl={selectedRecruiter.photoUrl}
                  firstName={selectedRecruiter.firstName}
                  lastName={selectedRecruiter.lastName}
                  onChange={() => { setDrillDown("recruiter"); triggerHaptic("Light"); }}
                />
              ) : (
                <PickerCTA
                  label="Choisir un recruteur"
                  helper={loadingRecruiters ? "Chargement…" : `Recruteurs au ${selectedCegep.name}`}
                  onTap={() => { setDrillDown("recruiter"); triggerHaptic("Light"); }}
                />
              )}
            </section>

            {/* Composer */}
            <section>
              <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-white/40 mb-2">
                Message
              </p>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder={
                  selectedAthlete && selectedRecruiter
                    ? "Écris ton message…"
                    : "Choisis un athlète et un recruteur pour commencer…"
                }
                className="w-full min-h-[200px] bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 text-[16px] text-white placeholder:text-white/40 outline-none resize-none focus:border-[#E63946]/40"
              />
            </section>
          </div>

          {/* Sticky Envoyer */}
          <div
            className="sticky bottom-0 bg-[#111317]/95 backdrop-blur-md border-t border-white/[0.06] px-4 pt-3"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
          >
            <button
              type="button"
              onClick={() => { void triggerHaptic("Light"); handleSend(); }}
              disabled={!canSend}
              className={`w-full h-14 rounded-2xl font-head font-black text-[14px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                canSend
                  ? "bg-[#E63946] text-white active:scale-[0.97] active:bg-[#D42B22] shadow-[0_8px_24px_rgba(230,57,70,0.35)]"
                  : "bg-white/[0.06] text-[#6B7280] cursor-not-allowed"
              }`}
            >
              {sending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                  Envoi…
                </>
              ) : (
                "Envoyer"
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Athlete drill-down ───────────────────────────────── */}
      {drillDown === "athlete" && (
        <PickerDrillDown
          search={athleteSearch}
          onSearchChange={setAthleteSearch}
          searchPlaceholder="Rechercher un athlète"
          loading={loading}
          emptyTitle={athletes.length === 0 ? "Aucun athlète" : "Aucun résultat"}
          emptyDescription={
            athletes.length === 0
              ? "Ajoute un athlète à ton programme pour pouvoir lui écrire à propos d'un recruteur."
              : "Essaie un autre nom."
          }
        >
          {filteredAthletes.map((a) => (
            <PickerRow
              key={a.id}
              photoUrl={a.photoUrl}
              firstName={a.firstName}
              lastName={a.lastName}
              primary={`${a.firstName} ${a.lastName}`}
              secondary={a.position || "—"}
              onTap={() => handleSelectAthlete(a)}
            />
          ))}
        </PickerDrillDown>
      )}

      {/* ── CÉGEP drill-down ─────────────────────────────────── */}
      {drillDown === "cegep" && (
        <PickerDrillDown
          search={cegepSearch}
          onSearchChange={setCegepSearch}
          searchPlaceholder="Rechercher un CÉGEP"
          loading={loading}
          emptyTitle={cegeps.length === 0 ? "Aucun CÉGEP" : "Aucun résultat"}
          emptyDescription={
            cegeps.length === 0
              ? "Aucun CÉGEP n'a encore de recruteur inscrit sur Nexus."
              : "Essaie un autre nom."
          }
        >
          {filteredCegeps.map((c) => (
            <CegepRow key={c.id} name={c.name} onTap={() => handleSelectCegep(c)} />
          ))}
        </PickerDrillDown>
      )}

      {/* ── Recruiter drill-down (scoped to the chosen CÉGEP) ── */}
      {drillDown === "recruiter" && (
        <PickerDrillDown
          search={recruiterSearch}
          onSearchChange={setRecruiterSearch}
          searchPlaceholder="Rechercher un recruteur"
          loading={loadingRecruiters}
          emptyTitle={recruitersAtCegep.length === 0 ? "Aucun recruteur" : "Aucun résultat"}
          emptyDescription={
            recruitersAtCegep.length === 0
              ? `Aucun recruteur inscrit au ${selectedCegep?.name ?? "CÉGEP choisi"}.`
              : "Essaie un autre nom."
          }
        >
          {filteredRecruiters.map((r) => (
            <PickerRow
              key={r.id}
              photoUrl={r.photoUrl}
              firstName={r.firstName}
              lastName={r.lastName}
              primary={`${r.firstName} ${r.lastName}`}
              secondary={r.cegep || selectedCegep?.name || "—"}
              onTap={() => handleSelectRecruiter(r)}
            />
          ))}
        </PickerDrillDown>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
═══════════════════════════════════════════════════════════════ */

function PickerCTA({ label, helper, onTap }: { label: string; helper: string; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      className="w-full flex items-center gap-3 p-4 bg-[#1A1D24] border border-dashed border-white/15 rounded-2xl active:bg-[#22262e] transition-colors text-left"
    >
      <div className="w-11 h-11 rounded-full bg-[#111317] border border-white/10 flex items-center justify-center flex-shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2.6" strokeLinecap="round">
          <path d="M12 5v14" /><path d="M5 12h14" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-white">{label}</p>
        <p className="text-[13px] text-white/55 truncate">{helper}</p>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.4" strokeLinecap="round">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

function CegepSelectedCard({ name, onChange }: { name: string; onChange: () => void }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[#1A1D24] rounded-2xl">
      <div className="w-12 h-12 rounded-xl bg-[#E63946]/15 border border-[#E63946]/30 flex items-center justify-center flex-shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-white truncate">{name}</p>
        <p className="text-[13px] text-white/55 truncate">CÉGEP destinataire</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="px-3 py-1.5 rounded-full bg-white/[0.06] text-[12px] font-semibold text-white/80 active:bg-white/[0.12]"
      >
        Changer
      </button>
    </div>
  );
}

function CegepRow({ name, onTap }: { name: string; onTap: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onTap}
        className="w-full flex items-center gap-3 p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors text-left"
      >
        <div className="w-12 h-12 rounded-xl bg-[#E63946]/15 border border-[#E63946]/30 flex items-center justify-center flex-shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-semibold text-white truncate">{name}</p>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.4" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </li>
  );
}

function SelectedCard({
  label,
  sublabel,
  photoUrl,
  firstName,
  lastName,
  onChange,
}: {
  label: string;
  sublabel: string;
  photoUrl: string | null;
  firstName: string;
  lastName: string;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-[#1A1D24] rounded-2xl">
      <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
        <AthletePhoto photoUrl={photoUrl ?? ""} firstName={firstName} lastName={lastName} size={48} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-white truncate">{label}</p>
        <p className="text-[13px] text-white/55 truncate">{sublabel}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="px-3 py-1.5 rounded-full bg-white/[0.06] text-[12px] font-semibold text-white/80 active:bg-white/[0.12]"
      >
        Changer
      </button>
    </div>
  );
}

function PickerDrillDown({
  search,
  onSearchChange,
  searchPlaceholder,
  loading,
  emptyTitle,
  emptyDescription,
  children,
}: {
  search: string;
  onSearchChange: (s: string) => void;
  searchPlaceholder: string;
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  /* `children` is the mapped <PickerRow/> list. We treat an empty
     children array as the "no results" state. */
  const hasRows = Array.isArray(children) ? children.length > 0 : !!children;

  return (
    <div className="flex-1 flex flex-col">
      {/* Search */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-white/[0.06] rounded-2xl pl-9 pr-3 py-2.5 text-[16px] text-white placeholder:text-white/40 outline-none"
          />
        </div>
      </div>

      <div className="flex-1 px-4 pt-2 nx-mobile-pb-tabbar">
        {loading ? (
          <div className="space-y-2 pt-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[72px] rounded-2xl bg-[#1A1D24] animate-pulse" />
            ))}
          </div>
        ) : !hasRows ? (
          <div className="flex flex-col items-center text-center py-16 px-6">
            <div className="w-16 h-16 rounded-full bg-[#1A1D24] flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <p className="text-[16px] font-bold text-white">{emptyTitle}</p>
            <p className="text-[15px] text-white/55 mt-2 max-w-xs leading-relaxed">
              {emptyDescription}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">{children}</ul>
        )}
      </div>
    </div>
  );
}

function PickerRow({
  photoUrl,
  firstName,
  lastName,
  primary,
  secondary,
  onTap,
}: {
  photoUrl: string | null;
  firstName: string;
  lastName: string;
  primary: string;
  secondary: string;
  onTap: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onTap}
        className="w-full flex items-center gap-3 p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors text-left"
      >
        <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
          <AthletePhoto photoUrl={photoUrl ?? ""} firstName={firstName} lastName={lastName} size={48} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-semibold text-white truncate">{primary}</p>
          <p className="text-[14px] text-white/55 truncate">{secondary}</p>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.4" strokeLinecap="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </li>
  );
}
