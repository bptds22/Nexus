"use client";

/* ═══════════════════════════════════════════════════════════════
   CreerProspectMobile — « + Prospect » de Mon processus (recette 1.4.4).

   MÊMES CHAMPS QUE LE FORMULAIRE WEB (CreerCarteModal, décision BP
   2026-10-02), mêmes validations et mêmes formats acceptés — les lectures
   viennent du même module (lib/cartes/saisie : 6'2", 188 cm, 121 lbs…).
   Pour rester rapide sur le terrain, l'ordre change :
   · EN HAUT : prénom, nom, Scolaire/Civil puis école ou club, l'équipe
     quand l'établissement en a, courriel, téléphone ;
   · SOUS « Plus d'infos » (replié) : position, numéro, promotion, taille,
     poids, lien vidéo, nom et courriel du parent. Une erreur dans un champ
     replié rouvre la section et y place le curseur.

   L'équipe : la base l'exige quand l'établissement a des équipes du sport
   de l'unité (cartes_prospect_avant_insert). Une seule → prise d'office ;
   aucune → la carte se rattache à l'établissement (même message qu'au web).

   « Créer et inviter » — il faut un courriel OU un téléphone :
   · courriel → NEXUS envoie l'invitation, par le même déclencheur que le
     web (une seule fois par adresse) ;
   · téléphone SEUL → l'app Messages s'ouvre avec le texto pré-écrit
     (texteRenvoi, le texte du web) ; le recruteur appuie sur Envoyer.
     Avec les deux, le courriel suffit : pas de seconde invitation.
   Doublons : la détection du web (lib/cartes/doublonsCarte), en
   avertissement discret ; le second appui crée quand même. Pas de QR.

   Clavier : comme la feuille Filtrer, un champ qui prend le focus est
   ramené dans la partie visible quand la feuille raccourcit.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";
import { creerCarte, libelleEquipe, normaliserNom } from "@/lib/cartes/carteProspect";
import { chercherDoublonsCarte, type DoublonCarte } from "@/lib/cartes/doublonsCarte";
import { MENTION_INVITATION_NON_ENVOYEE } from "@/lib/cartes/invitationEtat";
import { lireTaille, lirePoids, lireCourriel, lireLien, lireTelephone, lireNomParent, lireCourrielParent } from "@/lib/cartes/saisie";
import { texteRenvoi, lienSms } from "@/lib/cartes/renvoiInvitation";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import { useSheetKeyboardGeometry } from "@/lib/hooks/useSheetKeyboardGeometry";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { triggerHaptic } from "@/lib/haptics";

type Genre = "SCOLAIRE" | "CIVIL";
/** Scolaire = les écoles (secondaire, et le collégial pour un transfert) ;
 *  Civil = les clubs (LIGUE_CIVILE, rangés dans schools pour la plomberie).
 *  Même partage que le web. */
const TYPES: Record<Genre, string[]> = { SCOLAIRE: ["SECONDAIRE", "CEGEP"], CIVIL: ["LIGUE_CIVILE"] };

type Champ = "taille" | "poids" | "courriel" | "telephone" | "parentNom" | "parentCourriel" | "video";
/** Les champs rangés sous « Plus d'infos ». */
const REPLIES: Champ[] = ["taille", "poids", "video", "parentNom", "parentCourriel"];

interface Etablissement { id: string; name: string; city: string | null; cle: string }
interface Equipe { id: string; libelle: string }
interface Position { id: string; abreviation: string | null; nom: string }

const champ = "w-full min-h-[46px] bg-[#1A1D24] border border-white/10 rounded-xl px-3 text-[15px] text-white placeholder:text-[#4a4d56] outline-none focus:border-[#E63946] [&>option]:bg-[#13151a] disabled:opacity-50";
const etiquette = "block text-[11px] uppercase tracking-[0.18em] text-[#6B7280] font-bold mb-1.5";

