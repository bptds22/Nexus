"use client";

/* ═══════════════════════════════════════════════════════════════
   useGameOn — l'état du mode match : stock local (localStorage, toujours en
   premier), envoi par lots dès que le réseau revient (événement online,
   reprise de l'appli, toutes les 15 s, après chaque note), lectures serveur
   (séances de l'unité, notes des collègues — relues toutes les 15 s en ligne
   et à chaque retour dans l'appli : les notes d'un collègue arrivent « en
   direct », sans Realtime ; BP 2026-10-18).

   Les fonctions de la base (migration 20261018130000) peuvent manquer en prod :
   `indisponible` passe alors à vrai et l'écran le dit, sans planter.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { surReprise } from "@/lib/push/pastillesAppareil";
import { fetchRecruiterAthleteCards } from "@/lib/queries/shared/recruiterAthleteCards";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import {
  ajouterLigneDatee, ajouterNote, avecCouleurs, avecPasLui, avecPrenom, cleStock, ecrireStock, fonctionAbsente, lireStock, lots, marquerEnvoyees, messageErreur,
  notesEnAttente, nouvelleSeance, remapperSeance, retirerNote, versEnvoi,
  type AthleteCandidat, type CarteCandidate, type Cote, type EtatSeance, type GroupeJoueur, type NoteAffichee, type NoteLocale, type StockGameOn,
} from "@/lib/gameOn/gameOn";

/** Cadence des relectures pendant le match (BP 2026-10-18 : « sinon 15 s »). */
export const RELECTURE_MS = 15_000;
const enLigneMaintenant = () => typeof navigator === "undefined" || navigator.onLine !== false;

const stockage = () => {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
};

export function nouvelId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch { /* contexte non sûr */ }
  // Repli RFC 4122 v4 (WebView ancienne).
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export interface SeanceServeur {
  id: string;
  game_id: string | null;
  equipe_a: string;
  equipe_b: string | null;
  lieu: string | null;
  commence_le: string;
  termine_le: string | null;
  cree_par: string;
  nb_notes: number;
  nb_a_lier: number;
}

interface LigneNote {
  id: string; auteur: string; auteur_nom: string | null; cote: Cote; numero: string | null; prenom: string | null;
  texte: string; etiquettes: string[] | null; note_le: string; athlete_id: string | null; carte_id: string | null; lie_le: string | null;
}

export const CLE_SEANCES = ["game-on", "seances"] as const;
export const cleNotes = (seance: string | null) => ["game-on", "notes", seance] as const;

/** Séances de l'unité (120 jours). `indisponible` : migration absente. */
export function useSeancesRecentes(enabled = true) {
  return useQuery<{ seances: SeanceServeur[]; indisponible: boolean }>({
    queryKey: CLE_SEANCES,
    enabled,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("match_seances_recentes");
      if (error) {
        if (fonctionAbsente(error)) return { seances: [], indisponible: true };
        throw new Error(messageErreur(error));
      }
      return { seances: (data ?? []) as SeanceServeur[], indisponible: false };
    },
  });
}

/** Notes d'une séance côté base (collègues compris) : relues toutes les 15 s quand on est en ligne,
 *  au retour dans l'appli et au retour du réseau. Restent lisibles après « Terminer ». */
export function useNotesSeance(seance: string | null, moi: string | null, actif = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!seance || !actif) return;
    const relire = () => { void qc.invalidateQueries({ queryKey: cleNotes(seance) }); };
    window.addEventListener("online", relire);
    const retirer = surReprise(relire);
    return () => { window.removeEventListener("online", relire); retirer(); };
  }, [seance, actif, qc]);
  return useQuery<NoteAffichee[]>({
    queryKey: cleNotes(seance),
    enabled: !!seance && actif,
    refetchInterval: () => (enLigneMaintenant() ? RELECTURE_MS : false),
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("match_notes_seance", { p_seance: seance });
      if (error) {
        if (fonctionAbsente(error)) return [];
        throw new Error(messageErreur(error));
      }
      return ((data ?? []) as LigneNote[]).map((n) => ({
        id: n.id, cote: n.cote, numero: n.numero, prenom: n.prenom, texte: n.texte, etiquettes: n.etiquettes ?? [],
        noteLe: n.note_le, auteurNom: n.auteur_nom, deMoi: !!moi && n.auteur === moi, enAttente: false,
        athleteId: n.athlete_id, carteId: n.carte_id, lieLe: n.lie_le,
      }));
    },
  });
}

