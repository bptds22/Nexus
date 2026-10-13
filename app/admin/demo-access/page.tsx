"use client";

/* ═══════════════════════════════════════════════════════════════
   Admin — accès à l'enregistrement de la démo (/12octobre → lien par
   jeton). Lecture et statut par deux RPC gardées par is_admin()
   (admin_demo_access_liste, admin_demo_access_statut) : la table
   demo_access n'a aucune policy. Plus récent en haut.
   Révoquer coupe le lien tout de suite ; Réactiver le rouvre (même jeton).
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLES_DEMO } from "@/lib/demo/demo12Octobre";

interface Ligne {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cegep: string | null;
  sport: string | null;
  role: string | null;
  wants_1on1: boolean;
  token: string;
  status: "approved" | "revoked";
  revoked_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
  courriel_statut: string;
  envoi_erreur: string | null;
}

const roleLibelle = (r: string | null) => ROLES_DEMO.find((x) => x.valeur === r)?.libelle ?? "—";
const dateHeure = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const ENVOI: Record<string, string> = { ENVOYE: "Envoyé", A_ENVOYER: "À envoyer", EN_COURS: "En cours", ECHEC: "Échec" };

export default function AdminDemoAccessPage() {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [copie, setCopie] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const { data, error } = await createClient().rpc("admin_demo_access_liste");
    if (error) setErreur("Lecture impossible.");
    setLignes((data ?? []) as Ligne[]);
    setChargement(false);
  }, []);

  useEffect(() => { void charger(); }, [charger]);

  const changerStatut = async (l: Ligne, status: Ligne["status"]) => {
    setEnCours(l.id);
    setErreur(null);
    const { error } = await createClient().rpc("admin_demo_access_statut", { p_id: l.id, p_status: status });
    if (error) setErreur("Le statut n'a pas pu être changé.");
    await charger();
    setEnCours(null);
  };

  const copierLien = async (l: Ligne) => {
    const lien = `${window.location.origin}/12octobre/video?t=${l.token}`;
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(l.id);
      setTimeout(() => setCopie((c) => (c === l.id ? null : c)), 1800);
    } catch {
      setErreur(`Copie impossible : ${lien}`);
    }
  };

  const actifs = lignes.filter((l) => l.status === "approved").length;
  const vus = lignes.filter((l) => l.view_count > 0).length;
  const unAUn = lignes.filter((l) => l.wants_1on1).length;
  const bouton = "px-3 py-1.5 rounded-lg text-[12px] font-bold border transition-colors disabled:opacity-40";

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Accès à la démo</h1>
        <p className="text-[13px] text-[#9CA3AF] mt-1">
          {lignes.length} demande{lignes.length > 1 ? "s" : ""} · {actifs} actif{actifs > 1 ? "s" : ""} · {vus} ont regardé · {unAUn} demandent un 1:1
        </p>
      </div>

      {erreur && <p role="alert" className="text-[13px] text-[#FCA5A5] mb-4 break-all">{erreur}</p>}
      {chargement ? (
        <p className="text-[13px] text-[#6b7280]">Chargement…</p>
      ) : lignes.length === 0 ? (
        <p className="text-[13px] text-[#6b7280]">Aucune demande pour l&apos;instant.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#2D3748]">
          <table className="w-full text-[13px]">
            <thead className="bg-[#1A1D24] text-[11px] uppercase tracking-wider text-[#6b7280]">
              <tr>
                {["Nom", "Cégep", "Courriel", "Rôle", "1:1", "Vues", "Dernière vue", "Statut", ""].map((h, n) => (
                  <th key={n} className="text-left font-bold px-3 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className="border-t border-[#2D3748] text-[#E5E7EB] align-top">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-white font-semibold">{l.first_name} {l.last_name}</span>
                    <br /><span className="text-[11px] text-[#6b7280]">{dateHeure(l.created_at)}</span>
                  </td>
                  <td className="px-3 py-2.5">{l.cegep ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    <a href={`mailto:${l.email}`} className="hover:text-[#E63946]">{l.email}</a>
                    <br />
                    <span className={`text-[11px] ${l.courriel_statut === "ECHEC" ? "text-[#FCA5A5]" : "text-[#6b7280]"}`} title={l.envoi_erreur ?? undefined}>
                      Courriel : {ENVOI[l.courriel_statut] ?? l.courriel_statut}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{roleLibelle(l.role)}</td>
                  <td className="px-3 py-2.5">{l.wants_1on1 ? "Oui" : "Non"}</td>
                  <td className="px-3 py-2.5 tabular-nums">{l.view_count}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-[#9CA3AF]">{dateHeure(l.last_viewed_at)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {l.status === "approved"
                      ? <span className="text-[#22C55E] font-semibold">Actif</span>
                      : <span className="text-[#FCA5A5] font-semibold">Révoqué</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void copierLien(l)}
                        className={`${bouton} border-[#2D3748] text-[#E5E7EB] hover:border-[#9CA3AF]`}>
                        {copie === l.id ? "Copié" : "Copier le lien"}
                      </button>
                      {l.status === "approved" ? (
                        <button type="button" disabled={enCours === l.id} onClick={() => void changerStatut(l, "revoked")}
                          className={`${bouton} border-[#E63946]/40 text-[#E63946] hover:bg-[#E63946]/10`}>
                          Révoquer
                        </button>
                      ) : (
                        <button type="button" disabled={enCours === l.id} onClick={() => void changerStatut(l, "approved")}
                          className={`${bouton} border-[#22C55E]/40 text-[#22C55E] hover:bg-[#22C55E]/10`}>
                          Réactiver
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
