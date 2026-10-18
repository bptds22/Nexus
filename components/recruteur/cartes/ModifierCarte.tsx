"use client";

/* ═══════════════════════════════════════════════════════════════
   ModifierCarte — le formulaire « Modifier » d'une CARTE PROSPECT (1.4.5).

   Web ET appli (le même composant : l'onglet Infos est partagé). Tous les
   champs de la carte, d'un seul geste : prénom, nom, école ou club, équipe,
   position, numéro, promotion, taille, poids, vidéo (Hudl / YouTube).
   Le courriel, le téléphone et le parent gardent leur ligne « Modifier » dans
   Infos (ils ont leurs propres règles d'invitation).

   QUI MODIFIE. Seule l'unité propriétaire : la RLS (cartes_update) le garantit
   côté base ; le panneau n'est d'ailleurs ouvert qu'aux membres de l'unité.
   UNE CARTE N'ÉCRIT JAMAIS DANS `athletes`. Ce formulaire ne touche que
   cartes_prospect. Une carte FUSIONNÉE avec un vrai athlète est masquée et
   non écrivable pour tous (cartes_non_fusionnees, lot E) : elle disparaît du
   processus, remplacée par l'athlète — il n'y a rien à éditer, et les données
   de l'athlète ne sont jamais modifiables d'ici. Une simple PROPOSITION de
   rapprochement ne fusionne rien : la carte reste la sienne.

   ÉTABLISSEMENT ET ÉQUIPE (règle de la base) : avec une équipe, l'établissement
   la suit — on change l'équipe (ou on en choisit une dans un autre établissement).
   Sans équipe, l'établissement se change directement, tant qu'il n'a pas d'équipe
   du sport de l'athlète. Le SPORT de l'athlète ne change jamais.

   Les champs libres se lisent comme à la création (lib/cartes/saisie) : l'erreur
   s'affiche SOUS le champ fautif, avec la règle attendue.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { ecrireCarte, libelleEquipe, normaliserNom, type CarteKanban } from "@/lib/cartes/carteProspect";
import { trierEquipes } from "@/lib/teams/teamLabel";
import { lireTaille, lirePoids, lireLien } from "@/lib/cartes/saisie";
import { invaliderTableauBlanc } from "@/lib/queries/tableauBlanc";

type Champ = "prenom" | "nom" | "taille" | "poids" | "video" | "numero" | "etablissement" | "equipe";
interface Etablissement { id: string; name: string; city: string | null }
interface Equipe { id: string; name: string; age_group: string | null; division: string | null; gender: string | null; libelle: string }
interface Position { id: string; abreviation: string | null; nom: string }

/* 16 px sur mobile : iOS ne zoome pas sur un champ à 16 px. 44 px de haut au toucher. */
const champCls = "w-full min-h-[44px] sm:min-h-0 bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[16px] sm:text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const etiquette = "block text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7280] mb-1";
const TYPES = ["SECONDAIRE", "CEGEP", "LIGUE_CIVILE"];

function tailleTexte(pieds: number | null | undefined, pouces: number | null | undefined): string {
  return pieds ? `${pieds}'${pouces ?? 0}"` : "";
}

