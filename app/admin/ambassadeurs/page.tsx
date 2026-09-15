"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════════════════
   /admin/ambassadeurs — la contrepartie administrative du programme.

   Trois choses, dans cet ordre : la FILE (les homonymies à départager, seul
   endroit où quelqu'un attend une décision), le CLASSEMENT (compteurs,
   paliers, annulation), le CARNET (post Instagram, chandail).

   ── POURQUOI CETTE PAGE LIT LES TABLES EN DIRECT ────────────────────────────
   L'athlète passe par une projection parce que la table porte l'identité de
   tiers mineurs. L'administrateur, lui, A le droit de la voir : la policy
   `ambassadeur revendications admin read` est `is_admin()`, et il lit déjà
   `athletes` en entier (`admins read all`). Une projection ici n'ajouterait
   aucune garantie — elle ne ferait que dupliquer la RLS en JavaScript.

   ── LES ÉCRITURES, ELLES, PASSENT PAR RPC ───────────────────────────────────
   `ambassadeur_admin_trancher` — parce qu'une confirmation peut heurter
   l'index unique (course avec un autre parrain) et doit rendre un motif, pas
   un 23505 dont le message nomme l'index. Seul `ambassadeur_suivi` s'écrit en
   direct : c'est un carnet, sans contrainte de course.
   ═══════════════════════════════════════════════════════════════════════════ */

interface Candidat {
  athlete_id: string;
  prenom: string | null;
  nom: string | null;
  ecole: string | null;
  equipe: string | null;
  /* Les deux DISCRIMINANTS. Sans eux, deux homonymes de même école et de même
     équipe s'affichent à l'identique et il n'y a rien à trancher. Le courriel
     est masqué en base (public.masquer_courriel) : il arrive déjà illisible,
     l'écran n'a rien à tronquer lui-même. */
  promotion: number | null;
  courriel_masque: string | null;
}

interface Revendication {
  id: string;
  parrain_athlete_id: string;
  prenom: string;
  nom: string;
  statut: "EN_ATTENTE" | "CONFIRMEE" | "REJETEE";
  methode: string;
  candidats: Candidat[] | null;
  created_at: string;
  raison_rejet: string | null;
  filleul_athlete_id: string | null;
}

interface Ambassadeur {
  athlete_id: string;
  nom: string;
  courriel: string | null;
  confirmes: number;
  paliers: number[];
  post_ig_le: string | null;
  chandail_envoye_le: string | null;
}