/** Le stock local et sa synchronisation. Un seul appel par écran Game On. */
export function useStockGameOn() {
  const qc = useQueryClient();
  const [stock, setStockEtat] = useState<StockGameOn>({ seances: {}, active: null });
  const [charge, setCharge] = useState(false);
  const [enLigne, setEnLigne] = useState(true);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  const [indisponible, setIndisponible] = useState(false);
  const ref = useRef(stock);
  const verrou = useRef(false);
  // Le stock est celui DU COMPTE connecté (BP 2026-10-19) : rien n'est lu ni écrit avant de le connaître.
  const { data: user } = useCurrentUser();
  const compte = user?.authUser.id ?? null;
  const cle = useRef<string | null>(null);

  // Lecture au montage, et à chaque changement de compte (le serveur de rendu n'a pas de localStorage).
  useEffect(() => {
    if (!compte) return;
    cle.current = cleStock(compte);
    const s = lireStock(stockage(), cle.current);
    ref.current = s;
    // Lecture du stockage de l'appareil, pour ce compte.
    setStockEtat(s);
    setCharge(true);
    setEnLigne(typeof navigator === "undefined" ? true : navigator.onLine !== false);
  }, [compte]);

  const poser = useCallback((s: StockGameOn) => {
    if (!cle.current) return;
    ref.current = s;
    ecrireStock(stockage(), s, cle.current);
    setStockEtat(s);
  }, []);

  const majSeance = useCallback((id: string, f: (e: EtatSeance) => EtatSeance) => {
    const cur = ref.current;
    const e = cur.seances[id];
    if (!e) return;
    poser({ ...cur, seances: { ...cur.seances, [id]: f(e) } });
  }, [poser]);

  /** Envoie tout ce qui attend : ouvrir les séances, envoyer les notes, terminer. */
  const synchroniser = useCallback(async () => {
    if (verrou.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    verrou.current = true;
    setEnvoiEnCours(true);
    const supabase = createClient();
    let touche = false;
    try {
      for (const id of Object.keys(ref.current.seances)) {
        let etat = ref.current.seances[id];
        if (!etat) continue;
        let sid = id;
        if (!etat.seance.ouverte) {
          const s = etat.seance;
          const { data, error } = await supabase.rpc("match_seance_ouvrir", {
            p_id: s.id, p_game_id: s.gameId, p_equipe_a: s.equipeA, p_equipe_b: s.equipeB, p_lieu: s.lieu, p_commence_le: s.commenceLe,
          });
          if (error) {
            if (fonctionAbsente(error)) { setIndisponible(true); return; }
            setErreurEnvoi(messageErreur(error));
            continue;
          }
          const rendu = (data as string | null) ?? s.id;
          if (rendu !== s.id) poser(remapperSeance(ref.current, s.id, rendu));
          else majSeance(s.id, (e) => ({ ...e, seance: { ...e.seance, ouverte: true } }));
          sid = rendu;
          etat = ref.current.seances[sid];
          touche = true;
        }
        for (const lot of lots(notesEnAttente(etat), 100)) {
          const { error } = await supabase.rpc("match_notes_envoyer", { p_seance: sid, p_notes: versEnvoi(lot) });
          if (error) {
            if (fonctionAbsente(error)) { setIndisponible(true); return; }
            setErreurEnvoi(messageErreur(error));
            break;
          }
          majSeance(sid, (e) => marquerEnvoyees(e, lot.map((n) => n.id)));
          touche = true;
        }
        etat = ref.current.seances[sid];
        if (etat?.seance.termineLe && !etat.seance.termineeEnvoyee && notesEnAttente(etat).length === 0) {
          const { error } = await supabase.rpc("match_seance_terminer", { p_id: sid });
          if (!error) majSeance(sid, (e) => ({ ...e, seance: { ...e.seance, termineeEnvoyee: true } }));
        }
      }
      setErreurEnvoi(null);
    } catch {
      // Réseau coupé en plein envoi : on réessaiera au prochain signal.
    } finally {
      verrou.current = false;
      setEnvoiEnCours(false);
      if (touche) {
        void qc.invalidateQueries({ queryKey: CLE_SEANCES });
        void qc.invalidateQueries({ queryKey: ["game-on", "notes"] });
      }
    }
  }, [majSeance, poser, qc]);

  // Signaux : réseau revenu, reprise de l'appli, toutes les 15 s.
  useEffect(() => {
    if (!charge) return;
    const enLigneOn = () => { setEnLigne(true); void synchroniser(); };
    const horsLigne = () => setEnLigne(false);
    window.addEventListener("online", enLigneOn);
    window.addEventListener("offline", horsLigne);
    const retirerReprise = surReprise(() => { void synchroniser(); });
    const t = window.setInterval(() => { void synchroniser(); }, RELECTURE_MS);
    void synchroniser();
    return () => {
      window.removeEventListener("online", enLigneOn);
      window.removeEventListener("offline", horsLigne);
      retirerReprise();
      window.clearInterval(t);
    };
  }, [charge, synchroniser]);

  const demarrer = useCallback((p: { gameId?: string | null; equipeA: string; equipeB?: string | null; lieu?: string | null }) => {
    const cur = ref.current;
    // Même match déjà ouvert sur l'appareil : on le reprend.
    const deja = p.gameId ? Object.values(cur.seances).find((e) => e.seance.gameId === p.gameId && !e.seance.termineLe) : null;
    if (deja) { poser({ ...cur, active: deja.seance.id }); return deja.seance.id; }
    const e = nouvelleSeance(nouvelId(), p);
    poser({ seances: { ...cur.seances, [e.seance.id]: e }, active: e.seance.id });
    void synchroniser();
    return e.seance.id;
  }, [poser, synchroniser]);

  /** Reprendre une séance de l'unité (ouverte par moi ou un collègue) sur cet appareil. */
  const rejoindre = useCallback((s: SeanceServeur) => {
    const cur = ref.current;
    if (!cur.seances[s.id]) {
      const e = nouvelleSeance(s.id, { gameId: s.game_id, equipeA: s.equipe_a, equipeB: s.equipe_b, lieu: s.lieu }, new Date(s.commence_le));
      e.seance.ouverte = true;
      e.seance.termineLe = s.termine_le;
      e.seance.termineeEnvoyee = !!s.termine_le;
      poser({ seances: { ...cur.seances, [s.id]: e }, active: s.id });
    } else {
      poser({ ...cur, active: s.id });
    }
  }, [poser]);

  /** Couleurs des chandails, demandées à chaque match. */
  const colorer = useCallback((id: string, couleurA: string, couleurB: string) => {
    majSeance(id, (e) => avecCouleurs(e, couleurA, couleurB));
  }, [majSeance]);

  const activer = useCallback((id: string | null) => poser({ ...ref.current, active: id }), [poser]);

  const noter = useCallback((seance: string, n: Omit<NoteLocale, "envoyee">) => {
    majSeance(seance, (e) => ajouterNote(e, n));
    void synchroniser();
  }, [majSeance, synchroniser]);

  /** Fiche du joueur : ajoute une ligne datée à une de MES notes, sans écraser le texte d'avant.
   *  Hors ligne d'abord : la note repart avec le même id (match_notes_envoyer met à jour l'auteur). */
  const ajouterA = useCallback((seance: string, base: NoteAffichee, ajout: string) => {
    if (!base.deMoi || base.lieLe) return false;
    const e = ref.current.seances[seance];
    const locale = e?.notes.find((n) => n.id === base.id);
    const avant = locale?.texte ?? base.texte;
    majSeance(seance, (x) => ajouterNote(x, {
      id: base.id, cote: base.cote, numero: base.numero, prenom: locale?.prenom ?? base.prenom,
      texte: ajouterLigneDatee(avant, ajout), etiquettes: locale?.etiquettes ?? base.etiquettes, noteLe: base.noteLe,
    }));
    void synchroniser();
    return true;
  }, [majSeance, synchroniser]);

  /** Le crayon de l'en-tête : corrige le prénom du joueur. La séance le retient ; MES notes
   *  du joueur (pas encore liées) repartent avec ce prénom. */
  const renommer = useCallback((seance: string, g: Pick<GroupeJoueur, "cle" | "notes">, prenom: string) => {
    majSeance(seance, (x) => {
      let e = avecPrenom(x, g.cle, prenom);
      for (const n of g.notes) {
        if (!n.deMoi || n.lieLe) continue;
        const locale = e.notes.find((l) => l.id === n.id);
        e = ajouterNote(e, {
          id: n.id, cote: n.cote, numero: n.numero, prenom: prenom.trim() || null,
          texte: locale?.texte ?? n.texte, etiquettes: locale?.etiquettes ?? n.etiquettes, noteLe: n.noteLe,
        });
      }
      return e;
    });
    void synchroniser();
  }, [majSeance, synchroniser]);

  /** « Pas lui » sur le joueur reconnu (id), ou le rétablir (null). Sur l'appareil seulement. */
  const ecarter = useCallback((seance: string, cle: string, id: string | null) => {
    majSeance(seance, (x) => avecPasLui(x, cle, id));
  }, [majSeance]);

  const supprimerNote = useCallback(async (seance: string, id: string) => {
    const e = ref.current.seances[seance];
    const locale = e?.notes.find((n) => n.id === id);
    majSeance(seance, (x) => retirerNote(x, id));
    if (!locale || locale.envoyee) {
      const { error } = await createClient().rpc("match_note_supprimer", { p_id: id });
      if (!error) void qc.invalidateQueries({ queryKey: cleNotes(seance) });
      return error ? messageErreur(error) : null;
    }
    return null;
  }, [majSeance, qc]);

  const terminer = useCallback((seance: string) => {
    majSeance(seance, (e) => ({ ...e, seance: { ...e.seance, termineLe: e.seance.termineLe ?? new Date().toISOString() } }));
    void synchroniser();
  }, [majSeance, synchroniser]);

  /** Oublier une séance sur CET appareil (tout est envoyé) — la base la garde. */
  const oublier = useCallback((seance: string) => {
    const cur = ref.current;
    const e = cur.seances[seance];
    if (e && notesEnAttente(e).length > 0) return false;
    const seances = { ...cur.seances };
    delete seances[seance];
    poser({ seances, active: cur.active === seance ? null : cur.active });
    return true;
  }, [poser]);

  const enAttente = Object.values(stock.seances).reduce((n, e) => n + notesEnAttente(e).length, 0);

  return {
    stock, charge, enLigne, envoiEnCours, erreurEnvoi, indisponible, enAttente,
    demarrer, rejoindre, colorer, activer, noter, ajouterA, renommer, ecarter, supprimerNote, terminer, oublier, synchroniser,
  };
}

/* ── Le match : ses deux équipes, ses athlètes Nexus (BP 2026-10-18) ──── */

export interface EquipeMatch {
  teamId: string;
  nom: string;
  sportId: string | null;
  etablissement: { id: string; name: string; city: string | null; type: string | null } | null;
}

type EcoleLue = { id: string; name: string; city: string | null; type: string | null };
type LigneEquipe = { id: string; name: string; sport_id: string | null; schools: EcoleLue | EcoleLue[] | null };

/** Les équipes des côtés A (domicile) et B (visiteur) d'un match connu : de quoi préremplir une carte. */
export function useEquipesMatch(gameId: string | null | undefined) {
  return useQuery<{ A: EquipeMatch | null; B: EquipeMatch | null }>({
    queryKey: ["game-on", "equipes-match", gameId ?? null],
    enabled: !!gameId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data: g } = await supabase.from("games").select("home_team_id, visitor_team_id").eq("id", gameId!).maybeSingle();
      const ids = [g?.home_team_id, g?.visitor_team_id].filter((x): x is string => !!x);
      if (ids.length === 0) return { A: null, B: null };
      const { data } = await supabase.from("teams").select("id, name, sport_id, schools:school_id(id, name, city, type)").in("id", ids);
      const parId = new Map<string, EquipeMatch>(((data ?? []) as unknown as LigneEquipe[]).map((t) => {
        const e = Array.isArray(t.schools) ? t.schools[0] ?? null : t.schools;
        return [t.id, { teamId: t.id, nom: t.name, sportId: t.sport_id, etablissement: e ? { id: e.id, name: e.name, city: e.city, type: e.type } : null }];
      }));
      return {
        A: g?.home_team_id ? parId.get(g.home_team_id as string) ?? null : null,
        B: g?.visitor_team_id ? parId.get(g.visitor_team_id as string) ?? null : null,
      };
    },
  });
}

