"use client";

/* ═══════════════════════════════════════════════════════════════
   MessageNouveauMobile — iter 7.64

   Variante mobile de /recruteur/messages/nouveau (la page desktop reste
   intacte côté byte). Rendue conditionnellement via IS_CAPACITOR dans
   app/recruteur/messages/nouveau/page.tsx.

   Flow iOS 2-étapes :
   1. Picker athlète (union dédupliquée recruiter_favorites + recruiter_
      pipeline). Affichage dégradé sur le coach : "Coach de [Athlète]"
      uniquement, sans nom — RLS poulet-et-l'œuf assumé (DIAG 7.63 §3,
      Loi 25 respectée, aucune migration RLS).
   2. Composer : textarea 16px (no-zoom iOS) + envoi.

   Send logic : same shape que page desktop — reuse OR insert conversation,
   puis insert message. Pas de RPC, pas de migration.

   Tier gating : la route /nouveau elle-même est wrappée par
   <FeatureGate feature="messaging" requiredTier="pro"> côté parent →
   Free n'arrive jamais ici. UI sans guard redondant.

   ⚠️ Hooks AVANT toute condition (canon Rules of Hooks).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useMobileToast } from "@/components/mobile/MobileToast";
import AthletePhoto from "@/components/shared/AthletePhoto";
import {
  fetchRecruiterAthleteCards,
  displayFullName,
} from "@/lib/queries/shared/recruiterAthleteCards";
import { triggerHaptic } from "@/lib/haptics";


interface PickerAthlete {
  id: string;
  /** VIDES sous identité réservée — le serveur ne les envoie pas. Conservés
   *  pour le filtre de recherche, jamais pour l'affichage : voir `fullName`. */
  firstName: string;
  lastName: string;
  /** Déjà résolu par displayFullName() : « Identité réservée » sous masquage. */
  fullName: string;
  /** Décision SERVEUR. false → photo et nom sont ABSENTS de la réponse. */
  identityVisible: boolean;
  photoUrl: string | null;
  coachId: string;
  position: string;
  school: string;
  sport: string;
  /** "favorite" | "pipeline" — pour debug / future UI (badge source). */
  source: "favorite" | "pipeline" | "both";
}

/** Ce qui reste de l'embed : l'identifiant et le coach. `coach_id` n'est PAS
 *  projeté par recruiter_athlete_cards et il sert à filtrer (sans coach, pas
 *  de destinataire) — même partage assumé qu'au profil et au fil. */
interface RawAthleteRow {
  id?: string;
  coach_id?: string | null;
}