export default function CreerProspectMobile({ sportId, onClose }: {
  /** Sport de l'unité du recruteur : la carte naît dans SON unité. */
  sportId: string;
  onClose: () => void;
}) {
  const toast = useMobileToast();
  const queryClient = useQueryClient();
  const kbdStyle = useSheetKeyboardGeometry("90vh");
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const { data: currentUser } = useCurrentUser();
  const profil = currentUser?.profile;

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [genre, setGenre] = useState<Genre>("SCOLAIRE");
  const [recherche, setRecherche] = useState("");
  const [etablissement, setEtablissement] = useState<Etablissement | null>(null);
  // Le sport DE L'ATHLÈTE (décision BP 2026-10-05) — distinct du sport de
  // l'unité (sportId, prop) : la carte naît dans l'unité du créateur, mais
  // l'athlète peut jouer n'importe quel sport offert par son établissement.
  const [sportAthleteId, setSportAthleteId] = useState("");
  const [equipeChoisie, setEquipeChoisie] = useState("");
  const [courriel, setCourriel] = useState("");
  const [telephone, setTelephone] = useState("");
  const [plus, setPlus] = useState(false);
  const [positionId, setPositionId] = useState("");
  const [numero, setNumero] = useState("");
  const [promotion, setPromotion] = useState("");
  const [taille, setTaille] = useState("");
  const [poids, setPoids] = useState("");
  const [video, setVideo] = useState("");
  const [parentNom, setParentNom] = useState("");
  const [parentCourriel, setParentCourriel] = useState("");
  const [erreurs, setErreurs] = useState<Partial<Record<Champ, string>>>({});
  const [avertissements, setAvertissements] = useState<DoublonCarte[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  /* Champ ramené à vue (voir l'en-tête) : au focus, et quand la hauteur du
     clavier change pendant qu'un champ a le focus. */
  const zone = useRef<HTMLDivElement>(null);
  const ramener = useCallback(() => {
    window.setTimeout(() => {
      const el = document.activeElement as HTMLElement | null;
      if (el && zone.current?.contains(el) && (el.tagName === "INPUT" || el.tagName === "SELECT")) {
        el.scrollIntoView({ block: "nearest" });
      }
    }, 300);
  }, []);
  const hauteurClavier = kbdStyle.bottom;
  useEffect(() => { ramener(); }, [hauteurClavier, ramener]);

  // Le nom du cégep (texto) — même clé de cache que le panneau web.
  const { data: cegep = null } = useQuery({
    queryKey: ["ecole-nom", profil?.school_id],
    enabled: !!profil?.school_id,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await createClient().from("schools").select("name").eq("id", profil!.school_id!).maybeSingle();
      return (data?.name as string | undefined) ?? null;
    },
  });

  // Positions et nom DU SPORT DE L'ATHLÈTE — jamais celui de l'unité.
  const { data: sport } = useQuery({
    queryKey: ["carte-sport", sportAthleteId],
    enabled: !!sportAthleteId,
    staleTime: Infinity,
    queryFn: async () => {
      const supabase = createClient();
      const [{ data }, { data: s }] = await Promise.all([
        supabase.from("positions").select("id, abreviation, nom").eq("sport_id", sportAthleteId).order("nom"),
        supabase.from("sports").select("nom").eq("id", sportAthleteId).maybeSingle(),
      ]);
      return { positions: (data ?? []) as Position[], nom: (s?.nom as string | undefined) ?? "" };
    },
  });

  // Les sports offerts par l'établissement choisi (≥ 1 équipe) — repli :
  // choix libre parmi tous les sports s'il n'en a AUCUNE.
  const { data: sportsEtablissement = null } = useQuery({
    queryKey: ["carte-sports-etablissement", etablissement?.id],
    enabled: !!etablissement,
    staleTime: Infinity,
    queryFn: async (): Promise<{ id: string; nom: string }[]> => {
      const { data } = await createClient().from("teams").select("sport_id, sports!sport_id(nom)").eq("school_id", etablissement!.id);
      const vus = new Map<string, string>();
      for (const t of (data ?? []) as { sport_id: string; sports: { nom: string } | { nom: string }[] | null }[]) {
        const s = Array.isArray(t.sports) ? t.sports[0] : t.sports;
        if (s?.nom) vus.set(t.sport_id, s.nom);
      }
      return [...vus.entries()].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    },
  });
  // Un seul sport offert : pas de choix réel, on le pose directement.
  useEffect(() => {
    if (sportsEtablissement?.length === 1 && !sportAthleteId) setSportAthleteId(sportsEtablissement[0].id);
  }, [sportsEtablissement, sportAthleteId]);
  const { data: tousLesSports = null } = useQuery({
    queryKey: ["tous-les-sports"],
    enabled: sportsEtablissement !== null && sportsEtablissement.length === 0,
    staleTime: Infinity,
    queryFn: async () => {
      const { data } = await createClient().from("sports").select("id, nom").order("nom");
      return (data ?? []) as { id: string; nom: string }[];
    },
  });

  // Tous les établissements du genre, lus UNE fois pour la session : la
  // recherche se fait ici, sans accents (un ilike côté base ne sait pas les
  // ignorer). Aucun filtre de sport — comme le web (bug prod 2026-09-30).
  const { data: tous = null } = useQuery({
    queryKey: ["carte-etablissements", genre],
    staleTime: Infinity,
    queryFn: async () => {
      const supabase = createClient();
      const lus: Etablissement[] = [];
      for (let debut = 0; debut < 20000; debut += 1000) {
        const { data, error } = await supabase
          .from("schools").select("id, name, city").in("type", TYPES[genre])
          .order("name").range(debut, debut + 999);
        if (error || !data) break;
        for (const e of data as { id: string; name: string; city: string | null }[]) {
          lus.push({ id: e.id, name: e.name, city: e.city, cle: normaliserNom(`${e.name} ${e.city ?? ""}`) });
        }
        if (data.length < 1000) break;
      }
      return lus;
    },
  });

  const resultats = useMemo(() => {
    if (etablissement || !tous || recherche.trim().length < 2) return [];
    const mots = normaliserNom(recherche).split(" ").filter(Boolean);
    return tous.filter((e) => mots.every((m) => e.cle.includes(m))).slice(0, 12);
  }, [recherche, etablissement, tous]);

  // Les équipes DU SPORT DE L'ATHLÈTE choisi dans l'établissement.
  const nomSport = sport?.nom ?? "";
  const { data: equipes = null } = useQuery({
    queryKey: ["carte-equipes", etablissement?.id, sportAthleteId, nomSport],
    enabled: !!etablissement && !!sportAthleteId && !!sport,
    queryFn: async (): Promise<Equipe[]> => {
      const { data } = await createClient().from("teams").select("id, name, age_group, division, gender")
        .eq("school_id", etablissement!.id).eq("sport_id", sportAthleteId).order("age_group").order("division");
      const lignes = ((data ?? []) as { id: string; name: string; age_group: string | null; division: string | null; gender: string | null }[])
        .map((e) => ({ id: e.id, name: e.name, libelle: libelleEquipe(nomSport, e) }));
      const vus = new Map<string, number>();
      for (const e of lignes) vus.set(e.libelle, (vus.get(e.libelle) ?? 0) + 1);
      return lignes.map((e) => ({ id: e.id, libelle: vus.get(e.libelle)! > 1 ? `${e.libelle} — ${e.name}` : e.libelle }));
    },
  });
  const sansEquipe = !!etablissement && equipes !== null && equipes.length === 0;
  const teamId = equipes?.length === 1 ? equipes[0].id : equipeChoisie || null;
  const equipeOk = !!etablissement && equipes !== null && (sansEquipe || !!teamId);
  const aContact = courriel.trim().length > 0 || telephone.trim().length > 0;
  const valide = prenom.trim().length > 0 && nom.trim().length > 0 && !!sportAthleteId && equipeOk && aContact;

  const promotions = useMemo(() => {
    const an = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => an + i);
  }, []);

  /* Chaque champ libre se lit à la sortie du champ ET à l'envoi ; l'erreur
     s'affiche SOUS lui, avec la règle attendue — comme au web. */
  const lectures = () => ({
    taille: lireTaille(taille),
    poids: lirePoids(poids),
    courriel: lireCourriel(courriel),
    telephone: lireTelephone(telephone),
    parentNom: lireNomParent(parentNom),
    parentCourriel: lireCourrielParent(parentCourriel),
    video: lireLien(video),
  });
  const verifierChamp = (c: Champ) => {
    const r = lectures()[c];
    setErreurs((e) => ({ ...e, [c]: r.ok ? undefined : r.regle }));
  };
  const effacerErreur = (c: Champ) => setErreurs((e) => (e[c] ? { ...e, [c]: undefined } : e));
  const toucher = () => { setAvertissements(null); setErreur(null); };

  const soumettre = async () => {
    if (!valide || enCours || !etablissement) return;
    setErreur(null);
    const l = lectures();
    const fautes: Partial<Record<Champ, string>> = {};
    for (const c of ["courriel", "telephone", "taille", "poids", "video", "parentNom", "parentCourriel"] as Champ[]) {
      const r = l[c];
      if (!r.ok) fautes[c] = r.regle;
    }
    if (Object.keys(fautes).length > 0) {
      setErreurs(fautes);
      const premier = Object.keys(fautes)[0] as Champ;
      if (REPLIES.includes(premier)) setPlus(true);
      window.setTimeout(() => document.getElementById(`prospect-${premier}`)?.focus(), 50);
      return;
    }
    const courrielLu = l.courriel.ok ? l.courriel.valeur : null;
    const telephoneLu = l.telephone.ok ? l.telephone.valeur : null;
    if (!courrielLu && !telephoneLu) return;
    setEnCours(true);
    try {
      const supabase = createClient();
      if (avertissements === null) {
        const trouves = await chercherDoublonsCarte(supabase, {
          prenom, nom, sportId, etablissement, courriel: courrielLu ?? "",
        });
        if (trouves.length > 0) { setAvertissements(trouves); return; }
      }
      const { id: carteId, error } = await creerCarte(supabase, {
        prenom, nom, teamId: sansEquipe ? null : teamId, schoolId: etablissement.id,
        sportAthleteId,
        positionId: positionId || null,
        numero: numero || null,
        promotion: promotion.trim() === "" ? null : Number(promotion),
        taillePieds: l.taille.ok ? l.taille.valeur.pieds : null,
        taillePouces: l.taille.ok ? l.taille.valeur.pouces : null,
        poidsLbs: l.poids.ok ? l.poids.valeur : null,
        lienVideo: l.video.ok ? l.video.valeur : null,
        courriel: courrielLu,
        telephone: telephoneLu,
        parentNom: l.parentNom.ok ? l.parentNom.valeur : null,
        parentCourriel: l.parentCourriel.ok ? l.parentCourriel.valeur : null,
      });
      if (error) { setErreur("La carte n'a pas pu être créée. Réessaie."); return; }
      triggerHaptic("Medium");
      void invaliderTableauBlanc(queryClient);
      const quiEst = `${prenom.trim()} ${nom.trim()}`;
      if (courrielLu) {
        /* Le déclencheur de la base (le même que le web) peut ÉCARTER
           l'invitation — adresse déjà invitée dans les 90 jours, compte
           existant, désabonnement. Il a statué dans la transaction de
           l'insertion : on relit la carte au lieu de promettre un envoi
           (cas réel 2026-10-03). Mention neutre, sans la raison, comme la
           fiche (invitationEtat). */
        const { data: etat } = carteId
          ? await supabase.from("cartes_prospect").select("invitation_etat").eq("id", carteId).maybeSingle()
          : { data: null };
        if (etat?.invitation_etat === "NON_ENVOYEE") {
          toast.info({ message: `Carte créée : ${quiEst}. ${MENTION_INVITATION_NON_ENVOYEE}`, duration: 7000 });
        } else {
          toast.success({ message: `Carte créée : ${quiEst}. Nexus envoie l'invitation à ${courrielLu}.` });
        }
        onClose();
      } else if (telephoneLu) {
        const corps = texteRenvoi({
          prenom: prenom.trim(),
          recruteur: [profil?.first_name, profil?.last_name].filter(Boolean).join(" "),
          cegep,
          courriel: null,
        });
        toast.success({ message: `Carte créée : ${quiEst}. Appuie sur Envoyer dans Messages.` });
        onClose();
        window.location.href = lienSms(telephoneLu, corps, Capacitor.getPlatform() === "ios");
      }
    } finally {
      setEnCours(false);
    }
  };

  if (!mounted) return null;

  /** Champ texte libre avec sa règle sous lui (même patron que le web). */
  const libre = (c: Champ, libelle: string, valeur: string, poser: (v: string) => void, opts: {
    placeholder: string; inputMode?: "email" | "tel" | "url" | "text" | "decimal"; type?: string; aide?: string; maxLength?: number;
  }) => (
    <div>
      <label htmlFor={`prospect-${c}`} className={etiquette}>{libelle}</label>
      <input
        id={`prospect-${c}`}
        data-testid={`prospect-${c}`}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        autoComplete="off"
        autoCapitalize="none"
        maxLength={opts.maxLength}
        className={`${champ} ${erreurs[c] ? "border-[#EF4444]" : ""}`}
        value={valeur}
        placeholder={opts.placeholder}
        aria-invalid={!!erreurs[c]}
        onChange={(e) => { poser(e.target.value); effacerErreur(c); if (c === "courriel") toucher(); }}
        onBlur={() => verifierChamp(c)}
      />
      {erreurs[c]
        ? <p className="text-[12px] text-[#EF4444] mt-1">{erreurs[c]}</p>
        : opts.aide ? <p className="text-[12px] text-[#6B7280] mt-1">{opts.aide}</p> : null}
    </div>
  );

  const libelleBouton = enCours
    ? "…"
    : avertissements && avertissements.length > 0
      ? "Créer et inviter quand même"
      : "Créer et inviter";

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[55] bg-black/60"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-label="Ajouter un prospect"
        data-testid="creer-prospect"
        initial={{ y: "100%" }} animate={{ y: 0 }}
        transition={{ duration: 0.28, ease: [0.34, 1.56, 0.64, 1] }}
        className="fixed inset-x-0 bottom-0 z-[60] bg-[#111317] rounded-t-2xl flex flex-col"
        style={{ ...kbdStyle, touchAction: "pan-y" }}
      >
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
        <div className="flex items-center justify-between px-4">
          <h2 className="font-head text-[16px] font-black text-white uppercase tracking-tight">Ajouter un prospect</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center active:bg-white/5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
          </button>
        </div>
        <p className="px-4 text-[12px] text-[#6B7280] mb-3">Un athlète qui n&apos;est pas encore sur Nexus. Seuls tes collègues de l&apos;unité voient la carte.</p>

        <div ref={zone} onFocus={ramener} className="flex-1 overflow-y-auto px-4 pb-3 space-y-4" style={{ overflowX: "hidden", overscrollBehaviorX: "none", touchAction: "pan-y" }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prospect-prenom" className={etiquette}>Prénom <span className="text-[#E63946]">*</span></label>
              <input id="prospect-prenom" data-testid="prospect-prenom" className={champ} value={prenom} maxLength={80} autoComplete="off"
                onChange={(e) => { setPrenom(e.target.value); toucher(); }} />
            </div>
            <div>
              <label htmlFor="prospect-nom" className={etiquette}>Nom <span className="text-[#E63946]">*</span></label>
              <input id="prospect-nom" data-testid="prospect-nom" className={champ} value={nom} maxLength={80} autoComplete="off"
                onChange={(e) => { setNom(e.target.value); toucher(); }} />
            </div>
          </div>

          <div>
            <span className={etiquette}>École ou club <span className="text-[#E63946]">*</span></span>
            {etablissement ? (
              <div className="flex items-center justify-between gap-2 min-h-[46px] rounded-xl border border-white/10 bg-[#1A1D24] px-3">
                <span className="text-[15px] text-white truncate" data-testid="prospect-etablissement">
                  {etablissement.name}
                  {etablissement.city && <span className="text-[#6B7280]"> · {etablissement.city}</span>}
                </span>
                <button type="button" onClick={() => { setEtablissement(null); setSportAthleteId(""); setEquipeChoisie(""); setRecherche(""); toucher(); }}
                  className="min-h-[40px] text-[12px] font-bold text-[#9CA3AF] shrink-0">
                  Changer
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-1 p-1 rounded-xl bg-[#1A1D24] mb-2" role="radiogroup" aria-label="Scolaire ou civil">
                  {(["SCOLAIRE", "CIVIL"] as Genre[]).map((g) => (
                    <button key={g} type="button" role="radio" aria-checked={genre === g} data-testid={`prospect-genre-${g.toLowerCase()}`}
                      onClick={() => { triggerHaptic("Light"); setGenre(g); }}
                      className={`flex-1 min-h-[38px] rounded-lg text-[12px] font-bold uppercase tracking-wider ${genre === g ? "bg-[#E63946] text-white" : "text-[#9CA3AF]"}`}>
                      {g === "SCOLAIRE" ? "Scolaire" : "Civil"}
                    </button>
                  ))}
                </div>
                <input id="prospect-ecole" data-testid="prospect-ecole" type="search" className={champ} value={recherche}
                  aria-label={genre === "SCOLAIRE" ? "Nom de l'école" : "Nom du club"}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder={genre === "SCOLAIRE" ? "Nom de l'école (2 lettres minimum)" : "Nom du club (2 lettres minimum)"}
                  autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search" />
                {resultats.length > 0 && (
                  <ul className="mt-1.5 rounded-xl border border-white/10 bg-[#1A1D24] divide-y divide-white/[0.06]" role="listbox" aria-label={genre === "SCOLAIRE" ? "Écoles" : "Clubs"}>
                    {resultats.map((e) => (
                      <li key={e.id}>
                        <button type="button" role="option" aria-selected={false} data-testid="prospect-choix-ecole"
                          onClick={() => { triggerHaptic("Light"); setEtablissement(e); toucher(); }}
                          className="w-full min-h-[46px] text-left px-3 py-2 text-[14px] active:bg-white/[0.04]">
                          <span className="font-semibold text-white">{e.name}</span>
                          {e.city && <span className="text-[#6B7280]"> · {e.city}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {recherche.trim().length >= 2 && tous !== null && resultats.length === 0 && (
                  <p className="text-[12px] text-[#6B7280] mt-1.5">{genre === "SCOLAIRE" ? "Aucune école ne correspond." : "Aucun club ne correspond."}</p>
                )}
                {recherche.trim().length >= 2 && tous === null && (
                  <p className="text-[12px] text-[#6B7280] mt-1.5">Chargement…</p>
                )}
              </>
            )}
          </div>

          {etablissement && sportsEtablissement !== null && (
            <div>
              <label htmlFor="prospect-sport" className={etiquette}>Sport <span className="text-[#E63946]">*</span></label>
              <select id="prospect-sport" data-testid="prospect-sport" className={champ} value={sportAthleteId}
                onChange={(e) => { setSportAthleteId(e.target.value); setEquipeChoisie(""); toucher(); }}>
                <option value="">Choisir le sport</option>
                {(sportsEtablissement.length > 0 ? sportsEtablissement : (tousLesSports ?? [])).map((s) => (
                  <option key={s.id} value={s.id}>{s.nom}</option>
                ))}
              </select>
              {sportsEtablissement.length === 0 && (
                <p className="text-[12px] text-[#6B7280] mt-1">
                  {genre === "CIVIL" ? "Ce club n'a aucune équipe enregistrée — choisis le sport de l'athlète." : "Cette école n'a aucune équipe enregistrée — choisis le sport de l'athlète."}
                </p>
              )}
            </div>
          )}
          {etablissement && sportsEtablissement === null && (
            <p className="text-[12px] text-[#6B7280]">Chargement des sports…</p>
          )}

          {etablissement && sportAthleteId && equipes !== null && (
            <div>
              <label htmlFor="prospect-equipe" className={etiquette}>Équipe {!sansEquipe && <span className="text-[#E63946]">*</span>}</label>
              <select id="prospect-equipe" data-testid="prospect-equipe" className={champ} disabled={sansEquipe}
                value={equipes.length === 1 ? equipes[0].id : equipeChoisie}
                onChange={(e) => { setEquipeChoisie(e.target.value); toucher(); }}>
                {equipes.length !== 1 && <option value="">{sansEquipe ? "Aucune équipe de ce sport" : "Choisir l'équipe"}</option>}
                {equipes.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
              </select>
              {sansEquipe && (
                <p className="text-[12px] text-[#F59E0B] mt-1" data-testid="prospect-aucune-equipe">
                  {`Aucune équipe${nomSport ? ` de ${nomSport.toLowerCase()}` : ""} inscrite pour ${genre === "CIVIL" ? "ce club — la carte sera rattachée au club" : "cette école — la carte sera rattachée à l'école"}. Dès qu'un entraîneur inscrit l'équipe, tu pourras la préciser.`}
                </p>
              )}
            </div>
          )}

          {libre("courriel", "Courriel", courriel, setCourriel, {
            placeholder: "nom@exemple.com", type: "email", inputMode: "email",
            aide: "Nexus lui envoie l'invitation à ton nom et à celui de ton cégep. Une seule fois par adresse.",
          })}
          {libre("telephone", "Téléphone", telephone, setTelephone, {
            placeholder: "438 555-0123", type: "tel", inputMode: "tel",
            aide: "Sans courriel ? Ton app Messages s'ouvrira avec le texto déjà écrit — tu n'as qu'à l'envoyer.",
          })}
          {!aContact && <p className="-mt-2 text-[12px] text-[#9CA3AF]">Un courriel ou un téléphone pour l&apos;inviter.</p>}

          {/* « Plus d'infos » — replié par défaut : le terrain d'abord. */}
          <div className="rounded-2xl bg-[#1A1D24]/60 border border-white/[0.06]">
            <button type="button" data-testid="prospect-plus" aria-expanded={plus}
              onClick={() => { triggerHaptic("Light"); setPlus((v) => !v); }}
              className="w-full min-h-[48px] px-4 flex items-center justify-between text-left">
              <span className="text-[14px] font-bold text-white">Plus d&apos;infos</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: plus ? "rotate(180deg)" : "none", transition: "transform 200ms ease" }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {plus && (
              <div className="px-4 pb-4 space-y-4" data-testid="prospect-plus-contenu">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="prospect-position" className={etiquette}>Position</label>
                    <select id="prospect-position" data-testid="prospect-position" className={champ} value={positionId} onChange={(e) => setPositionId(e.target.value)}>
                      <option value="">—</option>
                      {(sport?.positions ?? []).map((p) => <option key={p.id} value={p.id}>{p.abreviation ? `${p.abreviation} — ${p.nom}` : p.nom}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="prospect-numero" className={etiquette}>Numéro</label>
                    <input id="prospect-numero" data-testid="prospect-numero" className={champ} value={numero} inputMode="numeric" autoComplete="off"
                      onChange={(e) => setNumero(e.target.value.slice(0, 4))} />
                  </div>
                </div>
                <div>
                  <label htmlFor="prospect-promotion" className={etiquette}>Promotion</label>
                  <select id="prospect-promotion" data-testid="prospect-promotion" className={champ} value={promotion} onChange={(e) => setPromotion(e.target.value)}>
                    <option value="">—</option>
                    {promotions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {libre("taille", "Taille", taille, setTaille, { placeholder: `6'2" ou 188 cm` })}
                  {libre("poids", "Poids", poids, setPoids, { placeholder: "121 ou 121 lbs", inputMode: "text" })}
                </div>
                {libre("video", "Lien vidéo", video, setVideo, { placeholder: "youtube.com/… ou https://hudl.com/…", inputMode: "url" })}
                {libre("parentNom", "Nom du parent", parentNom, setParentNom, { placeholder: "Facultatif", maxLength: 120 })}
                {libre("parentCourriel", "Courriel du parent", parentCourriel, setParentCourriel, {
                  placeholder: "Facultatif", type: "email", inputMode: "email",
                  aide: "Le parent est visible de ton unité seulement. Aucun courriel n'est envoyé au parent.",
                })}
              </div>
            )}
          </div>

          {/* Doublons : avertir, jamais bloquer — discret. */}
          {avertissements && avertissements.length > 0 && (
            <div role="note" data-testid="prospect-doublons" className="space-y-1">
              {avertissements.map((a, i) => (
                <p key={i} className="text-[12px] leading-snug text-[#F5D08B]">
                  {a.texte}{" "}
                  {a.lien && <Link href={a.lien} className="font-bold underline text-white">Voir sa fiche</Link>}
                </p>
              ))}
            </div>
          )}
          {erreur && <p role="alert" className="text-[13px] text-[#EF4444]">{erreur}</p>}
        </div>

        <div className="px-4 pt-2 pb-3 border-t border-white/[0.06]">
          <button
            type="button"
            data-testid="prospect-creer"
            disabled={!valide || enCours}
            onClick={() => void soumettre()}
            className="w-full min-h-[48px] rounded-2xl bg-[#E63946] text-white text-[14px] font-bold active:bg-[#D42B22] disabled:opacity-40"
          >
            {libelleBouton}
          </button>
        </div>
      </motion.div>
    </>,
    document.body,
  );
}