/** Les athlètes Nexus des deux équipes (matchs_profils_nexus), avec leur numéro (recruiter_athlete_cards).
 *  Seuls ceux dont l'identité est visible au recruteur sont proposés. */
export function useAthletesMatch(gameId: string | null | undefined) {
  return useQuery<AthleteCandidat[]>({
    queryKey: ["game-on", "athletes-match", gameId ?? null],
    enabled: !!gameId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("matchs_profils_nexus", { p_games: [gameId] });
      if (error) return [];
      const lignes = (data ?? []) as { athlete_id: string; prenom: string | null; nom: string | null; cote: "DOMICILE" | "VISITEUR" }[];
      if (lignes.length === 0) return [];
      const cartes = await fetchRecruiterAthleteCards(supabase, lignes.map((l) => l.athlete_id)).catch(() => null);
      return lignes.flatMap((l): AthleteCandidat[] => {
        const c = cartes?.get(l.athlete_id);
        if (!c?.identity_visible) return [];
        return [{
          id: l.athlete_id, prenom: c.first_name ?? l.prenom ?? "", nom: c.last_name ?? l.nom ?? "",
          numero: c.numero_jersey ?? null, cote: l.cote === "DOMICILE" ? "A" : "B",
        }];
      });
    },
  });
}

/** Les cartes de l'unité des ÉCOLES du match (toutes leurs équipes) et des deux équipes du match.
 *  BP 2026-10-19 : une suggestion reste dans la même école — plus de « même numéro » ailleurs. */