export default function ModifierCarte({ card, onClose, onEnregistre }: {
  card: CarteKanban;
  onClose: () => void;
  /** Reçoit la phrase de confirmation (« Carte de … mise à jour »). */
  onEnregistre: (message: string) => void;
}) {
  const c = card.carte;
  const queryClient = useQueryClient();

  const initial = useMemo(() => ({
    prenom: c.prenom ?? "",
    nom: c.nom ?? "",
    numero: c.numero ?? "",
    promotion: c.promotion != null ? String(c.promotion) : "",
    taille: tailleTexte(card.taille_pieds, card.taille_pouces),
    poids: card.poids_lbs ? String(card.poids_lbs) : "",
    video: c.lienVideo ?? "",
    positionId: c.positionId ?? "",
    schoolId: c.schoolId ?? "",
    teamId: c.teamId ?? "",
  }), [c, card.taille_pieds, card.taille_pouces, card.poids_lbs]);

  const [prenom, setPrenom] = useState(initial.prenom);
  const [nom, setNom] = useState(initial.nom);
  const [numero, setNumero] = useState(initial.numero);
  const [promotion, setPromotion] = useState(initial.promotion);
  const [taille, setTaille] = useState(initial.taille);
  const [poids, setPoids] = useState(initial.poids);
  const [video, setVideo] = useState(initial.video);
  const [positionId, setPositionId] = useState(initial.positionId);
  const [positions, setPositions] = useState<Position[]>([]);
  const [erreurs, setErreurs] = useState<Partial<Record<Champ, string>>>({});
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [abandon, setAbandon] = useState(false);

  /* Établissement / équipe */
  const [etablissement, setEtablissement] = useState<Etablissement | null>(
    c.schoolId ? { id: c.schoolId, name: c.schoolNom ?? "", city: null } : null,
  );
  const [changerEcole, setChangerEcole] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [tous, setTous] = useState<(Etablissement & { cle: string })[] | null>(null);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipesChargees, setEquipesChargees] = useState(false);
  const [equipeId, setEquipeId] = useState(initial.teamId);

  useEffect(() => {
    if (!c.sportAthleteId) return;
    let annule = false;
    void createClient().from("positions").select("id, abreviation, nom").eq("sport_id", c.sportAthleteId).order("nom")
      .then(({ data }) => { if (!annule) setPositions((data ?? []) as Position[]); });
    return () => { annule = true; };
  }, [c.sportAthleteId]);

  /* Tous les établissements, chargés UNE fois à l'ouverture de « Changer » (pages de 1000) ;
     la recherche se fait ici, sans accents ni casse — comme à la création. */
  useEffect(() => {
    if (!changerEcole || tous !== null) return;
    let annule = false;
    void (async () => {
      const supabase = createClient();
      const liste: (Etablissement & { cle: string })[] = [];
      for (let debut = 0; debut < 10000; debut += 1000) {
        const { data, error } = await supabase.from("schools").select("id, name, city").in("type", TYPES).order("name").range(debut, debut + 999);
        if (error || !data) break;
        for (const e of data as { id: string; name: string; city: string | null }[]) {
          liste.push({ id: e.id, name: e.name, city: e.city, cle: normaliserNom(`${e.name} ${e.city ?? ""}`) });
        }
        if (data.length < 1000) break;
      }
      if (!annule) setTous(liste);
    })();
    return () => { annule = true; };
  }, [changerEcole, tous]);

  const resultats = useMemo(() => {
    const mots = normaliserNom(recherche).split(" ").filter(Boolean);
    if (!changerEcole || !tous || recherche.trim().length < 2) return [];
    return tous.filter((e) => mots.every((m) => e.cle.includes(m))).slice(0, 15);
  }, [recherche, changerEcole, tous]);

  /* Les équipes de l'établissement, DU SPORT DE L'ATHLÈTE (qui ne change jamais). */
  useEffect(() => {
    setEquipesChargees(false);
    if (!etablissement || !c.sportAthleteId) { setEquipes([]); return; }
    let annule = false;
    void (async () => {
      const { data } = await createClient().from("teams").select("id, name, age_group, division, gender")
        .eq("school_id", etablissement.id).eq("sport_id", c.sportAthleteId);
      if (annule) return;
      const finales = trierEquipes((data ?? []) as Omit<Equipe, "libelle">[])
        .map((e) => ({ ...e, libelle: libelleEquipe(c.sportAthleteNom ?? "", e, etablissement.name) }));
      setEquipes(finales);
      setEquipeId((cur) => (finales.some((e) => e.id === cur) ? cur : finales.length === 1 ? finales[0].id : ""));
      setEquipesChargees(true);
    })();
    return () => { annule = true; };
  }, [etablissement, c.sportAthleteId, c.sportAthleteNom]);

  const aUneEquipe = !!initial.teamId;
  const ecoleChangee = (etablissement?.id ?? "") !== initial.schoolId;
  /* Sans équipe de ce sport dans l'établissement : permis seulement si la carte n'a pas d'équipe. */
  const sansEquipeChoix = !!etablissement && equipesChargees && equipes.length === 0;
  const equipeManquante = !!etablissement && equipesChargees && equipes.length > 0 && !equipeId;
  const equipeImpossible = sansEquipeChoix && aUneEquipe;

  const promotions = useMemo(() => {
    const an = new Date().getFullYear();
    const liste = Array.from({ length: 6 }, (_, i) => an + i);
    const actuelle = initial.promotion ? Number(initial.promotion) : null;
    if (actuelle && !liste.includes(actuelle)) liste.unshift(actuelle);
    return liste;
  }, [initial.promotion]);

  const modifie = prenom !== initial.prenom || nom !== initial.nom || numero !== initial.numero || promotion !== initial.promotion
    || taille !== initial.taille || poids !== initial.poids || video !== initial.video || positionId !== initial.positionId
    || ecoleChangee || equipeId !== initial.teamId;

  const fermer = () => { if (modifie && !abandon) { setAbandon(true); return; } onClose(); };

  const effacer = (k: Champ) => setErreurs((e) => (e[k] ? { ...e, [k]: undefined } : e));

  const enregistrer = async () => {
    if (enCours) return;
    setErreurGenerale(null);
    const fautes: Partial<Record<Champ, string>> = {};
    if (!prenom.trim()) fautes.prenom = "Le prénom est obligatoire.";
    if (!nom.trim()) fautes.nom = "Le nom est obligatoire.";
    if (numero.trim().length > 6) fautes.numero = "Numéro : 6 caractères au plus.";
    const t = lireTaille(taille); if (!t.ok) fautes.taille = t.regle;
    const p = lirePoids(poids); if (!p.ok) fautes.poids = p.regle;
    const v = lireLien(video); if (!v.ok) fautes.video = v.regle;
    if (!etablissement) fautes.etablissement = "L'école ou le club est obligatoire.";
    if (equipeImpossible) fautes.equipe = "Cet établissement n'a pas d'équipe de ce sport : choisis un établissement qui en a une.";
    if (equipeManquante) fautes.equipe = "Choisis l'équipe.";
    if (Object.keys(fautes).length > 0) {
      setErreurs(fautes);
      document.getElementById(`modifier-carte-${Object.keys(fautes)[0]}`)?.focus();
      return;
    }
    setErreurs({});

    /* Seulement ce qui a changé. */
    const patch: Record<string, unknown> = {};
    if (prenom !== initial.prenom) patch.prenom = prenom.trim();
    if (nom !== initial.nom) patch.nom = nom.trim();
    if (numero !== initial.numero) patch.numero = numero.trim() || null;
    if (promotion !== initial.promotion) patch.promotion = promotion ? Number(promotion) : null;
    if (taille !== initial.taille && t.ok) { patch.taillePieds = t.valeur.pieds; patch.taillePouces = t.valeur.pouces; }
    if (poids !== initial.poids && p.ok) patch.poidsLbs = p.valeur;
    if (video !== initial.video && v.ok) patch.lienVideo = v.valeur;
    if (positionId !== initial.positionId) patch.positionId = positionId || null;
    const equipeChangee = equipeId !== initial.teamId && !!equipeId;
    if (equipeChangee) patch.teamId = equipeId;            // l'établissement suit l'équipe (base)
    else if (ecoleChangee && etablissement) patch.schoolId = etablissement.id; // carte sans équipe

    if (Object.keys(patch).length === 0) { onClose(); return; }

    setEnCours(true);
    try {
      const supabase = createClient();
      const err = await ecrireCarte(supabase, card.id, patch);
      if (err) { setErreurGenerale("La carte n'a pas pu être enregistrée. Vérifie les champs, puis réessaie."); return; }
      /* L'établissement / l'équipe se vérifient à la relecture : une base qui ne les a pas
         acceptés ne doit jamais laisser croire que c'est fait. */
      if (patch.teamId || patch.schoolId) {
        const { data } = await supabase.from("cartes_prospect").select("school_id, team_id").eq("id", card.id).maybeSingle();
        const attenduEcole = patch.teamId ? null : (patch.schoolId as string);
        const ok = patch.teamId ? data?.team_id === patch.teamId : data?.school_id === attenduEcole;
        if (!ok) { setErreurGenerale("L'établissement n'a pas pu être changé. Réessaie, ou choisis son équipe."); return; }
      }
      void invaliderTableauBlanc(queryClient);
      onEnregistre(`Carte de ${prenom.trim()} ${nom.trim()} mise à jour.`);
    } finally {
      setEnCours(false);
    }
  };

  const Erreur = ({ k }: { k: Champ }) => erreurs[k] ? <p id={`modifier-carte-${k}-erreur`} className="text-[12px] text-[#EF4444] mt-1">{erreurs[k]}</p> : null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="titre-modifier-carte" data-testid="modifier-carte">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={fermer} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-t-2xl sm:rounded-xl p-5 sm:p-6 max-w-lg w-full sm:mx-4 shadow-2xl max-h-[92vh] overflow-y-auto" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <h3 id="titre-modifier-carte" className="font-head text-[18px] font-black text-white uppercase tracking-tight">Modifier la carte</h3>
        <p className="text-[13px] text-[#9CA3AF] mt-1">
          Cette carte est à ton unité. Les changements ne touchent jamais un profil d&apos;athlète sur Nexus. Les champs avec <span className="text-[#E63946]">*</span> sont obligatoires.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <label className={etiquette} htmlFor="modifier-carte-prenom">Prénom <span className="text-[#E63946]">*</span></label>
            <input id="modifier-carte-prenom" className={champCls} value={prenom} maxLength={80} aria-invalid={!!erreurs.prenom}
              onChange={(e) => { setPrenom(e.target.value); effacer("prenom"); }} />
            <Erreur k="prenom" />
          </div>
          <div>
            <label className={etiquette} htmlFor="modifier-carte-nom">Nom <span className="text-[#E63946]">*</span></label>
            <input id="modifier-carte-nom" className={champCls} value={nom} maxLength={80} aria-invalid={!!erreurs.nom}
              onChange={(e) => { setNom(e.target.value); effacer("nom"); }} />
            <Erreur k="nom" />
          </div>

          <div className="col-span-2 relative">
            <span className={etiquette}>École ou club <span className="text-[#E63946]">*</span></span>
            {!changerEcole ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#2a2d36] bg-[#13151a] px-3 py-2 min-h-[44px] sm:min-h-0">
                <span className="text-[14px] sm:text-[13px] text-white truncate" data-testid="modifier-carte-etablissement">
                  {etablissement?.name || <span className="text-[#6b7280]">—</span>}
                </span>
                <button type="button" onClick={() => { setChangerEcole(true); setRecherche(""); }}
                  className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white shrink-0 min-h-[44px] sm:min-h-0 px-2">Changer</button>
              </div>
            ) : (
              <>
                <input id="modifier-carte-etablissement" className={champCls} value={recherche} autoFocus autoComplete="off"
                  aria-label="Nom de l'école ou du club" placeholder="Nom de l'école ou du club (2 lettres minimum)"
                  onChange={(e) => setRecherche(e.target.value)} />
                {tous === null && <p className="text-[12px] text-[#6b7280] mt-1">Chargement…</p>}
                {resultats.length > 0 && (
                  <ul className="mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-[#2D3748] bg-[#13151a] shadow-xl" role="listbox" aria-label="Établissements">
                    {resultats.map((e) => (
                      <li key={e.id}>
                        <button type="button" role="option" aria-selected={false}
                          onClick={() => { setEtablissement(e); setChangerEcole(false); setEquipeId(""); effacer("etablissement"); effacer("equipe"); }}
                          className="w-full text-left px-3 py-2.5 text-[14px] sm:text-[13px] text-[#e0e0e0] hover:bg-white/5 min-h-[44px] sm:min-h-0">
                          <span className="font-semibold text-white">{e.name}</span>{e.city && <span className="text-[#6b7280]"> · {e.city}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {recherche.trim().length >= 2 && tous !== null && resultats.length === 0 && (
                  <p className="text-[12px] text-[#6b7280] mt-1">Aucun établissement ne correspond.</p>
                )}
                <button type="button" onClick={() => setChangerEcole(false)} className="text-[12px] font-bold text-[#9CA3AF] hover:text-white mt-1 min-h-[44px] sm:min-h-0">Garder {etablissement?.name ?? "l'actuel"}</button>
              </>
            )}
            <Erreur k="etablissement" />
          </div>

          {etablissement && (
            <div className="col-span-2">
              <label className={etiquette} htmlFor="modifier-carte-equipe">
                Équipe {equipes.length > 0 && <span className="text-[#E63946]">*</span>}
              </label>
              {!equipesChargees ? (
                <p className="text-[12px] text-[#6b7280]">Chargement des équipes…</p>
              ) : equipes.length === 0 ? (
                <p className="text-[13px] text-[#9CA3AF]" id="modifier-carte-equipe">
                  {aUneEquipe
                    ? "Cet établissement n'a pas d'équipe de ce sport."
                    : `Aucune équipe de ce sport — la carte reste rattachée à ${etablissement.name}.`}
                </p>
              ) : (
                <select id="modifier-carte-equipe" className={champCls} value={equipeId} aria-invalid={!!erreurs.equipe}
                  onChange={(e) => { setEquipeId(e.target.value); effacer("equipe"); }}>
                  {equipes.length !== 1 && <option value="">Choisir l&apos;équipe</option>}
                  {equipes.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
                </select>
              )}
              {c.sportAthleteNom && <p className="text-[12px] text-[#6b7280] mt-1">Sport : {c.sportAthleteNom} — il ne change pas.</p>}
              <Erreur k="equipe" />
            </div>
          )}

          <div>
            <label className={etiquette} htmlFor="modifier-carte-position">Position</label>
            <select id="modifier-carte-position" className={champCls} value={positionId} onChange={(e) => setPositionId(e.target.value)}>
              <option value="">—</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.abreviation ? `${p.abreviation} · ${p.nom}` : p.nom}</option>)}
            </select>
          </div>
          <div>
            <label className={etiquette} htmlFor="modifier-carte-numero">Numéro</label>
            <input id="modifier-carte-numero" className={champCls} value={numero} inputMode="numeric" maxLength={6} aria-invalid={!!erreurs.numero}
              onChange={(e) => { setNumero(e.target.value); effacer("numero"); }} />
            <Erreur k="numero" />
          </div>

          <div>
            <label className={etiquette} htmlFor="modifier-carte-promotion">Promotion</label>
            <select id="modifier-carte-promotion" className={champCls} value={promotion} onChange={(e) => setPromotion(e.target.value)}>
              <option value="">—</option>
              {promotions.map((an) => <option key={an} value={String(an)}>{an}</option>)}
            </select>
          </div>
          <div>
            <label className={etiquette} htmlFor="modifier-carte-taille">Taille</label>
            <input id="modifier-carte-taille" className={champCls} value={taille} placeholder={`6'2" ou 188 cm`} aria-invalid={!!erreurs.taille}
              onChange={(e) => { setTaille(e.target.value); effacer("taille"); }} />
            <Erreur k="taille" />
          </div>

          <div>
            <label className={etiquette} htmlFor="modifier-carte-poids">Poids</label>
            <input id="modifier-carte-poids" className={champCls} value={poids} placeholder="121 lbs ou 55 kg" inputMode="decimal" aria-invalid={!!erreurs.poids}
              onChange={(e) => { setPoids(e.target.value); effacer("poids"); }} />
            <Erreur k="poids" />
          </div>
          <div className="col-span-2">
            <label className={etiquette} htmlFor="modifier-carte-video">Vidéo (Hudl ou YouTube)</label>
            <input id="modifier-carte-video" className={champCls} value={video} placeholder="hudl.com/… ou youtube.com/watch?v=…" inputMode="url" autoCapitalize="none" aria-invalid={!!erreurs.video}
              onChange={(e) => { setVideo(e.target.value); effacer("video"); }} />
            <Erreur k="video" />
          </div>
        </div>

        {erreurGenerale && <p role="alert" className="text-[13px] text-[#EF4444] mt-4">{erreurGenerale}</p>}

        {abandon ? (
          <div className="mt-6 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/[0.08] p-3" role="alertdialog" aria-label="Abandonner les modifications">
            <p className="text-[13px] text-white font-bold">Abandonner tes modifications ?</p>
            <p className="text-[12px] text-[#9CA3AF] mt-0.5">Rien n&apos;a été enregistré.</p>
            <div className="flex gap-2 mt-3">
              <button type="button" onClick={onClose} className="flex-1 min-h-[44px] sm:min-h-0 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[13px] font-bold">Oui, abandonner</button>
              <button type="button" onClick={() => setAbandon(false)} className="flex-1 min-h-[44px] sm:min-h-0 px-4 py-2 rounded-lg bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold">Continuer à modifier</button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2 mt-6">
            <button type="button" onClick={fermer} className="min-h-[44px] sm:min-h-0 px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white">Annuler</button>
            <button type="button" onClick={() => void enregistrer()} disabled={enCours || !modifie}
              className="min-h-[44px] sm:min-h-0 px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] disabled:bg-[#2D3748] disabled:text-[#4a4d56] text-white text-[13px] font-bold rounded-lg transition-colors">
              {enCours ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
