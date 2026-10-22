"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FUSEAU_MONTREAL, type Comparaison, type EcranMuralDonnees } from "@/lib/admin/ecranMural";

/* ─────────────────────────────────────────────────────────────────
   Écran mural — moniteur ultrawide laissé ouvert en permanence.

   - Rafraîchi toutes les 15 minutes par un simple appel à
     /api/admin/ecran, sans recharger la page ; aussi au retour sur
     l'onglet si le dernier appel date de plus de 15 minutes.
   - Point vert : dernier appel réussi, il y a moins de 16 minutes.
     Point orange : le dernier appel a échoué, ou les chiffres ont vieilli.
   - Le texte grossit avec la largeur : toute la page est en `em`, et la
     taille de base suit la largeur de l'écran (vw), plafonnée par la
     hauteur (vh) pour que tout tienne sans défiler — mesuré à 3440×1440
     (21:9) et à 1920×1080.
   - Rien d'autre que des nombres n'arrive ici (voir la route).
───────────────────────────────────────────────────────────────── */

const INTERVALLE_MS = 15 * 60 * 1000;
const VIEUX_MS = 16 * 60 * 1000;

const C = {
  fond: "#070B15",
  carte: "#0F1729",
  bord: "rgba(79,140,255,0.14)",
  bleu: "#4F8CFF",
  rouge: "#E63946",
  vert: "#2FD18B",
  orange: "#F5A524",
  texte: "#E6ECF7",
  doux: "#8A97B1",
  pale: "#56627C",
} as const;

const nf = new Intl.NumberFormat("fr-CA");
const fmt = (n: number) => nf.format(n);

const fmtHeure = new Intl.DateTimeFormat("fr-CA", { timeZone: FUSEAU_MONTREAL, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fmtDate = new Intl.DateTimeFormat("fr-CA", { timeZone: FUSEAU_MONTREAL, weekday: "long", day: "numeric", month: "long", year: "numeric" });
/** « 14 h 05 », à la québécoise. */
const heure = (d: Date) => fmtHeure.format(d).replace(":", " h ");
/** « Jeudi 22 octobre 2026 » : majuscule au premier mot seulement. */
const dateLongue = (d: Date) => {
  const t = fmtDate.format(d);
  return t.charAt(0).toUpperCase() + t.slice(1);
};

type Etat =
  | { kind: "chargement" }
  | { kind: "refus"; message: string }
  | { kind: "pret"; donnees: EcranMuralDonnees };

export default function EcranMural() {
  const [etat, setEtat] = useState<Etat>({ kind: "chargement" });
  const [derniereReussite, setDerniereReussite] = useState<Date | null>(null);
  const [echec, setEchec] = useState(false);
  const [maintenant, setMaintenant] = useState(() => new Date());
  const derniereTentative = useRef(0);

  const charger = useCallback(async () => {
    derniereTentative.current = Date.now();
    try {
      const r = await fetch("/api/admin/ecran", { cache: "no-store" });
      if (r.status === 401 || r.status === 403) {
        setEtat({ kind: "refus", message: r.status === 401 ? "Session expirée — reconnecte-toi." : "Accès réservé aux administrateurs." });
        setEchec(true);
        return;
      }
      if (!r.ok) throw new Error(String(r.status));
      const donnees = (await r.json()) as EcranMuralDonnees;
      setEtat({ kind: "pret", donnees });
      setDerniereReussite(new Date(donnees.calcule_le));
      setEchec(false);
    } catch {
      // On garde les derniers chiffres à l'écran ; le point passe à l'orange.
      setEchec(true);
    }
  }, []);

  useEffect(() => {
    void charger();
    const minuterie = window.setInterval(() => void charger(), INTERVALLE_MS);
    const horloge = window.setInterval(() => setMaintenant(new Date()), 20_000);
    const auRetour = () => {
      if (document.visibilityState === "visible" && Date.now() - derniereTentative.current >= INTERVALLE_MS) {
        void charger();
      }
    };
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      window.clearInterval(minuterie);
      window.clearInterval(horloge);
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, [charger]);

  const frais = !echec && derniereReussite !== null && maintenant.getTime() - derniereReussite.getTime() < VIEUX_MS;

  return (
    <div
      className="min-h-screen w-full font-sans"
      style={{ background: C.fond, color: C.texte, fontSize: "clamp(12px, min(0.84vw, 1.5vh), 30px)" }}
    >
      <div className="flex flex-col min-h-screen" style={{ padding: "1.6em 2em", gap: "1.2em" }}>
        <EnTete maintenant={maintenant} frais={frais} derniereReussite={derniereReussite} echec={echec} />

        {etat.kind === "chargement" && <Message texte="Chargement des chiffres…" />}
        {etat.kind === "refus" && <Message texte={etat.message} />}
        {etat.kind === "pret" && <Tableau d={etat.donnees} />}
      </div>
    </div>
  );
}

/* ── En-tête ─────────────────────────────────────────────────────── */

function EnTete({ maintenant, frais, derniereReussite, echec }: {
  maintenant: Date; frais: boolean; derniereReussite: Date | null; echec: boolean;
}) {
  const statut = derniereReussite === null
    ? (echec ? "Aucune donnée reçue" : "Première lecture…")
    : `${echec ? "Échec de la mise à jour — chiffres de" : "Mis à jour à"} ${heure(derniereReussite)}`;
  return (
    <header className="flex flex-wrap items-end justify-between" style={{ gap: "1em" }}>
      <div className="flex items-center" style={{ gap: "0.8em" }}>
        <span className="relative inline-flex" style={{ width: "0.9em", height: "0.9em" }}>
          <span className="absolute inset-0 rounded-full animate-ping" style={{ background: C.rouge, opacity: 0.5 }} />
          <span className="relative rounded-full w-full h-full" style={{ background: C.rouge }} />
        </span>
        <h1 className="font-head font-bold uppercase tracking-tight leading-none" style={{ fontSize: "2.6em" }}>
          Nexus <span style={{ color: C.rouge }}>en direct</span>
        </h1>
      </div>
      <div className="flex items-end" style={{ gap: "2em" }}>
        <div className="text-right">
          <div style={{ color: C.doux, fontSize: "1.1em" }}>{dateLongue(maintenant)}</div>
          <div className="font-head font-bold tabular-nums leading-none" style={{ fontSize: "2.4em" }}>{heure(maintenant)}</div>
        </div>
        <div className="flex items-center" style={{ gap: "0.5em", color: C.doux, fontSize: "1em", paddingBottom: "0.3em" }}>
          <span
            aria-label={frais ? "Chiffres à jour" : "Chiffres en retard"}
            className="rounded-full inline-block"
            style={{ width: "0.8em", height: "0.8em", background: frais ? C.vert : C.orange, boxShadow: `0 0 0.6em ${frais ? C.vert : C.orange}` }}
          />
          <span>{statut}</span>
        </div>
      </div>
    </header>
  );
}

function Message({ texte }: { texte: string }) {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ color: C.doux, fontSize: "1.6em" }}>
      {texte}
    </div>
  );
}