export function useCartesUnite(ecoles: readonly string[], idsEquipes: readonly string[]) {
  return useQuery<CarteCandidate[]>({
    queryKey: ["game-on", "cartes", ecoles.join(","), idsEquipes.join(",")],
    enabled: ecoles.length > 0 || idsEquipes.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const champs = "id, prenom, nom, numero, team_id, school_id, teams:team_id(name)";
      const [parEcole, parEquipe] = await Promise.all([
        ecoles.length > 0
          ? supabase.from("cartes_prospect").select(champs).in("school_id", [...ecoles]).is("fusionnee_le", null).limit(1000)
          : Promise.resolve({ data: [], error: null }),
        idsEquipes.length > 0
          ? supabase.from("cartes_prospect").select(champs).in("team_id", [...idsEquipes]).is("fusionnee_le", null).limit(1000)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (parEcole.error) throw parEcole.error;
      if (parEquipe.error) throw parEquipe.error;
      const vus = new Map<string, CarteCandidate>();
      for (const c of [...(parEcole.data ?? []), ...(parEquipe.data ?? [])] as Record<string, unknown>[]) {
        const t = Array.isArray(c.teams) ? c.teams[0] : c.teams;
        vus.set(c.id as string, {
          id: c.id as string, prenom: (c.prenom as string) ?? "", nom: (c.nom as string) ?? "", numero: (c.numero as string) ?? null,
          teamId: (c.team_id as string) ?? null, schoolId: (c.school_id as string) ?? null,
          equipe: ((t as { name?: string } | null)?.name) ?? null,
        });
      }
      return [...vus.values()];
    },
  });
}

/** Les cartes « En attente » du PARTENAIRE des écoles et des équipes du match (BP 2026-10-19).
 *  Fonction absente (prod sans la migration 20261019140000) : aucune carte, sans erreur. */
export function useCartesPartenaire(ecoles: readonly string[], idsEquipes: readonly string[], actif = true) {
  return useQuery<CarteCandidate[]>({
    queryKey: ["game-on", "cartes-partenaire", ecoles.join(","), idsEquipes.join(",")],
    enabled: actif && (ecoles.length > 0 || idsEquipes.length > 0),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("partenaire_depistage_cartes", { p_ecoles: [...ecoles], p_equipes: [...idsEquipes] });
      if (error) {
        if (fonctionAbsente(error)) return [];
        throw error;
      }
      return ((data ?? []) as { id: string; prenom: string | null; nom: string | null; numero: string | null; team_id: string | null; school_id: string | null; equipe: string | null }[])
        .map((c) => ({ id: c.id, prenom: c.prenom ?? "", nom: c.nom ?? "", numero: c.numero, teamId: c.team_id, schoolId: c.school_id, equipe: c.equipe }));
    },
  });
}

