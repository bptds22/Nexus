"use client";

/* ═══════════════════════════════════════════════════════════════
   useGameOn — l'état du mode match : stock local (localStorage, toujours en
   premier), envoi par lots dès que le réseau revient (événement online,
   reprise de l'appli, toutes les 20 s, après chaque note), lectures serveur
   (séances de l'unité, notes des collègues).

   Les fonctions de la base (migration 20261018130000) peuvent manquer en prod :
   `indisponible` passe alors à vrai et l'écran le dit, sans planter.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { surReprise } from "@/lib/push/pastillesAppareil";
import {
  ajouterNote, ecrireStock, fonctionAbsente, lireStock, lots, marquerEnvoyees, messageErreur,
  notesEnAttente, nouvelleSeance, remapperSeance, retirerNote, versEnvoi,
  type Cote, type EtatSeance, type NoteAffichee, type NoteLocale, type StockGameOn,
} from "@/lib/gameOn/gameOn";

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

/** Notes d'une séance côté base (collègues compris), relues toutes les 20 s pendant le match. */
export function useNotesSeance(seance: string | null, moi: string | null, actif = true) {
  return useQuery<NoteAffichee[]>({
    queryKey: cleNotes(seance),
    enabled: !!seance && actif,
    refetchInterval: 20_000,
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

  // Lecture au montage seulement (le serveur de rendu n'a pas de localStorage).
  useEffect(() => {
    const s = lireStock(stockage());
    ref.current = s;
    // Lecture unique du stockage de l'appareil au montage.
    setStockEtat(s);
    setCharge(true);
    setEnLigne(typeof navigator === "undefined" ? true : navigator.onLine !== false);
  }, []);

  const poser = useCallback((s: StockGameOn) => {
    ref.current = s;
    ecrireStock(stockage(), s);
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

  // Signaux : réseau revenu, reprise de l'appli, toutes les 20 s.
  useEffect(() => {
    if (!charge) return;
    const enLigneOn = () => { setEnLigne(true); void synchroniser(); };
    const horsLigne = () => setEnLigne(false);
    window.addEventListener("online", enLigneOn);
    window.addEventListener("offline", horsLigne);
    const retirerReprise = surReprise(() => { void synchroniser(); });
    const t = window.setInterval(() => { void synchroniser(); }, 20_000);
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

  const activer = useCallback((id: string | null) => poser({ ...ref.current, active: id }), [poser]);

  const noter = useCallback((seance: string, n: Omit<NoteLocale, "envoyee">) => {
    majSeance(seance, (e) => ajouterNote(e, n));
    void synchroniser();
  }, [majSeance, synchroniser]);

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
    demarrer, rejoindre, activer, noter, supprimerNote, terminer, oublier, synchroniser,
  };
}
