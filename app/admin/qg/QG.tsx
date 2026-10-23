"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceArea,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { FUSEAU_MONTREAL, type Comparaison, type Granularite } from "@/lib/admin/ecranMural";
import type { QgDonnees } from "@/lib/admin/qg";
import { PALETTE_MURALE } from "@/app/admin/_components/paletteMurale";

/* ─────────────────────────────────────────────────────────────────
   QG admin — /admin/qg (décision BP 2026-10-22, lot 1).

   - Onglets Aujourd'hui / Croissance / Recruteurs ; bascule jour /
     semaine / mois : « à date vs même moment », heure de Montréal.
   - Chiffres de GET /api/admin/qg : des nombres seulement (Loi 25).
   - Relu aux 5 minutes, et au retour sur l'onglet s'il a vieilli ; si la
     première lecture échoue, nouvel essai après 30 s.
   - Bouton plein écran (Fullscreen API) : seul le QG passe en plein
     écran, sans le menu. F11 marche aussi.
   - Texte en `em` : la taille de base suit la largeur (vw), plafonnée
     par la hauteur (vh) — lisible à 3440×1440 comme à 1366×768.
───────────────────────────────────────────────────────────────── */

const C = { ...PALETTE_MURALE, violet: "#A78BFA", cyan: "#22D3EE" } as const;
const INTERVALLE_MS = 5 * 60 * 1000;
const REPRISE_MS = 30 * 1000;

const nf = new Intl.NumberFormat("fr-CA");
const fmt = (n: number) => nf.format(n);
const fmtHeure = new Intl.DateTimeFormat("fr-CA", { timeZone: FUSEAU_MONTREAL, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const heure = (d: Date) => fmtHeure.format(d).replace(":", " h ");
const fmtJourCourt = new Intl.DateTimeFormat("fr-CA", { timeZone: FUSEAU_MONTREAL, day: "numeric", month: "short" });

type Onglet = "aujourdhui" | "croissance" | "recruteurs";
const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: "aujourdhui", libelle: "Aujourd'hui" },
  { cle: "croissance", libelle: "Croissance" },
  { cle: "recruteurs", libelle: "Recruteurs" },
];
const PERIODES: { cle: Granularite; libelle: string }[] = [
  { cle: "jour", libelle: "Jour" },
  { cle: "semaine", libelle: "Semaine" },
  { cle: "mois", libelle: "Mois" },
];
/** Ce que « maintenant » et « avant » veulent dire, dans chaque période. */
const MOTS: Record<Granularite, { courant: string; avant: string; serie: string }> = {
  jour: { courant: "Aujourd'hui", avant: "hier à la même heure", serie: "30 derniers jours" },
  semaine: { courant: "Cette semaine", avant: "semaine dernière au même moment", serie: "12 semaines, du lundi" },
  mois: { courant: "Ce mois-ci", avant: "mois dernier au même moment", serie: "12 mois" },
};

const ROLES: { cle: string; libelle: string; un: string; couleur: string }[] = [
  { cle: "ATHLETE", libelle: "Athlètes", un: "athlète", couleur: C.bleu },
  { cle: "COACH", libelle: "Coachs", un: "coach", couleur: C.vert },
  { cle: "RECRUTEUR", libelle: "Recruteurs", un: "recruteur", couleur: C.rouge },
  { cle: "PARENT", libelle: "Parents", un: "parent", couleur: C.violet },
  { cle: "PARTNER", libelle: "Partenaires", un: "partenaire", couleur: C.cyan },
  { cle: "ADMIN", libelle: "Admins", un: "admin", couleur: C.pale },
];

type Etat =
  | { kind: "chargement" }
  | { kind: "refus"; message: string }
  | { kind: "pret"; donnees: QgDonnees };

function lireUrl(): { onglet: Onglet; periode: Granularite } {
  try {
    const q = new URLSearchParams(window.location.search);
    const o = q.get("onglet");
    const p = q.get("periode");
    return {
      onglet: o === "croissance" || o === "recruteurs" ? o : "aujourdhui",
      periode: p === "semaine" || p === "mois" ? p : "jour",
    };
  } catch {
    return { onglet: "aujourdhui", periode: "jour" };
  }
}

