"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════════════════
   /admin/ambassadeurs — la contrepartie administrative du programme.

   DEPUIS LE 2026-09-22 : les athlètes INVITENT par un lien personnel ; une
   déclaration par courriel exact reste possible en secours. Une recrue compte
   à la fin de son inscription (consentements passés).

   L'ÉCRAN D'ARBITRAGE A ÉTÉ RETIRÉ. Il départageait les homonymes de la
   recherche par nom ; cette recherche n'existe plus, et plus aucun chemin
   n'écrit EN_ATTENTE (prod au 2026-09-21 : zéro ligne). S'il en restait une,
   elle apparaîtrait dans les recrues de son parrain, annulable comme les
   autres.

   Ce que l'écran montre, par ambassadeur : recrues confirmées, dont par lien,
   ouvertures du lien sur 30 jours, paliers, le carnet (post IG, chandail), et
   le détail des recrues avec leur ANNULATION (rejet doux, motif consigné).

   ── POURQUOI CETTE PAGE LIT LES TABLES EN DIRECT ────────────────────────────
   L'administrateur a le droit de les voir : `ambassadeur_revendications`,
   `ambassadeur_paliers`, `ambassadeur_liens_clics` et `ambassadeur_suivi`
   portent une policy SELECT `is_admin()`, et il lit déjà `athletes` et
   `users` en entier. Une projection ici dupliquerait la RLS en JavaScript.
   `ambassadeur_liens` (les jetons) reste FERMÉE, même à l'admin : l'écran n'en
   a pas besoin.

   ── LES ÉCRITURES PASSENT PAR RPC ───────────────────────────────────────────
   L'annulation par `ambassadeur_admin_trancher(action = 'annuler')`, qui
   exige un motif. Seul `ambassadeur_suivi` s'écrit en direct : c'est un
   carnet, sans contrainte de course.
   ═══════════════════════════════════════════════════════════════════════════ */

interface Revendication {
  id: string;
  parrain_athlete_id: string;
  prenom: string | null;
  statut: "EN_ATTENTE" | "CONFIRMEE" | "REJETEE";
  methode: string;
  created_at: string;
  raison_rejet: string | null;
  filleul_user_id: string | null;
}

interface Recrue {
  id: string;
  qui: string;
  courriel: string | null;
  methode: string;
  statut: Revendication["statut"];
  le: string;
  raison_rejet: string | null;
}

interface Ambassadeur {
  athlete_id: string;
  nom: string;
  courriel: string | null;
  confirmes: number;
  par_lien: number;
  clics_30j: number;
  paliers: number[];
  post_ig_le: string | null;
  chandail_envoye_le: string | null;
  recrues: Recrue[];
}

