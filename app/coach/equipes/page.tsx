"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getCurrentSeason } from "@/lib/utils/season";
import { TeamPickerSheet, type TeamPickerItem } from "@/components/shared/teams/TeamPickerSheet";
import {
  TeamCreateFormBlock, type TeamFormValues, resolveTeamFinalValues,
} from "@/components/shared/teams/TeamCreateFormBlock";
import { ExistingTeamBanner } from "@/components/shared/teams/ExistingTeamBanner";
import { createTeam, joinTeam } from "@/lib/queries/coach/createTeam";
import { loadSchoolDirectorStatus } from "@/lib/queries/coach/useSchoolDirector";
import CoachEquipesMobile from "@/components/shared/CoachEquipesMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   Mes Équipes — Team management for coaches
═══════════════════════════════════════════════════════════════ */

interface Team {
  id: string;
  name: string;
  ageGroup: string;
  division: string;
  league: string;
  season: string;
  sportName: string;
  coachCount: number;
  athleteCount: number;
  coaches: { name: string; role: string }[];
}

const ROLE_LABELS: Record<string, string> = {
  head_coach: "Entraîneur-chef",
  assistant: "Assistant",
  coordinator: "Coordonnateur",
};
const ROLE_COLORS: Record<string, string> = {
  head_coach: "bg-[#E63946]/15 text-[#E63946] border-[#E63946]/30",
  assistant: "bg-[#2D3748] text-[#9CA3AF] border-[#2D3748]",
  coordinator: "bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30",
};

export default function EquipesPage() {
  // Capacitor → composant mobile-native (Run 3 — Mes Équipes mobile).
  // Web (non-Capacitor) garde son layout existant inchangé.
  if (IS_CAPACITOR) return <CoachEquipesMobile />;
  return <EquipesPageDesktop />;
}

