"use client";

/* ═══════════════════════════════════════════════════════════════
   CreerProspectMobile — « + Prospect » de Mon processus (recette 1.4.4,
   décision BP 2026-10-02 : version simple, pas de bouton flottant).

   UN écran : prénom, nom, école ou club, puis COURRIEL ou TÉLÉPHONE.
   · L'établissement se cherche sans accents ni casse, écoles ET clubs dans
     la même liste (« academie » trouve « Académie les Estacades »). Il est
     requis : c'est lui qui permet de retrouver le jeune quand il s'inscrit.
   · L'équipe : la base l'exige quand l'établissement a des équipes du sport
     de l'unité (cartes_prospect_avant_insert). Une seule → prise d'office ;
     plusieurs → un menu apparaît sous l'établissement ; aucune → la carte
     se rattache à l'établissement.
   · « Créer et inviter » :
       - courriel → la carte se crée et NEXUS envoie l'invitation, par le
         même déclencheur que le web (une seule fois par adresse) ;
       - téléphone → la carte se crée et l'app Messages s'ouvre avec le
         texto pré-écrit (texteRenvoi, le texte même du web) ; le recruteur
         appuie sur Envoyer. Nexus n'envoie rien au numéro.
   · Doublons : la détection du web (lib/cartes/doublonsCarte), en
     avertissement discret ; le second appui crée quand même.
   Pas de QR, aucun autre champ (position, taille… restent au web).
═══════════════════════════════════════════════════════════════ */

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";
import { creerCarte, libelleEquipe, normaliserNom } from "@/lib/cartes/carteProspect";
import { chercherDoublonsCarte, type DoublonCarte } from "@/lib/cartes/doublonsCarte";
import { lireCourriel, lireTelephone } from "@/lib/cartes/saisie";
import { texteRenvoi, lienSms } from "@/lib/cartes/renvoiInvitation";
import { useCurrentUser } from "@/lib/queries/shared/useCurrentUser";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";
import { useSheetKeyboardGeometry } from "@/lib/hooks/useSheetKeyboardGeometry";
import { useMobileToast } from "@/components/mobile/MobileToast";
import { triggerHaptic } from "@/lib/haptics";

/** Écoles (secondaire, et le collégial pour un transfert) ET clubs
 *  (LIGUE_CIVILE, rangés dans schools pour la plomberie). */
const TYPES = ["SECONDAIRE", "CEGEP", "LIGUE_CIVILE"];

interface Etablissement { id: string; name: string; city: string | null; club: boolean; cle: string }
interface Equipe { id: string; libelle: string }
type Canal = "courriel" | "telephone";