const METHODE: Record<string, string> = {
  lien: "par lien",
  courriel: "courriel",
  nom_ecole: "nom + école",
  nom_equipe: "nom + équipe",
  nom_approx: "nom approx.",
  admin: "admin",
};

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-CA", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function AdminAmbassadeursPage() {
  const [classement, setClassement] = useState<Ambassadeur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [annulerId, setAnnulerId] = useState<string | null>(null);
  const [raison, setRaison] = useState("");

  const montrer = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4000); };

  /* LECTURE PURE — elle ne touche à AUCUN état, elle RENVOIE. C'est ce qui
     permet à l'effet de poser l'état dans un callback plutôt que dans son
     corps synchrone (react-hooks/set-state-in-effect), et d'annuler au
     démontage. */
  const lire = useCallback(async (): Promise<Ambassadeur[] | null> => {
    const supabase = createClient();
    const depuis = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

    const [{ data: revs, error }, { data: clics }] = await Promise.all([
      supabase
        .from("ambassadeur_revendications")
        .select("id, parrain_athlete_id, prenom, statut, methode, created_at, raison_rejet, filleul_user_id")
        .order("created_at", { ascending: false }),
      supabase.from("ambassadeur_liens_clics").select("athlete_id, jour, n").gt("jour", depuis),
    ]);

    if (error) {
      console.error("[AdminAmbassadeurs] lecture:", error.message);
      return null;
    }
    const lignes = (revs ?? []) as unknown as Revendication[];
    const clicsPar = new Map<string, number>();
    for (const c of (clics ?? []) as { athlete_id: string; n: number }[]) {
      clicsPar.set(c.athlete_id, (clicsPar.get(c.athlete_id) ?? 0) + c.n);
    }

    /* Un ambassadeur = quiconque a une recrue OU des ouvertures de lien : un
       athlète qui partage beaucoup sans encore convertir se voit aussi. */
    const ids = [...new Set([...lignes.map((r) => r.parrain_athlete_id), ...clicsPar.keys()])];
    if (ids.length === 0) return [];
    const filleuls = [...new Set(lignes.map((r) => r.filleul_user_id).filter((x): x is string => !!x))];

    const [{ data: fiches }, { data: paliers }, { data: suivi }, { data: comptes }] = await Promise.all([
      supabase.from("athletes").select("id, first_name, last_name, email").in("id", ids),
      supabase.from("ambassadeur_paliers").select("athlete_id, palier").in("athlete_id", ids),
      supabase.from("ambassadeur_suivi").select("athlete_id, post_ig_le, chandail_envoye_le").in("athlete_id", ids),
      filleuls.length
        ? supabase.from("users").select("id, first_name, last_name, email").in("id", filleuls)
        : Promise.resolve({ data: [] }),
    ]);

    const pal = new Map<string, number[]>();
    for (const p of (paliers ?? []) as { athlete_id: string; palier: number }[]) {
      pal.set(p.athlete_id, [...(pal.get(p.athlete_id) ?? []), p.palier].sort((a, b) => a - b));
    }
    const sui = new Map(((suivi ?? []) as { athlete_id: string; post_ig_le: string | null; chandail_envoye_le: string | null }[])
      .map((s) => [s.athlete_id, s]));
    const cpt = new Map(((comptes ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[])
      .map((u) => [u.id, u]));

    return ((fiches ?? []) as { id: string; first_name: string; last_name: string; email: string | null }[])
      .map((f) => {
        const siennes = lignes.filter((r) => r.parrain_athlete_id === f.id);
        return {
          athlete_id: f.id,
          nom: `${f.first_name ?? ""} ${f.last_name ?? ""}`.trim() || "—",
          courriel: f.email,
          confirmes: siennes.filter((r) => r.statut === "CONFIRMEE").length,
          par_lien: siennes.filter((r) => r.statut === "CONFIRMEE" && r.methode === "lien").length,
          clics_30j: clicsPar.get(f.id) ?? 0,
          paliers: pal.get(f.id) ?? [],
          post_ig_le: sui.get(f.id)?.post_ig_le ?? null,
          chandail_envoye_le: sui.get(f.id)?.chandail_envoye_le ?? null,
          recrues: siennes.map((r) => {
            const c = r.filleul_user_id ? cpt.get(r.filleul_user_id) : undefined;
            return {
              id: r.id,
              qui: `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || r.prenom?.trim() || "—",
              courriel: c?.email ?? null,
              methode: r.methode,
              statut: r.statut,
              le: r.created_at,
              raison_rejet: r.raison_rejet,
            };
          }),
        };
      })
      .sort((a, b) => b.confirmes - a.confirmes || b.clics_30j - a.clics_30j);
  }, []);

  const [tic, setTic] = useState(0);
  const recharger = useCallback(() => setTic((n) => n + 1), []);

  useEffect(() => {
    let vivant = true;
    lire().then((r) => {
      if (!vivant) return;
      if (r) setClassement(r);
      setChargement(false);
    });
    return () => { vivant = false; };
  }, [lire, tic]);

  async function annuler(id: string) {
    setOccupe(id);
    const { data, error } = await createClient().rpc("ambassadeur_admin_trancher", {
      p_revendication_id: id,
      p_action: "annuler",
      p_filleul_athlete_id: null,
      p_raison: raison,
    });
    setOccupe(null);
    if (error) { montrer(error.message); return; }
    const r = data as unknown as { ok: boolean; motif?: string };
    if (!r.ok) {
      montrer(r.motif === "raison_requise" ? "Un motif est requis." : `Refusé : ${r.motif}`);
      return;
    }
    montrer("Recrue annulée. Le compteur baisse ; les paliers déjà atteints restent.");
    setAnnulerId(null); setRaison("");
    recharger();
  }

  async function cocher(athleteId: string, champ: "post_ig_le" | "chandail_envoye_le", actuel: string | null) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("ambassadeur_suivi").upsert(
      { athlete_id: athleteId, [champ]: actuel ? null : new Date().toISOString(), updated_by: user?.id ?? null },
      { onConflict: "athlete_id" },
    );
    if (error) { montrer(error.message); return; }
    recharger();
  }

  const totalLien = classement.reduce((s, a) => s + a.par_lien, 0);
  const totalClics = classement.reduce((s, a) => s + a.clics_30j, 0);

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Ambassadeurs
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Les athlètes invitent leurs coéquipiers par un lien personnel ; une déclaration par
          courriel reste possible. Une recrue compte à la fin de son inscription.
        </p>
      </div>

      {chargement ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <section>
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-head text-[13px] font-black uppercase tracking-[0.18em] text-[#6b7280]">
              Ambassadeurs ({classement.length})
            </h2>
            <p className="text-[12px] text-[#9CA3AF]">
              {totalClics} ouverture{totalClics > 1 ? "s" : ""} de lien (30 j) · {totalLien} inscription{totalLien > 1 ? "s" : ""} par lien
            </p>
          </div>
          {classement.length === 0 ? (
            <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] px-6 py-10 text-center">
              <p className="text-[14px] text-[#9CA3AF]">Aucun ambassadeur pour l&apos;instant.</p>
            </div>
          ) : (
            <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-[#2D3748]">
                    {["Athlète", "Confirmées", "Par lien", "Ouvertures (30 j)", "Paliers", "Post IG", "Chandail", ""].map((h, i) => (
                      <th key={i} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {classement.map((a) => (
                    <Fragment key={a.athlete_id}>
                      <tr className="border-b border-[#2D3748]/50">
                        <td className="px-4 py-3">
                          <p className="text-[14px] text-white">{a.nom}</p>
                          <p className="text-[11px] text-[#6b7280]">{a.courriel ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-head text-[18px] font-black" style={{ color: a.confirmes >= 10 ? "#F59E0B" : "#fff" }}>
                            {a.confirmes}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[14px] text-white tabular-nums">{a.par_lien}</td>
                        <td className="px-4 py-3 text-[14px] text-[#9CA3AF] tabular-nums">{a.clics_30j}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {[3, 5, 10].map((p) => (
                              <span
                                key={p}
                                className="px-2 py-0.5 rounded text-[10px] font-bold"
                                style={a.paliers.includes(p)
                                  ? { background: "rgba(245,158,11,.16)", color: "#F59E0B" }
                                  : { background: "#111317", color: "#4a4d56" }}
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Case coche={!!a.post_ig_le} onClick={() => cocher(a.athlete_id, "post_ig_le", a.post_ig_le)} />
                            {/* CE MARQUEUR EST CE QUI TIENT LA PROMESSE du palier
                                10 : admin_notifications est un trou noir (RLS
                                sans policy) ; ici on lit ambassadeur_paliers. */}
                            {a.paliers.includes(10) && !a.post_ig_le && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#E63946]/15 text-[#E63946]">
                                À faire
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Case coche={!!a.chandail_envoye_le} onClick={() => cocher(a.athlete_id, "chandail_envoye_le", a.chandail_envoye_le)} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {a.recrues.length > 0 && (
                            <button
                              type="button"
                              onClick={() => { setOuvert(ouvert === a.athlete_id ? null : a.athlete_id); setAnnulerId(null); setRaison(""); }}
                              className="text-[12px] text-[#9CA3AF] underline underline-offset-2 hover:text-white"
                            >
                              {ouvert === a.athlete_id ? "Masquer" : `Recrues (${a.recrues.length})`}
                            </button>
                          )}
                        </td>
                      </tr>
                      {ouvert === a.athlete_id && (
                        <tr className="border-b border-[#2D3748]/50 bg-[#111317]">
                          <td colSpan={8} className="px-4 py-3">
                            <ul className="divide-y divide-[#2D3748]/60">
                              {a.recrues.map((r) => (
                                <li key={r.id} className="py-2.5">
                                  <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div className="min-w-0">
                                      <p className="text-[13px] text-white">
                                        {r.qui}
                                        <span className="ml-2 text-[11px] text-[#6b7280]">{METHODE[r.methode] ?? r.methode} · {dateCourte(r.le)}</span>
                                      </p>
                                      <p className="text-[11px] text-[#6b7280] truncate">
                                        {r.courriel ?? "—"}
                                        {r.statut === "REJETEE" && r.raison_rejet ? ` · annulée : ${r.raison_rejet}` : ""}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                        r.statut === "CONFIRMEE" ? "bg-[#22C55E]/15 text-[#22C55E]"
                                          : r.statut === "EN_ATTENTE" ? "bg-[#F59E0B]/15 text-[#F59E0B]"
                                          : "bg-white/5 text-[#9CA3AF]"}`}>
                                        {r.statut === "CONFIRMEE" ? "Confirmée" : r.statut === "EN_ATTENTE" ? "En attente" : "Annulée"}
                                      </span>
                                      {r.statut !== "REJETEE" && annulerId !== r.id && (
                                        <button
                                          type="button"
                                          onClick={() => { setAnnulerId(r.id); setRaison(""); }}
                                          className="text-[12px] text-[#EF4444] underline underline-offset-2"
                                        >
                                          Annuler
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  {annulerId === r.id && (
                                    <div className="mt-2 flex gap-2 flex-wrap">
                                      <input
                                        value={raison}
                                        onChange={(e) => setRaison(e.target.value)}
                                        placeholder="Motif (consigné)"
                                        className="flex-1 min-w-[200px] rounded-lg bg-[#1A1D24] border border-[#2D3748] px-3 py-2 text-[13px] text-white outline-none focus:border-[#E63946]"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => annuler(r.id)}
                                        disabled={!raison.trim() || occupe === r.id}
                                        className="h-9 px-4 rounded-lg bg-[#EF4444] text-white font-bold text-[11px] uppercase tracking-wider disabled:opacity-40"
                                      >
                                        Confirmer l&apos;annulation
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => { setAnnulerId(null); setRaison(""); }}
                                        className="h-9 px-4 rounded-lg border border-[#2D3748] text-[#9CA3AF] font-bold text-[11px] uppercase tracking-wider"
                                      >
                                        Garder
                                      </button>
                                    </div>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-[#6b7280] mt-2">
            Les paliers ne se défont pas : annuler une recrue fait baisser le compteur, pas
            l&apos;historique.
          </p>
        </section>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] max-w-[92vw] rounded-lg bg-[#1A1D24] border border-[#2D3748] px-5 py-3 shadow-lg">
          <span className="text-[13px] font-bold text-white">{toast}</span>
        </div>
      )}
    </div>
  );
}

function Case({ coche, onClick }: { coche: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={coche}
      className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${
        coche ? "bg-[#22C55E] border-[#22C55E]" : "border-[#2D3748] hover:border-[#4a4d56]"
      }`}
    >
      {coche && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      )}
    </button>
  );
}
