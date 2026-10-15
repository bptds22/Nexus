"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   /admin/prospects-partenaires — cartes prospects de TOUS les partenaires (W4d).

   Base W4a (en prod), lue par ses fonctions admin — aucune table en direct :
   - Cartes actives : partenaire, nom, sport, statut RÉEL (pas celui, masqué,
     que voit le partenaire), source de la réservation, échéance.
   - Issues : réclamée, refusée, expirée, retirée, supprimée. Une réclamation
     s'annule pendant 7 jours (transfert défait, carte restaurée sans lien).
   - Rapprochements : candidats calculés à la demande (critère, force,
     promotion, visible du partenaire ou non) → « Proposer au jeune » ou
     « Écarter » ; puis les décisions passées. Le partenaire n'en voit rien.
   Confirmations en deux temps, jamais de boîte native.
   ═══════════════════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  annulerReclamation,
  chargerProspectsAdmin,
  chargerRapprochementsAdmin,
  ecarterRapprochement,
  LIBELLE_DECISION,
  LIBELLE_SOURCE,
  LIBELLE_STATUT_ADMIN,
  proposerAuJeune,
  type LigneProspectAdmin,
  type RapprochementAdmin,
} from "@/lib/admin/prospectsPartenaires";

function date(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "—";
}
function nomComplet(p: string | null, n: string | null): string {
  return `${p ?? ""} ${n ?? ""}`.trim() || "—";
}
function messageErreur(e: unknown): string {
  return (e as { message?: string })?.message?.replace(/^NEXUS:\s*/, "") ?? "Action impossible.";
}

const titre = "font-head text-[13px] font-black uppercase tracking-[0.18em] text-[#6b7280]";
const carteCls = "rounded-xl border border-[#2D3748] bg-[#1A1D24]";

