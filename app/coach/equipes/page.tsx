"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getCurrentSeason } from "@/lib/utils/season";

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
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [sports, setSports] = useState<{ id: string; nom: string }[]>([]);
  const [schoolId, setSchoolId] = useState<string>("");
  const [rosterCount, setRosterCount] = useState(0);

  // Create form
  const [newName, setNewName] = useState("");
  const [newSportId, setNewSportId] = useState("");
  const [newAgeGroup, setNewAgeGroup] = useState("");
  const [newDivision, setNewDivision] = useState("");
  const [newLeague, setNewLeague] = useState("RSEQ");
  const [newSeason, setNewSeason] = useState(getCurrentSeason());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTeams();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTeams() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

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

    // If coach has no teams, skip the teams query entirely
    if (myTeamIds.length === 0) {
      setLoading(false);
      return;
    }

    // Load teams with coaches and athlete counts
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name, age_group, division, league, season, sport_id, sports!sport_id(nom), team_coaches(coach_id, role), team_athletes(id)")
      .in("id", myTeamIds)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

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
      setTeams(mapped);
    }
    setLoading(false);
  }

  async function handleCreate() {
    if (!newName.trim() || !newSportId || !schoolId) return;
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data: team, error } = await supabase
      .from("teams")
      .insert({ school_id: schoolId, sport_id: newSportId, name: newName.trim(), age_group: newAgeGroup.trim() || null, division: newDivision.trim() || null, league: newLeague.trim() || null, season: newSeason })
      .select("id")
      .single();

    if (error || !team) { console.error("Create team error:", error); setSaving(false); return; }

    // Auto-assign current coach as head_coach
    await supabase.from("team_coaches").insert({ team_id: team.id, coach_id: user.id, role: "head_coach" });

    // Reset form & reload
    setNewName(""); setNewSportId(""); setNewAgeGroup(""); setNewDivision(""); setNewLeague("RSEQ"); setNewSeason(getCurrentSeason());
    setShowCreate(false);
    setSaving(false);
    loadTeams();
  }

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
        <button type="button" onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#E63946] hover:bg-[#D42B22] text-white px-5 py-2.5 rounded-lg font-head font-bold text-[12px] uppercase tracking-wider transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Créer une équipe
        </button>
      </div>

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

      {/* Empty state */}
      {teams.length === 0 && rosterCount === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#1A1D24] border border-[#2D3748] flex items-center justify-center mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a4d56" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
          </div>
          <h3 className="font-head text-lg font-black text-white uppercase mb-1">Aucune équipe</h3>
          <p className="text-[13px] text-[#9CA3AF]">Crée ta première équipe pour commencer à organiser tes athlètes.</p>
        </div>
      )}

      {/* Team list */}
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

      {/* Create Team Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-5">Créer une équipe</h3>

            <div className="space-y-4">
              <div>
                <label className={labelCls}>Nom de l&apos;équipe *</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Football Juvénile" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Sport *</label>
                <select value={newSportId} onChange={(e) => setNewSportId(e.target.value)} className={inputCls}>
                  <option value="">Sélectionner un sport</option>
                  {sports.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Catégorie d&apos;âge</label>
                <input type="text" value={newAgeGroup} onChange={(e) => setNewAgeGroup(e.target.value)} placeholder="Ex: Juvénile, Cadet, Benjamin, Midget" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Division</label>
                <input type="text" value={newDivision} onChange={(e) => setNewDivision(e.target.value)} placeholder="Ex: D1, D2, AA, AAA" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Ligue</label>
                <input type="text" value={newLeague} onChange={(e) => setNewLeague(e.target.value)} placeholder="Ex: RSEQ Capitale-Nationale" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Saison</label>
                <select value={newSeason} onChange={(e) => setNewSeason(e.target.value)} className={inputCls}>
                  <option value="2025-2026">2025-2026</option>
                  <option value="2026-2027">2026-2027</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">Annuler</button>
              <button type="button" onClick={handleCreate} disabled={saving || !newName.trim() || !newSportId}
                className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-50 text-white text-[13px] font-bold rounded-lg transition-colors">
                {saving ? "Création..." : "Créer l'équipe"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
