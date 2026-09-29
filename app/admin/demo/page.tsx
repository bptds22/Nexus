"use client";

/* ═══════════════════════════════════════════════════════════════
   Admin — inscrits à la démo du 12 octobre (/12octobre).
   Lecture : policy demo_inscriptions_admin_select (is_admin()). La page
   ne fait que lire et exporter (xlsx) ; elle montre aussi l'état des deux
   courriels (confirmation, avis à info@) pour repérer un envoi raté.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROLES_DEMO, INTERETS_DEMO, libelleParticipation, type Participation } from "@/lib/demo/demo12Octobre";
import type { CelluleXlsx } from "@/lib/export/xlsx";

interface Ligne {
  id: string;
  prenom: string;
  nom: string;
  courriel: string;
  cegep_autre: string | null;
  role: string | null;
  interets: string[];
  interet_autre: string | null;
  veut_compte: boolean;
  participation: Participation;
  presentation_1a1: boolean;
  nb_soumissions: number;
  cree_le: string;
  modifie_le: string;
  confirmation_statut: string;
  avis_statut: string;
  schools: { name: string } | null;
  sports: { nom: string } | null;
}

const roleLibelle = (r: string | null) => ROLES_DEMO.find((x) => x.valeur === r)?.libelle ?? "—";
const interetsLibelle = (l: Ligne) =>
  l.interets.map((i) => (i === "AUTRE" && l.interet_autre ? `Autre : ${l.interet_autre}` : INTERETS_DEMO.find((x) => x.valeur === i)?.libelle ?? i)).join(" · ") || "—";
const cegepLibelle = (l: Ligne) => l.schools?.name ?? (l.cegep_autre ? `Autre : ${l.cegep_autre}` : "—");
const dateHeure = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const STATUT: Record<string, string> = { ENVOYE: "Envoyé", A_ENVOYER: "À envoyer", EN_COURS: "En cours", ECHEC: "Échec" };

export default function AdminDemoPage() {
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void createClient()
      .from("demo_inscriptions")
      .select("id, prenom, nom, courriel, cegep_autre, role, interets, interet_autre, veut_compte, participation, presentation_1a1, nb_soumissions, cree_le, modifie_le, confirmation_statut, avis_statut, schools:cegep_id(name), sports:sport_id(nom)")
      .order("cree_le", { ascending: false })
      .then(({ data, error }) => {
        if (error) setErreur("Lecture impossible.");
        setLignes((data ?? []) as unknown as Ligne[]);
        setChargement(false);
      });
  }, []);

  const totaux = useMemo(() => ({
    DIRECT: lignes.filter((l) => l.participation === "DIRECT").length,
    ENREGISTREMENT: lignes.filter((l) => l.participation === "ENREGISTREMENT").length,
    UN_A_UN: lignes.filter((l) => l.presentation_1a1).length,
    compte: lignes.filter((l) => l.veut_compte).length,
  }), [lignes]);

  const exporter = async () => {
    const { construireXlsx } = await import("@/lib/export/xlsx");
    const t = (v: string): CelluleXlsx => ({ t: "texte", v });
    const octets = await construireXlsx(
      "Démo 12 octobre",
      [
        { titre: "Inscrit le", largeur: 17 }, { titre: "Prénom", largeur: 14 }, { titre: "Nom", largeur: 16 },
        { titre: "Courriel", largeur: 30 }, { titre: "Cégep", largeur: 30 }, { titre: "Sport", largeur: 14 },
        { titre: "Rôle", largeur: 18 }, { titre: "Intérêts", largeur: 36 }, { titre: "Intérêt compte", largeur: 12 },
        { titre: "Choix", largeur: 18 }, { titre: "Présentation 1:1", largeur: 10 }, { titre: "Soumissions", largeur: 10 },
        { titre: "Confirmation", largeur: 12 }, { titre: "Avis info@", largeur: 12 },
      ],
      lignes.map((l) => [
        { t: "date", v: dateHeure(l.cree_le) }, t(l.prenom), t(l.nom), t(l.courriel), t(cegepLibelle(l)),
        t(l.sports?.nom ?? "—"), t(roleLibelle(l.role)), t(interetsLibelle(l)), t(l.veut_compte ? "Oui" : "Non"),
        t(libelleParticipation[l.participation]), t(l.presentation_1a1 ? "Oui" : "Non"), { t: "nombre", v: l.nb_soumissions },
        t(STATUT[l.confirmation_statut] ?? l.confirmation_statut), t(STATUT[l.avis_statut] ?? l.avis_statut),
      ]),
    );
    const url = URL.createObjectURL(new Blob([octets as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `demo-12-octobre-inscrits-${dateHeure(new Date().toISOString()).slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-head text-2xl font-black text-white uppercase tracking-tight">Démo du 12 octobre</h1>
          <p className="text-[13px] text-[#9CA3AF] mt-1">
            {lignes.length} inscrit{lignes.length > 1 ? "s" : ""} · {totaux.DIRECT} en direct · {totaux.ENREGISTREMENT} enregistrement · {totaux.UN_A_UN} demandent un 1:1 · {totaux.compte} intéressés par un compte
          </p>
        </div>
        <button type="button" onClick={() => void exporter()} disabled={lignes.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 text-white text-[13px] font-bold">
          <Download size={16} /> Exporter (xlsx)
        </button>
      </div>

      {erreur && <p role="alert" className="text-[13px] text-[#FCA5A5] mb-4">{erreur}</p>}
      {chargement ? (
        <p className="text-[13px] text-[#6b7280]">Chargement…</p>
      ) : lignes.length === 0 ? (
        <p className="text-[13px] text-[#6b7280]">Aucune inscription pour l&apos;instant.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#2D3748]">
          <table className="w-full text-[13px]">
            <thead className="bg-[#1A1D24] text-[11px] uppercase tracking-wider text-[#6b7280]">
              <tr>
                {["Inscrit le", "Nom", "Courriel", "Cégep", "Sport", "Rôle", "Intérêts", "Compte", "Choix", "1:1", "Courriels"].map((h) => (
                  <th key={h} className="text-left font-bold px-3 py-2.5 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className="border-t border-[#2D3748] text-[#E5E7EB] align-top">
                  <td className="px-3 py-2.5 whitespace-nowrap text-[#9CA3AF]">{dateHeure(l.cree_le)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-white font-semibold">{l.prenom} {l.nom}{l.nb_soumissions > 1 && <span className="ml-1 text-[11px] text-[#6b7280]">×{l.nb_soumissions}</span>}</td>
                  <td className="px-3 py-2.5"><a href={`mailto:${l.courriel}`} className="hover:text-[#E63946]">{l.courriel}</a></td>
                  <td className="px-3 py-2.5">{cegepLibelle(l)}</td>
                  <td className="px-3 py-2.5">{l.sports?.nom ?? "—"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{roleLibelle(l.role)}</td>
                  <td className="px-3 py-2.5 min-w-[200px]">{interetsLibelle(l)}</td>
                  <td className="px-3 py-2.5">{l.veut_compte ? "Oui" : "Non"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{libelleParticipation[l.participation]}</td>
                  <td className="px-3 py-2.5">{l.presentation_1a1 ? "Oui" : "Non"}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-[12px]">
                    <span className={l.confirmation_statut === "ECHEC" ? "text-[#FCA5A5]" : "text-[#9CA3AF]"}>Conf. : {STATUT[l.confirmation_statut] ?? l.confirmation_statut}</span><br />
                    <span className={l.avis_statut === "ECHEC" ? "text-[#FCA5A5]" : "text-[#9CA3AF]"}>Avis : {STATUT[l.avis_statut] ?? l.avis_statut}</span>
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