/* ── Corps ───────────────────────────────────────────────────────── */

function Tableau({ d }: { d: EcranMuralDonnees }) {
  const t = d.tuiles;
  const coachsRec: Comparaison = {
    courant: t.nouveaux_coachs.courant + t.nouveaux_recruteurs.courant,
    precedent: t.nouveaux_coachs.precedent + t.nouveaux_recruteurs.precedent,
  };
  return (
    <main className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 content-start" style={{ gap: "1.2em" }}>
      <Tuile titre="Nouveaux athlètes" valeur={t.nouveaux_athletes} accent={C.bleu}
        bas={`${fmt(t.athletes_actifs)} athlètes actifs au total`} />
      <Tuile titre="Profils vus par les recruteurs" valeur={t.profils_vus} accent={C.bleu}
        bas={`${fmt(t.recruteurs_actifs.courant)} recruteurs actifs (${fmt(t.recruteurs_actifs.precedent)} avant)`} />
      <Tuile titre="Mouvements dans le processus" valeur={t.mouvements_processus} accent={C.rouge}
        bas="Changements d'étape des recruteurs" />
      <Tuile titre="Nouveaux coachs + recruteurs" valeur={coachsRec} accent={C.vert}
        bas={`${fmt(t.nouveaux_coachs.courant)} coachs · ${fmt(t.nouveaux_recruteurs.courant)} recruteurs`} />

      <Inscriptions d={d} />
      <Activite d={d} />
      <Parcours d={d} />

      <Files d={d} />
    </main>
  );
}