export default function ProspectsPartenairesAdminPage() {
  const [lignes, setLignes] = useState<LigneProspectAdmin[]>([]);
  const [rappr, setRappr] = useState<RapprochementAdmin[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const supabase = createClient();
    try {
      const [l, r] = await Promise.all([chargerProspectsAdmin(supabase), chargerRapprochementsAdmin(supabase)]);
      setLignes(l);
      setRappr(r);
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setChargement(false);
    }
  }, []);
  useEffect(() => { void charger(); }, [charger]);

  const actives = useMemo(() => lignes.filter((l) => !l.termineeLe), [lignes]);
  const issues = useMemo(() => lignes.filter((l) => l.termineeLe), [lignes]);
  const cartesParId = useMemo(() => new Map(actives.map((c) => [c.carteId, c])), [actives]);
  const candidats = useMemo(() => rappr.filter((r) => r.statut === "CANDIDAT"), [rappr]);
  const decisions = useMemo(
    () => rappr.filter((r) => r.statut !== "CANDIDAT").sort((a, b) => (b.decideLe ?? "").localeCompare(a.decideLe ?? "")),
    [rappr],
  );

  async function agir(cle: string, action: () => Promise<unknown>, succes: string) {
    setOccupe(cle);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, texte: succes });
      setConfirmation(null);
      await charger();
    } catch (e) {
      setMessage({ ok: false, texte: messageErreur(e) });
    } finally {
      setOccupe(null);
    }
  }

  const libelleCarte = (carteId: string) => {
    const c = cartesParId.get(carteId);
    return c ? `${nomComplet(c.prenom, c.nom)} · ${c.sport ?? "—"} · ${c.partenaire ?? "—"}` : "Carte terminée";
  };

  return (
    <div className="px-4 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-8" data-page-admin-prospects>
      <div>
        <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Prospects partenaires</h1>
        <p className="text-[14px] text-[#9CA3AF] mt-1">
          Les cartes des partenaires évaluateurs pour des jeunes absents de Nexus, leurs issues, et les
          rapprochements avec des athlètes déjà inscrits. Le partenaire ne voit jamais un rapprochement.
        </p>
      </div>

      {message && (
        <p role="status" className={`text-[13px] font-semibold ${message.ok ? "text-[#22C55E]" : "text-[#EF4444]"}`}>{message.texte}</p>
      )}
      {erreur && <p className="text-[13px] text-[#EF4444]">{erreur}</p>}

      {chargement ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Rapprochements à décider ───────────────────────────────────── */}
          <section data-section-candidats>
            <h2 className={titre}>Rapprochements à décider ({candidats.length})</h2>
            {candidats.length === 0 ? (
              <p className="text-[13px] text-[#9CA3AF] mt-3">Aucun candidat en attente.</p>
            ) : (
              <ul className={`mt-3 divide-y divide-[#2D3748]/60 ${carteCls}`}>
                {candidats.map((r) => {
                  const cle = `${r.carteId}:${r.athleteId}`;
                  return (
                    <li key={cle} className="px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-white">
                          <span className="text-[#9CA3AF]">Carte :</span> {libelleCarte(r.carteId)}
                        </p>
                        <p className="text-[13px] text-white mt-0.5">
                          <span className="text-[#9CA3AF]">Athlète :</span> {nomComplet(r.athletePrenom, r.athleteNom)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px] font-bold">
                          <span className="px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc]">{r.critere}</span>
                          <span className={`px-2 py-0.5 rounded-full ${r.force === "MOYENNE" ? "bg-[#F59E0B]/15 text-[#F59E0B]" : "bg-[#6B7280]/20 text-[#9CA3AF]"}`}>
                            Force {r.force.toLowerCase()}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#2D3748] text-[#c0c4cc]">
                            Promotion {r.promotionConcorde ? "concorde" : "différente ou inconnue"}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full ${r.visiblePartenaire ? "bg-[#22C55E]/12 text-[#22C55E]" : "bg-[#E63946]/12 text-[#E63946]"}`}>
                            {r.visiblePartenaire ? "Visible du partenaire" : "Non visible du partenaire"}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button type="button" disabled={occupe === cle}
                          onClick={() => void agir(cle, () => proposerAuJeune(createClient(), r.carteId, r.athleteId), "Carte proposée au jeune : il a été notifié.")}
                          className="px-3.5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[12px] font-bold rounded-lg disabled:opacity-50">
                          Proposer au jeune
                        </button>
                        <button type="button" disabled={occupe === cle}
                          onClick={() => void agir(cle, () => ecarterRapprochement(createClient(), r.carteId, r.athleteId), "Rapprochement écarté.")}
                          className="px-3.5 py-2 border border-[#2D3748] text-[#9CA3AF] hover:text-white text-[12px] font-bold rounded-lg disabled:opacity-50">
                          Écarter
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ── Cartes actives ────────────────────────────────────────────── */}
          <section data-section-cartes-actives>
            <h2 className={titre}>Cartes actives ({actives.length})</h2>
            {actives.length === 0 ? (
              <p className="text-[13px] text-[#9CA3AF] mt-3">Aucune carte active.</p>
            ) : (
              <ul className={`mt-3 divide-y divide-[#2D3748]/60 ${carteCls}`}>
                {actives.map((c) => (
                  <li key={c.id} className="px-4 py-3 grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr_1fr] gap-1 sm:gap-3 sm:items-center">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-white">{nomComplet(c.prenom, c.nom)}</p>
                      <p className="text-[12px] text-[#9CA3AF]">{c.partenaire ?? "—"} · {c.sport ?? "—"}</p>
                    </div>
                    <p className="text-[12px] text-white">{LIBELLE_STATUT_ADMIN[c.statut] ?? c.statut}</p>
                    <p className="text-[12px] text-[#9CA3AF]">{c.source ? LIBELLE_SOURCE[c.source] ?? c.source : "Pas de réservation"}</p>
                    <p className="text-[12px] text-[#9CA3AF]">Échéance : {date(c.expireLe)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Issues ────────────────────────────────────────────────────── */}
          <section data-section-issues>
            <h2 className={titre}>Issues ({issues.length})</h2>
            <p className="text-[12px] text-[#6b7280] mt-1">
              Le nom d&apos;une carte réclamée n&apos;est gardé que 7 jours, le temps de pouvoir annuler.
            </p>
            {issues.length === 0 ? (
              <p className="text-[13px] text-[#9CA3AF] mt-3">Aucune issue.</p>
            ) : (
              <ul className={`mt-3 divide-y divide-[#2D3748]/60 ${carteCls}`}>
                {issues.map((i) => (
                  <li key={i.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-white">
                        {LIBELLE_STATUT_ADMIN[i.statut] ?? i.statut}
                        {i.prenom && <span className="font-normal text-[#c8c8cc]"> — {nomComplet(i.prenom, i.nom)}</span>}
                      </p>
                      <p className="text-[12px] text-[#9CA3AF]">
                        {i.partenaire ?? "—"} · {i.sport ?? "—"}
                        {i.source ? ` · ${LIBELLE_SOURCE[i.source] ?? i.source}` : ""} · terminée le {date(i.termineeLe)}
                      </p>
                    </div>
                    {i.annulable && (confirmation === i.id ? (
                      <div className="flex items-center gap-2 flex-wrap rounded-lg border border-[#E63946]/40 bg-[#111317] px-3 py-2">
                        <span className="text-[12px] text-[#c8c8cc]">Défaire le transfert et rendre la carte au partenaire ?</span>
                        <button type="button" disabled={occupe === i.id}
                          onClick={() => void agir(i.id, () => annulerReclamation(createClient(), i.id), "Réclamation annulée : transfert défait, carte rendue au partenaire.")}
                          className="px-3 py-1.5 bg-[#E63946] text-white text-[12px] font-bold rounded-md disabled:opacity-50">
                          {occupe === i.id ? "Annulation…" : "Confirmer"}
                        </button>
                        <button type="button" onClick={() => setConfirmation(null)} className="px-2 py-1.5 text-[12px] text-[#9CA3AF] hover:text-white">
                          Non
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmation(i.id)}
                        className="self-start sm:self-auto px-3.5 py-2 border border-[#E63946]/50 text-[#E63946] hover:bg-[#E63946]/10 text-[12px] font-bold rounded-lg">
                        Annuler la réclamation
                      </button>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Décisions passées ─────────────────────────────────────────── */}
          <section data-section-decisions>
            <h2 className={titre}>Décisions de rapprochement ({decisions.length})</h2>
            {decisions.length === 0 ? (
              <p className="text-[13px] text-[#9CA3AF] mt-3">Aucune décision.</p>
            ) : (
              <ul className={`mt-3 divide-y divide-[#2D3748]/60 ${carteCls}`}>
                {decisions.map((r) => (
                  <li key={`${r.carteId}:${r.athleteId}`} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] text-white">{libelleCarte(r.carteId)} ↔ {nomComplet(r.athletePrenom, r.athleteNom)}</p>
                      <p className="text-[12px] text-[#9CA3AF]">{r.critere} · force {r.force.toLowerCase()} · {r.origine === "AUTO" ? "automatique" : "par Nexus"}</p>
                    </div>
                    <p className="text-[12px] text-white">{LIBELLE_DECISION[r.statut] ?? r.statut}</p>
                    <p className="text-[12px] text-[#6b7280]">{date(r.decideLe)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
