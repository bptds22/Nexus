"use client";

/* ═══════════════════════════════════════════════════════════════
   Dépistage (ex-« Game On ») — le mode match du recruteur, web ET appli.
   Libellés : lib/gameOn/libelles (une seule source).

   Trois temps, sur une seule route (/recruteur/game-on) :
     1. Le tableau de bord — quatre pastilles : En cours · Mes matchs du jour
        (tirés du calendrier) · À trier · Mon unité (séances des collègues, à
        rejoindre). On n'y refait PAS une liste de matchs (BP 2026-10-18) :
        « Trouver un match » ouvre la carte des matchs et ses filtres, et
        « Dépister ce match » (carte des matchs, calendrier) arrive ici avec
        le match et ses deux équipes dans l'URL. « + Autre match » reste pour
        un match hors calendrier.
     2. Le match — plein écran, à une main : côté A / B, pastilles de numéros
        (la plus récente d'abord), pavé numérique, fiche du joueur (en-tête
        « #N · Prénom ✏️ », un bloc d'écriture qui se vide, l'historique ;
        toucher une de MES notes la recharge, Enregistrer y AJOUTE une ligne
        datée).
     3. « Trier mes notes » — suggestions (athlètes Nexus et cartes de
        l'équipe : même numéro ou nom proche), puis Lier, Créer une carte
        (préremplie depuis le côté du match) ou Garder sans lier. Les notes
        vont dans le fil de la carte sous « Match X vs Y, date ».

   Tout s'écrit d'abord sur l'appareil (lib/gameOn/useGameOn) : le réseau des
   estrades ne bloque jamais une note.
═══════════════════════════════════════════════════════════════ */

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FeuilleBas } from "@/components/mobile/FeuilleBas";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { useCalendrierUnite } from "@/lib/queries/recruiter/useCalendrierUnite";
import { todayIso } from "@/lib/queries/recruiter/useRecruitingCalendar";
import { heureCarte } from "@/lib/carteMatchs/carteMatchs";
import { useAthleteAutocomplete } from "@/lib/queries/recruiter/useAthleteAutocomplete";
import { ajouterNoteCarte, ecrireCarte } from "@/lib/cartes/carteProspect";
import { fusionnerCarte } from "@/lib/cartes/fusions";
import { useBasculeFavori } from "@/components/recruteur/unite/useBasculeFavori";
import { useNotesCarte } from "@/lib/cartes/useCartes";
import { useNotesUnite } from "@/lib/queries/recruiter/useProcessusUnite";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { ConfirmSheet } from "@/components/shared/settings/ConfirmSheet";
import ChampNote from "@/components/shared/ChampNote";
import EnTeteMobilePartenaire from "@/components/partenaire/mobile/EnTeteMobilePartenaire";
import CreerCarteModal, { type PrerempliCarte } from "@/components/recruteur/cartes/CreerCarteModal";
import CreerProspectMobile from "@/components/shared/CreerProspectMobile";
import FormulaireCarte from "@/components/partenaire/prospects/FormulaireCarte";
import { triggerHaptic } from "@/lib/haptics";
import { DEPISTAGE, lireDepister, routeDepistage, type ModeDepistage } from "@/lib/gameOn/libelles";
import {
  CHANDAILS, PASTILLES, carteJumelle, cleJoueur, couleurCote, dateSeance, fusionnerNotes, grouperParJoueur, connusDuCote, heureLigne, joueurConnu, libelleJoueur, messageErreur, nomCourt, prenomDe,
  notesEnAttente, numeroValide, noteValide, pastilleParDefaut, pastillesCote, rangerSeances, resumeEnvoi, suggestionsTri,
  texteRecopie, texteSur, titreSeance,
  type CarteCandidate, type Cote, type GroupeJoueur, type NoteAffichee, type Pastille, type SeanceLocale, type Suggestion,
} from "@/lib/gameOn/gameOn";
import {
  nouvelId, useAthletesMatch, useCartesPartenaire, useCartesUnite, useEquipesMatch, useNotesCartePartenaire, useNotesSeance, useSeancesRecentes, useStockGameOn,
  type EquipeMatch, type SeanceServeur,
} from "@/lib/gameOn/useGameOn";

const heureCourte = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
};

/** Petit rond de la couleur du chandail, bordé pour rester visible (noir sur fond sombre). */
function Chandail({ couleur, taille = 14 }: { couleur: string; taille?: number }) {
  return <span aria-hidden className="inline-block shrink-0 rounded-full border border-white/40" style={{ width: taille, height: taille, background: couleur }} />;
}

type Vue = { type: "choix" } | { type: "match"; seance: string } | { type: "trier"; seance: string };
/** Un match à lancer : on demande d'abord la couleur des chandails (à chaque match). */
type ALancer = { equipeA: string; equipeB: string; lancer: (ca: string, cb: string) => void };

/* Le mode (BP 2026-10-19) : le PARTENAIRE dépiste aussi. Ses notes vont à SES cartes « En attente »
   (fonctions partenaire_*), sans athlètes Nexus à lier ni fil de processus d'unité. */
const ModeCtx = createContext<ModeDepistage>("recruteur");
const useMode = () => useContext(ModeCtx);

/** Les cartes du mode : celles de l'unité (recruteur) ou celles du partenaire. */
function useCartesDepistage(ecoles: readonly string[], idsEquipes: readonly string[]) {
  const partenaire = useMode() === "partenaire";
  const unite = useCartesUnite(partenaire ? AUCUNE : ecoles, partenaire ? AUCUNE : idsEquipes);
  const siennes = useCartesPartenaire(ecoles, idsEquipes, partenaire);
  return partenaire ? siennes : unite;
}
const AUCUNE: readonly string[] = [];

export default function GameOn({ mobile = false, mode = "recruteur" }: { mobile?: boolean; mode?: ModeDepistage }) {
  return (
    <ModeCtx.Provider value={mode}>
      <GameOnEcrans mobile={mobile} />
    </ModeCtx.Provider>
  );
}