function Carte({ titre, sousTitre, children, className = "" }: {
  titre: string; sousTitre?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-[0.9em] flex flex-col ${className}`}
      style={{ background: C.carte, border: `1px solid ${C.bord}`, padding: "1.2em 1.4em", gap: "0.9em" }}>
      <div className="flex items-baseline justify-between" style={{ gap: "1em" }}>
        <h2 className="font-bold uppercase" style={{ fontSize: "0.95em", letterSpacing: "0.14em", color: C.doux }}>{titre}</h2>
        {sousTitre && <span style={{ fontSize: "0.85em", color: C.pale }}>{sousTitre}</span>}
      </div>
      {children}
    </section>
  );
}

function Ecart({ v, taille = "1em" }: { v: Comparaison; taille?: string }) {
  const diff = v.courant - v.precedent;
  const couleur = diff > 0 ? C.vert : diff < 0 ? C.rouge : C.doux;
  const signe = diff > 0 ? "▲" : diff < 0 ? "▼" : "＝";
  const pct = v.precedent > 0 ? ` (${diff > 0 ? "+" : ""}${Math.round((diff / v.precedent) * 100)} %)` : "";
  return (
    <span className="tabular-nums whitespace-nowrap" style={{ color: couleur, fontSize: taille }}>
      {signe} {diff > 0 ? "+" : ""}{fmt(diff)}{pct}
    </span>
  );
}

function Tuile({ titre, valeur, accent, bas }: { titre: string; valeur: Comparaison; accent: string; bas: string }) {
  return (
    <Carte titre={titre} sousTitre="7 jours">
      <div className="flex items-end justify-between" style={{ gap: "1em", borderLeft: `0.25em solid ${accent}`, paddingLeft: "0.8em" }}>
        <span className="font-head font-bold tabular-nums leading-none" style={{ fontSize: "3.6em" }}>{fmt(valeur.courant)}</span>
        <div className="text-right" style={{ paddingBottom: "0.3em" }}>
          <Ecart v={valeur} taille="1.15em" />
          <div style={{ color: C.pale, fontSize: "0.85em" }}>7 jours d&apos;avant : {fmt(valeur.precedent)}</div>
        </div>
      </div>
      <div style={{ color: C.doux, fontSize: "1em" }}>{bas}</div>
    </Carte>
  );
}

function Inscriptions({ d }: { d: EcranMuralDonnees }) {
  const max = Math.max(1, ...d.inscriptions.map((s) => s.athletes + s.autres));
  return (
    <Carte titre="Inscriptions par semaine" sousTitre="12 semaines, du lundi" className="md:col-span-2">
      <div className="flex items-center" style={{ gap: "1.4em", fontSize: "0.9em", color: C.doux }}>
        <Legende couleur={C.bleu} texte="Athlètes" />
        <Legende couleur={C.vert} texte="Autres rôles" />
        <span style={{ color: C.pale }}>Semaine en cours plus pâle</span>
      </div>
      <div className="flex items-end" style={{ gap: "0.6em", height: "13em" }}>
        {d.inscriptions.map((s) => {
          const total = s.athletes + s.autres;
          return (
            <div key={s.semaine} className="flex-1 flex flex-col items-center justify-end h-full" style={{ gap: "0.3em", opacity: s.en_cours ? 0.45 : 1 }}>
              <span className="tabular-nums font-semibold" style={{ fontSize: "0.95em" }}>{fmt(total)}</span>
              <div className="w-full flex flex-col justify-end rounded-t-[0.3em] overflow-hidden" style={{ height: `${(total / max) * 100}%`, minHeight: total > 0 ? "0.2em" : 0 }}>
                <div style={{ background: C.vert, flexGrow: s.autres }} title={`${s.autres} autres rôles`} />
                <div style={{ background: C.bleu, flexGrow: s.athletes }} title={`${s.athletes} athlètes`} />
              </div>
              <span className="whitespace-nowrap" style={{ fontSize: "0.8em", color: C.doux }}>{s.semaine}</span>
            </div>
          );
        })}
      </div>
    </Carte>
  );
}

function Legende({ couleur, texte }: { couleur: string; texte: string }) {
  return (
    <span className="flex items-center" style={{ gap: "0.4em" }}>
      <span className="inline-block rounded-[0.15em]" style={{ width: "0.8em", height: "0.8em", background: couleur }} />
      {texte}
    </span>
  );
}

function Activite({ d }: { d: EcranMuralDonnees }) {
  const a = d.activite;
  const lignes: [string, Comparaison][] = [
    ["Profils consultés", a.profils_consultes],
    ["Favoris", a.favoris],
    ["Mouvements dans le processus", a.mouvements_processus],
    ["Suivi des cartes prospect", a.suivi_cartes],
    ["Notes de match", a.notes_match],
    ["Messages envoyés", a.messages],
  ];
  return (
    <Carte titre="Activité des recruteurs" sousTitre="7 j · 7 j d'avant">
      <ul className="flex flex-col" style={{ gap: "0.55em" }}>
        {lignes.map(([libelle, v]) => (
          <li key={libelle} className="flex items-baseline justify-between" style={{ gap: "0.8em", borderBottom: `1px solid ${C.bord}`, paddingBottom: "0.45em" }}>
            <span style={{ fontSize: "1em" }}>{libelle}</span>
            <span className="flex items-baseline" style={{ gap: "0.8em" }}>
              <span className="font-head font-bold tabular-nums" style={{ fontSize: "1.5em" }}>{fmt(v.courant)}</span>
              <span className="tabular-nums" style={{ color: C.pale, fontSize: "0.9em" }}>{fmt(v.precedent)}</span>
              <Ecart v={v} taille="0.85em" />
            </span>
          </li>
        ))}
      </ul>
    </Carte>
  );
}

function Parcours({ d }: { d: EcranMuralDonnees }) {
  const p = d.parcours;
  const base = Math.max(1, p.inscrits);
  const etapes: [string, number][] = [
    ["Inscrits", p.inscrits],
    ["Profil complété à 80 % ou plus", p.profil_80],
    ["Validé par un coach", p.valide_coach],
    ["Vu par un recruteur", p.vu_recruteur],
    ["Suivi par un recruteur", p.suivi_recruteur],
  ];
  return (
    <Carte titre="Parcours des athlètes" sousTitre="depuis le début">
      <ul className="flex flex-col" style={{ gap: "0.7em" }}>
        {etapes.map(([libelle, n], i) => (
          <li key={libelle} className="flex flex-col" style={{ gap: "0.25em" }}>
            <div className="flex items-baseline justify-between" style={{ gap: "0.8em" }}>
              <span style={{ fontSize: "1em" }}>{libelle}</span>
              <span className="tabular-nums">
                <span className="font-head font-bold" style={{ fontSize: "1.35em" }}>{fmt(n)}</span>
                {i > 0 && <span style={{ color: C.pale, fontSize: "0.9em" }}> · {Math.round((n / base) * 100)} %</span>}
              </span>
            </div>
            <div className="w-full rounded-full overflow-hidden" style={{ height: "0.45em", background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (n / base) * 100)}%`, background: i === 0 ? C.bleu : C.rouge, opacity: i === 0 ? 1 : 1 - i * 0.12 }} />
            </div>
          </li>
        ))}
      </ul>
    </Carte>
  );
}

