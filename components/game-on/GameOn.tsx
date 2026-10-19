"use client";

/* ═══════════════════════════════════════════════════════════════
   Game On — le mode match du recruteur (BP 2026-10-18), web ET appli.

   Trois temps, sur une seule route (/recruteur/game-on) :
     1. « Quel match ? » — séances de l'unité (reprendre, rejoindre, trier),
        matchs d'aujourd'hui du sport de l'unité, ou « Autre match ».
     2. Le match — plein écran, à une main : côté A / B, pastilles de numéros
        (la plus récente d'abord), pavé numérique, feuille de note (prénom,
        texte avec dictée et brouillon, étiquettes en un toucher).
     3. « Trier mes notes » — chaque numéro est lié à une carte prospect ou à
        un athlète Nexus (les notes sont recopiées dans sa fiche), une carte est
        créée, ou le numéro est gardé sans lien.

   Tout s'écrit d'abord sur l'appareil (lib/gameOn/useGameOn) : le réseau des
   estrades ne bloque jamais une note.
═══════════════════════════════════════════════════════════════ */

import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FeuilleBas } from "@/components/mobile/FeuilleBas";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useMatchsRecherche } from "@/lib/carteMatchs/useMatchsRecherche";
import { useOrigineCarte } from "@/lib/carteMatchs/useOrigineCarte";
import { groupeMatch, heureCarte, jourDecale, titreMatch, trierMatchs, LIEU_NON_PRECISE, type MatchRecherche, type TypeMatch } from "@/lib/carteMatchs/carteMatchs";
import { useAthleteAutocomplete } from "@/lib/queries/recruiter/useAthleteAutocomplete";
import { ajouterNoteCarte } from "@/lib/cartes/carteProspect";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { ConfirmSheet } from "@/components/shared/settings/ConfirmSheet";
import ChampNote from "@/components/shared/ChampNote";
import EnTeteMobilePartenaire from "@/components/partenaire/mobile/EnTeteMobilePartenaire";
import CreerCarteModal from "@/components/recruteur/cartes/CreerCarteModal";
import CreerProspectMobile from "@/components/shared/CreerProspectMobile";
import { triggerHaptic } from "@/lib/haptics";
import {
  CHANDAILS, couleurCote, dateSeance, fusionnerNotes, grouperParJoueur, libelleJoueur, messageErreur, notesEnAttente,
  numeroValide, noteValide, pastillesCote, resumeEnvoi, suggestionsCartes, texteRecopie, texteSur, titreSeance,
  type CarteCandidate, type Cote, type GroupeJoueur, type NoteAffichee, type SeanceLocale,
} from "@/lib/gameOn/gameOn";
import { nouvelId, useNotesSeance, useSeancesRecentes, useStockGameOn, type SeanceServeur } from "@/lib/gameOn/useGameOn";

const TOUS_TYPES: TypeMatch[] = ["SECONDAIRE", "COLLEGIAL", "CIVIL"];
const heureCourte = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
};