const dateCourte = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-CA", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function AdminAmbassadeursPage() {
  const [file, setFile] = useState<Revendication[]>([]);
  const [classement, setClassement] = useState<Ambassadeur[]>([]);
  const [chargement, setChargement] = useState(true);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [rejetId, setRejetId] = useState<string | null>(null);
  const [raison, setRaison] = useState("");

  const montrer = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4000); };

  /* LECTURE PURE — elle ne touche à AUCUN état, elle RENVOIE.
     C'est ce qui permet à l'effet ci-dessous de poser l'état dans un callback
     plutôt que dans son corps synchrone (react-hooks/set-state-in-effect), et
     accessoirement ce qui rend l'annulation possible au démontage : un écran
     quitté pendant les quatre requêtes ne pose plus rien. */
  const lire = useCallback(async (): Promise<
    { file: Revendication[]; classement: Ambassadeur[] } | null
  > => {
    const supabase = createClient();

    const { data: revs, error } = await supabase
      .from("ambassadeur_revendications")
      .select("id, parrain_athlete_id, prenom, nom, statut, methode, candidats, created_at, raison_rejet, filleul_athlete_id")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[AdminAmbassadeurs] lecture:", error.message);
      return null;
    }
    const lignes = (revs ?? []) as unknown as Revendication[];
    const enAttente = lignes.filter((r) => r.statut === "EN_ATTENTE");

    /* Le classement se construit ici plutôt qu'en SQL : les parrains sont au
       plus quelques centaines, et une vue de plus serait un objet à maintenir
       (et à re-durcir à chaque CREATE OR REPLACE — cf. le piège documenté sur
       top_athletes_view). */
    const parParrain = new Map<string, number>();
    for (const r of lignes) {
      if (r.statut !== "CONFIRMEE") continue;
      parParrain.set(r.parrain_athlete_id, (parParrain.get(r.parrain_athlete_id) ?? 0) + 1);
    }
    const ids = [...new Set(lignes.map((r) => r.parrain_athlete_id))];
    if (ids.length === 0) return { file: enAttente, classement: [] };

    const [{ data: fiches }, { data: paliers }, { data: suivi }] = await Promise.all([
      supabase.from("athletes").select("id, first_name, last_name, email").in("id", ids),
      supabase.from("ambassadeur_paliers").select("athlete_id, palier").in("athlete_id", ids),
      supabase.from("ambassadeur_suivi").select("athlete_id, post_ig_le, chandail_envoye_le").in("athlete_id", ids),
    ]);

    const pal = new Map<string, number[]>();
    for (const p of (paliers ?? []) as { athlete_id: string; palier: number }[]) {
      pal.set(p.athlete_id, [...(pal.get(p.athlete_id) ?? []), p.palier].sort((a, b) => a - b));
    }
    const sui = new Map(((suivi ?? []) as Ambassadeur[]).map((s) => [s.athlete_id, s]));

    return {
      file: enAttente,
      classement: ((fiches ?? []) as { id: string; first_name: string; last_name: string; email: string | null }[])
        .map((f) => ({
          athlete_id: f.id,
          nom: `${f.first_name ?? ""} ${f.last_name ?? ""}`.trim() || "—",
          courriel: f.email,
          confirmes: parParrain.get(f.id) ?? 0,
          paliers: pal.get(f.id) ?? [],
          post_ig_le: sui.get(f.id)?.post_ig_le ?? null,
          chandail_envoye_le: sui.get(f.id)?.chandail_envoye_le ?? null,
        }))
        .sort((a, b) => b.confirmes - a.confirmes),
    };
  }, []);

  /* Le tic de rafraîchissement : les gestes (arbitrage, cases du carnet) ne
     rechargent pas eux-mêmes, ils incrémentent — et c'est l'effet, seul point
     d'écriture de l'état de liste, qui rejoue la lecture. */
  const [tic, setTic] = useState(0);
  const recharger = useCallback(() => setTic((n) => n + 1), []);

  useEffect(() => {
    let vivant = true;
    lire().then((r) => {
      if (!vivant) return;          // écran quitté pendant la lecture
      if (r) { setFile(r.file); setClassement(r.classement); }
      setChargement(false);
    });
    return () => { vivant = false; };
  }, [lire, tic]);

  async function trancher(id: string, action: string, filleul?: string, motif?: string) {
    setOccupe(id);
    const { data, error } = await createClient().rpc("ambassadeur_admin_trancher", {
      p_revendication_id: id,
      p_action: action,
      p_filleul_athlete_id: filleul ?? null,
      p_raison: motif ?? null,
    });
    setOccupe(null);
    if (error) { montrer(error.message); return; }
    const r = data as unknown as { ok: boolean; motif?: string };
    if (!r.ok) {
      montrer(
        r.motif === "deja_parrainee"
          ? "Cette personne est déjà créditée à un autre parrain — le premier arrivé garde."
          : `Refusé : ${r.motif}`,
      );
    } else {
      montrer(action === "confirmer" ? "Confirmée." : "Écartée.");
      setRejetId(null); setRaison("");
    }
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

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
          Ambassadeurs
        </h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Les athlètes déclarent les personnes qu&apos;ils ont amenées. Une concordance
          certaine se confirme seule ; les homonymies atterrissent ici.
        </p>
      </div>

      {chargement ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── File d'attente ─────────────────────────────────── */}
          <section>
            <h2 className="font-head text-[13px] font-black uppercase tracking-[0.18em] text-[#6b7280] mb-3">
              À départager ({file.length})
            </h2>
            {file.length === 0 ? (
              <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] px-6 py-10 text-center">
                <p className="text-[14px] text-[#9CA3AF]">Rien à départager.</p>
                <p className="text-[12px] text-[#6b7280] mt-1">
                  Une revendication n&apos;arrive ici que si plusieurs athlètes portent le nom déclaré.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {file.map((r) => (
                  <div key={r.id} className="bg-[#1A1D24] rounded-xl border border-[#F59E0B]/30 p-5">
                    <div className="flex items-center gap-2 flex-wrap mb-3">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#F59E0B]/15 text-[#F59E0B]">
                        {r.methode === "nom_equipe" ? "nom + équipe" : "nom + école"}
                      </span>
                      <span className="text-[11px] text-[#6b7280]">déclarée le {dateCourte(r.created_at)}</span>
                    </div>
                    <h3 className="font-head text-lg font-black text-white tracking-tight">
                      {r.prenom} {r.nom}
                    </h3>
                    <p className="text-[12px] text-[#6b7280] mt-0.5">
                      Saisie du parrain. Choisis la bonne personne, ou écarte.
                    </p>

                    <div className="mt-4 space-y-2">
                      {(r.candidats ?? []).map((c) => (
                        <div key={c.athlete_id} className="flex items-center justify-between gap-3 flex-wrap rounded-lg bg-[#111317] border border-[#2D3748] px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-[14px] text-white">{c.prenom} {c.nom}</p>
                            <p className="text-[12px] text-[#6b7280] truncate">
                              {c.ecole ?? "sans école"}{c.equipe ? ` · ${c.equipe}` : ""}
                            </p>
                            {/* La ligne qui permet de trancher. En police
                                monospace : deux masques ne se comparent à
                                l'œil que si les caractères s'alignent. */}
                            <p className="text-[12px] text-[#9CA3AF] mt-0.5 font-mono truncate">
                              {c.promotion ? `Promo ${c.promotion}` : "promo inconnue"}
                              {c.courriel_masque ? ` · ${c.courriel_masque}` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => trancher(r.id, "confirmer", c.athlete_id)}
                            disabled={occupe === r.id}
                            className="h-9 px-4 rounded-lg bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold text-[11px] uppercase tracking-wider transition-colors disabled:opacity-50"
                          >
                            C&apos;est elle
                          </button>
                        </div>
                      ))}
                    </div>

                    {rejetId === r.id ? (
                      <div className="mt-4 flex gap-2 flex-wrap">
                        <input
                          value={raison}
                          onChange={(e) => setRaison(e.target.value)}
                          placeholder="Motif (consigné)"
                          className="flex-1 min-w-[200px] rounded-lg bg-[#111317] border border-[#2D3748] px-3 py-2 text-[13px] text-white outline-none focus:border-[#E63946]"
                        />
                        <button
                          type="button"
                          onClick={() => trancher(r.id, "rejeter", undefined, raison)}
                          disabled={!raison.trim() || occupe === r.id}
                          className="h-10 px-4 rounded-lg bg-[#EF4444] text-white font-bold text-[11px] uppercase tracking-wider disabled:opacity-40"
                        >
                          Écarter
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRejetId(null); setRaison(""); }}
                          className="h-10 px-4 rounded-lg border border-[#2D3748] text-[#9CA3AF] font-bold text-[11px] uppercase tracking-wider"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setRejetId(r.id); setRaison(""); }}
                        className="mt-4 text-[12px] text-[#EF4444] underline underline-offset-2"
                      >
                        Aucune de celles-ci
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Classement + carnet ────────────────────────────── */}
          <section>
            <h2 className="font-head text-[13px] font-black uppercase tracking-[0.18em] text-[#6b7280] mb-3">
              Ambassadeurs ({classement.length})
            </h2>
            {classement.length === 0 ? (
              <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] px-6 py-10 text-center">
                <p className="text-[14px] text-[#9CA3AF]">Personne n&apos;a encore déclaré de recrue.</p>
              </div>
            ) : (
              <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-[#2D3748]">
                      {["Athlète", "Confirmées", "Paliers", "Post IG", "Chandail"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b7280]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {classement.map((a) => (
                      <tr key={a.athlete_id} className="border-b border-[#2D3748]/50 last:border-0">
                        <td className="px-4 py-3">
                          <p className="text-[14px] text-white">{a.nom}</p>
                          <p className="text-[11px] text-[#6b7280]">{a.courriel ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-head text-[18px] font-black" style={{ color: a.confirmes >= 10 ? "#F59E0B" : "#fff" }}>
                            {a.confirmes}
                          </span>
                        </td>
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
                          <Case coche={!!a.post_ig_le} onClick={() => cocher(a.athlete_id, "post_ig_le", a.post_ig_le)} />
                        </td>
                        <td className="px-4 py-3">
                          <Case coche={!!a.chandail_envoye_le} onClick={() => cocher(a.athlete_id, "chandail_envoye_le", a.chandail_envoye_le)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-[#6b7280] mt-2">
              Les paliers ne se défont pas : annuler une revendication fait baisser le
              compteur, pas l&apos;historique.
            </p>
          </section>
        </>
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