function Files({ d }: { d: EcranMuralDonnees }) {
  const f = d.files;
  return (
    <Carte titre="Files d'attente" sousTitre="maintenant" className="md:col-span-2 xl:col-span-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5" style={{ gap: "1em" }}>
        <Bloc titre="Invitations parent" valeurs={[
          ["Réclamées", f.invitations_parent.reclamees, C.vert],
          ["En attente", f.invitations_parent.en_attente, C.bleu],
          ["Expirées", f.invitations_parent.expirees, C.pale],
        ]} />
        <Bloc titre="Consentements partenaires v2" valeurs={[
          ["Acceptés", f.consentements_v2.acceptes, C.vert],
          ["Refusés", f.consentements_v2.refuses, C.rouge],
          // 4 cases (BP 2026-10-22) : « En attente » = question posée, sans réponse
          // (plus tard, demande au parent) ; « Jamais demandé » = aucune ligne v2.
          ["En attente", f.consentements_v2.en_attente, C.bleu],
          ["Jamais demandé", f.consentements_v2.jamais_demande, C.pale],
        ]} />
        <Seul titre="Écoles non listées" n={f.ecoles_non_listees} aTraiter />
        <Seul titre="Demandes Loi 25 ouvertes" n={f.loi25_ouvertes} aTraiter />
        <Seul titre="Réclamations d'établissement à approuver" n={f.reclamations_etablissement} aTraiter />
      </div>
    </Carte>
  );
}

function Bloc({ titre, valeurs }: { titre: string; valeurs: [string, number, string][] }) {
  return (
    <div className="rounded-[0.7em] flex flex-col" style={{ background: "rgba(255,255,255,0.03)", padding: "0.9em 1em", gap: "0.6em" }}>
      <span style={{ color: C.doux, fontSize: "0.95em" }}>{titre}</span>
      <div className="flex flex-wrap justify-between" style={{ gap: "0.6em 0.8em" }}>
        {valeurs.map(([libelle, n, couleur]) => (
          <div key={libelle} className="flex flex-col">
            <span className="font-head font-bold tabular-nums leading-none" style={{ fontSize: "2em", color: couleur }}>{fmt(n)}</span>
            <span style={{ fontSize: "0.85em", color: C.pale }}>{libelle}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Seul({ titre, n, aTraiter }: { titre: string; n: number; aTraiter?: boolean }) {
  const alerte = aTraiter && n > 0;
  return (
    <div className="rounded-[0.7em] flex flex-col justify-between" style={{
      background: alerte ? "rgba(245,165,36,0.08)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${alerte ? "rgba(245,165,36,0.35)" : "transparent"}`,
      padding: "0.9em 1em", gap: "0.6em",
    }}>
      <span style={{ color: C.doux, fontSize: "0.95em" }}>{titre}</span>
      <span className="font-head font-bold tabular-nums leading-none" style={{ fontSize: "2.4em", color: alerte ? C.orange : C.texte }}>{fmt(n)}</span>
    </div>
  );
}