/** Petit rond de la couleur du chandail, bordé pour rester visible (noir sur fond sombre). */
function Chandail({ couleur, taille = 14 }: { couleur: string; taille?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rounded-full border border-white/40" style={{ width: taille, height: taille, background: couleur }} />;
}

type Vue = { type: "choix" } | { type: "match"; seance: string } | { type: "trier"; seance: string };

export default function GameOn({ mobile = false }: { mobile?: boolean }) {
  const st = useStockGameOn();
  const { data: user } = useCurrentUser();
  const moi = user?.authUser.id ?? null;
  const toast = useMobileToast();
  const [message, setMessage] = useState<string | null>(null);
  const avis = (m: string, erreur = false) => {
    if (mobile) { if (erreur) toast.error({ message: m }); else toast.success({ message: m }); }
    else setMessage(m);
  };
  const seancesQ = useSeancesRecentes();
  const [vueChoisie, setVue] = useState<Vue | null>(null);

  // Une séance en cours sur l'appareil se rouvre d'elle-même (l'appli a pu être fermée en plein match).
  const active = st.stock.active ? st.stock.seances[st.stock.active] : null;
  const vue: Vue = vueChoisie ?? (active && !active.seance.termineLe ? { type: "match", seance: active.seance.id } : { type: "choix" });
  const indisponible = st.indisponible || !!seancesQ.data?.indisponible;

  if (!st.charge) return <div className="min-h-[40vh]" />;

  if (indisponible) {
    return (
      <Coquille mobile={mobile} titre="Game On" sousTitre="Mode match">
        <div className="rounded-2xl border border-white/10 bg-[#1A1D24] p-6 text-center">
          <p className="text-[17px] font-bold text-white">Game On arrive bientôt</p>
          <p className="mt-2 text-[14px] text-white/60">Le mode match n&apos;est pas encore ouvert sur ton compte. Tes notes de match pourront y être prises dès son lancement.</p>
        </div>
      </Coquille>
    );
  }

  if (vue.type === "match" && st.stock.seances[vue.seance]) {
    return (
      <EcranMatch
        st={st} seanceId={vue.seance} moi={moi}
        onQuitter={() => setVue({ type: "choix" })}
        onTermine={() => { st.terminer(vue.seance); setVue({ type: "trier", seance: vue.seance }); }}
      />
    );
  }

  if (vue.type === "trier") {
    const id = vue.seance;
    return (
      <Coquille mobile={mobile} titre="Trier mes notes" sousTitre="Après le match" retour={() => setVue({ type: "choix" })} message={message} onFermerMessage={() => setMessage(null)}>
        <EcranTrier st={st} seanceId={id} seanceServeur={seancesQ.data?.seances.find((s) => s.id === id) ?? null} moi={moi} mobile={mobile}
          sportId={user?.profile.sport_id ?? null} avis={avis} />
      </Coquille>
    );
  }

  return (
    <Coquille mobile={mobile} titre="Game On" sousTitre="Mode match — tes notes de match, même sans réseau" message={message} onFermerMessage={() => setMessage(null)}>
      <EcranChoix st={st} seances={seancesQ.data?.seances ?? []} chargement={seancesQ.isLoading}
        onMatch={(id) => setVue({ type: "match", seance: id })}
        onTrier={(id) => setVue({ type: "trier", seance: id })} />
    </Coquille>
  );
}

type St = ReturnType<typeof useStockGameOn>;

/* ── Coquille : en-tête natif dans l'appli, en-tête recruteur au web ───── */
function Coquille({ mobile, titre, sousTitre, retour, children, message, onFermerMessage }: {
  mobile: boolean; titre: string; sousTitre?: string; retour?: () => void; children: ReactNode;
  message?: string | null; onFermerMessage?: () => void;
}) {
  return (
    <div className={mobile ? "min-h-screen bg-[#111317]" : "mx-auto max-w-3xl px-4 py-8"}>
      {mobile ? (
        <div className="relative">
          <EnTeteMobilePartenaire titre={titre} sousTitre={sousTitre} />
          {retour && (
            <button type="button" onClick={() => { triggerHaptic("Light"); retour(); }}
              className="absolute right-4 top-[calc(env(safe-area-inset-top)+12px)] h-11 rounded-full bg-white/[0.06] px-4 text-[14px] font-semibold text-white active:bg-white/10">
              Fermer
            </button>
          )}
        </div>
      ) : (
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-head text-[30px] font-black uppercase tracking-tight text-white">{titre}</h1>
            {sousTitre && <p className="mt-1 text-[14px] text-[#8A909C]">{sousTitre}</p>}
          </div>
          {retour && (
            <button type="button" onClick={retour} className="rounded-lg border border-[#2D3748] px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white">
              Retour
            </button>
          )}
        </div>
      )}
      {message && (
        <div className={`${mobile ? "mx-4" : ""} mb-4 flex items-start justify-between gap-3 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 px-4 py-3 text-[14px] text-white`}>
          <span>{message}</span>
          <button type="button" onClick={onFermerMessage} className="text-white/60" aria-label="Fermer">✕</button>
        </div>
      )}
      <div className={mobile ? "px-4 pb-6" : ""}>{children}</div>
    </div>
  );
}

function Section({ titre, children, action }: { titre: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.12em] text-white/50">{titre}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ── 1. Quel match ? ───────────────────────────────────────────── */
function EcranChoix({ st, seances, chargement, onMatch, onTrier }: {
  st: St; seances: SeanceServeur[]; chargement: boolean;
  onMatch: (id: string) => void; onTrier: (id: string) => void;
}) {
  const [texte, setTexte] = useState("");
  const [autre, setAutre] = useState(false);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [lieu, setLieu] = useState("");
  const aujourdhui = useMemo(() => jourDecale(new Date(), 0), []);
  const { data: origine, isFetched: origineLue } = useOrigineCarte(true);
  const matchsQ = useMatchsRecherche(
    { debut: aujourdhui, fin: aujourdhui, sport: origine?.sportUnite ?? "", types: TOUS_TYPES, texte },
    origineLue,
  );
  const matchs = useMemo(() => trierMatchs(matchsQ.data ?? []), [matchsQ.data]);

  const locales = Object.values(st.stock.seances)
    .filter((e) => !e.seance.termineLe)
    .sort((x, y) => y.seance.commenceLe.localeCompare(x.seance.commenceLe));
  const serveur = seances.filter((s) => !locales.some((l) => l.seance.id === s.id));

  // Couleur des chandails : demandée à CHAQUE match, avant d'entrer (BP 2026-10-18).
  const [aLancer, setALancer] = useState<{ equipeA: string; equipeB: string; lancer: (ca: string, cb: string) => void } | null>(null);
  const commencer = (m: MatchRecherche) => {
    triggerHaptic("Light");
    setALancer({ equipeA: m.domicile, equipeB: m.visiteur, lancer: (ca, cb) => {
      const id = st.demarrer({ gameId: m.id, equipeA: m.domicile, equipeB: m.visiteur, lieu: m.terrain });
      st.colorer(id, ca, cb); onMatch(id);
    } });
  };
  const commencerAutre = () => {
    if (!a.trim()) return;
    triggerHaptic("Light");
    const [ea, eb, el] = [a, b, lieu];
    setALancer({ equipeA: ea.trim(), equipeB: eb.trim() || "Adversaire", lancer: (ca, cb) => {
      const id = st.demarrer({ equipeA: ea, equipeB: eb, lieu: el });
      st.colorer(id, ca, cb); onMatch(id);
      setAutre(false); setA(""); setB(""); setLieu("");
    } });
  };

  return (
    <div>
      {st.enAttente > 0 && (
        <p className="mb-4 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-3 text-[13px] text-[#FCD34D]">
          {resumeEnvoi(st.enAttente, st.enLigne)}
        </p>
      )}

      {locales.length > 0 && (
        <Section titre="En cours sur ce téléphone">
          <ul className="space-y-2">
            {locales.map((e) => (
              <li key={e.seance.id}>
                <button type="button" onClick={() => { st.activer(e.seance.id); onMatch(e.seance.id); }}
                  className="flex w-full min-h-[56px] items-center justify-between gap-3 rounded-2xl border border-[#E63946]/40 bg-[#E63946]/10 px-4 py-3 text-left">
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-bold text-white">{titreSeance(e.seance)}</span>
                    <span className="block text-[13px] text-white/60">{e.notes.length} note{e.notes.length > 1 ? "s" : ""} · {heureCourte(e.seance.commenceLe)}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[#E63946] px-3 py-1.5 text-[13px] font-bold text-white">Reprendre</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section titre="Matchs d'aujourd'hui" action={
        <button type="button" onClick={() => setAutre((v) => !v)} className="text-[13px] font-bold text-[#E63946]">
          {autre ? "Annuler" : "+ Autre match"}
        </button>
      }>
        {autre ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#1A1D24] p-4">
            <Champ libelle="Équipe A" valeur={a} onChange={setA} placeholder="Ex. Cougars" />
            <Champ libelle="Équipe B (facultatif)" valeur={b} onChange={setB} placeholder="Ex. Titans" />
            <Champ libelle="Lieu (facultatif)" valeur={lieu} onChange={setLieu} placeholder="Ex. Aréna de Granby" />
            <button type="button" disabled={!a.trim()} onClick={commencerAutre}
              className="h-12 w-full rounded-xl bg-[#E63946] text-[15px] font-bold text-white disabled:opacity-40">
              Commencer le match
            </button>
          </div>
        ) : (
          <>
            <input value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Chercher une équipe, un terrain…"
              className="mb-3 h-12 w-full rounded-xl border border-[#2D3748] bg-[#111317] px-4 text-[16px] text-white placeholder:text-white/30" />
            {matchsQ.isLoading || !origineLue ? (
              <p className="py-6 text-center text-[14px] text-white/50">Chargement des matchs…</p>
            ) : matchsQ.isError ? (
              <p className="py-6 text-center text-[14px] text-white/50">Les matchs n&apos;ont pas pu être lus. Tu peux noter un « Autre match ».</p>
            ) : matchs.length === 0 ? (
              <p className="py-6 text-center text-[14px] text-white/50">Aucun match aujourd&apos;hui{texte ? " pour cette recherche" : ""}. Note un « Autre match ».</p>
            ) : (
              <ul className="space-y-2">
                {matchs.slice(0, 60).map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => commencer(m)}
                      className="flex w-full min-h-[56px] items-center gap-3 rounded-2xl border border-white/10 bg-[#1A1D24] px-4 py-3 text-left active:bg-white/[0.04]">
                      <span className="w-14 shrink-0 text-[14px] font-bold text-white">{m.heure ? heureCarte(m.heure) : "—"}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold text-white">{titreMatch(m)}</span>
                        <span className="block truncate text-[12px] text-white/50">
                          {groupeMatch(m) ? `${groupeMatch(m)} · ` : ""}{m.terrain || LIEU_NON_PRECISE}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>

      <Section titre="Séances de ton unité">
        {chargement ? (
          <p className="py-4 text-[14px] text-white/50">Chargement…</p>
        ) : serveur.length === 0 ? (
          <p className="py-2 text-[14px] text-white/50">Aucune séance récente.</p>
        ) : (
          <ul className="space-y-2">
            {serveur.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1A1D24] px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-white">{s.equipe_b ? `${s.equipe_a} vs ${s.equipe_b}` : s.equipe_a}</span>
                  <span className="block text-[12px] text-white/50">
                    {dateSeance(s.commence_le)} · {s.nb_notes} note{s.nb_notes > 1 ? "s" : ""}
                    {s.nb_a_lier > 0 ? ` · ${s.nb_a_lier} à lier` : ""}
                  </span>
                </span>
                {!s.termine_le && (
                  <button type="button" onClick={() => setALancer({ equipeA: s.equipe_a, equipeB: s.equipe_b || "Adversaire", lancer: (ca, cb) => { st.rejoindre(s); st.colorer(s.id, ca, cb); onMatch(s.id); } })}
                    className="h-11 shrink-0 rounded-full bg-white/[0.08] px-4 text-[13px] font-bold text-white">Rejoindre</button>
                )}
                {s.nb_notes > 0 && (
                  <button type="button" onClick={() => { st.rejoindre(s); onTrier(s.id); }}
                    className={`h-11 shrink-0 rounded-full px-4 text-[13px] font-bold ${s.nb_a_lier > 0 ? "bg-[#E63946] text-white" : "bg-white/[0.08] text-white/70"}`}>
                    Trier
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {aLancer && (
        <FeuilleCouleurs equipeA={aLancer.equipeA} equipeB={aLancer.equipeB}
          onFermer={() => setALancer(null)}
          onValider={(ca, cb) => { const l = aLancer; setALancer(null); triggerHaptic("Medium"); l.lancer(ca, cb); }} />
      )}
    </div>
  );
}

/* ── Couleur des chandails, à chaque match : un toucher par équipe ─────── */
function FeuilleCouleurs({ equipeA, equipeB, onFermer, onValider }: {
  equipeA: string; equipeB: string; onFermer: () => void; onValider: (ca: string, cb: string) => void;
}) {
  const [ca, setCa] = useState<string | null>(null);
  const [cb, setCb] = useState<string | null>(null);
  const rangee = (equipe: string, choisie: string | null, choisir: (h: string) => void) => (
    <div className="mb-4">
      <p className="mb-2 truncate text-[15px] font-bold text-white">{equipe}</p>
      <div className="grid grid-cols-5 gap-2">
        {CHANDAILS.map((c) => (
          <button key={c.hex} type="button" aria-label={`${equipe} : chandail ${c.nom}`} aria-pressed={choisie === c.hex}
            onClick={() => { triggerHaptic("Light"); choisir(c.hex); }}
            className="flex h-12 items-center justify-center rounded-xl border-2"
            style={{ background: c.hex, borderColor: choisie === c.hex ? "#FFFFFF" : "rgba(255,255,255,0.15)" }}>
            {choisie === c.hex && <span className="text-[18px] font-black" style={{ color: texteSur(c.hex) }}>✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <FeuilleBas variante="feuille" onFermer={onFermer} etiquette="Couleur des chandails" testId="game-on-couleurs"
      pied={
        <button type="button" disabled={!ca || !cb} onClick={() => ca && cb && onValider(ca, cb)}
          className="h-14 w-full rounded-2xl bg-[#E63946] text-[17px] font-black text-white disabled:opacity-40">
          Commencer
        </button>
      }>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[18px] font-black text-white">Couleur des chandails</p>
        <button type="button" onClick={onFermer} className="h-11 px-2 text-[14px] font-semibold text-white/60">Annuler</button>
      </div>
      {rangee(equipeA, ca, setCa)}
      {rangee(equipeB, cb, setCb)}
    </FeuilleBas>
  );
}

function Champ({ libelle, valeur, onChange, placeholder, inputMode }: {
  libelle: string; valeur: string; onChange: (v: string) => void; placeholder?: string; inputMode?: "numeric" | "text";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-white/50">{libelle}</span>
      <input value={valeur} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={inputMode}
        className="h-12 w-full rounded-xl border border-[#2D3748] bg-[#111317] px-4 text-[16px] text-white placeholder:text-white/30" />
    </label>
  );
}

/* ── 2. Le match (plein écran, au-dessus de la barre d'onglets) ──────── */
function EcranMatch({ st, seanceId, moi, onQuitter, onTermine }: {
  st: St; seanceId: string; moi: string | null; onQuitter: () => void; onTermine: () => void;
}) {
  const monte = useSyncExternalStore(() => () => {}, () => true, () => false);
  const etat = st.stock.seances[seanceId];
  const serveurQ = useNotesSeance(etat?.seance.ouverte ? seanceId : null, moi);
  const [cote, setCote] = useState<Cote>("A");
  const [pave, setPave] = useState(false);
  const [joueur, setJoueur] = useState<{ cote: Cote; numero: string | null; prenom: string | null } | null>(null);
  const [confirmer, setConfirmer] = useState(false);

  const notes = useMemo(() => fusionnerNotes(etat?.notes ?? [], serveurQ.data ?? [], moi), [etat?.notes, serveurQ.data, moi]);
  const groupes = useMemo(() => grouperParJoueur(notes), [notes]);
  if (!etat || !monte) return null;
  const s = etat.seance;
  const attente = notesEnAttente(etat).length;
  const nomCote = (c: Cote) => (c === "A" ? s.equipeA : s.equipeB || "Adversaire");
  const cc = (c: Cote) => couleurCote(s, c);
  const pastilles = pastillesCote(groupes, cote);
  const groupeOuvert = joueur ? groupes.find((g) => g.cote === joueur.cote && (joueur.numero ? g.numero === joueur.numero : !g.numero && (g.prenom ?? "").toLowerCase() === (joueur.prenom ?? "").toLowerCase())) : null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#111317] text-white transition-colors" data-game-on-match
      // Repère visuel (BP) : tout l'écran prend la teinte du chandail du côté noté.
      style={{ paddingTop: "env(safe-area-inset-top)", backgroundImage: `linear-gradient(180deg, ${cc(cote)}40 0%, ${cc(cote)}14 35%, #111317 75%)` }}>
      {/* Barre du haut */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" aria-label="Retour à la liste" onClick={() => { triggerHaptic("Light"); onQuitter(); }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:bg-white/[0.06]">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold">{titreSeance(s)}</p>
          <p className={`truncate text-[12px] ${attente > 0 ? "text-[#FCD34D]" : "text-white/50"}`} aria-live="polite">
            {resumeEnvoi(attente, st.enLigne)}{st.erreurEnvoi ? ` · ${st.erreurEnvoi}` : ""}
          </p>
        </div>
        <button type="button" onClick={() => setConfirmer(true)}
          className="h-11 shrink-0 rounded-full border border-white/15 px-4 text-[14px] font-bold text-white active:bg-white/10">
          Terminer
        </button>
      </div>

      {/* Côtés */}
      <div className="grid grid-cols-2 gap-2 px-3 pb-2">
        {(["A", "B"] as const).map((c) => (
          <button key={c} type="button" onClick={() => { triggerHaptic("Light"); setCote(c); }}
            className="h-12 min-w-0 rounded-xl px-3 text-[15px] font-bold"
            style={cote === c
              ? { background: cc(c), color: texteSur(cc(c)), boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.35)" }
              : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}>
            <span className="flex items-center justify-center gap-2">{cote !== c && <Chandail couleur={cc(c)} />}<span className="truncate">{nomCote(c)}</span></span>
          </button>
        ))}
      </div>

      {/* Pastilles */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {pastilles.length === 0 ? (
          <p className="mt-10 px-6 text-center text-[15px] text-white/50">
            Touche « + Numéro » pour noter un joueur de {nomCote(cote)}.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {pastilles.map((g) => (
              <button key={g.cle} type="button" onClick={() => { triggerHaptic("Light"); setJoueur({ cote: g.cote, numero: g.numero, prenom: g.prenom }); }}
                className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border bg-[#1A1D24] px-2 py-2 active:bg-white/[0.06]"
                style={{ borderColor: cc(g.cote), borderWidth: 2 }}>
                <span className="text-[26px] font-black leading-none">{g.numero ? `#${g.numero}` : "—"}</span>
                <span className="mt-1 max-w-full truncate text-[12px] text-white/60">{g.prenom || `${g.notes.length} note${g.notes.length > 1 ? "s" : ""}`}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Zone du pouce */}
      <div className="px-3 pt-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
        <button type="button" onClick={() => { triggerHaptic("Medium"); setPave(true); }}
          className="h-16 w-full rounded-2xl text-[18px] font-black" style={{ background: cc(cote), color: texteSur(cc(cote)), boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.25)" }}>
          + Numéro
        </button>
      </div>

      {pave && (
        <PaveNumerique couleur={cc(cote)} equipe={nomCote(cote)}
          onFermer={() => setPave(false)}
          onValider={(numero, prenom) => { setPave(false); setJoueur({ cote, numero, prenom }); }} />
      )}

      {joueur && (
        <FeuilleNote
          seance={s} cote={joueur.cote} numero={joueur.numero} prenomInitial={groupeOuvert?.prenom ?? joueur.prenom}
          equipe={nomCote(joueur.cote)} groupe={groupeOuvert ?? null}
          onFermer={() => setJoueur(null)}
          onSupprimer={async (id) => { await st.supprimerNote(seanceId, id); }}
          onEnregistrer={(n) => {
            st.noter(seanceId, { id: nouvelId(), cote: joueur.cote, numero: joueur.numero, noteLe: new Date().toISOString(), ...n });
            triggerHaptic("Medium");
            setJoueur(null);
          }} />
      )}

      <ConfirmSheet open={confirmer} onClose={() => setConfirmer(false)} variant="warning"
        title="Terminer le match ?"
        message={attente > 0 ? `${attente} note${attente > 1 ? "s" : ""} attend${attente > 1 ? "ent" : ""} encore le réseau : elles partiront toutes seules. Tu pourras ensuite trier tes notes.` : "Tu pourras ensuite lier chaque numéro à une carte ou à un athlète."}
        confirmLabel="Terminer et trier"
        onConfirm={() => { setConfirmer(false); onTermine(); }} />
    </div>,
    document.body,
  );
}

function PaveNumerique({ couleur, equipe, onFermer, onValider }: {
  couleur: string; equipe: string; onFermer: () => void; onValider: (numero: string | null, prenom: string | null) => void;
}) {
  const [n, setN] = useState("");
  const [sansNumero, setSansNumero] = useState(false);
  const [prenom, setPrenom] = useState("");
  const touche = (c: string) => { triggerHaptic("Light"); setN((v) => (v.length >= 3 ? v : v + c)); };
  return (
    <FeuilleBas variante="feuille" onFermer={onFermer} etiquette={`Numéro — ${equipe}`} testId="game-on-pave" classeContenu="px-4 pb-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="truncate text-[14px] font-semibold text-white/60">{equipe}</p>
          <button type="button" onClick={() => setSansNumero((v) => !v)} className="h-11 text-[14px] font-bold text-[#E63946]">
            {sansNumero ? "Avec un numéro" : "Sans numéro"}
          </button>
        </div>
        {sansNumero ? (
          <>
            <input autoFocus value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom ou repère (ex. « le gaucher »)"
              className="mb-3 h-14 w-full rounded-xl border border-[#2D3748] bg-[#111317] px-4 text-[18px] text-white placeholder:text-white/30" />
            <button type="button" disabled={!prenom.trim()} onClick={() => onValider(null, prenom.trim())}
              className="h-14 w-full rounded-2xl text-[17px] font-black disabled:opacity-40" style={{ background: couleur, color: texteSur(couleur) }}>Noter</button>
          </>
        ) : (
          <>
            <p className="mb-3 text-center text-[44px] font-black leading-none text-white" aria-live="polite">{n ? `#${n}` : "#"}</p>
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((c) => (
                <button key={c} type="button" onClick={() => touche(c)} className="h-14 rounded-2xl bg-white/[0.06] text-[24px] font-bold text-white active:bg-white/15">{c}</button>
              ))}
              <button type="button" aria-label="Effacer" onClick={() => setN((v) => v.slice(0, -1))} className="h-14 rounded-2xl bg-white/[0.03] text-[20px] text-white/70 active:bg-white/10">⌫</button>
              <button type="button" onClick={() => touche("0")} className="h-14 rounded-2xl bg-white/[0.06] text-[24px] font-bold text-white active:bg-white/15">0</button>
              <button type="button" disabled={!numeroValide(n)} onClick={() => onValider(numeroValide(n), null)}
                className="h-14 rounded-2xl text-[17px] font-black disabled:opacity-40" style={{ background: couleur, color: texteSur(couleur) }}>OK</button>
            </div>
          </>
        )}
    </FeuilleBas>
  );
}

function FeuilleNote({ seance, cote, numero, prenomInitial, equipe, groupe, onFermer, onEnregistrer, onSupprimer }: {
  seance: SeanceLocale; cote: Cote; numero: string | null; prenomInitial: string | null; equipe: string;
  groupe: GroupeJoueur | null;
  onFermer: () => void;
  onEnregistrer: (n: { prenom: string | null; texte: string; etiquettes: string[] }) => void;
  onSupprimer: (id: string) => Promise<void>;
}) {
  const [prenom, setPrenom] = useState(prenomInitial ?? "");
  const [texte, setTexte] = useState("");
  // BP 2026-10-18 : garder ça simple — pas d'étiquettes ni de gabarits, le texte (ou la voix) suffit.
  const ok = noteValide({ numero, prenom, texte, etiquettes: [] });
  const sujet = `gameon:${seance.id}:${cote}:${numero ?? (prenomInitial ?? "").toLowerCase()}`;
  return (
    <FeuilleBas variante="feuille" onFermer={onFermer} etiquette={`Note — ${numero ? `#${numero}` : (prenomInitial || "Joueur")}`} testId="game-on-note"
      pied={
        <button type="button" disabled={!ok}
          onClick={() => onEnregistrer({ prenom: prenom.trim() || prenomInitial || null, texte, etiquettes: [] })}
          className="h-14 w-full rounded-2xl bg-[#E63946] text-[17px] font-black text-white disabled:opacity-40">
          Enregistrer
        </button>
      }>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[28px] font-black leading-none text-white"><Chandail couleur={couleurCote(seance, cote)} taille={18} />{numero ? `#${numero}` : (prenomInitial || "Joueur")}</p>
            <p className="mt-1 truncate text-[13px] text-white/50">{equipe}</p>
          </div>
          <button type="button" onClick={onFermer} className="h-11 shrink-0 px-2 text-[14px] font-semibold text-white/60">Annuler</button>
        </div>

        {groupe && groupe.notes.length > 0 && (
          <ul className="mb-3 max-h-40 space-y-2 overflow-y-auto">
            {groupe.notes.map((n: NoteAffichee) => (
              <li key={n.id} className="rounded-xl bg-[#111317] px-3 py-2 text-[14px] text-white/80">
                <span className="mr-2 text-[12px] text-white/40">{heureCourte(n.noteLe)}{n.deMoi ? "" : ` · ${n.auteurNom ?? "Collègue"}`}</span>
                {n.etiquettes.length > 0 && <span className="mr-1 text-[12px] font-bold text-[#E63946]">{n.etiquettes.join(" · ")}</span>}
                {n.texte}
                {n.enAttente && <span className="ml-1 text-[11px] text-[#FCD34D]">(en attente)</span>}
                {n.deMoi && !n.lieLe && (
                  <button type="button" onClick={() => void onSupprimer(n.id)} className="ml-2 text-[12px] text-white/40 underline">retirer</button>
                )}
              </li>
            ))}
          </ul>
        )}

        {numero && (
          <input value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Prénom (facultatif)"
            className="mb-3 h-12 w-full rounded-xl border border-[#2D3748] bg-[#111317] px-4 text-[16px] text-white placeholder:text-white/30" />
        )}

        <ChampNote value={texte} onChange={setTexte} sujet={sujet} mobile envoyerAvecEntree={false} sansGabarits
          placeholder="Ce que tu as vu…" ariaLabel="Note sur ce joueur" />
    </FeuilleBas>
  );
}

/* ── 3. Trier mes notes ────────────────────────────────────────── */
function EcranTrier({ st, seanceId, seanceServeur, moi, mobile, sportId, avis }: {
  st: St; seanceId: string; seanceServeur: SeanceServeur | null; moi: string | null; mobile: boolean;
  sportId: string | null; avis: (m: string, erreur?: boolean) => void;
}) {
  const qc = useQueryClient();
  const locale = st.stock.seances[seanceId];
  const s: Pick<SeanceLocale, "equipeA" | "equipeB" | "commenceLe" | "gameId"> | null = locale?.seance
    ?? (seanceServeur ? { equipeA: seanceServeur.equipe_a, equipeB: seanceServeur.equipe_b, commenceLe: seanceServeur.commence_le, gameId: seanceServeur.game_id } : null);
  const serveurQ = useNotesSeance(seanceId, moi);
  const notes = useMemo(() => fusionnerNotes(locale?.notes ?? [], serveurQ.data ?? [], moi), [locale?.notes, serveurQ.data, moi]);
  const groupes = useMemo(() => grouperParJoueur(notes), [notes]);
  const attente = locale ? notesEnAttente(locale).length : 0;
  const numeros = useMemo(() => [...new Set(groupes.map((g) => g.numero).filter((n): n is string => !!n))].sort(), [groupes]);

  const cartesQ = useQuery<CarteCandidate[]>({
    queryKey: ["game-on", "cartes", numeros.join(",")],
    enabled: numeros.length > 0,
    queryFn: async () => {
      const { data, error } = await createClient().from("cartes_prospect")
        .select("id, prenom, nom, numero, team_id, teams:team_id(name)")
        .in("numero", numeros).is("fusionnee_le", null).limit(200);
      if (error) throw error;
      return (data ?? []).map((c: Record<string, unknown>) => {
        const t = Array.isArray(c.teams) ? c.teams[0] : c.teams;
        return {
          id: c.id as string, prenom: (c.prenom as string) ?? "", nom: (c.nom as string) ?? "", numero: (c.numero as string) ?? null,
          teamId: (c.team_id as string) ?? null, equipe: ((t as { name?: string } | null)?.name) ?? null,
        };
      });
    },
  });
  const equipesQ = useQuery<string[]>({
    queryKey: ["game-on", "equipes-match", s?.gameId ?? null],
    enabled: !!s?.gameId,
    queryFn: async () => {
      const { data } = await createClient().from("games").select("home_team_id, visitor_team_id").eq("id", s!.gameId!).maybeSingle();
      return [data?.home_team_id, data?.visitor_team_id].filter((x): x is string => !!x);
    },
  });

  const [ouvert, setOuvert] = useState<string | null>(null);
  const [creer, setCreer] = useState<GroupeJoueur | null>(null);
  const [enCours, setEnCours] = useState(false);

  if (!s) return <p className="py-6 text-center text-[14px] text-white/50">Séance introuvable.</p>;

  const lier = async (g: GroupeJoueur, cible: { athleteId?: string; carteId?: string } | null, nom?: string) => {
    if (enCours) return;
    setEnCours(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.rpc("match_notes_lier", {
        p_seance: seanceId, p_cote: g.cote, p_numero: g.numero, p_prenom: g.prenom,
        p_athlete_id: cible?.athleteId ?? null, p_carte_id: cible?.carteId ?? null,
      });
      if (error) { avis(messageErreur(error), true); return; }
      if (cible) {
        const texte = texteRecopie(s, g);
        const e2 = cible.carteId
          ? await ajouterNoteCarte(supabase, cible.carteId, texte)
          : moi ? (await supabase.from("recruiter_notes").insert({ recruiter_id: moi, athlete_id: cible.athleteId, content: texte })).error : null;
        if (e2) avis("Lié, mais la note n'a pas pu être recopiée dans la fiche.", true);
        else avis(`${libelleJoueur(g)} lié${nom ? ` à ${nom}` : ""} — notes recopiées dans sa fiche.`);
        void invaliderTableauBlanc(qc);
      } else {
        avis(`${libelleJoueur(g)} gardé sans lien.`);
      }
      setOuvert(null);
      void qc.invalidateQueries({ queryKey: ["game-on"] });
    } finally {
      setEnCours(false);
    }
  };

  const aTrier = groupes.filter((g) => !g.traite);
  const traites = groupes.filter((g) => g.traite);

  return (
    <div>
      <p className="mb-4 text-[14px] text-white/60">{titreSeance(s)} · {dateSeance(s.commenceLe)}</p>
      {attente > 0 && (
        <p className="mb-4 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-3 text-[13px] text-[#FCD34D]">
          {resumeEnvoi(attente, st.enLigne)} — le tri s&apos;ouvre dès qu&apos;elles sont envoyées.
          {st.enLigne && <button type="button" onClick={() => void st.synchroniser()} className="ml-2 font-bold underline">Envoyer</button>}
        </p>
      )}
      {serveurQ.isLoading ? (
        <p className="py-6 text-center text-[14px] text-white/50">Chargement…</p>
      ) : groupes.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-white/50">Aucune note pour ce match.</p>
      ) : (
        <>
          {aTrier.length === 0 && <p className="mb-4 text-[14px] text-[#22C55E]">Tout est trié. Beau travail !</p>}
          <ul className="space-y-3">
            {aTrier.map((g) => (
              <LigneTri key={g.cle} g={g} couleur={couleurCote(locale?.seance, g.cote)} ouvert={ouvert === g.cle} desactive={attente > 0 || enCours}
                suggestions={suggestionsCartes(g, cartesQ.data ?? [], equipesQ.data ?? [])}
                onOuvrir={() => setOuvert((v) => (v === g.cle ? null : g.cle))}
                onLierCarte={(c) => void lier(g, { carteId: c.id }, `${c.prenom} ${c.nom}`.trim())}
                onLierAthlete={(id, nom) => void lier(g, { athleteId: id }, nom)}
                onCreer={() => setCreer(g)}
                onGarder={() => void lier(g, null)} />
            ))}
          </ul>
          {traites.length > 0 && (
            <Section titre="Déjà triés">
              <ul className="space-y-2">
                {traites.map((g) => (
                  <li key={g.cle} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3 text-[14px] text-white/60">
                    <span>{libelleJoueur(g)} · {g.notes.length} note{g.notes.length > 1 ? "s" : ""}</span>
                    <span className="text-[12px]">{g.carteId ? "Carte" : g.athleteId ? "Athlète" : "Gardé"}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}

      {creer && sportId && (mobile ? (
        <CreerProspectMobile sportId={sportId} onClose={() => setCreer(null)}
          prerempli={{ prenom: creer.prenom, numero: creer.numero }}
          onCarteCreee={(id) => { const g = creer; void lier(g, { carteId: id }); }} />
      ) : (
        <CreerCarteModal sportId={sportId} onClose={() => setCreer(null)}
          prerempli={{ prenom: creer.prenom, numero: creer.numero }}
          onCarteCreee={(id) => { const g = creer; void lier(g, { carteId: id }); }}
          onCreee={(m) => { setCreer(null); avis(m); }} />
      ))}
    </div>
  );
}

function LigneTri({ g, couleur, ouvert, desactive, suggestions, onOuvrir, onLierCarte, onLierAthlete, onCreer, onGarder }: {
  g: GroupeJoueur; couleur: string; ouvert: boolean; desactive: boolean;
  suggestions: (CarteCandidate & { memeEquipe: boolean })[];
  onOuvrir: () => void; onLierCarte: (c: CarteCandidate) => void; onLierAthlete: (id: string, nom: string) => void;
  onCreer: () => void; onGarder: () => void;
}) {
  const [recherche, setRecherche] = useState(g.prenom ?? "");
  const athletesQ = useAthleteAutocomplete(ouvert ? recherche : "");
  return (
    <li className="rounded-2xl border border-white/10 bg-[#1A1D24] p-4">
      <button type="button" onClick={onOuvrir} className="flex w-full items-start justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[18px] font-black text-white"><Chandail couleur={couleur} />{libelleJoueur(g)}</span>
          <span className="block text-[12px] text-white/50">{g.notes.length} note{g.notes.length > 1 ? "s" : ""}{suggestions.length > 0 ? ` · ${suggestions.length} carte${suggestions.length > 1 ? "s" : ""} possible${suggestions.length > 1 ? "s" : ""}` : ""}</span>
        </span>
        <span className="shrink-0 rounded-full bg-[#E63946] px-3 py-1.5 text-[13px] font-bold text-white">{ouvert ? "Fermer" : "Trier"}</span>
      </button>
      <ul className="mt-3 space-y-1.5">
        {g.notes.map((n) => (
          <li key={n.id} className="text-[14px] text-white/80">
            <span className="mr-2 text-[12px] text-white/40">{heureCourte(n.noteLe)}{n.deMoi ? "" : ` · ${n.auteurNom ?? "Collègue"}`}</span>
            {n.etiquettes.length > 0 && <span className="mr-1 text-[12px] font-bold text-[#E63946]">{n.etiquettes.join(" · ")}</span>}
            {n.texte}
          </li>
        ))}
      </ul>
      {ouvert && (
        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          {suggestions.length > 0 && (
            <div>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-white/50">Cartes avec le #{g.numero}</p>
              <ul className="space-y-2">
                {suggestions.map((c) => (
                  <li key={c.id}>
                    <button type="button" disabled={desactive} onClick={() => onLierCarte(c)}
                      className="flex w-full min-h-[48px] items-center justify-between gap-3 rounded-xl bg-[#111317] px-4 py-2 text-left disabled:opacity-40">
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-white">{`${c.prenom} ${c.nom}`.trim()}</span>
                        <span className="block truncate text-[12px] text-white/50">{c.equipe ?? "Sans équipe"}{c.memeEquipe ? " · équipe du match" : ""}</span>
                      </span>
                      <span className="shrink-0 text-[13px] font-bold text-[#E63946]">Lier</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-white/50">Athlète sur Nexus</p>
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom de l'athlète"
              className="h-12 w-full rounded-xl border border-[#2D3748] bg-[#111317] px-4 text-[16px] text-white placeholder:text-white/30" />
            {(athletesQ.data ?? []).length > 0 && (
              <ul className="mt-2 space-y-2">
                {(athletesQ.data ?? []).filter((a) => a.identityVisible).map((a) => (
                  <li key={a.id}>
                    <button type="button" disabled={desactive} onClick={() => onLierAthlete(a.id, a.fullName)}
                      className="flex w-full min-h-[48px] items-center justify-between gap-3 rounded-xl bg-[#111317] px-4 py-2 text-left disabled:opacity-40">
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-white">{a.fullName}{a.jersey ? ` · #${a.jersey}` : ""}</span>
                        <span className="block truncate text-[12px] text-white/50">{[a.school, a.position].filter(Boolean).join(" · ")}</span>
                      </span>
                      <span className="shrink-0 text-[13px] font-bold text-[#E63946]">Lier</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={desactive} onClick={onCreer} className="h-12 rounded-xl bg-[#E63946] text-[14px] font-bold text-white disabled:opacity-40">Créer une carte</button>
            <button type="button" disabled={desactive} onClick={onGarder} className="h-12 rounded-xl bg-white/[0.06] text-[14px] font-bold text-white/80 disabled:opacity-40">Garder sans lier</button>
          </div>
        </div>
      )}
    </li>
  );
}