function GameOnEcrans({ mobile }: { mobile: boolean }) {
  const mode = useMode();
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
  const [aLancer, setALancer] = useState<ALancer | null>(null);
  const params = useSearchParams();
  const router = useRouter();
  const lienLu = useRef(false);

  // « Dépister ce match » (carte des matchs, calendrier) : le match et ses deux équipes arrivent
  // dans l'URL. Déjà ouvert sur l'appareil → on le reprend ; sinon couleurs, puis la séance.
  useEffect(() => {
    if (!st.charge || lienLu.current) return;
    const d = lireDepister(params);
    if (!d) return;
    lienLu.current = true;
    router.replace(routeDepistage(mode));
    const deja = Object.values(st.stock.seances).find((e) => e.seance.gameId === d.gameId && !e.seance.termineLe);
    // L'URL est une source EXTERNE (le lien suivi) : l'état se pose hors du corps de l'effet.
    queueMicrotask(() => {
      if (deja) {
        st.activer(deja.seance.id);
        setVue({ type: "match", seance: deja.seance.id });
        return;
      }
      setVue({ type: "choix" });
      setALancer({
        equipeA: d.equipeA, equipeB: d.equipeB,
        lancer: (ca, cb) => {
          const id = st.demarrer({ gameId: d.gameId, equipeA: d.equipeA, equipeB: d.equipeB, lieu: d.lieu });
          st.colorer(id, ca, cb);
          setVue({ type: "match", seance: id });
        },
      });
    });
  }, [st, params, router, mode]);

  // Une séance en cours sur l'appareil se rouvre d'elle-même (l'appli a pu être fermée en plein match).
  const active = st.stock.active ? st.stock.seances[st.stock.active] : null;
  const vue: Vue = vueChoisie ?? (active && !active.seance.termineLe ? { type: "match", seance: active.seance.id } : { type: "choix" });
  const indisponible = st.indisponible || !!seancesQ.data?.indisponible;

  if (!st.charge) return <div className="min-h-[40vh]" />;

  if (indisponible) {
    return (
      <Coquille mobile={mobile} titre={DEPISTAGE.titre} sousTitre="Mode match">
        <div className="rounded-2xl border border-white/10 bg-[#1A1D24] p-6 text-center">
          <p className="text-[17px] font-bold text-white">{DEPISTAGE.bientot}</p>
          <p className="mt-2 text-[14px] text-white/60">Le mode match n&apos;est pas encore ouvert sur ton compte. Tes notes de match pourront y être prises dès son lancement.</p>
        </div>
      </Coquille>
    );
  }

  const couleurs = aLancer && (
    <FeuilleCouleurs equipeA={aLancer.equipeA} equipeB={aLancer.equipeB}
      onFermer={() => setALancer(null)}
      onValider={(ca, cb) => { const l = aLancer; setALancer(null); triggerHaptic("Medium"); l.lancer(ca, cb); }} />
  );

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
        {/* BP 2026-10-19 : une fois le tri fini, on retourne au Live d'un toucher. */}
        <button type="button" onClick={() => { triggerHaptic("Light"); setVue({ type: "choix" }); }} data-testid="retour-live"
          className="mt-6 h-12 w-full rounded-xl border border-white/15 text-[15px] font-bold text-white active:bg-white/[0.06]">
          ← Retour à {DEPISTAGE.titre}
        </button>
      </Coquille>
    );
  }

  return (
    <Coquille mobile={mobile} titre={DEPISTAGE.titre} sousTitre={DEPISTAGE.sousTitre} message={message} onFermerMessage={() => setMessage(null)}>
      <EcranTableau st={st} seances={seancesQ.data?.seances ?? []} chargement={seancesQ.isLoading} moi={moi}
        onLancer={setALancer}
        onMatch={(id) => setVue({ type: "match", seance: id })}
        onTrier={(id) => setVue({ type: "trier", seance: id })} />
      {couleurs}
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

function Vide({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-[14px] text-white/50">{children}</p>;
}

/** Une ligne du tableau de bord : titre, détail, un bouton à droite. */
function Ligne({ titre, detail, accent = false, children }: { titre: string; detail?: string; accent?: boolean; children?: ReactNode }) {
  return (
    <li className={`flex min-h-[60px] items-center gap-3 rounded-2xl border px-4 py-3 ${accent ? "border-[#E63946]/40 bg-[#E63946]/10" : "border-white/10 bg-[#1A1D24]"}`}>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-white">{titre}</span>
        {detail && <span className="block truncate text-[12px] text-white/55">{detail}</span>}
      </span>
      {children}
    </li>
  );
}

const btnRouge = "h-11 shrink-0 rounded-full bg-[#E63946] px-4 text-[13px] font-bold text-white active:bg-[#D42B22]";
const btnGris = "h-11 shrink-0 rounded-full bg-white/[0.08] px-4 text-[13px] font-bold text-white active:bg-white/15";

/* ── 1. Le tableau de bord : quatre pastilles ─────────────────── */
function EcranTableau({ st, seances, chargement, moi, onLancer, onMatch, onTrier }: {
  st: St; seances: SeanceServeur[]; chargement: boolean; moi: string | null;
  onLancer: (l: ALancer) => void; onMatch: (id: string) => void; onTrier: (id: string) => void;
}) {
  const [autre, setAutre] = useState(false);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [lieu, setLieu] = useState("");
  const [choisie, setChoisie] = useState<Pastille | null>(null);

  // Mes matchs du jour : ceux du calendrier de l'unité (aucune nouvelle liste de matchs). Partenaire : aucun.
  const mode = useMode();
  const calendrierQ = useCalendrierUnite(mode === "recruteur");
  const aujourdhui = useMemo(() => todayIso(), []);
  const duJour = useMemo(() => (calendrierQ.data?.games ?? [])
    .filter((g) => g.gameDate === aujourdhui)
    .sort((x, y) => (x.gameTime || "99").localeCompare(y.gameTime || "99")), [calendrierQ.data, aujourdhui]);

  const locales = Object.values(st.stock.seances)
    .filter((e) => !e.seance.termineLe)
    .sort((x, y) => y.seance.commenceLe.localeCompare(x.seance.commenceLe));
  const surAppareil = useMemo(() => new Set(Object.keys(st.stock.seances)), [st.stock.seances]);
  const r = rangerSeances(seances, moi, surAppareil);
  const nb: Record<Pastille, number> = {
    "en-cours": locales.length + r.enCours.length, "du-jour": duJour.length, "a-trier": r.aTrier.length, unite: r.unite.length,
  };
  const pastille = choisie ?? pastilleParDefaut({ enCours: nb["en-cours"], duJour: nb["du-jour"], aTrier: nb["a-trier"] });

  const lancerJeu = (gameId: string, equipeA: string, equipeB: string, lieuJeu: string | null) => {
    triggerHaptic("Light");
    const deja = locales.find((e) => e.seance.gameId === gameId);
    if (deja) { st.activer(deja.seance.id); onMatch(deja.seance.id); return; }
    onLancer({ equipeA, equipeB, lancer: (ca, cb) => {
      const id = st.demarrer({ gameId, equipeA, equipeB, lieu: lieuJeu });
      st.colorer(id, ca, cb); onMatch(id);
    } });
  };
  const rejoindre = (s: SeanceServeur) => onLancer({ equipeA: s.equipe_a, equipeB: s.equipe_b || "Adversaire", lancer: (ca, cb) => {
    st.rejoindre(s); st.colorer(s.id, ca, cb); onMatch(s.id);
  } });
  const commencerAutre = () => {
    if (!a.trim()) return;
    triggerHaptic("Light");
    const [ea, eb, el] = [a, b, lieu];
    onLancer({ equipeA: ea.trim(), equipeB: eb.trim() || "Adversaire", lancer: (ca, cb) => {
      const id = st.demarrer({ equipeA: ea, equipeB: eb, lieu: el });
      st.colorer(id, ca, cb); onMatch(id);
      setAutre(false); setA(""); setB(""); setLieu("");
    } });
  };
  const detailSeance = (s: SeanceServeur) =>
    `${dateSeance(s.commence_le)} · ${s.nb_notes} note${s.nb_notes > 1 ? "s" : ""}${s.nb_a_lier > 0 ? ` · ${s.nb_a_lier} à lier` : ""}`;

  return (
    <div>
      {st.enAttente > 0 && (
        <p className="mb-4 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-3 text-[13px] text-[#FCD34D]">
          {resumeEnvoi(st.enAttente, st.enLigne)}
        </p>
      )}

      {/* Les quatre pastilles (BP 2026-10-18). */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Tableau de bord En direct" data-testid="depistage-pastilles">
        {/* BP 2026-10-19 : plus de « Mon unité » (recruteur ni partenaire). */}
        {PASTILLES.filter((p) => p.cle !== "unite").map((p) => (
          <button key={p.cle} type="button" role="tab" aria-selected={pastille === p.cle} data-testid={`pastille-${p.cle}`}
            onClick={() => { triggerHaptic("Light"); setChoisie(p.cle); }}
            className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[14px] font-bold ${pastille === p.cle ? "border-[#E63946] bg-[#E63946] text-white" : "border-white/10 bg-white/[0.04] text-white/75"}`}>
            {p.libelle}
            <span className={`min-w-[22px] rounded-full px-1.5 text-center text-[12px] ${pastille === p.cle ? "bg-white/25" : "bg-white/10"}`}>{nb[p.cle]}</span>
          </button>
        ))}
      </div>

      <div className="mb-6" role="tabpanel">
        {pastille === "en-cours" && (
          locales.length + r.enCours.length === 0 ? <Vide>Aucun match en cours. Choisis un match du jour ou touche « {DEPISTAGE.trouver} ».</Vide> : (
            <ul className="space-y-2">
              {locales.map((e) => (
                <Ligne key={e.seance.id} accent titre={titreSeance(e.seance)} detail={`${e.notes.length} note${e.notes.length > 1 ? "s" : ""} · ${heureCourte(e.seance.commenceLe)}`}>
                  <button type="button" className={btnRouge} onClick={() => { triggerHaptic("Light"); st.activer(e.seance.id); onMatch(e.seance.id); }}>Reprendre</button>
                </Ligne>
              ))}
              {r.enCours.map((s) => (
                <Ligne key={s.id} titre={s.equipe_b ? `${s.equipe_a} vs ${s.equipe_b}` : s.equipe_a} detail={detailSeance(s)}>
                  <button type="button" className={btnRouge} onClick={() => rejoindre(s)}>Reprendre</button>
                </Ligne>
              ))}
            </ul>
          )
        )}

        {pastille === "du-jour" && (
          calendrierQ.isLoading ? <p className="py-6 text-center text-[14px] text-white/50">Chargement du calendrier…</p>
            : duJour.length === 0 ? <Vide>Aucun match à ton calendrier aujourd&apos;hui. Touche « {DEPISTAGE.trouver} » pour en choisir un sur la carte.</Vide> : (
              <ul className="space-y-2">
                {duJour.map((g) => {
                  const local = locales.find((e) => e.seance.gameId === g.id);
                  return (
                    <Ligne key={g.id} titre={`${g.homeName} vs ${g.visitorName}`}
                      detail={[g.gameTime ? heureCarte(g.gameTime) : null, g.venue || null].filter(Boolean).join(" · ") || undefined}>
                      <button type="button" className={btnRouge} data-testid="depister-match"
                        onClick={() => lancerJeu(g.id, g.homeName, g.visitorName, g.venue || null)}>
                        {local ? "Reprendre" : DEPISTAGE.bouton}
                      </button>
                    </Ligne>
                  );
                })}
              </ul>
            )
        )}

        {pastille === "a-trier" && (
          chargement ? <p className="py-6 text-center text-[14px] text-white/50">Chargement…</p>
            : r.aTrier.length === 0 ? <Vide>Rien à trier. Tes notes liées sont dans le fil de chaque carte.</Vide> : (
              <ul className="space-y-2">
                {r.aTrier.map((s) => (
                  <Ligne key={s.id} titre={s.equipe_b ? `${s.equipe_a} vs ${s.equipe_b}` : s.equipe_a} detail={detailSeance(s)}>
                    <button type="button" className={btnRouge} onClick={() => { st.rejoindre(s); onTrier(s.id); }}>Trier</button>
                  </Ligne>
                ))}
              </ul>
            )
        )}

        {pastille === "unite" && (
          chargement ? <p className="py-6 text-center text-[14px] text-white/50">Chargement…</p>
            : r.unite.length === 0 ? <Vide>Aucun collègue n&apos;est en train de dépister un match.</Vide> : (
              <ul className="space-y-2">
                {r.unite.map((s) => (
                  <Ligne key={s.id} titre={s.equipe_b ? `${s.equipe_a} vs ${s.equipe_b}` : s.equipe_a} detail={detailSeance(s)}>
                    <button type="button" className={btnGris} onClick={() => rejoindre(s)}>Rejoindre</button>
                  </Ligne>
                ))}
              </ul>
            )
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2">
        <Link href={mode === "partenaire" ? "/partenaire/carte-matchs" : "/recruteur/carte-matchs"} onClick={() => triggerHaptic("Light")} data-testid="trouver-match"
          className="flex h-12 items-center justify-center rounded-xl bg-[#E63946] text-[15px] font-bold text-white active:bg-[#D42B22]">
          {DEPISTAGE.trouver}
        </Link>
        <button type="button" onClick={() => setAutre((v) => !v)} aria-expanded={autre}
          className="h-12 rounded-xl border border-white/15 text-[15px] font-bold text-white active:bg-white/10">
          {autre ? "Annuler" : "+ Autre match"}
        </button>
      </div>

      {autre && (
        <Section titre="Autre match (hors calendrier)">
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#1A1D24] p-4">
            <Champ libelle="Équipe A" valeur={a} onChange={setA} placeholder="Ex. Cougars" />
            <Champ libelle="Équipe B (facultatif)" valeur={b} onChange={setB} placeholder="Ex. Titans" />
            <Champ libelle="Lieu (facultatif)" valeur={lieu} onChange={setLieu} placeholder="Ex. Aréna de Granby" />
            <button type="button" disabled={!a.trim()} onClick={commencerAutre}
              className="h-12 w-full rounded-xl bg-[#E63946] text-[15px] font-bold text-white disabled:opacity-40">
              Commencer le match
            </button>
          </div>
        </Section>
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
  const groupes = useMemo(() => grouperParJoueur(notes, etat?.seance.prenoms), [notes, etat?.seance.prenoms]);
  // Joueur déjà connu (BP 2026-10-19) : athlètes Nexus du match et cartes de l'unité des deux équipes.
  const equipesQ = useEquipesMatch(etat?.seance.gameId);
  const partenaire = useMode() === "partenaire";
  const athletesQ = useAthletesMatch(partenaire ? null : etat?.seance.gameId);
  const idsEquipes = useMemo(() => [equipesQ.data?.A?.teamId, equipesQ.data?.B?.teamId].filter((x): x is string => !!x), [equipesQ.data]);
  const ecoles = useMemo(() => [equipesQ.data?.A?.etablissement?.id, equipesQ.data?.B?.etablissement?.id].filter((x): x is string => !!x), [equipesQ.data]);
  const cartesQ = useCartesDepistage(ecoles, idsEquipes);
  if (!etat || !monte) return null;
  const s = etat.seance;
  const attente = notesEnAttente(etat).length;
  const nomCote = (c: Cote) => (c === "A" ? s.equipeA : s.equipeB || "Adversaire");
  const cc = (c: Cote) => couleurCote(s, c);
  const pastilles = pastillesCote(groupes, cote);
  const connus = connusDuCote(cote, athletesQ.data ?? [], cartesQ.data ?? [],
    (cote === "A" ? equipesQ.data?.A : equipesQ.data?.B)?.teamId ?? null,
    new Set(pastilles.map((g) => g.numero).filter((n): n is string => !!n)), s.pasLui ?? {});
  const connuDe = (j: { cote: Cote; numero: string | null; prenom: string | null }) => joueurConnu(
    j, athletesQ.data ?? [], cartesQ.data ?? [], (j.cote === "A" ? equipesQ.data?.A : equipesQ.data?.B)?.teamId ?? null,
    s.pasLui?.[cleJoueur(j)] ?? null);
  // « Pas lui » se défait (BP 2026-10-19 : revoir une suggestion écartée) : le nom de l'écarté.
  const ecarteDe = (j: { cote: Cote; numero: string | null; prenom: string | null }) => {
    const id = s.pasLui?.[cleJoueur(j)];
    if (!id) return null;
    const a = athletesQ.data?.find((x) => x.id === id);
    const c = cartesQ.data?.find((x) => x.id === id);
    const nom = a ? `${a.prenom} ${a.nom}` : c ? `${c.prenom} ${c.nom}` : null;
    return nom ? { id, nom: nom.trim() } : null;
  };
  const groupeOuvert = joueur ? groupes.find((g) => g.cote === joueur.cote && (joueur.numero ? g.numero === joueur.numero : !g.numero && (g.prenom ?? "").toLowerCase() === (joueur.prenom ?? "").toLowerCase())) : null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#111317] text-white transition-colors" data-game-on-match
      // Repère visuel (BP) : tout l'écran prend la teinte du chandail du côté noté.
      style={{ paddingTop: "env(safe-area-inset-top)", backgroundImage: `linear-gradient(180deg, ${cc(cote)}40 0%, ${cc(cote)}14 35%, #111317 75%)` }}>
      {/* Barre du haut */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button type="button" aria-label="Retour au tableau de bord" onClick={() => { triggerHaptic("Light"); onQuitter(); }}
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
        {pastilles.length === 0 && connus.length === 0 ? (
          <p className="mt-10 px-6 text-center text-[15px] text-white/50">
            Touche « + Numéro » pour noter un joueur de {nomCote(cote)}.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {pastilles.map((g) => { const connu = connuDe(g); return (
              <button key={g.cle} type="button" onClick={() => { triggerHaptic("Light"); setJoueur({ cote: g.cote, numero: g.numero, prenom: g.prenom }); }}
                className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border bg-[#1A1D24] px-2 py-2 active:bg-white/[0.06]"
                style={{ borderColor: cc(g.cote), borderWidth: 2 }}>
                <span className="text-[26px] font-black leading-none">{g.numero ? `#${g.numero}` : "—"}</span>
                <span className={`mt-1 max-w-full truncate text-[12px] ${connu ? "font-semibold text-[#22C55E]" : "text-white/60"}`}>
                  {connu ? `✓ ${nomCourt(connu.nom)}` : g.prenom || `${g.notes.length} note${g.notes.length > 1 ? "s" : ""}`}
                </span>
              </button>
            ); })}
            {connus.map(({ numero, connu }) => (
              <button key={`connu-${numero}`} type="button" data-testid="pastille-connue"
                onClick={() => { triggerHaptic("Light"); setJoueur({ cote, numero, prenom: prenomDe(connu) }); }}
                className="flex min-h-[76px] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-[#1A1D24]/60 px-2 py-2 active:bg-white/[0.06]"
                style={{ borderColor: `${cc(cote)}99` }}>
                <span className="text-[26px] font-black leading-none text-white/70">#{numero}</span>
                <span className="mt-1 max-w-full truncate text-[12px] font-semibold text-[#22C55E]/80">✓ {nomCourt(connu.nom)}</span>
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
        <FicheJoueur
          seance={s} cote={joueur.cote} numero={joueur.numero} prenom={groupeOuvert?.prenom ?? joueur.prenom ?? prenomDe(connuDe(joueur))}
          equipe={nomCote(joueur.cote)} groupe={groupeOuvert ?? null}
          connu={connuDe(joueur)}
          jumelle={carteJumelle(joueur, connuDe(joueur), cartesQ.data ?? [], (joueur.cote === "A" ? equipesQ.data?.A : equipesQ.data?.B)?.teamId ?? null)}
          ecarte={ecarteDe(joueur)}
          onPasLui={(id) => st.ecarter(seanceId, cleJoueur(joueur), id)}
          onRetablir={() => st.ecarter(seanceId, cleJoueur(joueur), null)}
          onFermer={() => setJoueur(null)}
          onSupprimer={async (id) => { await st.supprimerNote(seanceId, id); }}
          onRenommer={(p) => {
            if (groupeOuvert) st.renommer(seanceId, groupeOuvert, p);
            setJoueur((j) => (j ? { ...j, prenom: p.trim() || null } : j));
          }}
          onAjouterA={(base, texte) => { st.ajouterA(seanceId, base, texte); triggerHaptic("Medium"); }}
          onEnregistrer={(n) => {
            st.noter(seanceId, { id: nouvelId(), cote: joueur.cote, numero: joueur.numero, noteLe: new Date().toISOString(), etiquettes: [], ...n });
            triggerHaptic("Medium");
          }} />
      )}

      <ConfirmSheet open={confirmer} onClose={() => setConfirmer(false)} variant="warning"
        title="Terminer le match ?"
        message={attente > 0 ? `${attente} note${attente > 1 ? "s" : ""} attend${attente > 1 ? "ent" : ""} encore le réseau : elles partiront toutes seules. Tu pourras ensuite trier tes notes.` : "Tu pourras ensuite lier chaque numéro à une carte ou à un athlète. Les notes restent visibles à ton unité."}
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

/* La fiche du joueur (BP 2026-10-18) :
   · en-tête FIXE « #N · Prénom (facultatif) ✏️ », le prénom se corrige au crayon ;
   · UN bloc d'écriture, qui se VIDE après Enregistrer (la fiche reste ouverte) ;
   · l'historique du joueur (heure, auteur), suppression de MES notes ;
   · toucher une de MES notes la recharge : Enregistrer y AJOUTE une ligne datée
     (« 14 h 32 : … »), sans écraser le texte d'avant. Hors ligne comme le reste. */
function FicheJoueur({ seance, cote, numero, prenom, equipe, groupe, connu, jumelle, ecarte, onPasLui, onRetablir, onFermer, onEnregistrer, onAjouterA, onRenommer, onSupprimer }: {
  seance: SeanceLocale; cote: Cote; numero: string | null; prenom: string | null; equipe: string;
  groupe: GroupeJoueur | null;
  /** Le joueur reconnu (athlète Nexus ou carte de l'unité), s'il y en a un. */
  connu: Suggestion | null;
  /** Une carte de l'unité au même numéro alors que le joueur est reconnu comme athlète Nexus. */
  jumelle: CarteCandidate | null;
  /** Le joueur écarté par « Pas lui » pour ce numéro, s'il y en a un. */
  ecarte: { id: string; nom: string } | null;
  onPasLui: (id: string) => void;
  onRetablir: () => void;
  onFermer: () => void;
  onEnregistrer: (n: { prenom: string | null; texte: string }) => void;
  onAjouterA: (base: NoteAffichee, texte: string) => void;
  onRenommer: (prenom: string) => void;
  onSupprimer: (id: string) => Promise<void>;
}) {
  const [texte, setTexte] = useState("");
  const [cibleId, setCibleId] = useState<string | null>(null);
  const [crayon, setCrayon] = useState(false);
  const [prenomSaisi, setPrenomSaisi] = useState(prenom ?? "");
  const cible = cibleId ? groupe?.notes.find((n) => n.id === cibleId) ?? null : null;
  // BP 2026-10-18 : garder ça simple — pas d'étiquettes, pas de gabarits, pas de bouton Dicter.
  const ok = cible ? !!texte.trim() : noteValide({ numero, prenom, texte, etiquettes: [] });
  const sujet = `gameon:${seance.id}:${cote}:${numero ?? (prenom ?? "").toLowerCase()}`;
  // BP 2026-10-19 : l'historique EN HAUT (ordre du match, la plus récente juste au-dessus du champ),
  // le joueur et la boîte d'écriture TOUJOURS collés en bas — comme un fil de messages.
  const historique = groupe?.notes ?? [];
  const finHistorique = useRef<HTMLDivElement>(null);
  useEffect(() => { finHistorique.current?.scrollIntoView({ block: "end" }); }, [historique.length, connu?.id]);

  const enregistrer = () => {
    if (!ok) return;
    if (cible) onAjouterA(cible, texte);
    else onEnregistrer({ prenom: prenom?.trim() || null, texte });
    setTexte("");
    setCibleId(null);
  };
  const validerPrenom = () => { onRenommer(prenomSaisi); setCrayon(false); };

  // Le joueur : #N · Prénom ✏️ (collé en bas, au-dessus du champ).
  const joueur = (
    <div className="flex min-h-[44px] items-center gap-2">
      <Chandail couleur={couleurCote(seance, cote)} taille={18} />
      <span className="shrink-0 text-[26px] font-black leading-none text-white">{numero ? `#${numero}` : (prenom || "Joueur")}</span>
      {numero && (crayon ? (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <input autoFocus value={prenomSaisi} onChange={(e) => setPrenomSaisi(e.target.value)} maxLength={60}
            onKeyDown={(e) => { if (e.key === "Enter") validerPrenom(); }}
            placeholder="Prénom (facultatif)" aria-label="Prénom du joueur"
            className="h-11 min-w-0 flex-1 rounded-xl border border-[#2D3748] bg-[#111317] px-3 text-[16px] text-white placeholder:text-white/30" />
          <button type="button" onClick={validerPrenom} className="h-11 shrink-0 rounded-xl bg-white/10 px-3 text-[14px] font-bold text-white">OK</button>
        </span>
      ) : (
        <button type="button" onClick={() => { setPrenomSaisi(prenom ?? ""); setCrayon(true); }} aria-label="Modifier le prénom"
          data-testid="fiche-joueur-crayon"
          className="flex min-h-[44px] min-w-0 items-center gap-1.5 text-left">
          <span className={`truncate text-[18px] font-bold ${prenom ? "text-white" : "text-white/40"}`}>· {prenom || "Prénom (facultatif)"}</span>
          <span aria-hidden className="text-[16px]">✏️</span>
        </button>
      ))}
    </div>
  );

  // En-tête mince : l'équipe et Fermer. L'historique défile dessous.
  const entete = (
    <div className="flex items-center justify-between gap-3">
      <p className="min-w-0 truncate text-[13px] font-semibold text-white/60">
        {equipe} · <span className="uppercase tracking-wider text-white/45">Historique</span>
      </p>
      <button type="button" onClick={onFermer} className="h-11 shrink-0 px-2 text-[14px] font-semibold text-white/60">Fermer</button>
    </div>
  );

  return (
    <FeuilleBas variante="feuille" onFermer={onFermer} etiquette={`Fiche — ${numero ? `#${numero}` : (prenom || "Joueur")}`} testId="game-on-note"
      entete={entete}
      pied={
        <div data-testid="fiche-joueur-saisie">
          {joueur}
          {connu && (
            <p className="mt-0.5 truncate text-[13px] font-semibold text-[#22C55E]" data-testid="fiche-joueur-connu">
              ✓ {connu.nom} — {connu.type === "carte" ? "tes notes continuent sa carte" : "athlète Nexus, tes notes iront à sa fiche"}
            </p>
          )}
          {cible && (
            <div className="mb-2 mt-1 flex items-center justify-between gap-2 rounded-xl border border-[#E63946]/40 bg-[#E63946]/10 px-3 py-2 text-[13px] text-white">
              <span className="min-w-0 truncate">Ajout à ta note de {heureLigne(cible.noteLe)}</span>
              <button type="button" onClick={() => setCibleId(null)} className="shrink-0 font-bold text-white/70 underline">Nouvelle note</button>
            </div>
          )}
          <div className="mt-1">
            <ChampNote value={texte} onChange={setTexte} sujet={sujet} mobile envoyerAvecEntree={false} sansGabarits sansDictee
              placeholder={cible ? "Ce que tu ajoutes…" : "Ce que tu as vu…"} ariaLabel="Note sur ce joueur" />
          </div>
          <button type="button" disabled={!ok} onClick={enregistrer}
            className="mt-3 h-14 w-full rounded-2xl bg-[#E63946] text-[17px] font-black text-white disabled:opacity-40">
            {cible ? "Ajouter à cette note" : "Enregistrer"}
          </button>
        </div>
      }>
        {connu && jumelle && <MemeJoueur carte={jumelle} athlete={connu} />}
        {connu && <NotesAvant connu={connu} onPasLui={() => onPasLui(connu.id)} />}
        {!connu && ecarte && (
          <p className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-[13px] text-white/60" data-testid="fiche-joueur-ecarte">
            <span className="min-w-0 truncate">Écarté : {ecarte.nom}</span>
            <button type="button" onClick={onRetablir} className="h-9 shrink-0 px-1 font-semibold text-white/80 underline">Rétablir</button>
          </p>
        )}
        {historique.length === 0 ? (
          <p className="py-6 text-center text-[14px] text-white/40">{connu ? "Rien encore sur lui dans ce match." : "Aucune note sur ce joueur pour l'instant."}</p>
        ) : (
          <ul className="space-y-2" data-testid="fiche-joueur-historique">
            {historique.map((n: NoteAffichee) => {
              const modifiable = n.deMoi && !n.lieLe;
              const contenu = (
                <>
                  <span className="mb-0.5 block text-[12px] text-white/45">
                    {heureLigne(n.noteLe)} · {n.deMoi ? "Toi" : (n.auteurNom ?? "Collègue")}
                    {n.enAttente && <span className="ml-1 text-[#FCD34D]">(en attente)</span>}
                  </span>
                  <span className="block whitespace-pre-line">{n.texte}</span>
                </>
              );
              return (
                <li key={n.id} className={`flex items-start gap-2 rounded-xl px-3 py-2 text-[14px] text-white/85 ${cibleId === n.id ? "bg-[#E63946]/15 ring-1 ring-[#E63946]/50" : "bg-[#111317]"}`}>
                  {modifiable ? (
                    <button type="button" className="min-w-0 flex-1 text-left" aria-label={`Ajouter à ta note de ${heureLigne(n.noteLe)}`}
                      onClick={() => { triggerHaptic("Light"); setCibleId(n.id); }}>
                      {contenu}
                    </button>
                  ) : <div className="min-w-0 flex-1">{contenu}</div>}
                  {modifiable && (
                    <button type="button" onClick={() => { if (cibleId === n.id) setCibleId(null); void onSupprimer(n.id); }}
                      className="h-9 shrink-0 px-1 text-[12px] text-white/40 underline">Supprimer</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div ref={finHistorique} />
    </FeuilleBas>
  );
}

/* Peut-être le même joueur (BP 2026-10-19) : ta fausse carte et le vrai profil Nexus portent le même
   numéro dans la même équipe. « Fusionner » (deux temps) : la carte et son fil passent au profil,
   annulable 7 jours depuis l'Historique du dossier (lot E). « Pas le même » cache l'offre. */
function MemeJoueur({ carte, athlete }: { carte: CarteCandidate; athlete: Suggestion }) {
  const qc = useQueryClient();
  const [etat, setEtat] = useState<"offre" | "confirmer" | "fusion" | "fait" | "cache">("offre");
  const [erreur, setErreur] = useState<string | null>(null);
  if (etat === "cache") return null;
  const fusionner = async () => {
    setEtat("fusion");
    setErreur(null);
    const e = await fusionnerCarte(createClient(), carte.id, athlete.id);
    if (e) { setErreur(e); setEtat("confirmer"); return; }
    setEtat("fait");
    void invaliderTableauBlanc(qc);
    void qc.invalidateQueries({ queryKey: ["game-on"] });
  };
  return (
    <div className="mb-3 rounded-xl border border-[#3B82F6]/35 bg-[#3B82F6]/[0.08] px-3 py-2.5 text-[13px] text-white/85" data-testid="meme-joueur">
      {etat === "fait" ? (
        <p>Fusionné : la carte « {carte.prenom} {carte.nom} » et son fil sont maintenant sur le profil de {athlete.nom}.</p>
      ) : (
        <>
          <p>Tu as aussi la carte <span className="font-semibold text-white">« {carte.prenom} {carte.nom} » #{carte.numero}</span> dans cette équipe : c&apos;est peut-être le même joueur que {athlete.nom}.</p>
          {erreur && <p className="mt-1 text-[#FCA5A5]">{erreur}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {etat === "offre" ? (
              <button type="button" onClick={() => setEtat("confirmer")} className="h-9 rounded-lg bg-[#3B82F6] px-3 text-[13px] font-bold text-white">Fusionner</button>
            ) : (
              <button type="button" disabled={etat === "fusion"} onClick={() => void fusionner()} className="h-9 rounded-lg bg-[#E63946] px-3 text-[13px] font-bold text-white disabled:opacity-50">
                {etat === "fusion" ? "Fusion…" : "Confirmer : la carte passe au profil"}
              </button>
            )}
            <button type="button" onClick={() => setEtat("cache")} className="h-9 text-[13px] font-semibold text-white/60 underline">Pas le même</button>
          </div>
        </>
      )}
    </div>
  );
}

/* Un athlète Nexus reconnu (BP 2026-10-19) : « Voir le profil » (retour au match par la flèche
   du profil : la séance en cours se rouvre d'elle-même) et le cœur, pour le suivre tout de suite. */
function ActionsAthleteConnu({ athleteId, nom }: { athleteId: string; nom: string }) {
  const { favoris, basculer, modale } = useBasculeFavori();
  const estFavori = favoris.ids.has(athleteId);
  const [occupe, setOccupe] = useState(false);
  return (
    <div className="mb-2 flex items-center gap-4" data-testid="actions-athlete-connu">
      <Link href={`/recruteur/athletes/${athleteId}`} onClick={() => triggerHaptic("Light")}
        className="flex h-9 items-center text-[13px] font-bold text-white underline">Voir le profil</Link>
      <button type="button" disabled={occupe || favoris.isLoading}
        onClick={async () => { setOccupe(true); triggerHaptic("Light"); try { await basculer(athleteId, estFavori, nom); } finally { setOccupe(false); } }}
        aria-pressed={estFavori}
        className={`flex h-9 items-center gap-1.5 text-[13px] font-bold disabled:opacity-50 ${estFavori ? "text-[#E63946]" : "text-white/80"}`}>
        <span aria-hidden>{estFavori ? "♥" : "♡"}</span>{estFavori ? "Dans les favoris" : "Ajouter aux favoris"}
      </button>
      {modale}
    </div>
  );
}

/* Ses notes d'AVANT ce match (BP 2026-10-19) : « je veux continuer mes notes, pas recommencer ».
   Le fil de la carte, ou les notes de l'unité sur l'athlète ; les 10 plus récentes, en ordre. */
const AVANT_MAX = 10;

function NotesAvant({ connu, onPasLui }: { connu: Suggestion; onPasLui: () => void }) {
  const partenaire = useMode() === "partenaire";
  const carteQ = useNotesCarte(!partenaire && connu.type === "carte" ? connu.id : null);
  const cartePartenaireQ = useNotesCartePartenaire(partenaire && connu.type === "carte" ? connu.id : null);
  const uniteQ = useNotesUnite(!partenaire && connu.type === "athlete" ? connu.id : null);
  const q = connu.type !== "carte" ? uniteQ : partenaire ? cartePartenaireQ : carteQ;
  const toutes = (q.data ?? []) as { id: string; content: string; created_at: string }[];
  const notes = toutes.slice(0, AVANT_MAX).reverse();
  return (
    <div className="mb-3" data-testid="fiche-joueur-avant">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[13px] font-bold text-[#22C55E]">
          {connu.type === "carte" ? (partenaire ? "Ta carte en attente" : "Dans ton processus") : "Sur Nexus"} · {connu.nom}
        </p>
        <button type="button" onClick={onPasLui} className="h-9 shrink-0 px-1 text-[12px] font-semibold text-white/50 underline">Pas lui</button>
      </div>
      {!partenaire && connu.type === "athlete" && <ActionsAthleteConnu athleteId={connu.id} nom={connu.nom} />}
      {q.isLoading ? (
        <p className="text-[13px] text-white/40">Chargement de ses notes…</p>
      ) : q.isError ? (
        <p className="text-[13px] text-white/40">Hors ligne : ses notes d&apos;avant reviendront avec le réseau.</p>
      ) : notes.length === 0 ? (
        <p className="text-[13px] text-white/40">Aucune note d&apos;avant sur lui.</p>
      ) : (
        <ul className="space-y-2">
          {toutes.length > AVANT_MAX && <li className="text-[12px] text-white/40">{toutes.length - AVANT_MAX} plus ancienne{toutes.length - AVANT_MAX > 1 ? "s" : ""} dans sa fiche</li>}
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-[13px] text-white/70">
              <span className="mb-0.5 block text-[11px] text-white/40">{dateSeance(n.created_at)}</span>
              <span className="block whitespace-pre-line">{n.content}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 border-t border-white/10 pt-2 text-[11px] font-bold uppercase tracking-wider text-white/45">Ce match</p>
    </div>
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
  const groupes = useMemo(() => grouperParJoueur(notes, locale?.seance.prenoms), [notes, locale?.seance.prenoms]);
  const attente = locale ? notesEnAttente(locale).length : 0;

  const equipesQ = useEquipesMatch(s?.gameId);
  const partenaire = useMode() === "partenaire";
  const athletesQ = useAthletesMatch(partenaire ? null : s?.gameId);
  const equipeDe = (c: Cote): EquipeMatch | null => (c === "A" ? equipesQ.data?.A : equipesQ.data?.B) ?? null;
  const idsEquipes = [equipesQ.data?.A?.teamId, equipesQ.data?.B?.teamId].filter((x): x is string => !!x);

  const ecoles = [equipesQ.data?.A?.etablissement?.id, equipesQ.data?.B?.etablissement?.id].filter((x): x is string => !!x);
  const cartesQ = useCartesDepistage(ecoles, idsEquipes);
  // Partenaire : ses sports permis (pour créer une carte depuis le tri).
  const sportsPermisQ = useQuery<{ id: string; nom: string }[]>({
    queryKey: ["game-on", "sports-permis-partenaire"],
    enabled: partenaire,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: mp } = await supabase.from("media_partners").select("id").eq("user_id", user.id).maybeSingle();
      if (!mp) return [];
      const { data } = await supabase.from("partenaire_sports_permis").select("sport_id, sports!sport_id(nom)").eq("partner_id", mp.id);
      return ((data ?? []) as { sport_id: string; sports: { nom: string } | { nom: string }[] | null }[])
        .map((r) => ({ id: r.sport_id, nom: (Array.isArray(r.sports) ? r.sports[0]?.nom : r.sports?.nom) ?? "" }))
        .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    },
  });
  const sportsPermis = sportsPermisQ.data ?? [];

  const [ouvert, setOuvert] = useState<string | null>(null);
  const [creer, setCreer] = useState<GroupeJoueur | null>(null);
  const [enCours, setEnCours] = useState(false);

  if (!s) return <p className="py-6 text-center text-[14px] text-white/50">Séance introuvable.</p>;

  // Un lien : la base range les notes, puis le fil de la carte (ou la fiche) reçoit
  // « Match X vs Y, date » et les notes.
  const lierUn = async (g: GroupeJoueur, cible: { athleteId?: string; carteId?: string } | null): Promise<{ erreur: string } | { recopie: boolean }> => {
    const supabase = createClient();
    if (partenaire) {
      // Partenaire : la base range les notes sur SA carte (et y pose le numéro s'il manque). Pas de fil à recopier.
      if (cible?.athleteId) return { erreur: "Un partenaire lie ses notes à ses cartes." };
      const { error: ep } = await supabase.rpc("partenaire_match_notes_lier", {
        p_seance: seanceId, p_cote: g.cote, p_numero: g.numero, p_prenom: g.prenom, p_prospect_id: cible?.carteId ?? null,
      });
      return ep ? { erreur: messageErreur(ep) } : { recopie: true };
    }
    const { error } = await supabase.rpc("match_notes_lier", {
      p_seance: seanceId, p_cote: g.cote, p_numero: g.numero, p_prenom: g.prenom,
      p_athlete_id: cible?.athleteId ?? null, p_carte_id: cible?.carteId ?? null,
    });
    if (error) return { erreur: messageErreur(error) };
    if (!cible) return { recopie: true };
    const texte = texteRecopie(s, g);
    const e2 = cible.carteId
      ? await ajouterNoteCarte(supabase, cible.carteId, texte)
      : moi ? (await supabase.from("recruiter_notes").insert({ recruiter_id: moi, athlete_id: cible.athleteId, content: texte })).error : null;
    // BP 2026-10-19 : un joueur qu'on dépiste est IDENTIFIÉ — hors processus, son dossier s'ouvre à Identifié
    // (jamais de recul s'il y est déjà ; une carte est déjà dans le processus dès sa création).
    if (cible.athleteId) {
      const { data: dossier } = await supabase.rpc("unite_pipeline").eq("athlete_id", cible.athleteId);
      if (!((dossier ?? []) as unknown[]).length) {
        const { error: eDossier } = await supabase.rpc("unite_ecrire_dossier", { p_athlete_id: cible.athleteId, p_champs: { stage: "IDENTIFIE" } });
        if (eDossier) console.error(`[dépistage] dossier non ouvert ${eDossier.code ?? ""} ${eDossier.message}`);
      }
    }
    // Une carte sans numéro garde celui du match : au prochain match, il est reconnu tout seul.
    const carte = cible.carteId ? cartesQ.data?.find((c) => c.id === cible.carteId) : null;
    if (carte && !carte.numero?.trim() && g.numero) await ecrireCarte(supabase, carte.id, { numero: g.numero });
    return { recopie: !e2 };
  };

  const lier = async (g: GroupeJoueur, cible: { athleteId?: string; carteId?: string } | null, nom?: string) => {
    if (enCours) return;
    setEnCours(true);
    try {
      const r = await lierUn(g, cible);
      if ("erreur" in r) { avis(r.erreur, true); return; }
      if (cible) {
        if (!r.recopie) avis("Lié, mais la note n'a pas pu être recopiée dans la fiche.", true);
        else avis(`${libelleJoueur(g)} lié${nom ? ` à ${nom}` : ""} — notes ajoutées à ${partenaire ? "sa carte" : "son fil"}.`);
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

  // Reconnus pendant le match : un seul toucher pour tous les ajouter à leur fiche.
  const lierReconnus = async (liste: { g: GroupeJoueur; connu: Suggestion }[]) => {
    if (enCours || liste.length === 0) return;
    setEnCours(true);
    let ok = 0;
    let echec: string | null = null;
    try {
      for (const { g, connu } of liste) {
        const r = await lierUn(g, connu.type === "carte" ? { carteId: connu.id } : { athleteId: connu.id });
        if ("erreur" in r) { echec = r.erreur; break; }
        ok += 1;
      }
      if (echec) avis(ok > 0 ? `${ok} ajouté${ok > 1 ? "s" : ""}, puis : ${echec}` : echec, true);
      else avis(`${ok} joueur${ok > 1 ? "s" : ""} ajouté${ok > 1 ? "s" : ""} à leur fiche.`);
      void invaliderTableauBlanc(qc);
      void qc.invalidateQueries({ queryKey: ["game-on"] });
    } finally {
      setEnCours(false);
    }
  };

  const aTrier = groupes.filter((g) => !g.traite);
  const traites = groupes.filter((g) => g.traite);
  const reconnus = aTrier.flatMap((g) => {
    const connu = joueurConnu(g, athletesQ.data ?? [], cartesQ.data ?? [], equipeDe(g.cote)?.teamId ?? null, locale?.seance.pasLui?.[g.cle] ?? null);
    return connu ? [{ g, connu }] : [];
  });
  const prerempli = (g: GroupeJoueur): PrerempliCarte => {
    const e = equipeDe(g.cote);
    return {
      prenom: g.prenom, numero: g.numero,
      etablissement: e?.etablissement ?? null, sportAthleteId: e?.sportId ?? null, teamId: e?.teamId ?? null,
    };
  };

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
          {aTrier.length === 0 && <p className="mb-4 text-[14px] text-[#22C55E]">Tout est trié. Beau travail ! Touche « Retour à {DEPISTAGE.titre} » plus bas.</p>}
          {reconnus.length > 0 && (
            <div className="mb-4 rounded-2xl border border-[#22C55E]/30 bg-[#22C55E]/[0.07] p-4" data-testid="tri-reconnus">
              <p className="mb-2 text-[14px] font-bold text-white">Déjà connus ({reconnus.length})</p>
              <ul className="mb-3 space-y-1">
                {reconnus.map(({ g, connu }) => (
                  <li key={g.cle} className="truncate text-[14px] text-white/80">
                    {libelleJoueur(g)} → <span className="font-semibold text-white">{connu.nom}</span>
                    <span className="text-white/50"> · {connu.type === "carte" ? "carte" : "athlète Nexus"} · {g.notes.length} note{g.notes.length > 1 ? "s" : ""}</span>
                  </li>
                ))}
              </ul>
              <button type="button" disabled={attente > 0 || enCours} onClick={() => void lierReconnus(reconnus)}
                className="h-12 w-full rounded-xl bg-[#22C55E] text-[15px] font-bold text-[#111317] disabled:opacity-40">
                Ajouter à leur fiche
              </button>
            </div>
          )}
          <ul className="space-y-3">
            {aTrier.map((g) => (
              <LigneTri key={g.cle} g={g} couleur={couleurCote(locale?.seance, g.cote)} ouvert={ouvert === g.cle} desactive={attente > 0 || enCours}
                suggestions={suggestionsTri(g, athletesQ.data ?? [], cartesQ.data ?? [], equipeDe(g.cote)?.teamId ?? null, equipeDe(g.cote)?.etablissement?.id ?? null)}
                onOuvrir={() => setOuvert((v) => (v === g.cle ? null : g.cle))}
                onLier={(sug) => void lier(g, sug.type === "carte" ? { carteId: sug.id } : { athleteId: sug.id }, sug.nom)}
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

      {/* Partenaire (BP 2026-10-19) : SA carte, préremplie depuis le match ; les notes s'y lient à l'enregistrement. */}
      {creer && partenaire && (
        <FormulaireCarte sports={sportsPermis} carte={null}
          prerempli={(() => {
            const p = prerempli(creer);
            const e = p.etablissement;
            return { prenom: creer.prenom, sportId: p.sportAthleteId ?? null, teamId: p.teamId ?? null,
              etablissement: e ? { id: e.id, name: e.name, city: e.city, type: e.type ?? null } : null };
          })()}
          onClose={() => setCreer(null)}
          onEnregistree={(id) => {
            const g = creer;
            setCreer(null);
            void lier(g, { carteId: id }, `${g.prenom ?? ""}`.trim() || undefined);
            void qc.invalidateQueries({ queryKey: ["game-on", "cartes-partenaire"] });
          }} />
      )}
      {creer && !partenaire && sportId && (mobile ? (
        <CreerProspectMobile sportId={sportId} onClose={() => setCreer(null)}
          prerempli={prerempli(creer)}
          onCarteCreee={(id) => { const g = creer; void lier(g, { carteId: id }); }} />
      ) : (
        <CreerCarteModal sportId={sportId} onClose={() => setCreer(null)}
          prerempli={prerempli(creer)}
          onCarteCreee={(id) => { const g = creer; void lier(g, { carteId: id }); }}
          onCreee={(m) => { setCreer(null); avis(m); }} />
      ))}
    </div>
  );
}

function LigneTri({ g, couleur, ouvert, desactive, suggestions, onOuvrir, onLier, onLierAthlete, onCreer, onGarder }: {
  g: GroupeJoueur; couleur: string; ouvert: boolean; desactive: boolean;
  suggestions: Suggestion[];
  onOuvrir: () => void; onLier: (s: Suggestion) => void; onLierAthlete: (id: string, nom: string) => void;
  /** null : pas de création ici (partenaire — ses cartes se créent dans Mes athlètes). */
  onCreer: (() => void) | null; onGarder: () => void;
}) {
  const partenaire = useMode() === "partenaire";
  const [recherche, setRecherche] = useState(g.prenom ?? "");
  const [chercher, setChercher] = useState(false);
  const athletesQ = useAthleteAutocomplete(ouvert && chercher ? recherche : "");
  return (
    <li className="rounded-2xl border border-white/10 bg-[#1A1D24] p-4">
      <button type="button" onClick={onOuvrir} className="flex w-full items-start justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[18px] font-black text-white"><Chandail couleur={couleur} />{libelleJoueur(g)}</span>
          <span className="block text-[12px] text-white/50">{g.notes.length} note{g.notes.length > 1 ? "s" : ""}{suggestions.length > 0 ? ` · ${suggestions.length} suggestion${suggestions.length > 1 ? "s" : ""}` : ""}</span>
        </span>
        <span className="shrink-0 rounded-full bg-[#E63946] px-3 py-1.5 text-[13px] font-bold text-white">{ouvert ? "Fermer" : "Trier"}</span>
      </button>
      <ul className="mt-3 space-y-1.5">
        {g.notes.map((n) => (
          <li key={n.id} className="text-[14px] text-white/80">
            <span className="mr-2 text-[12px] text-white/40">{heureLigne(n.noteLe)}{n.deMoi ? "" : ` · ${n.auteurNom ?? "Collègue"}`}</span>
            <span className="whitespace-pre-line">{n.texte}</span>
          </li>
        ))}
      </ul>
      {ouvert && (
        <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-white/50">Suggestions</p>
            {suggestions.length === 0 ? (
              <p className="text-[13px] text-white/50">Aucun athlète ni aucune carte de cette équipe avec ce numéro ou ce prénom.</p>
            ) : (
              <ul className="space-y-2" data-testid="tri-suggestions">
                {suggestions.map((c) => (
                  <li key={`${c.type}:${c.id}`}>
                    <button type="button" disabled={desactive} onClick={() => onLier(c)}
                      className="flex w-full min-h-[52px] items-center justify-between gap-3 rounded-xl bg-[#111317] px-4 py-2 text-left disabled:opacity-40">
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-white">{c.nom}{c.numero ? ` · #${c.numero}` : ""}</span>
                        <span className="block truncate text-[12px] text-white/50">
                          {c.type === "athlete" ? "Athlète Nexus" : "Carte prospect"}
                          {c.memeEquipe ? " · équipe du match" : c.equipe ? ` · ${c.equipe}` : ""}
                          {c.raison === "numero" ? " · même numéro" : " · nom proche"}
                        </span>
                      </span>
                      <span className="shrink-0 text-[13px] font-bold text-[#E63946]">Lier</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!partenaire && <div>
            {!chercher ? (
              <button type="button" onClick={() => setChercher(true)} className="text-[13px] font-bold text-white/70 underline">Chercher un autre athlète sur Nexus</button>
            ) : (
              <>
                <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom de l'athlète" autoFocus
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
              </>
            )}
          </div>}
          <div className={`grid gap-2 ${onCreer ? "grid-cols-2" : "grid-cols-1"}`}>
            {onCreer && <button type="button" disabled={desactive} onClick={onCreer} className="h-12 rounded-xl bg-[#E63946] text-[14px] font-bold text-white disabled:opacity-40">Créer une carte</button>}
            <button type="button" disabled={desactive} onClick={onGarder} className="h-12 rounded-xl bg-white/[0.06] text-[14px] font-bold text-white/80 disabled:opacity-40">Garder sans lier</button>
          </div>
        </div>
      )}
    </li>
  );
}