/** Les notes de dépistage déjà liées à une carte du partenaire (le « fil » de sa carte). */
export function useNotesCartePartenaire(prospectId: string | null) {
  return useQuery<{ id: string; content: string; created_at: string }[]>({
    queryKey: ["game-on", "notes-carte-partenaire", prospectId],
    enabled: !!prospectId,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("partenaire_prospect_notes_match", { p_prospect_id: prospectId });
      if (error) {
        if (fonctionAbsente(error)) return [];
        throw error;
      }
      const lignes = (data ?? []) as { id: string; note_le: string; texte: string; equipe_a: string; equipe_b: string | null; commence_le: string }[];
      // Du plus récent au plus ancien, comme useNotesCarte ; le match en tête de chaque note.
      return lignes.map((n) => ({
        id: n.id, created_at: n.note_le,
        content: `${n.equipe_b ? `${n.equipe_a} vs ${n.equipe_b}` : n.equipe_a}\n${n.texte}`,
      })).reverse();
    },
  });
}

/** Combien de notes de dépistage par carte du partenaire (Mes athlètes) ; vide sans la migration. */
export function useComptesDepistagePartenaire(actif = true) {
  return useQuery<Map<string, number>>({
    queryKey: ["game-on", "comptes-partenaire"],
    enabled: actif,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await createClient().rpc("partenaire_depistage_compte");
      if (error) return new Map();
      return new Map(((data ?? []) as { prospect_id: string; nb: number }[]).map((r) => [r.prospect_id, r.nb]));
    },
  });
}
