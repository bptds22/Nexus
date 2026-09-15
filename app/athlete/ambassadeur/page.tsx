"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SchoolSelect from "@/components/ui/SchoolSelect";
import { createClient } from "@/lib/supabase/client";
import {
  chargerTableau, revendiquer, basculerBadge, MESSAGES, PALIERS,
  type TableauAmbassadeur, type LigneRevendication,
} from "@/lib/queries/athlete/ambassadeur";

/* ═══════════════════════════════════════════════════════════════════════════
   /athlete/ambassadeur — l'athlète déclare les personnes qu'il a amenées.

   ── GABARIT ─────────────────────────────────────────────────────────────────
   Calqué sur /athlete/transfert : un `page.tsx` seul, aucune branche
   IS_CAPACITOR, `pb-8` + `nx-safe-top` sur le header (le layout athlète ne
   pose AUCUN padding-top en Capacitor — chaque page gère son haut). La garde
   d'accès est entièrement héritée du layout : session, rôle, onboarding,
   désactivation, maintenance. Rien à écrire ici.

   ── CE QUE CET ÉCRAN NE MONTRE JAMAIS ───────────────────────────────────────
   L'identité de la personne trouvée. La liste affiche le prénom et le nom que
   L'ATHLÈTE A TAPÉS — il ne peut donc rien y apprendre. C'est la raison d'être
   de la projection `ambassadeur_mon_tableau()` : la table est fermée
   (une seule policy SELECT, `is_admin()`), et une lecture directe rendrait
   `filleul_athlete_id` et `candidats`, c'est-à-dire l'identité de mineurs que
   la RLS de `athletes` lui refuse partout ailleurs.

   Même discipline sur les MESSAGES : « deja_parrainee » ne dit pas « quelqu'un
   d'autre l'a déclarée », ce qui confirmerait que la personne a un compte.

   ── LE BADGE N'EST JAMAIS IMPOSÉ ────────────────────────────────────────────
   Au palier 5, il devient DISPONIBLE. La bascule est ici, et elle est le seul
   chemin : le catalogue porte `ambassadeur` en `actif = false`, donc aucun
   picker — ni coach, ni admin, ni athlète, ni binaire mobile en magasin — ne
   le propose. Et il prend une des CINQ places de la ligne de badges : si elle
   est pleine, la RPC rend `plafond` et on le dit, plutôt que de laisser le
   trigger lever un message que personne ne comprendrait.
   ═══════════════════════════════════════════════════════════════════════════ */

const OR = "#F59E0B";

interface TeamRow { id: string; name: string }