function EquipesPageDesktop() {
  const [teams, setTeams] = useState<Team[]>([]);
  // Oversight directeur : équipes de l'école dont le user n'est PAS membre.
  // Vide pour un coach non-directeur → la 2e section ne s'affiche pas.
  const [schoolTeams, setSchoolTeams] = useState<Team[]>([]);
  const [isDirector, setIsDirector] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sports, setSports] = useState<{ id: string; nom: string }[]>([]);
  const [schoolId, setSchoolId] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [rosterCount, setRosterCount] = useState(0);

  // Unified flow : Picker FIRST (see existing teams to dedup), then
  // Create form only when the coach confirms no match.
  const [showPicker, setShowPicker] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  /** Confirmation après un « rejoindre » — précise le rôle obtenu. */
  const [joinedNotice, setJoinedNotice] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<TeamFormValues | null>(null);
  const [formValid, setFormValid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadTeams();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTeams() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setCurrentUserId(user.id);

    // Post-Phase 6.2.e : unified path. Coaches école et civil sont
    // dans team_coaches → teams. La page lit le user's school_id pour
    // permettre la création de teams (école : school_id de l'école;
    // civil : school_id de la LIGUE_CIVILE row set par 6.2.a-hotfix).
    // school_id NULL ne bloque plus le chargement — le bouton "Créer"
    // sera disabled si non set, mais les teams existantes s'affichent.
    const { data: profile } = await supabase
      .from("users")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (profile?.school_id) setSchoolId(profile.school_id);

    // Get teams where I'm a coach (via team_coaches)
    const { data: myTeamRows } = await supabase
      .from("team_coaches")
      .select("team_id")
      .eq("coach_id", user.id);
    const myTeamIds = (myTeamRows || []).map((r) => r.team_id);

    // Load sports for create form
    const { data: sportsData } = await supabase.from("sports").select("id, nom").order("nom");
    if (sportsData) setSports(sportsData);

    // Count existing roster athletes (for migration prompt)
    const { count } = await supabase
      .from("athletes")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", user.id);
    setRosterCount(count || 0);

    // Oversight directeur : un directeur d'école voit TOUTES les équipes
    // actives de son école (pas seulement les siennes). La lecture est
    // autorisée côté DB (RLS Part A). On charge alors par school_id ;
    // sinon on garde le comportement coach classique (par myTeamIds).
    const dir = await loadSchoolDirectorStatus(supabase, user.id);
    setIsDirector(dir.isDirector);
    const directorSchoolId = dir.isDirector ? dir.schoolId : null;

    // Un coach non-directeur sans équipe : rien à charger.
    if (!directorSchoolId && myTeamIds.length === 0) {
      setLoading(false);
      return;
    }

    // Load teams with coaches and athlete counts. Directeur → école
    // entière ; coach → ses équipes.
    let teamsQuery = supabase
      .from("teams")
      .select("id, name, age_group, division, league, season, sport_id, sports!sport_id(nom), team_coaches(coach_id, role), team_athletes(id)")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    teamsQuery = directorSchoolId
      ? teamsQuery.eq("school_id", directorSchoolId)
      : teamsQuery.in("id", myTeamIds);
    const { data: teamsData } = await teamsQuery;

    if (teamsData) {
      // Collect all coach IDs to resolve names in one query
      const allCoachIds = new Set<string>();
      for (const t of teamsData) {
        for (const tc of (t as any).team_coaches || []) {
          if (tc.coach_id) allCoachIds.add(tc.coach_id);
        }
      }
      const coachNameMap = new Map<string, string>();
      if (allCoachIds.size > 0) {
        const { data: coachUsers } = await supabase
          .from("users")
          .select("id, first_name, last_name")
          .in("id", Array.from(allCoachIds));
        for (const u of coachUsers || []) {
          coachNameMap.set(u.id, `${u.first_name || ""} ${u.last_name || ""}`.trim());
        }
      }

      const mapped: Team[] = teamsData.map((t: any) => {
        const sportRel = t.sports;
        const sport = Array.isArray(sportRel) ? sportRel[0] : sportRel;
        const coaches = (t.team_coaches || []).map((tc: any) => ({
          name: coachNameMap.get(tc.coach_id) || "Coach",
          role: tc.role,
        }));
        return {
          id: t.id,
          name: t.name,
          ageGroup: t.age_group || "",
          division: t.division || "",
          league: t.league || "",
          season: t.season || getCurrentSeason(),
          sportName: sport?.nom || "",
          coachCount: coaches.length,
          athleteCount: (t.team_athletes || []).length,
          coaches,
        };
      });

      // Split : « mes équipes » (je suis dans team_coaches) vs « équipes
      // de l'école » (supervision directeur). Le set des IDs où je suis
      // coach = myTeamIds. Pour un non-directeur, tout tombe dans « mes
      // équipes » (la requête n'a ramené que myTeamIds) → 2e section vide.
      const myIdSet = new Set(myTeamIds);
      setTeams(mapped.filter((t) => myIdSet.has(t.id)));
      setSchoolTeams(mapped.filter((t) => !myIdSet.has(t.id)));
    }
    setLoading(false);
  }

  /* Stable client for the pre-submit detection banner (its effect keys
     on the client identity — a fresh createClient() each render would
     re-run detection every render). */
  const bannerSupabase = useMemo(() => createClient(), []);

  /* Unified create using the shared layer. Mirrors createCoachConversation :
     returns { teamId, error } ; on success refreshes the list. */
  const handleCreate = useCallback(async () => {
    if (!formValues || !formValid || saving || !schoolId || !currentUserId) return;
    setSaving(true);
    setCreateError(null);
    const supabase = createClient();
    const { finalAge, finalDivision } = resolveTeamFinalValues(formValues);
    const { teamId, error } = await createTeam(supabase, {
      coachUserId: currentUserId,
      schoolId,
      sportId: formValues.sportId,
      name: formValues.name,
      ageGroup: finalAge,
      division: finalDivision,
      gender: formValues.gender,
      league: formValues.league,
      season: formValues.season,
    });
    if (error || !teamId) {
      setCreateError((error as { message?: string } | undefined)?.message || "Création échouée.");
      setSaving(false);
      return;
    }
    setShowCreate(false);
    setFormValues(null);
    setFormValid(false);
    setSaving(false);
    loadTeams();
  }, [formValues, formValid, saving, schoolId, currentUserId]);

  /* Coach picks an EXISTING team from the picker → joinTeam décide du rôle
     (équipe sans coach = revendication → head_coach ; sinon assistant) ;
     refresh list. */
  const handlePickExisting = useCallback(async (team: TeamPickerItem) => {
    if (!currentUserId) return;
    const supabase = createClient();
    const { error, role } = await joinTeam(supabase, { coachUserId: currentUserId, teamId: team.id });
    if (error) {
      setCreateError((error as { message?: string }).message || "Impossible de rejoindre cette équipe.");
      return;
    }
    setShowPicker(false);
    setJoinedNotice(
      role === "head_coach"
        ? `${team.name} — tu en es maintenant l'entraîneur responsable.`
        : `${team.name} — tu as rejoint l'équipe comme entraîneur adjoint.`,
    );
    loadTeams();
  }, [currentUserId]);

  if (loading) {
    return (
      <div className="px-6 sm:px-10 py-8 max-w-[1200px] mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#1A1D24] rounded w-48" />
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-[#1A1D24] rounded-lg" />)}
        </div>
      </div>
    );
  }

  const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-3 text-[14px] text-white placeholder-[#4a4d56] focus:outline-none focus:border-[#E63946]/50 transition-colors";
  const labelCls = "block text-[11px] font-bold tracking-[0.2em] uppercase text-[#6b7280] mb-1.5";

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1200px] mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Mes équipes</h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">Gère tes équipes, divisions et athlètes</p>
        </div>
        <button type="button" onClick={() => setShowPicker(true)}
          disabled={!schoolId}
          className="flex items-center gap-2 bg-[#E63946] hover:bg-[#D42B22] text-white px-5 py-2.5 rounded-lg font-head font-bold text-[12px] uppercase tracking-wider transition-colors disabled:opacity-50">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Ajouter une équipe
        </button>
      </div>

      {/* Confirmation de rattachement — dit explicitement le rôle obtenu,
          car revendiquer une équipe orpheline donne head_coach. */}
      {joinedNotice && (
        <div className="flex items-start gap-3 rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/10 px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" className="mt-0.5 shrink-0">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <p className="text-[13px] text-white flex-1">{joinedNotice}</p>
          <button type="button" onClick={() => setJoinedNotice(null)}
            className="text-[#9CA3AF] hover:text-white text-[16px] leading-none shrink-0" aria-label="Fermer">×</button>
        </div>
      )}

      {/* Migration prompt */}
      {teams.length === 0 && rosterCount > 0 && (
        <div className="bg-[#F59E0B]/[0.06] border border-[#F59E0B]/20 rounded-xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-[#F59E0B]/20 flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
          </div>
          <div>
            <p className="text-[15px] font-bold text-white">Tu as {rosterCount} athlète{rosterCount > 1 ? "s" : ""} dans ton roster</p>
            <p className="text-[13px] text-[#9CA3AF] mt-0.5">Crée une équipe pour les organiser par sport et division.</p>
          </div>
        </div>
      )}

      {/* Empty state — masqué si le directeur a des équipes d'école à superviser. */}
      {teams.length === 0 && rosterCount === 0 && schoolTeams.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
          </div>
          <h3 className="font-head text-lg font-black text-white uppercase mb-1">Aucune équipe</h3>
          <p className="text-[13px] text-[#9CA3AF]">Crée ta première équipe pour commencer à organiser tes athlètes.</p>
        </div>
      )}

      {/* Team list */}
      {/* Libellé de section — n'apparaît que pour un directeur (qui a
          aussi une 2e section « école ») ; un coach normal garde une
          liste unique sans sous-titre redondant avec le H1. */}
      {isDirector && teams.length > 0 && (
        <h2 className="font-head text-[13px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF]">Mes équipes</h2>
      )}
      {teams.length > 0 && (
        <div className="space-y-3">
          {teams.map((t) => (
            <Link key={t.id} href={`/coach/equipes/${t.id}`}
              className="block bg-[#1A1D24] rounded-lg border-l-[3px] border-l-[#E63946] hover:border-l-[#ff4d5a] transition-all hover:shadow-[0_0_20px_rgba(230,57,70,0.08)] group"
              style={{ padding: "16px 20px" }}>
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-[18px] font-bold text-white group-hover:text-[#E63946] transition-colors">{t.name}</h3>
                    <span className="text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-[#2D3748] text-[#9CA3AF]">{t.season}</span>
                  </div>
                  <p className="text-[13px] text-[#6b7280] mt-1">
                    {t.sportName}{t.ageGroup ? ` · ${t.ageGroup}` : ""}{t.division ? ` · ${t.division}` : ""}{t.league ? ` · ${t.league}` : ""}
                  </p>
                  {t.coaches.length > 0 && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {t.coaches.map((c, i) => (
                        <span key={i} className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${ROLE_COLORS[c.role] || ROLE_COLORS.assistant}`}>
                          {c.name} — {ROLE_LABELS[c.role] || c.role}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  <div className="text-center">
                    <p className="text-[20px] font-head font-black text-white">{t.athleteCount}</p>
                    <p className="text-[10px] text-[#6b7280] uppercase tracking-wider">athlète{t.athleteCount !== 1 ? "s" : ""}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"
                    className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Équipes de l'école (supervision directeur) ─────────────
          Équipes actives de l'école où le directeur n'est PAS coach.
          Affiche l'entraîneur-chef + le nombre d'athlètes ; clic → même
          détail d'équipe (le directeur y a une « Vue directeur »). */}
      {isDirector && schoolTeams.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <h2 className="font-head text-[13px] font-bold tracking-[0.15em] uppercase text-[#9CA3AF]">Équipes de l&apos;école</h2>
            <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/30">Directeur</span>
          </div>
          {schoolTeams.map((t) => {
            const headCoach = t.coaches.find((c) => c.role === "head_coach")?.name;
            return (
              <Link key={t.id} href={`/coach/equipes/${t.id}`}
                className="block bg-[#1A1D24] rounded-lg border-l-[3px] border-l-[#2D3748] hover:border-l-[#9CA3AF] transition-all group"
                style={{ padding: "16px 20px" }}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-[18px] font-bold text-white group-hover:text-[#9CA3AF] transition-colors">{t.name}</h3>
                      <span className="text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-[#2D3748] text-[#9CA3AF]">{t.season}</span>
                    </div>
                    <p className="text-[13px] text-[#6b7280] mt-1">
                      {t.sportName}{t.ageGroup ? ` · ${t.ageGroup}` : ""}{t.division ? ` · ${t.division}` : ""}{t.league ? ` · ${t.league}` : ""}
                    </p>
                    <p className="text-[12px] text-[#6b7280] mt-1.5">
                      {headCoach ? <>Entraîneur-chef : <span className="text-[#9CA3AF] font-semibold">{headCoach}</span></> : <span className="text-[#4a4d56] italic">Aucun entraîneur-chef</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 ml-4">
                    <div className="text-center">
                      <p className="text-[20px] font-head font-black text-white">{t.athleteCount}</p>
                      <p className="text-[10px] text-[#6b7280] uppercase tracking-wider">athlète{t.athleteCount !== 1 ? "s" : ""}</p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round"
                      className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Picker FIRST — surface existing teams to prevent duplicates.
          Coach can join an existing team (head_coach inserts as
          'assistant') OR open the structured Create form. */}
      <TeamPickerSheet
        open={showPicker}
        onClose={() => setShowPicker(false)}
        schoolId={schoolId || null}
        season={getCurrentSeason()}
        /* Ne propose pas de « rejoindre » une équipe dont je suis déjà membre. */
        excludeTeamIds={teams.map((t) => t.id)}
        onPicked={(team) => { handlePickExisting(team); }}
        onCreateNew={() => { setShowPicker(false); setShowCreate(true); }}
        title="Ajouter une équipe"
      />

      {/* Create Team Modal — structured form (shared with mobile +
          onboarding). Free-text fields replaced with structured
          selects (age/division/gender/season). Ligue stays text. */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-5">Créer une équipe</h3>

            <TeamCreateFormBlock
              sports={sports}
              variant="desktop"
              initialValues={{ season: getCurrentSeason(), league: "RSEQ" }}
              onChange={(values, isValid) => { setFormValues(values); setFormValid(isValid); }}
            />

            {/* Adoption visible AVANT le submit : si l'identité normalisée
                matche une team existante (dont les ~6 187 RSEQ), bannière
                d'adoption. Le bouton créer reste actif (garde serveur). */}
            {formValues && schoolId && (
              <div className="mt-4">
                <ExistingTeamBanner
                  supabase={bannerSupabase}
                  schoolId={schoolId}
                  sportId={formValues.sportId}
                  ageGroup={resolveTeamFinalValues(formValues).finalAge}
                  gender={formValues.gender}
                  division={resolveTeamFinalValues(formValues).finalDivision}
                  adopting={saving}
                  onAdopt={async (t) => {
                    setShowCreate(false);
                    await handlePickExisting({ id: t.id, name: t.name } as TeamPickerItem);
                  }}
                />
              </div>
            )}

            {createError && (
              <p className="mt-3 text-[13px] text-[#EF4444] font-semibold">{createError}</p>
            )}

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setCreateError(null); }}
                className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving || !formValid}
                className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg transition-colors"
              >
                {saving ? "Création..." : "Créer l'équipe"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
