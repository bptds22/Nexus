"use client";

import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/* ─────────────────────────────────────────────────────────────
   Admin athlete detail — full edit form wired to Supabase.
───────────────────────────────────────────────────────────── */

type AthleteData = Record<string, unknown>;
type EvaluationData = Record<string, unknown>;

interface Sport {
  id: string;
  nom: string;
}
interface Position {
  id: string;
  nom: string;
  sport_id: string;
}
interface School {
  id: string;
  name: string;
}

const GENRE_OPTS = [
  { v: "", l: "—" },
  { v: "M", l: "Masculin" },
  { v: "F", l: "Féminin" },
  { v: "Autre", l: "Autre" },
];

const MAIN_OPTS = [
  { v: "", l: "—" },
  { v: "droite", l: "Droite" },
  { v: "gauche", l: "Gauche" },
  { v: "ambidextre", l: "Ambidextre" },
];

const STATUS_OPTS = [
  { v: "ACTIF", l: "Actif" },
  { v: "DESACTIVE", l: "Désactivé" },
  { v: "EN_ATTENTE", l: "En attente" },
  { v: "DIPLOME", l: "Diplômé" },
];

const VERIF_METHOD_OPTS = [
  { v: "", l: "—" },
  { v: "auto", l: "Automatique" },
  { v: "manuel_coach", l: "Manuel — coach" },
  { v: "manuel_directeur", l: "Manuel — directeur" },
];

const RECRUIT_OPTS = [
  { v: "", l: "—" },
  { v: "IDENTIFIE", l: "Identifié" },
  { v: "CONTACTE", l: "Contacté" },
  { v: "EN_DISCUSSION", l: "En discussion" },
  { v: "VISITE_PLANIFIEE", l: "Visite planifiée" },
  { v: "ENGAGE", l: "Engagé" },
  { v: "LETTRE_SIGNEE", l: "Lettre signée" },
];

const inputCls =
  "w-full bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2 text-[13px] text-[#E0E0E0] focus:outline-none focus:border-[#E63946]/50";
const labelCls = "text-[11px] font-bold tracking-[0.12em] uppercase text-[#9CA3AF]";