export default function AthleteAmbassadeurPage() {
  const [tableau, setTableau] = useState<TableauAmbassadeur | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [courriel, setCourriel] = useState("");
  const [sansCourriel, setSansCourriel] = useState(false);
  const [ecoleId, setEcoleId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [equipes, setEquipes] = useState<TeamRow[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [bascule, setBascule] = useState(false);

  const montrer = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4200); };

  const recharger = useCallback(async () => {
    try {
      setTableau(await chargerTableau());
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => { recharger(); }, [recharger]);

  /* Les équipes de l'école choisie. La RLS de `teams` laisse tout compte
     authentifié lire celles des SECONDAIRE, CEGEP et LIGUE_CIVILE — c'est
     précisément le périmètre dont on a besoin, et rien de plus. */
  useEffect(() => {
    if (!ecoleId) { setEquipes([]); setTeamId(null); return; }
    let vivant = true;
    (async () => {
      const { data } = await createClient()
        .from("teams").select("id, name").eq("school_id", ecoleId).order("name");
      if (vivant) setEquipes((data ?? []) as TeamRow[]);
    })();
    return () => { vivant = false; };
  }, [ecoleId]);

  const discriminant = sansCourriel ? !!ecoleId || !!teamId : courriel.trim().length > 0;
  const peutEnvoyer = prenom.trim() && nom.trim() && discriminant && !envoi;

  const envoyer = async () => {
    if (!peutEnvoyer) return;
    setEnvoi(true);
    try {
      const r = await revendiquer({
        prenom, nom,
        courriel: sansCourriel ? null : courriel,
        ecoleId: sansCourriel ? ecoleId : null,
        teamId: sansCourriel ? teamId : null,
      });
      montrer(MESSAGES[r.motif] ?? "Réessaie dans un instant.");
      if (r.ok) {
        setPrenom(""); setNom(""); setCourriel("");
        setEcoleId(null); setTeamId(null); setSansCourriel(false);
        await recharger();
        window.dispatchEvent(new Event("notifications-updated"));
      } else {
        /* Un refus consomme quand même une recherche : le compteur est la
           borne d'énumération, il monte à chaque tentative. On rafraîchit
           pour que « il te reste N recherches » ne mente pas. */
        await recharger();
      }
    } catch (e) {
      montrer(e instanceof Error ? e.message : "Réessaie dans un instant.");
      await recharger();
    } finally {
      setEnvoi(false);
    }
  };

  const changerBadge = async (actif: boolean) => {
    setBascule(true);
    try {
      const r = await basculerBadge(actif);
      if (r.ok) {
        montrer(actif ? "Badge ajouté à ta fiche." : "Badge retiré de ta fiche.");
      } else if (r.motif === "plafond") {
        montrer("Ta ligne de badges est pleine (5). Retires-en un depuis ton profil, puis reviens.");
      } else if (r.motif === "palier_non_atteint") {
        montrer("Il te faut 5 recrues confirmées.");
      } else {
        montrer("Impossible pour l'instant.");
      }
      await recharger();
    } catch (e) {
      montrer(e instanceof Error ? e.message : "Impossible pour l'instant.");
    } finally {
      setBascule(false);
    }
  };

  const prochain = useMemo(() => {
    const n = tableau?.confirmes ?? 0;
    return PALIERS.find((p) => n < p) ?? null;
  }, [tableau]);

  if (chargement) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-8">
        <div className="h-40 flex items-center justify-center">
          <div className="w-7 h-7 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const n = tableau?.confirmes ?? 0;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-8">
      <header className="mb-6 nx-safe-top">
        <h1 className="font-head text-[26px] font-black text-white uppercase tracking-tight">
          Ambassadeur
        </h1>
        <p className="text-[13px] text-[#9CA3AF] mt-1">
          Déclare les personnes que tu as amenées sur Nexus.
        </p>
      </header>

      {erreur && (
        <div className="mb-5 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3">
          <p className="text-[13px] text-[#FCA5A5]">{erreur}</p>
        </div>
      )}

      {/* ── Compteur + paliers ─────────────────────────────────── */}
      <section className="rounded-xl border border-[#2D3748] bg-[#1A1D24] p-5 mb-5">
        <div className="flex items-end gap-3 flex-wrap">
          <span className="font-head text-[42px] leading-none font-black" style={{ color: OR }}>{n}</span>
          <span className="text-[13px] text-[#9CA3AF] pb-1.5">
            {n <= 1 ? "recrue confirmée" : "recrues confirmées"}
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          {PALIERS.map((p) => {
            const atteint = (tableau?.paliers ?? []).includes(p);
            return (
              <div
                key={p}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-center transition-colors ${
                  atteint
                    ? "border-[#F59E0B]/45 bg-[#F59E0B]/10"
                    : "border-[#2D3748] bg-[#111317]"
                }`}
              >
                <div
                  className="font-head text-[17px] font-black"
                  style={{ color: atteint ? OR : "#4a4d56" }}
                >
                  {p}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#6b7280] mt-0.5">
                  {p === 3 ? "Ta story" : p === 5 ? "Le badge" : "Élite"}
                </div>
              </div>
            );
          })}
        </div>

        {prochain && (
          <p className="text-[12px] text-[#6b7280] mt-3">
            Encore {prochain - n} pour le palier {prochain}.
          </p>
        )}
      </section>

      {/* ── Le badge ───────────────────────────────────────────── */}
      {tableau?.badge_debloque && (
        <section className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/[0.07] p-5 mb-5">
          <div className="flex items-center gap-4 flex-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/badges/badge-ambassadeur.svg" alt="" width={56} height={56} className="shrink-0" />
            <div className="flex-1 min-w-[180px]">
              <h2 className="font-head text-[15px] font-black uppercase tracking-tight text-white">
                Badge Ambassadeur
              </h2>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                Il prend une des cinq places de ta ligne de badges. À toi de voir.
              </p>
            </div>
            <button
              type="button"
              onClick={() => changerBadge(!tableau.badge_porte)}
              disabled={bascule}
              className={`px-4 py-2.5 rounded-lg text-[12px] font-bold uppercase tracking-[0.12em] transition-colors disabled:opacity-50 ${
                tableau.badge_porte
                  ? "border border-[#2D3748] text-[#9CA3AF] hover:text-white"
                  : "bg-[#F59E0B] text-[#111317] hover:brightness-110"
              }`}
            >
              {bascule ? "..." : tableau.badge_porte ? "Retirer" : "L'afficher"}
            </button>
          </div>
        </section>
      )}

      {/* ── Déclarer ───────────────────────────────────────────── */}
      <section className="rounded-xl border border-[#2D3748] bg-[#1A1D24] p-5 mb-5">
        <h2 className="font-head text-[15px] font-black uppercase tracking-tight text-white">
          Déclarer une recrue
        </h2>
        <p className="text-[12px] text-[#6b7280] mt-1">
          Elle doit déjà avoir un compte Nexus.
          {typeof tableau?.recherches_restantes === "number" && (
            <> {" · "}Il te reste {tableau.recherches_restantes} recherche
              {tableau.recherches_restantes === 1 ? "" : "s"} aujourd&apos;hui.</>
          )}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <Champ label="Prénom" value={prenom} onChange={setPrenom} placeholder="Alex" />
          <Champ label="Nom" value={nom} onChange={setNom} placeholder="Tremblay" />
        </div>

        {!sansCourriel ? (
          <div className="mt-3">
            <Champ
              label="Son courriel"
              value={courriel}
              onChange={setCourriel}
              placeholder="alex@exemple.com"
              type="email"
            />
            <button
              type="button"
              onClick={() => setSansCourriel(true)}
              className="mt-2 text-[12px] text-[#9CA3AF] underline underline-offset-2 hover:text-white"
            >
              Je ne connais pas son courriel
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div>
              <Label>Son école ou son club</Label>
              <SchoolSelect value={ecoleId} onChange={(id) => setEcoleId(id)} />
            </div>
            {equipes.length > 0 && (
              <div>
                <Label>Son équipe (optionnel)</Label>
                <select
                  value={teamId ?? ""}
                  onChange={(e) => setTeamId(e.target.value || null)}
                  className="w-full rounded-lg bg-[#111317] border border-[#2D3748] px-3 py-2.5 text-[14px] text-white focus:border-[#E63946] outline-none"
                >
                  <option value="">—</option>
                  {equipes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}
            <button
              type="button"
              onClick={() => { setSansCourriel(false); setEcoleId(null); setTeamId(null); }}
              className="text-[12px] text-[#9CA3AF] underline underline-offset-2 hover:text-white"
            >
              J&apos;ai son courriel finalement
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={envoyer}
          disabled={!peutEnvoyer}
          className="mt-4 w-full sm:w-auto px-5 py-3 rounded-lg bg-[#E63946] text-white text-[12px] font-bold uppercase tracking-[0.14em] hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100 transition"
        >
          {envoi ? "..." : "Déclarer"}
        </button>
      </section>

      {/* ── Mes déclarations ───────────────────────────────────── */}
      <section className="rounded-xl border border-[#2D3748] bg-[#1A1D24] p-5">
        <h2 className="font-head text-[15px] font-black uppercase tracking-tight text-white mb-3">
          Mes déclarations
        </h2>
        {(tableau?.revendications.length ?? 0) === 0 ? (
          <p className="text-[13px] text-[#6b7280]">Rien encore.</p>
        ) : (
          <ul className="divide-y divide-[#2D3748]/60">
            {tableau!.revendications.map((r) => <Ligne key={r.id} r={r} />)}
          </ul>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] max-w-[92vw] rounded-lg bg-[#1A1D24] border border-[#2D3748] px-5 py-3 shadow-lg">
          <span className="text-[13px] font-bold text-white">{toast}</span>
        </div>
      )}
    </div>
  );
}

/* ── Primitives ──────────────────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[11px] font-bold tracking-[0.14em] uppercase text-[#6b7280] mb-1.5">
      {children}
    </span>
  );
}

function Champ({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg bg-[#111317] border border-[#2D3748] px-3 py-2.5 text-[14px] text-white placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none"
      />
    </label>
  );
}

const PASTILLE: Record<LigneRevendication["statut"], { t: string; c: string; b: string }> = {
  CONFIRMEE:  { t: "Confirmée",  c: "#22C55E", b: "rgba(34,197,94,0.14)" },
  EN_ATTENTE: { t: "On vérifie", c: "#F59E0B", b: "rgba(245,158,11,0.14)" },
  REJETEE:    { t: "Écartée",    c: "#9CA3AF", b: "rgba(156,163,175,0.12)" },
};

function Ligne({ r }: { r: LigneRevendication }) {
  const p = PASTILLE[r.statut];
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      {/* Le prénom et le nom viennent de la SAISIE de l'athlète, pas de la
          fiche trouvée. Il ne peut rien apprendre d'une ligne qu'il a écrite. */}
      <span className="text-[14px] text-white truncate">{r.prenom} {r.nom}</span>
      <span
        className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.1em]"
        style={{ color: p.c, backgroundColor: p.b }}
      >
        {p.t}
      </span>
    </li>
  );
}