const champ = "w-full min-h-[46px] bg-[#1A1D24] border border-white/10 rounded-xl px-3 text-[15px] text-white placeholder:text-[#4a4d56] outline-none focus:border-[#E63946]";
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
  const [recherche, setRecherche] = useState("");
  const [etablissement, setEtablissement] = useState<Etablissement | null>(null);
  const [equipeChoisie, setEquipeChoisie] = useState("");
  const [canal, setCanal] = useState<Canal>("courriel");
  const [contact, setContact] = useState("");
  const [erreurContact, setErreurContact] = useState<string | null>(null);
  const [avertissements, setAvertissements] = useState<DoublonCarte[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

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

  // Tous les établissements, lus UNE fois pour la session : la recherche se
  // fait ici, sans accents (un ilike côté base ne sait pas les ignorer).
  const { data: tous = null } = useQuery({
    queryKey: ["carte-etablissements"],
    staleTime: Infinity,
    queryFn: async () => {
      const supabase = createClient();
      const lus: Etablissement[] = [];
      for (let debut = 0; debut < 20000; debut += 1000) {
        const { data, error } = await supabase
          .from("schools").select("id, name, city, type").in("type", TYPES)
          .order("name").range(debut, debut + 999);
        if (error || !data) break;
        for (const e of data as { id: string; name: string; city: string | null; type: string }[]) {
          lus.push({ id: e.id, name: e.name, city: e.city, club: e.type === "LIGUE_CIVILE", cle: normaliserNom(`${e.name} ${e.city ?? ""}`) });
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

  // Les équipes du sport de l'unité dans l'établissement choisi.
  const { data: equipes = null } = useQuery({
    queryKey: ["carte-equipes", etablissement?.id, sportId],
    enabled: !!etablissement,
    queryFn: async (): Promise<Equipe[]> => {
      const supabase = createClient();
      const [{ data }, { data: sport }] = await Promise.all([
        supabase.from("teams").select("id, name, age_group, division, gender")
          .eq("school_id", etablissement!.id).eq("sport_id", sportId).order("age_group").order("division"),
        supabase.from("sports").select("nom").eq("id", sportId).maybeSingle(),
      ]);
      const nomSport = (sport?.nom as string | undefined) ?? "";
      const lignes = ((data ?? []) as { id: string; name: string; age_group: string | null; division: string | null; gender: string | null }[])
        .map((e) => ({ id: e.id, name: e.name, libelle: libelleEquipe(nomSport, e) }));
      const vus = new Map<string, number>();
      for (const e of lignes) vus.set(e.libelle, (vus.get(e.libelle) ?? 0) + 1);
      return lignes.map((e) => ({ id: e.id, libelle: vus.get(e.libelle)! > 1 ? `${e.libelle} — ${e.name}` : e.libelle }));
    },
  });
  const teamId = equipes?.length === 1 ? equipes[0].id : equipeChoisie || null;
  const equipeOk = !!etablissement && equipes !== null && (equipes.length === 0 || !!teamId);
  const valide = prenom.trim().length > 0 && nom.trim().length > 0 && equipeOk && contact.trim().length > 0;

  const lireContact = () => (canal === "courriel" ? lireCourriel(contact) : lireTelephone(contact));
  const toucher = () => { setAvertissements(null); setErreur(null); };

  const soumettre = async () => {
    if (!valide || enCours || !etablissement) return;
    const lu = lireContact();
    if (!lu.ok || !lu.valeur) { setErreurContact(lu.ok ? "Requis" : lu.regle); return; }
    const valeur = lu.valeur;
    setEnCours(true);
    setErreur(null);
    try {
      const supabase = createClient();
      if (avertissements === null) {
        const trouves = await chercherDoublonsCarte(supabase, {
          prenom, nom, sportId, etablissement, courriel: canal === "courriel" ? valeur : "",
        });
        if (trouves.length > 0) { setAvertissements(trouves); return; }
      }
      const { error } = await creerCarte(supabase, {
        prenom, nom, teamId: equipes && equipes.length > 0 ? teamId : null, schoolId: etablissement.id,
        positionId: null, numero: null, promotion: null, taillePieds: null, taillePouces: null,
        poidsLbs: null, lienVideo: null,
        courriel: canal === "courriel" ? valeur : null,
        telephone: canal === "telephone" ? valeur : null,
        parentNom: null, parentCourriel: null,
      });
      if (error) { setErreur("La carte n'a pas pu être créée. Réessaie."); return; }
      triggerHaptic("Medium");
      void invaliderTableauBlanc(queryClient);
      const quiEst = `${prenom.trim()} ${nom.trim()}`;
      if (canal === "telephone") {
        const corps = texteRenvoi({
          prenom: prenom.trim(),
          recruteur: [profil?.first_name, profil?.last_name].filter(Boolean).join(" "),
          cegep,
          courriel: null,
        });
        toast.success({ message: `Carte créée : ${quiEst}. Appuie sur Envoyer dans Messages.` });
        onClose();
        window.location.href = lienSms(valeur, corps, Capacitor.getPlatform() === "ios");
      } else {
        toast.success({ message: `Carte créée : ${quiEst}. Nexus envoie l'invitation à ${valeur}.` });
        onClose();
      }
    } finally {
      setEnCours(false);
    }
  };

  if (!mounted) return null;

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

        <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-4" style={{ overflowX: "hidden", overscrollBehaviorX: "none", touchAction: "pan-y" }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prospect-prenom" className={etiquette}>Prénom</label>
              <input id="prospect-prenom" data-testid="prospect-prenom" className={champ} value={prenom} maxLength={80} autoComplete="off"
                onChange={(e) => { setPrenom(e.target.value); toucher(); }} />
            </div>
            <div>
              <label htmlFor="prospect-nom" className={etiquette}>Nom</label>
              <input id="prospect-nom" data-testid="prospect-nom" className={champ} value={nom} maxLength={80} autoComplete="off"
                onChange={(e) => { setNom(e.target.value); toucher(); }} />
            </div>
          </div>

          <div>
            <label htmlFor="prospect-ecole" className={etiquette}>École ou club</label>
            {etablissement ? (
              <div className="flex items-center justify-between gap-2 min-h-[46px] rounded-xl border border-white/10 bg-[#1A1D24] px-3">
                <span className="text-[15px] text-white truncate" data-testid="prospect-etablissement">
                  {etablissement.name}
                  <span className="text-[#6B7280]">{etablissement.club ? " · club" : etablissement.city ? ` · ${etablissement.city}` : ""}</span>
                </span>
                <button type="button" onClick={() => { setEtablissement(null); setEquipeChoisie(""); setRecherche(""); toucher(); }}
                  className="min-h-[40px] text-[12px] font-bold text-[#9CA3AF] shrink-0">
                  Changer
                </button>
              </div>
            ) : (
              <>
                <input id="prospect-ecole" data-testid="prospect-ecole" type="search" className={champ} value={recherche}
                  onChange={(e) => setRecherche(e.target.value)} placeholder="2 lettres minimum" autoComplete="off" enterKeyHint="search" />
                {resultats.length > 0 && (
                  <ul className="mt-1.5 rounded-xl border border-white/10 bg-[#1A1D24] divide-y divide-white/[0.06]" role="listbox" aria-label="Écoles et clubs">
                    {resultats.map((e) => (
                      <li key={e.id}>
                        <button type="button" role="option" aria-selected={false} data-testid="prospect-choix-ecole"
                          onClick={() => { triggerHaptic("Light"); setEtablissement(e); toucher(); }}
                          className="w-full min-h-[46px] text-left px-3 py-2 text-[14px] active:bg-white/[0.04]">
                          <span className="font-semibold text-white">{e.name}</span>
                          <span className="text-[#6B7280]">{e.club ? " · club" : e.city ? ` · ${e.city}` : ""}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {recherche.trim().length >= 2 && tous !== null && resultats.length === 0 && (
                  <p className="text-[12px] text-[#6B7280] mt-1.5">Aucune école ni aucun club ne correspond.</p>
                )}
                {recherche.trim().length >= 2 && tous === null && (
                  <p className="text-[12px] text-[#6B7280] mt-1.5">Chargement des écoles…</p>
                )}
              </>
            )}
            {/* Plusieurs équipes du sport : la base exige d'en choisir une. */}
            {etablissement && equipes && equipes.length > 1 && (
              <select aria-label="Équipe" data-testid="prospect-equipe" className={`${champ} mt-2 [&>option]:bg-[#13151a]`}
                value={equipeChoisie} onChange={(e) => { setEquipeChoisie(e.target.value); toucher(); }}>
                <option value="">Choisir l&apos;équipe</option>
                {equipes.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
              </select>
            )}
          </div>

          <div>
            <div className="flex gap-1 p-1 rounded-xl bg-[#1A1D24] mb-2" role="radiogroup" aria-label="Moyen d'invitation">
              {([["courriel", "Courriel"], ["telephone", "Téléphone"]] as const).map(([cle, libelle]) => (
                <button key={cle} type="button" role="radio" aria-checked={canal === cle} data-testid={`prospect-canal-${cle}`}
                  onClick={() => { triggerHaptic("Light"); setCanal(cle); setContact(""); setErreurContact(null); toucher(); }}
                  className={`flex-1 min-h-[38px] rounded-lg text-[12px] font-bold uppercase tracking-wider ${canal === cle ? "bg-[#E63946] text-white" : "text-[#9CA3AF]"}`}>
                  {libelle}
                </button>
              ))}
            </div>
            <input
              data-testid="prospect-contact"
              aria-label={canal === "courriel" ? "Courriel" : "Téléphone"}
              type={canal === "courriel" ? "email" : "tel"}
              inputMode={canal === "courriel" ? "email" : "tel"}
              autoComplete="off"
              className={`${champ} ${erreurContact ? "border-[#EF4444]" : ""}`}
              value={contact}
              placeholder={canal === "courriel" ? "nom@exemple.com" : "438 555-0123"}
              onChange={(e) => { setContact(e.target.value); setErreurContact(null); toucher(); }}
              onBlur={() => { if (contact.trim()) { const l = lireContact(); setErreurContact(l.ok ? null : l.regle); } }}
            />
            <p className={`text-[12px] mt-1.5 ${erreurContact ? "text-[#EF4444]" : "text-[#6B7280]"}`}>
              {erreurContact ?? (canal === "courriel"
                ? "Nexus lui envoie l'invitation à ton nom et à celui de ton cégep. Une seule fois par adresse."
                : "Messages s'ouvre avec le texto pré-écrit : tu n'as qu'à appuyer sur Envoyer.")}
            </p>
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
            {enCours ? "…" : avertissements && avertissements.length > 0 ? "Créer et inviter quand même" : "Créer et inviter"}
          </button>
        </div>
      </motion.div>
    </>,
    document.body,
  );
}