function jsonArrayToString(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  return "";
}
function stringToJsonArray(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function AdminAthleteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = use(params);
  const id = resolved.id;

  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [athlete, setAthlete] = useState<AthleteData>({});
  const [evaluation, setEvaluation] = useState<EvaluationData>({});
  const [sports, setSports] = useState<Sport[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [schools, setSchools] = useState<School[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [aRes, spRes, posRes, schRes] = await Promise.all([
        supabase.from("athletes").select("*").eq("id", id).maybeSingle(),
        supabase.from("sports").select("id,nom").order("nom"),
        supabase.from("positions").select("id,nom,sport_id"),
        supabase.from("schools").select("id,name").order("name"),
      ]);

      if (aRes.data) {
        setAthlete(aRes.data);
        if (aRes.data.coach_id) {
          const eRes = await supabase
            .from("evaluations")
            .select("*")
            .eq("athlete_id", id)
            .eq("coach_id", aRes.data.coach_id)
            .maybeSingle();
          if (eRes.data) setEvaluation(eRes.data);
        }
      }
      setSports((spRes.data as Sport[]) || []);
      setPositions((posRes.data as Position[]) || []);
      setSchools((schRes.data as School[]) || []);
      setLoading(false);
    })();
  }, [supabase, id]);

  function A(key: string) {
    return (athlete as Record<string, unknown>)[key];
  }
  function setA(key: string, value: unknown) {
    setAthlete((a) => ({ ...a, [key]: value }));
  }
  function setE(key: string, value: unknown) {
    setEvaluation((e) => ({ ...e, [key]: value }));
  }

  const filteredPositions = positions.filter((p) => p.sport_id === A("sport_id"));
  const filteredSecPositions = positions.filter((p) => p.sport_id === A("sport_secondaire_id"));

  async function handleSave() {
    setSaving(true);
    const supa = createClient();
    const athletePatch: Record<string, unknown> = {
      first_name: A("first_name"),
      last_name: A("last_name"),
      date_naissance: A("date_naissance") || null,
      genre: A("genre") || null,
      email: A("email") || null,
      telephone: A("telephone") || null,
      photo_url: A("photo_url") || null,
      nom_parent: A("nom_parent") || null,
      telephone_parent: A("telephone_parent") || null,
      sport_id: A("sport_id") || null,
      position_id: A("position_id") || null,
      sport_secondaire_id: A("sport_secondaire_id") || null,
      position_secondaire_id: A("position_secondaire_id") || null,
      school_id: A("school_id") || null,
      numero_jersey: A("numero_jersey") || null,
      taille_pieds: A("taille_pieds") ?? null,
      taille_pouces: A("taille_pouces") ?? null,
      poids_lbs: A("poids_lbs") ?? null,
      envergure: A("envergure") || null,
      taille_mains: A("taille_mains") || null,
      main_dominante: A("main_dominante") || null,
      pied_dominant: A("pied_dominant") || null,
      test_40_verges: A("test_40_verges") || null,
      saut_vertical: A("saut_vertical") || null,
      saut_longueur: A("saut_longueur") || null,
      developpe_couche: A("developpe_couche") || null,
      navette_agilite: A("navette_agilite") || null,
      sprint_100m: A("sprint_100m") || null,
      annee_diplomation: A("annee_diplomation") ?? null,
      moyenne_generale: A("moyenne_generale") ?? null,
      matieres_fortes: A("matieres_fortes") ?? [],
      mentions_academiques: A("mentions_academiques") ?? [],
      programme_cegep_vise: A("programme_cegep_vise") ?? [],
      ouvert_cegep_prive: !!A("ouvert_cegep_prive"),
      ouvert_cegep_anglophone: !!A("ouvert_cegep_anglophone"),
      pret_changer_region: !!A("pret_changer_region"),
      regions_cegep_preferees: A("regions_cegep_preferees") ?? [],
      video_faits_saillants_url: A("video_faits_saillants_url") || null,
      hudl_url: A("hudl_url") || null,
      youtube_url: A("youtube_url") || null,
      instagram_url: A("instagram_url") || null,
      video_match_complet_url: A("video_match_complet_url") || null,
      video_entrainement_url: A("video_entrainement_url") || null,
      status: A("status") || "ACTIF",
      verified: !!A("verified"),
      verification_method: A("verification_method") || null,
      statut_recrutement_override: A("statut_recrutement_override") || null,
      ouvert_entraineur_cegep: !!A("ouvert_entraineur_cegep"),
    };

    const { error: aErr } = await supa.from("athletes").update(athletePatch).eq("id", id);
    if (aErr) {
      setToast(`Erreur athlète: ${aErr.message}`);
      setTimeout(() => setToast(null), 4000);
      setSaving(false);
      return;
    }

    const coachId = A("coach_id") as string | null;
    if (coachId && Object.keys(evaluation).length > 0) {
      const evalPatch: Record<string, unknown> = {
        coach_id: coachId,
        athlete_id: id,
        leadership: evaluation.leadership ?? null,
        discipline: evaluation.discipline ?? null,
        coachabilite: evaluation.coachabilite ?? null,
        intelligence_jeu: evaluation.intelligence_jeu ?? null,
        competitivite: evaluation.competitivite ?? null,
        esprit_equipe: evaluation.esprit_equipe ?? null,
        resilience: evaluation.resilience ?? null,
        attitude_mentalite: evaluation.attitude_mentalite ?? null,
        cote_globale: evaluation.cote_globale ?? null,
        rapport_entraineur: evaluation.rapport_entraineur ?? null,
        distinctions: evaluation.distinctions ?? [],
      };
      const { error: eErr } = await supa
        .from("evaluations")
        .upsert(evalPatch, { onConflict: "coach_id,athlete_id" });
      if (eErr) {
        setToast(`Erreur évaluation: ${eErr.message}`);
        setTimeout(() => setToast(null), 4000);
        setSaving(false);
        return;
      }
    }

    setToast("Enregistré");
    setTimeout(() => setToast(null), 2500);
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="text-center py-12 text-[#6b7280]">Chargement...</div>
      </div>
    );
  }

  if (!athlete.id) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Link href="/admin/athletes" className="text-[13px] text-[#E63946] hover:underline">
          ← Retour
        </Link>
        <p className="mt-6 text-[#9CA3AF]">Athlète introuvable.</p>
      </div>
    );
  }

  const section = (title: string, children: React.ReactNode) => (
    <section className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 space-y-4">
      <h2 className="font-head text-[16px] font-black text-white uppercase tracking-tight border-b border-[#2D3748] pb-3">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );

  const row = (label: string, input: React.ReactNode) => (
    <label className="space-y-1.5 block">
      <span className={labelCls}>{label}</span>
      {input}
    </label>
  );

  const text = (key: string, placeholder?: string) => (
    <input
      type="text"
      title={key}
      placeholder={placeholder ?? key}
      value={(A(key) as string) ?? ""}
      onChange={(e) => setA(key, e.target.value)}
      className={inputCls}
    />
  );
  const num = (key: string, step = "1") => (
    <input
      type="number"
      step={step}
      title={key}
      placeholder={key}
      value={(A(key) as number | null) ?? ""}
      onChange={(e) => setA(key, e.target.value === "" ? null : Number(e.target.value))}
      className={inputCls}
    />
  );
  const date = (key: string) => (
    <input
      type="date"
      title={key}
      placeholder={key}
      value={(A(key) as string)?.slice(0, 10) ?? ""}
      onChange={(e) => setA(key, e.target.value || null)}
      className={inputCls}
    />
  );
  const bool = (key: string) => (
    <button
      type="button"
      title={key}
      onClick={() => setA(key, !A(key))}
      className={`relative inline-flex w-11 h-6 items-center rounded-full transition-colors ${
        A(key) ? "bg-[#22C55E]" : "bg-[#4a4d56]"
      }`}
      aria-pressed={A(key) ? "true" : "false"}
    >
      <span
        className={`inline-block w-4 h-4 rounded-full bg-white transition-transform ${
          A(key) ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
  const select = (
    key: string,
    opts: { v: string; l: string }[],
    onChange?: (v: string) => void,
  ) => (
    <select
      title={key}
      value={(A(key) as string) ?? ""}
      onChange={(e) => {
        setA(key, e.target.value || null);
        onChange?.(e.target.value);
      }}
      className={inputCls}
    >
      {opts.map((o) => (
        <option key={o.v} value={o.v}>
          {o.l}
        </option>
      ))}
    </select>
  );
  const arrayText = (key: string) => (
    <input
      type="text"
      title={key}
      placeholder="séparé par des virgules"
      value={jsonArrayToString(A(key))}
      onChange={(e) => setA(key, stringToJsonArray(e.target.value))}
      className={inputCls}
    />
  );

  const sportOpts = [{ v: "", l: "—" }, ...sports.map((s) => ({ v: s.id, l: s.nom }))];
  const schoolOpts = [{ v: "", l: "—" }, ...schools.map((s) => ({ v: s.id, l: s.name }))];
  const posOpts = [{ v: "", l: "—" }, ...filteredPositions.map((p) => ({ v: p.id, l: p.nom }))];
  const secPosOpts = [
    { v: "", l: "—" },
    ...filteredSecPositions.map((p) => ({ v: p.id, l: p.nom })),
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/athletes"
            className="text-[13px] text-[#E63946] hover:underline inline-flex items-center gap-1"
          >
            ← Retour à la liste
          </Link>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight mt-2">
            {(A("first_name") as string) ?? ""} {(A("last_name") as string) ?? ""}
          </h1>
          <p className="text-[12px] text-[#6b7280] mt-1 font-mono">{id}</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-lg bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors disabled:opacity-40"
        >
          {saving ? "Enregistrement..." : "Sauvegarder"}
        </button>
      </div>

      {section(
        "Identité",
        <>
          {row("Prénom", text("first_name"))}
          {row("Nom", text("last_name"))}
          {row("Date de naissance", date("date_naissance"))}
          {row("Genre", select("genre", GENRE_OPTS))}
          {row("Courriel", text("email"))}
          {row("Téléphone", text("telephone"))}
          {row("Photo URL", text("photo_url"))}
          {row("Nom du parent", text("nom_parent"))}
          {row("Téléphone parent", text("telephone_parent"))}
        </>,
      )}

      {section(
        "Sport",
        <>
          {row(
            "Sport principal",
            select("sport_id", sportOpts, () => setA("position_id", null)),
          )}
          {row("Position principale", select("position_id", posOpts))}
          {row(
            "Sport secondaire",
            select("sport_secondaire_id", sportOpts, () => setA("position_secondaire_id", null)),
          )}
          {row("Position secondaire", select("position_secondaire_id", secPosOpts))}
          {row("École", select("school_id", schoolOpts))}
          {row("Numéro de jersey", text("numero_jersey"))}
        </>,
      )}

      {section(
        "Physique",
        <>
          {row("Taille (pieds)", num("taille_pieds"))}
          {row("Taille (pouces)", num("taille_pouces"))}
          {row("Poids (lbs)", num("poids_lbs", "0.1"))}
          {row("Envergure", text("envergure"))}
          {row("Taille des mains", text("taille_mains"))}
          {row("Main dominante", select("main_dominante", MAIN_OPTS))}
          {row("Pied dominant", select("pied_dominant", MAIN_OPTS))}
          {row("40 verges", text("test_40_verges"))}
          {row("Saut vertical", text("saut_vertical"))}
          {row("Saut en longueur", text("saut_longueur"))}
          {row("Développé couché", text("developpe_couche"))}
          {row("Navette agilité", text("navette_agilite"))}
          {row("Sprint 100m", text("sprint_100m"))}
        </>,
      )}

      {section(
        "Académique",
        <>
          {row("Année de diplomation", num("annee_diplomation"))}
          {row("Moyenne générale", num("moyenne_generale", "0.01"))}
          {row("Matières fortes", arrayText("matieres_fortes"))}
          {row("Mentions académiques", arrayText("mentions_academiques"))}
          {row("Programme CÉGEP visé", arrayText("programme_cegep_vise"))}
          {row("Régions CÉGEP préférées", arrayText("regions_cegep_preferees"))}
          {row("Ouvert CÉGEP privé", bool("ouvert_cegep_prive"))}
          {row("Ouvert CÉGEP anglophone", bool("ouvert_cegep_anglophone"))}
          {row("Prêt à changer de région", bool("pret_changer_region"))}
        </>,
      )}

      {section(
        "Médias",
        <>
          {row("Vidéo faits saillants", text("video_faits_saillants_url"))}
          {row("Hudl", text("hudl_url"))}
          {row("YouTube", text("youtube_url"))}
          {row("Instagram", text("instagram_url"))}
          {row("Vidéo match complet", text("video_match_complet_url"))}
          {row("Vidéo entraînement", text("video_entrainement_url"))}
        </>,
      )}

      {section(
        "Statut",
        <>
          {row("Statut du compte", select("status", STATUS_OPTS))}
          {row("Vérifié", bool("verified"))}
          {row("Méthode de vérification", select("verification_method", VERIF_METHOD_OPTS))}
          {row("Statut recrutement", select("statut_recrutement_override", RECRUIT_OPTS))}
          {row("Ouvert à entraîneur CÉGEP", bool("ouvert_entraineur_cegep"))}
        </>,
      )}

      <section className="bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 space-y-4">
        <h2 className="font-head text-[16px] font-black text-white uppercase tracking-tight border-b border-[#2D3748] pb-3">
          Évaluation
        </h2>
        {!A("coach_id") ? (
          <p className="text-[13px] text-[#6b7280]">
            Aucun coach assigné — aucune évaluation n&apos;est possible.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(
              [
                ["cote_globale", "Cote globale", "0.01"],
                ["leadership", "Leadership", "1"],
                ["discipline", "Discipline", "1"],
                ["coachabilite", "Coachabilité", "1"],
                ["intelligence_jeu", "Intelligence du jeu", "1"],
                ["competitivite", "Compétitivité", "1"],
                ["esprit_equipe", "Esprit d'équipe", "1"],
                ["resilience", "Résilience", "1"],
                ["attitude_mentalite", "Attitude / mentalité", "1"],
              ] as const
            ).map(([key, lbl, step]) => (
              <label key={key} className="space-y-1.5 block">
                <span className={labelCls}>{lbl}</span>
                <input
                  type="number"
                  step={step}
                  title={key}
                  placeholder={key}
                  value={(evaluation[key] as number | null) ?? ""}
                  onChange={(e) =>
                    setE(key, e.target.value === "" ? null : Number(e.target.value))
                  }
                  className={inputCls}
                />
              </label>
            ))}
            <label className="space-y-1.5 block md:col-span-2">
              <span className={labelCls}>Rapport de l&apos;entraîneur</span>
              <textarea
                rows={3}
                maxLength={300}
                title="rapport_entraineur"
                placeholder="Rapport de l'entraîneur"
                value={(evaluation.rapport_entraineur as string) ?? ""}
                onChange={(e) => setE("rapport_entraineur", e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="space-y-1.5 block md:col-span-2">
              <span className={labelCls}>Distinctions (JSON)</span>
              <textarea
                rows={2}
                title="distinctions"
                placeholder='["captain","allstar"]'
                value={JSON.stringify(evaluation.distinctions ?? [])}
                onChange={(e) => {
                  try {
                    setE("distinctions", JSON.parse(e.target.value));
                  } catch {
                    // user still editing
                  }
                }}
                className={inputCls + " font-mono text-[12px]"}
              />
            </label>
          </div>
        )}
      </section>

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 rounded-lg bg-[#E63946] text-white font-bold text-[13px] uppercase tracking-wider hover:bg-[#D42B22] transition-colors disabled:opacity-40"
        >
          {saving ? "Enregistrement..." : "Sauvegarder"}
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#1A1D24] border border-[#E63946]/30 text-white font-head font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-lg shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