export default function QG() {
  const [onglet, setOnglet] = useState<Onglet>("aujourdhui");
  const [periode, setPeriode] = useState<Granularite>("jour");
  const [etat, setEtat] = useState<Etat>({ kind: "chargement" });
  const [echec, setEchec] = useState(false);
  const [pleinEcran, setPleinEcran] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const derniereTentative = useRef(0);
  const periodeCourante = useRef<Granularite>("jour");
  const aDesDonnees = useRef(false);
  const reprise = useRef<number | undefined>(undefined);

  // Onglet et période dans l'adresse : un lien rouvre la même vue.
  useEffect(() => {
    const u = lireUrl();
    setOnglet(u.onglet);
    setPeriode(u.periode);
  }, []);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      q.set("onglet", onglet);
      q.set("periode", periode);
      window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`);
    } catch { /* adresse inchangée : sans effet sur la page */ }
  }, [onglet, periode]);

  const charger = useCallback(async (p: Granularite) => {
    derniereTentative.current = Date.now();
    try {
      const r = await fetch(`/api/admin/qg?periode=${p}`, { cache: "no-store" });
      if (r.status === 401 || r.status === 403) {
        setEtat({ kind: "refus", message: r.status === 401 ? "Session expirée — reconnecte-toi." : "Accès réservé aux administrateurs." });
        setEchec(true);
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      const donnees = (await r.json()) as QgDonnees;
      // Une réponse arrivée après un changement de période est ignorée.
      if (donnees.periode !== periodeCourante.current) return;
      setEtat({ kind: "pret", donnees });
      aDesDonnees.current = true;
      setEchec(false);
    } catch {
      // On garde les derniers chiffres ; le point passe à l'orange. Tant
      // qu'aucun chiffre n'est arrivé, on réessaie après 30 s plutôt que 5 min.
      setEchec(true);
      if (!aDesDonnees.current) {
        window.clearTimeout(reprise.current);
        reprise.current = window.setTimeout(() => void charger(periodeCourante.current), REPRISE_MS);
      }
    }
  }, []);

  useEffect(() => {
    periodeCourante.current = periode;
    void charger(periode);
    const minuterie = window.setInterval(() => void charger(periode), INTERVALLE_MS);
    const auRetour = () => {
      if (document.visibilityState === "visible" && Date.now() - derniereTentative.current >= INTERVALLE_MS) void charger(periode);
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      window.clearInterval(minuterie);
      window.clearTimeout(reprise.current);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [periode, charger]);

  useEffect(() => {
    const suivre = () => setPleinEcran(document.fullscreenElement === racine.current);
    document.addEventListener("fullscreenchange", suivre);
    return () => document.removeEventListener("fullscreenchange", suivre);
  }, []);

  const basculerPleinEcran = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void racine.current?.requestFullscreen?.().catch(() => {});
  };

  const d = etat.kind === "pret" ? etat.donnees : null;
  const aJour = d !== null && d.periode === periode && !echec;

  return (
    <div
      ref={racine}
      className="w-full font-sans overflow-auto"
      style={{
        background: C.fond, color: C.texte, minHeight: pleinEcran ? "100vh" : "calc(100vh - 0px)",
        fontSize: "clamp(13px, min(0.7vw, 1.5vh), 26px)",
      }}
    >
      <div className="flex flex-col" style={{ padding: "1.4em 1.6em", gap: "1.1em" }}>
        <header className="flex flex-wrap items-end justify-between" style={{ gap: "1em" }}>
          <div className="flex flex-col" style={{ gap: "0.3em" }}>
            <h1 className="font-head font-bold uppercase tracking-tight leading-none" style={{ fontSize: "2.3em" }}>
              QG <span style={{ color: C.rouge }}>Nexus</span>
            </h1>
            <span style={{ color: C.doux, fontSize: "0.95em" }}>
              {d ? `${MOTS[d.periode].courant} vs ${MOTS[d.periode].avant} · heure de Montréal` : "Heure de Montréal"}
            </span>
          </div>
          <div className="flex flex-wrap items-center" style={{ gap: "0.8em" }}>
            <Statut d={d} aJour={aJour} echec={echec} />
            <Choix
              etiquette="Période"
              options={PERIODES}
              valeur={periode}
              onChange={(p) => { setPeriode(p); }}
            />
            <button
              type="button"
              onClick={basculerPleinEcran}
              className="rounded-[0.6em] font-semibold"
              style={{ border: `1px solid ${C.bord}`, background: C.carte, color: C.texte, padding: "0.55em 0.9em", fontSize: "0.95em" }}
              title="Plein écran (F11 marche aussi)"
            >
              {pleinEcran ? "Quitter le plein écran" : "Plein écran"}
            </button>
          </div>
        </header>

        <nav role="tablist" aria-label="Sections du QG" className="flex flex-wrap" style={{ gap: "0.4em", borderBottom: `1px solid ${C.bord}` }}>
          {ONGLETS.map((o) => (
            <button
              key={o.cle}
              role="tab"
              type="button"
              aria-selected={onglet === o.cle}
              onClick={() => setOnglet(o.cle)}
              className="font-semibold uppercase"
              style={{
                padding: "0.6em 1.1em", fontSize: "0.95em", letterSpacing: "0.08em",
                color: onglet === o.cle ? C.texte : C.doux,
                borderBottom: `0.18em solid ${onglet === o.cle ? C.rouge : "transparent"}`,
                marginBottom: "-1px",
              }}
            >
              {o.libelle}
            </button>
          ))}
        </nav>

        {etat.kind === "chargement" && <Message texte="Chargement des chiffres…" />}
        {etat.kind === "refus" && <Message texte={etat.message} />}
        {d && (
          <div role="tabpanel" style={{ opacity: d.periode === periode ? 1 : 0.55, transition: "opacity 150ms" }}>
            {onglet === "aujourdhui" && <Aujourdhui d={d} />}
            {onglet === "croissance" && <Croissance d={d} />}
            {onglet === "recruteurs" && <Recruteurs d={d} />}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── En-tête ─────────────────────────────────────────────────────── */

function Statut({ d, aJour, echec }: { d: QgDonnees | null; aJour: boolean; echec: boolean }) {
  const texte = d === null
    ? (echec ? "Aucune donnée reçue" : "Première lecture…")
    : `${echec ? "Échec de la mise à jour — chiffres de" : "Mis à jour à"} ${heure(new Date(d.calcule_le))}`;
  return (
    <span className="flex items-center" style={{ gap: "0.5em", color: C.doux, fontSize: "0.95em" }}>
      <span
        aria-label={aJour ? "Chiffres à jour" : "Chiffres en retard"}
        className="rounded-full inline-block"
        style={{ width: "0.75em", height: "0.75em", background: aJour ? C.vert : C.orange, boxShadow: `0 0 0.5em ${aJour ? C.vert : C.orange}` }}
      />
      {texte}
    </span>
  );
}

function Choix<T extends string>({ etiquette, options, valeur, onChange }: {
  etiquette: string; options: { cle: T; libelle: string }[]; valeur: T; onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={etiquette} className="inline-flex rounded-[0.6em]" style={{ border: `1px solid ${C.bord}`, background: C.carte, padding: "0.2em" }}>
      {options.map((o) => (
        <button
          key={o.cle}
          type="button"
          role="radio"
          aria-checked={valeur === o.cle}
          onClick={() => onChange(o.cle)}
          className="rounded-[0.45em] font-semibold"
          style={{
            padding: "0.4em 0.9em", fontSize: "0.95em",
            background: valeur === o.cle ? C.rouge : "transparent",
            color: valeur === o.cle ? "#fff" : C.doux,
          }}
        >
          {o.libelle}
        </button>
      ))}
    </div>
  );
}

function Message({ texte }: { texte: string }) {
  return <div className="flex items-center justify-center" style={{ color: C.doux, fontSize: "1.5em", minHeight: "40vh" }}>{texte}</div>;
}

/* ── Briques ─────────────────────────────────────────────────────── */

function Carte({ titre, sousTitre, children, className = "", lien }: {
  titre: string; sousTitre?: string; children: React.ReactNode; className?: string; lien?: { href: string; texte: string };
}) {
  return (
    <section className={`rounded-[0.9em] flex flex-col min-w-0 ${className}`}
      style={{ background: C.carte, border: `1px solid ${C.bord}`, padding: "1.1em 1.3em", gap: "0.8em" }}>
      <div className="flex items-baseline justify-between flex-wrap" style={{ gap: "0.6em" }}>
        <h2 className="font-bold uppercase" style={{ fontSize: "0.9em", letterSpacing: "0.14em", color: C.doux }}>{titre}</h2>
        {sousTitre && <span style={{ fontSize: "0.85em", color: C.pale }}>{sousTitre}</span>}
      </div>
      {children}
      {lien && (
        <Link href={lien.href} className="self-start underline-offset-4 hover:underline" style={{ color: C.bleu, fontSize: "0.9em" }}>
          {lien.texte} →
        </Link>
      )}
    </section>
  );
}

function Ecart({ v }: { v: Comparaison }) {
  const diff = v.courant - v.precedent;
  const couleur = diff > 0 ? C.vert : diff < 0 ? C.rouge : C.doux;
  const signe = diff > 0 ? "▲" : diff < 0 ? "▼" : "＝";
  const pct = v.precedent > 0 ? ` (${diff > 0 ? "+" : ""}${Math.round((diff / v.precedent) * 100)} %)` : "";
  return (
    <span className="tabular-nums whitespace-nowrap" style={{ color: couleur, fontSize: "1.05em" }}>
      {signe} {diff > 0 ? "+" : ""}{fmt(diff)}{pct}
    </span>
  );
}

// sansComparaison : le chiffre de la période seul, sans écart ni période d'avant
// (comptes connectés — décision BP 2026-10-22, la source ne permet pas encore de
// comparer honnêtement).
function Tuile({ titre, v, g, accent, bas, note, sansComparaison }: {
  titre: string; v: Comparaison; g: Granularite; accent: string; bas?: string; note?: string; sansComparaison?: boolean;
}) {
  return (
    <Carte titre={titre} sousTitre={MOTS[g].courant}>
      <div className="flex items-end justify-between flex-wrap" style={{ gap: "0.8em", borderLeft: `0.25em solid ${accent}`, paddingLeft: "0.8em" }}>
        <span className="font-head font-bold tabular-nums leading-none" style={{ fontSize: "3.1em" }}>{fmt(v.courant)}</span>
        {!sansComparaison && (
          <div className="text-right" style={{ paddingBottom: "0.2em" }}>
            <Ecart v={v} />
            <div style={{ color: C.pale, fontSize: "0.85em" }} title={note}>
              {MOTS[g].avant} : {fmt(v.precedent)}{note ? " *" : ""}
            </div>
          </div>
        )}
      </div>
      {bas && <div style={{ color: C.doux, fontSize: "0.92em" }}>{bas}</div>}
      {note && <div style={{ color: C.pale, fontSize: "0.8em" }}>{sansComparaison ? "" : "* "}{note}</div>}
    </Carte>
  );
}

function Case({ libelle, n, couleur, alerte }: { libelle: string; n: number | string; couleur: string; alerte?: boolean }) {
  return (
    <div className="flex flex-col rounded-[0.6em]" style={{
      padding: "0.6em 0.8em", gap: "0.2em",
      background: alerte ? "rgba(245,165,36,0.08)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${alerte ? "rgba(245,165,36,0.35)" : "transparent"}`,
    }}>
      <span className="font-head font-bold tabular-nums leading-none" style={{ fontSize: "2em", color: couleur }}>
        {typeof n === "number" ? fmt(n) : n}
      </span>
      <span style={{ fontSize: "0.85em", color: C.doux }}>{libelle}</span>
    </div>
  );
}