function flatten<T>(rel: T | T[] | null | undefined): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export function MessageNouveauMobile() {
  // Hooks AVANT toute condition (canon).
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useMobileToast();

  const [athletes, setAthletes] = useState<PickerAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  // Charge favoris + pipeline, merge dédupliqué.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      /* TEMPS 1 — les relations POSSÉDÉES (favoris, pipeline), sans identité.
         L'embed ne garde que l'id et le coach : `coach_id` n'est pas projeté
         par la RPC et sert à filtrer (sans coach, aucun destinataire).
         Tout le reste — nom, photo, sport, position, école — vient du temps 2,
         donc de la projection Loi 25. Avant, cet embed lisait first_name,
         last_name et photo_url en direct : la 15e surface, et la dernière du
         portail recruteur à court-circuiter le masquage. */
      const athleteSelect = "id, coach_id";

      const [favRes, pipeRes] = await Promise.all([
        supabase
          .from("recruiter_favorites")
          .select(`athlete_id, athletes!athlete_id(${athleteSelect})`)
          .eq("recruiter_id", user.id),
        supabase
          .from("recruiter_pipeline")
          .select(`athlete_id, athletes!athlete_id(${athleteSelect})`)
          .eq("recruiter_id", user.id),
      ]);

      if (cancelled) return;

      // Coach par athlète + provenance, avant toute résolution d'identité.
      const coachPar = new Map<string, string>();
      const sourcePar = new Map<string, "favorite" | "pipeline" | "both">();
      const noter = (rows: unknown[], source: "favorite" | "pipeline") => {
        for (const row of rows || []) {
          const raw = flatten((row as Record<string, unknown>).athletes as RawAthleteRow | RawAthleteRow[] | null);
          if (!raw?.id || !raw.coach_id) continue; // sans coach → pas de destinataire
          coachPar.set(raw.id, raw.coach_id);
          const vu = sourcePar.get(raw.id);
          sourcePar.set(raw.id, vu && vu !== source ? "both" : source);
        }
      };
      // Pipeline d'abord (ordre stable), favoris ensuite.
      noter(pipeRes.data || [], "pipeline");
      noter(favRes.data || [], "favorite");

      /* TEMPS 2 — les cartes projetées. Une carte ABSENTE (athlète non ACTIF)
         retire l'athlète du sélecteur : on ne propose pas d'écrire au sujet de
         quelqu'un dont on ne peut rien afficher. */
      const cartes = await fetchRecruiterAthleteCards(supabase, [...coachPar.keys()]);
      if (cancelled) return;

      const byId = new Map<string, PickerAthlete>();
      for (const [athleteId, coachId] of coachPar) {
        const c = cartes.get(athleteId);
        if (!c) continue;
        byId.set(athleteId, {
          id: athleteId,
          firstName: c.first_name ?? "",
          lastName: c.last_name ?? "",
          fullName: displayFullName(c),
          identityVisible: c.identity_visible,
          photoUrl: c.photo_url ?? null,
          coachId,
          position: c.position_abbr ?? "",
          school: c.school_name ?? "",
          sport: c.sport_nom ?? "",
          source: sourcePar.get(athleteId) ?? "pipeline",
        });
      }

      const list = Array.from(byId.values()).sort((a, b) => {
        // Favoris en premier (source = favorite ou both), puis nom.
        const aFav = a.source !== "pipeline" ? 0 : 1;
        const bFav = b.source !== "pipeline" ? 0 : 1;
        if (aFav !== bFav) return aFav - bFav;
        return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
      });

      setAthletes(list);
      setLoading(false);

      // Pre-select via ?athlete= (cohérent avec desktop).
      const preId = searchParams.get("athlete");
      if (preId && list.some((a) => a.id === preId)) {
        setSelectedId(preId);
      }
    })();
    return () => { cancelled = true; };
  // searchParams n'est qu'un objet stable, on lit la query au mount seulement.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(
    () => athletes.find((a) => a.id === selectedId) || null,
    [athletes, selectedId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return athletes;
    /* Le filtre porte sur firstName/lastName, PAS sur fullName, et c'est
       délibéré : sous masquage les deux premiers sont vides, donc un athlète
       à identité réservée ne répond à aucune recherche par nom. Passer par
       fullName le ferait remonter en tapant « identité ». */
    return athletes.filter((a) =>
      `${a.firstName} ${a.lastName}`.toLowerCase().includes(q),
    );
  }, [athletes, search]);

  function handleBack() {
    triggerHaptic("Light");
    if (selected) {
      // Étape 2 → 1 : déselectionne, revient au picker.
      setSelectedId(null);
      setMessageBody("");
      return;
    }
    router.back();
  }

  function handleSelect(a: PickerAthlete) {
    triggerHaptic("Light");
    setSelectedId(a.id);
    // Template court — on n'a pas le nom du coach (RLS), on évite
    // "Bonjour Coach [vide]". Reste neutre.
    //
    // `fullName` et NON firstName/lastName : c'est la plus sensible des
    // interpolations de ce fichier, parce qu'elle n'affiche pas le nom, elle
    // l'ÉCRIT dans un message envoyé à un coach. Sous masquage la forme
    // précédente produisait « le profil de   (QB) » — deux espaces et un trou
    // au milieu d'un texte que le recruteur allait envoyer tel quel.
    setMessageBody(
      `Bonjour,

J'ai consulté le profil de ${a.fullName}${a.position ? ` (${a.position})` : ""} et j'aimerais discuter de son avenir au niveau collégial.

`,
    );
  }

  const canSend = !!selected && messageBody.trim().length >= 10 && !sending;

  const handleSend = useCallback(async () => {
    if (!selected || !canSend) return;
    triggerHaptic("Light");
    setSending(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSending(false); return; }

    // Reuse-or-create conversation (triplet recruiter+coach+athlete).
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("recruiter_id", user.id)
      .eq("coach_id", selected.coachId)
      .eq("athlete_id", selected.id)
      .maybeSingle();

    let convId: string | null = existing?.id || null;
    if (!convId) {
      const { data: newConv, error: convErr } = await supabase
        .from("conversations")
        .insert({
          recruiter_id: user.id,
          coach_id: selected.coachId,
          athlete_id: selected.id,
          status: "ACTIVE",
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (convErr || !newConv) {
        const tierDenial =
          convErr?.code === "42501" ||
          /permission denied|row-level security|policy/i.test(convErr?.message ?? "");
        toast.error({
          message: tierDenial ? "Abonnement Pro requis" : "Conversation impossible",
          detail: tierDenial ? "L'envoi de messages est réservé Pro." : "Réessaie dans un instant.",
        });
        setSending(false);
        return;
      }
      convId = newConv.id;
    }

    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: user.id,
      content: messageBody.trim(),
    });
    if (msgErr) {
      const tierDenial =
        msgErr.code === "42501" ||
        /permission denied|row-level security|policy/i.test(msgErr.message ?? "");
      toast.error({
        message: tierDenial ? "Abonnement Pro requis" : "Envoi impossible",
        detail: tierDenial ? "Réservé Pro." : "Réessaie dans un instant.",
      });
      setSending(false);
      return;
    }

    await supabase.from("conversations").update({
      last_message_at: new Date().toISOString(),
      status: "ACTIVE",
    }).eq("id", convId);

    toast.success({ message: "Message envoyé" });
    // Navigation vers le thread créé.
    router.replace(`/recruteur/messages?id=${convId}`);
  }, [selected, messageBody, canSend, sending, router, toast]);

  return (
    // min-h-[100dvh] (pas min-h-screen/100vh) : suit le frame sous Keyboard
    // Native → le composer sticky ne flotte plus au milieu. Scroll via <main>.
    <div className="min-h-[100dvh] bg-[#111317] text-white flex flex-col">
      {/* Header drill-down sticky */}
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
            {selected ? "Composer" : "Nouveau message"}
          </h1>
        </div>
      </div>

      {/* Étape 1 — picker */}
      {!selected && (
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un athlète"
                className="w-full bg-white/[0.06] rounded-2xl pl-9 pr-3 py-2.5 text-[16px] text-white placeholder:text-white/40 outline-none"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 px-4 pt-2 nx-mobile-pb-tabbar">
            {loading ? (
              <div className="space-y-2 pt-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[72px] rounded-2xl bg-[#1A1D24] animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center text-center py-16 px-6">
                <div className="w-16 h-16 rounded-full bg-[#1A1D24] flex items-center justify-center mb-4">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <p className="text-[16px] font-bold text-white">
                  {athletes.length === 0 ? "Personne à contacter" : "Aucun résultat"}
                </p>
                <p className="text-[15px] text-white/55 mt-2 max-w-xs leading-relaxed">
                  {athletes.length === 0
                    ? "Ajoute des athlètes à tes favoris ou à ton processus pour pouvoir écrire à leur coach."
                    : "Essaie un autre nom."}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {filtered.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => { void triggerHaptic("Light"); handleSelect(a); }}
                      className="w-full flex items-center gap-3 p-3 bg-[#1A1D24] rounded-2xl active:bg-[#22262e] transition-colors text-left"
                    >
                      <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
                        <AthletePhoto photoUrl={a.photoUrl ?? ""} firstName={a.firstName} lastName={a.lastName} size={48} identityVisible={a.identityVisible} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[16px] font-semibold text-white truncate">
                          {a.fullName}
                        </p>
                        <p className="text-[14px] text-white/55 truncate">
                          {[a.position || a.sport, a.school].filter(Boolean).join(" · ") || "—"}
                        </p>
                        {/* Sous masquage, firstName est vide : « Coach de  »
                            resterait suspendu dans le vide. On retombe sur le
                            libellé générique — l'athlète est déjà nommé (ou
                            déclaré réservé) juste au-dessus. */}
                        <p className="text-[13px] text-white/40 truncate mt-0.5">
                          {a.identityVisible && a.firstName ? `Coach de ${a.firstName}` : "Coach de cet athlète"}
                        </p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="2.4" strokeLinecap="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Étape 2 — composer */}
      {selected && (
        <div className="flex-1 flex flex-col">
          {/* Recap athlète */}
          <div className="px-4 pt-3 pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-[#2F3440]">
                <AthletePhoto photoUrl={selected.photoUrl ?? ""} firstName={selected.firstName} lastName={selected.lastName} size={48} identityVisible={selected.identityVisible} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] font-bold text-white/40">
                  Tu écris au coach de
                </p>
                <p className="text-[16px] font-semibold text-white truncate">
                  {selected.fullName}
                </p>
                <p className="text-[13px] text-white/55 truncate">
                  {[selected.position || selected.sport, selected.school].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Composer */}
          <div className="flex-1 px-4 py-4">
            <textarea
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Écris ton message…"
              autoFocus
              className="w-full min-h-[220px] bg-[#1A1D24] border border-white/[0.06] rounded-2xl px-4 py-3 text-[16px] text-white placeholder:text-white/40 outline-none resize-none focus:border-[#E63946]/40"
            />
          </div>

          {/* CTA Send */}
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
    </div>
  );
}