const styleInfobulle = {
  contentStyle: { background: "#0B1222", border: `1px solid ${C.bord}`, borderRadius: 8, color: C.texte, fontSize: "0.9em" },
  labelStyle: { color: C.doux, marginBottom: 4 },
  itemStyle: { color: C.texte, padding: 0 },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};
const axe = { stroke: C.pale, tick: { fill: C.doux, fontSize: "0.8em" } as const, tickLine: false, axisLine: { stroke: C.bord } };
const enCours = (libelle: string, en_cours: boolean) => (en_cours ? `${libelle} (en cours)` : libelle);

/* ── Aujourd'hui ─────────────────────────────────────────────────── */

function Aujourdhui({ d }: { d: QgDonnees }) {
  const a = d.aujourdhui;
  const v2 = a.consentements_v2;
  const totalV2 = v2.acceptes + v2.refuses + v2.en_attente + v2.jamais_demande;
  const parts = [
    { nom: "Acceptés", n: v2.acceptes, couleur: C.vert },
    { nom: "Refusés", n: v2.refuses, couleur: C.rouge },
    { nom: "En attente", n: v2.en_attente, couleur: C.bleu },
    { nom: "Jamais demandé", n: v2.jamais_demande, couleur: C.pale },
  ];
  const prochaine = a.loi25.prochaine
    ? fmtJourCourt.format(new Date(`${a.loi25.prochaine}T12:00:00Z`))
    : "—";
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3" style={{ gap: "1.1em" }}>
      <Carte titre="Consentements partenaires v2" sousTitre={`${fmt(totalV2)} athlètes admissibles`} className="2xl:col-span-2">
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: "0.7em" }}>
          {parts.map((p) => <Case key={p.nom} libelle={p.nom} n={p.n} couleur={p.couleur} alerte={p.nom === "En attente" && p.n > 0} />)}
        </div>
        <div style={{ height: "3.2em" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={[Object.fromEntries(parts.map((p) => [p.nom, p.n]))]} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <XAxis type="number" hide domain={[0, Math.max(1, totalV2)]} />
              <YAxis type="category" hide />
              <Tooltip {...styleInfobulle} formatter={(n, nom) => [`${fmt(Number(n))} (${totalV2 ? Math.round((Number(n) / totalV2) * 100) : 0} %)`, String(nom)]} labelFormatter={() => "Consentements v2"} />
              {parts.map((p, i) => (
                <Bar key={p.nom} dataKey={p.nom} stackId="v2" fill={p.couleur} radius={i === 0 ? [6, 0, 0, 6] : i === parts.length - 1 ? [0, 6, 6, 0] : 0} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <span style={{ color: C.pale, fontSize: "0.82em" }}>
          En attente = la question a été posée, sans réponse (« plus tard », demande au parent). Jamais demandé = aucune question encore.
        </span>
      </Carte>

      <Carte titre="Demandes Loi 25" sousTitre="délai légal : 30 jours" lien={{ href: "/admin/loi25", texte: "Ouvrir le registre Loi 25" }}>
        <div className="grid grid-cols-2" style={{ gap: "0.7em" }}>
          <Case libelle="Ouvertes" n={a.loi25.ouvertes} couleur={C.texte} />
          <Case libelle="En retard" n={a.loi25.en_retard} couleur={a.loi25.en_retard ? C.rouge : C.doux} alerte={a.loi25.en_retard > 0} />
          <Case libelle="Échéance sous 7 jours" n={a.loi25.sous_7_jours} couleur={a.loi25.sous_7_jours ? C.orange : C.doux} alerte={a.loi25.sous_7_jours > 0} />
          <Case libelle="Prochaine échéance" n={prochaine} couleur={C.texte} />
        </div>
        <span style={{ color: C.pale, fontSize: "0.85em" }}>
          {fmt(a.loi25.portabilite)} accès / portabilité · {fmt(a.loi25.suppression)} suppression
        </span>
      </Carte>

      <Carte titre="Invitations parent" sousTitre="maintenant">
        <div className="grid grid-cols-3" style={{ gap: "0.7em" }}>
          <Case libelle="Réclamées" n={a.invitations_parent.reclamees} couleur={C.vert} />
          <Case libelle="En attente" n={a.invitations_parent.en_attente} couleur={C.bleu} />
          <Case libelle="Expirées" n={a.invitations_parent.expirees} couleur={C.pale} />
        </div>
      </Carte>

      <Carte titre="À traiter" sousTitre="maintenant">
        <div className="grid grid-cols-2" style={{ gap: "0.7em" }}>
          <Case libelle="Écoles non listées" n={a.ecoles_non_listees} couleur={a.ecoles_non_listees ? C.orange : C.doux} alerte={a.ecoles_non_listees > 0} />
          <Case libelle="Réclamations d'établissement" n={a.reclamations_etablissement} couleur={a.reclamations_etablissement ? C.orange : C.doux} alerte={a.reclamations_etablissement > 0} />
        </div>
        <div className="flex flex-wrap" style={{ gap: "1em", fontSize: "0.9em" }}>
          <Link href="/admin/athletes" className="underline-offset-4 hover:underline" style={{ color: C.bleu }}>Athlètes →</Link>
          <Link href="/admin/approvals" className="underline-offset-4 hover:underline" style={{ color: C.bleu }}>Approbations →</Link>
        </div>
      </Carte>
    </div>
  );
}

/* ── Croissance ──────────────────────────────────────────────────── */

const NOTE_CONNEXION = "Comparaison à venir.";

function Croissance({ d }: { d: QgDonnees }) {
  const c = d.croissance;
  const g = d.periode;
  const roles = ROLES.map((r) => ({
    role: r.libelle,
    couleur: r.couleur,
    courant: c.connectes.courant.par_role[r.cle] ?? 0,
    precedent: c.connectes.precedent.par_role[r.cle] ?? 0,
  }));
  const autresRoles = ["COACH", "RECRUTEUR", "PARENT", "PARTNER"]
    .map((r) => {
      const n = c.nouveaux.par_role[r]?.courant ?? 0;
      const role = ROLES.find((x) => x.cle === r)!;
      return `${fmt(n)} ${n > 1 ? role.libelle.toLowerCase() : role.un}`;
    })
    .join(" · ");
  const etapes = [
    { nom: "Inscrits", n: c.parcours.inscrits },
    { nom: "Profil à 80 %", n: c.parcours.profil_80 },
    { nom: "Validé par le coach", n: c.parcours.valide_coach },
    { nom: "Vu par un recruteur", n: c.parcours.vu_recruteur },
    { nom: "Suivi par un recruteur", n: c.parcours.suivi_recruteur },
  ];
  const base = Math.max(1, c.parcours.inscrits);
  const serie = c.serie.map((p) => ({ ...p, nom: enCours(p.libelle, p.en_cours) }));
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4" style={{ gap: "1.1em" }}>
      <Tuile titre="Comptes connectés" v={{ courant: c.connectes.courant.total, precedent: c.connectes.precedent.total }} g={g} accent={C.vert} note={NOTE_CONNEXION} sansComparaison />
      <Tuile titre="Nouveaux athlètes" v={c.nouveaux.athletes} g={g} accent={C.bleu} />
      <Tuile titre="Nouveaux comptes, autres rôles" v={c.nouveaux.autres} g={g} accent={C.violet} bas={autresRoles} />
      <Carte titre="Connectés par rôle" sousTitre={`${MOTS[g].courant} vs ${MOTS[g].avant}`}>
        <div style={{ height: "12em" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={roles} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={C.bord} vertical={false} />
              <XAxis dataKey="role" {...axe} interval={0} />
              <YAxis allowDecimals={false} {...axe} />
              <Tooltip {...styleInfobulle} />
              <Bar dataKey="precedent" name={MOTS[g].avant} fill={C.pale} radius={[4, 4, 0, 0]} />
              <Bar dataKey="courant" name={MOTS[g].courant} radius={[4, 4, 0, 0]}>
                {roles.map((r) => <Cell key={r.role} fill={r.couleur} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Carte>

      <Carte titre="Inscriptions" sousTitre={MOTS[g].serie} className="md:col-span-2 2xl:col-span-3">
        <div style={{ height: "17em" }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={C.bord} vertical={false} />
              <XAxis dataKey="libelle" {...axe} minTickGap={12} />
              <YAxis allowDecimals={false} {...axe} />
              <Tooltip {...styleInfobulle} labelFormatter={(_, p) => (p?.[0]?.payload?.nom as string) ?? ""} />
              <Legend wrapperStyle={{ color: C.doux, fontSize: "0.85em" }} />
              <Bar dataKey="athletes" name="Athlètes" stackId="i" fill={C.bleu}>
                {serie.map((p) => <Cell key={p.nom} fillOpacity={p.en_cours ? 0.45 : 1} />)}
              </Bar>
              <Bar dataKey="autres" name="Autres rôles" stackId="i" fill={C.vert} radius={[4, 4, 0, 0]}>
                {serie.map((p) => <Cell key={p.nom} fillOpacity={p.en_cours ? 0.45 : 1} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <span style={{ color: C.pale, fontSize: "0.82em" }}>La dernière barre, plus pâle, est la période en cours.</span>
      </Carte>

      <Carte titre="Parcours des athlètes" sousTitre="depuis le début">
        <ul className="flex flex-col" style={{ gap: "0.65em" }}>
          {etapes.map((e, i) => (
            <li key={e.nom} className="flex flex-col" style={{ gap: "0.25em" }} title={`${e.nom} : ${fmt(e.n)} (${Math.round((e.n / base) * 100)} % des inscrits)`}>
              <div className="flex justify-between" style={{ fontSize: "0.9em" }}>
                <span style={{ color: C.doux }}>{e.nom}</span>
                <span className="tabular-nums">{fmt(e.n)} <span style={{ color: C.pale }}>· {Math.round((e.n / base) * 100)} %</span></span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: "0.5em", background: "rgba(255,255,255,0.05)" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (e.n / base) * 100)}%`, background: i === 0 ? C.bleu : C.rouge, opacity: 1 - i * 0.12 }} />
              </div>
            </li>
          ))}
        </ul>
      </Carte>
    </div>
  );
}

/* ── Recruteurs ──────────────────────────────────────────────────── */

const SERIES_RECRUTEURS = [
  { cle: "profils_consultes", libelle: "Profils vus", couleur: C.bleu },
  { cle: "favoris", libelle: "Favoris", couleur: C.rouge },
  { cle: "mouvements_processus", libelle: "Déplacements", couleur: C.vert },
  { cle: "notes_match", libelle: "Notes de match", couleur: C.violet },
  { cle: "messages", libelle: "Messages", couleur: C.cyan },
] as const;

function Recruteurs({ d }: { d: QgDonnees }) {
  const t = d.recruteurs.tuiles;
  const g = d.periode;
  const serie = d.recruteurs.serie.map((p) => ({ ...p, nom: enCours(p.libelle, p.en_cours) }));
  const dernier = serie[serie.length - 1];
  const avantDernier = serie[serie.length - 2];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4" style={{ gap: "1.1em" }}>
      <Tuile titre="Recruteurs actifs" v={t.recruteurs_actifs} g={g} accent={C.rouge}
        bas="Au moins une vue, un favori, un déplacement, un message, une note de match ou un suivi de carte" />
      <Tuile titre="Profils vus" v={t.profils_consultes} g={g} accent={C.bleu} />
      <Tuile titre="Favoris" v={t.favoris} g={g} accent={C.rouge} />
      <Tuile titre="Déplacements dans le processus" v={t.mouvements_processus} g={g} accent={C.vert} bas="Changements d'étape (journal PIPELINE_CHANGED)" />
      <Tuile titre="Notes de match" v={t.notes_match} g={g} accent={C.violet} bas="Écrites par un recruteur" />
      <Tuile titre="Messages" v={t.messages} g={g} accent={C.cyan} bas="Envoyés par un recruteur" />
      <Tuile titre="Suivi des cartes prospect" v={t.suivi_cartes} g={g} accent={C.orange} bas="Hors création, notes et modifications" />

      <Carte titre="Activité des recruteurs" sousTitre={MOTS[g].serie} className="md:col-span-2 2xl:col-span-4">
        <div style={{ height: "17em" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={serie} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={C.bord} vertical={false} />
              <XAxis dataKey="nom" {...axe} minTickGap={16} tickFormatter={(v: string) => v.replace(" (en cours)", "")} />
              <YAxis allowDecimals={false} {...axe} />
              {dernier && avantDernier && (
                <ReferenceArea x1={avantDernier.nom} x2={dernier.nom} fill="rgba(255,255,255,0.035)" label={{ value: "en cours", fill: C.pale, fontSize: 12, position: "insideTopRight" }} />
              )}
              <Tooltip {...styleInfobulle} cursor={{ stroke: C.pale }} />
              <Legend wrapperStyle={{ color: C.doux, fontSize: "0.85em" }} />
              {SERIES_RECRUTEURS.map((s) => (
                <Line key={s.cle} type="linear" dataKey={s.cle} name={s.libelle} stroke={s.couleur} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <span style={{ color: C.pale, fontSize: "0.82em" }}>La zone grisée à droite est la période en cours.</span>
      </Carte>
    </div>
  );
}
