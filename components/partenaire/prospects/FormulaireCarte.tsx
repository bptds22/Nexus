"use client";

/* ═══════════════════════════════════════════════════════════════
   FormulaireCarte — créer ou modifier une carte prospect (W4b).

   Le minimum décidé par BP : prénom, nom, sport (seulement les sports
   permis au partenaire), position, école ou équipe, promotion, et la case
   OBLIGATOIRE « Ce jeune a 14 ans ou plus ». Aucune coordonnée, aucune
   photo, aucune date de naissance. Puis, facultatifs : l'évaluation (même
   éditeur que W2) et les badges (mêmes catalogues que W3/W3b).

   L'établissement se cherche comme dans la carte recruteur (lot D) :
   Scolaire ou Civil, puis le nom (sans accents ni casse) ; l'équipe, dans
   le sport de la carte, est facultative. La base revérifie tout (sport
   permis, position et équipe du bon sport, promotion, badges).

   Modifier une carte n'en prolonge pas l'échéance (60 jours depuis la
   création).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { libelleEquipe, normaliserNom } from "@/lib/cartes/carteProspect";
import { trierEquipes } from "@/lib/teams/teamLabel";
import EditeurEvaluationPartenaire, {
  coteFinale,
  parametresEvaluation,
  type ValeurEvaluation,
} from "@/components/partenaire/EditeurEvaluationPartenaire";
import ChoixBadgesCarte from "@/components/partenaire/prospects/ChoixBadgesCarte";
import { enregistrerCarte, messageErreurCarte, type CartePartenaire } from "@/lib/partenaires/prospects";

type Genre = "SCOLAIRE" | "CIVIL";
const TYPES: Record<Genre, string[]> = { SCOLAIRE: ["SECONDAIRE", "CEGEP"], CIVIL: ["LIGUE_CIVILE"] };

interface Etablissement { id: string; name: string; city: string | null }
interface Equipe { id: string; libelle: string }
interface Position { id: string; abreviation: string | null; nom: string }

const champ = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const etiquette = "block text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7280] mb-1";

export default function FormulaireCarte({
  sports,
  carte,
  onClose,
  onEnregistree,
}: {
  /** Les sports permis au partenaire. */
  sports: { id: string; nom: string }[];
  /** null = nouvelle carte. */
  carte: CartePartenaire | null;
  onClose: () => void;
  onEnregistree: (id: string, nouvelle: boolean) => void;
}) {
  const annee = new Date().getFullYear();
  const promotions = useMemo(() => Array.from({ length: 8 }, (_, i) => annee - 1 + i), [annee]);

  const [prenom, setPrenom] = useState(carte?.prenom ?? "");
  const [nom, setNom] = useState(carte?.nom ?? "");
  const [sportId, setSportId] = useState(carte?.sportId ?? (sports.length === 1 ? sports[0].id : ""));
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionId, setPositionId] = useState(carte?.positionId ?? "");
  const [genre, setGenre] = useState<Genre>("SCOLAIRE");
  const [recherche, setRecherche] = useState("");
  const [tous, setTous] = useState<(Etablissement & { cle: string })[] | null>(null);
  const [etablissement, setEtablissement] = useState<Etablissement | null>(null);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipeId, setEquipeId] = useState(carte?.teamId ?? "");
  const [promotion, setPromotion] = useState(carte?.promotion ? String(carte.promotion) : "");
  // Une carte existante a déjà été attestée ; la case reste à cocher pour une nouvelle.
  const [atteste, setAtteste] = useState(!!carte);
  const [avecEvaluation, setAvecEvaluation] = useState(carte?.coteGlobale != null);
  const [evaluation, setEvaluation] = useState<ValeurEvaluation>({
    mode: carte && Object.keys(carte.traits).length > 0 ? "detaille" : "simple",
    cote: carte?.coteGlobale != null ? Math.round(carte.coteGlobale) : 0,
    criteres: carte?.traits ?? {},
  });
  const [grilleId, setGrilleId] = useState<string | null>(null);
  const [badges, setBadges] = useState<{ partenaire: string[]; nexus: string[] }>({
    partenaire: carte?.badgesPartenaire ?? [],
    nexus: carte?.badgesNexus ?? [],
  });
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Carte existante : son établissement.
  useEffect(() => {
    if (!carte?.schoolId) return;
    void createClient().from("schools").select("id, name, city, type").eq("id", carte.schoolId).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setEtablissement({ id: data.id as string, name: data.name as string, city: (data.city as string | null) ?? null });
        if (data.type === "LIGUE_CIVILE") setGenre("CIVIL");
      });
  }, [carte?.schoolId]);

  // Positions du sport de la carte.
  useEffect(() => {
    if (!sportId) { setPositions([]); return; }
    void createClient().from("positions").select("id, abreviation, nom").eq("sport_id", sportId).order("nom")
      .then(({ data }) => setPositions((data ?? []) as Position[]));
  }, [sportId]);

  // La grille d'évaluation : celle de la position, sinon GENERIQUE — le même
  // résolveur que le serveur à l'enregistrement.
  useEffect(() => {
    let vivant = true;
    void (async () => {
      const supabase = createClient();
      let id: string | null = null;
      if (positionId) {
        const { data } = await supabase.from("position_grille").select("grille_id").eq("position_id", positionId).maybeSingle();
        id = (data?.grille_id as string | undefined) ?? null;
      }
      if (!id) {
        const { data } = await supabase.from("evaluation_grilles").select("id").eq("code", "GENERIQUE").maybeSingle();
        id = (data?.id as string | undefined) ?? null;
      }
      if (vivant) setGrilleId(id);
    })();
    return () => { vivant = false; };
  }, [positionId]);

  // Tous les établissements du genre, par pages de 1000 ; filtrés ici sans accents.
  useEffect(() => {
    let annule = false;
    void (async () => {
      const supabase = createClient();
      const liste: (Etablissement & { cle: string })[] = [];
      for (let debut = 0; debut < 10000; debut += 1000) {
        const { data, error } = await supabase.from("schools").select("id, name, city")
          .in("type", TYPES[genre]).order("name").range(debut, debut + 999);
        if (error || !data) break;
        for (const e of data as Etablissement[]) liste.push({ ...e, cle: normaliserNom(`${e.name} ${e.city ?? ""}`) });
        if (data.length < 1000) break;
      }
      if (!annule) setTous(liste);
    })();
    return () => { annule = true; };
  }, [genre]);

  const suggestions = useMemo(() => {
    const mots = normaliserNom(recherche).split(" ").filter(Boolean);
    if (etablissement || !tous || recherche.trim().length < 2) return [];
    return tous.filter((e) => mots.every((m) => e.cle.includes(m))).slice(0, 12);
  }, [recherche, etablissement, tous]);

  // Ses équipes du sport de la carte (facultatives).
  useEffect(() => {
    if (!etablissement || !sportId) { setEquipes([]); return; }
    let annule = false;
    void (async () => {
      const supabase = createClient();
      const [{ data }, { data: sport }] = await Promise.all([
        supabase.from("teams").select("id, name, age_group, division, gender")
          .eq("school_id", etablissement.id).eq("sport_id", sportId).order("age_group").order("division"),
        supabase.from("sports").select("nom").eq("id", sportId).maybeSingle(),
      ]);
      if (annule) return;
      const nomSport = (sport?.nom as string | undefined) ?? "";
      // Règle commune (lib/teams/teamLabel) : nom d'équipe dès qu'il diffère de
      // l'établissement, tri nom → catégorie → division → genre.
      setEquipes(trierEquipes((data ?? []) as { id: string; name: string; age_group: string | null; division: string | null; gender: string | null }[])
        .map((e) => ({ id: e.id, libelle: libelleEquipe(nomSport, e, etablissement.name) })));
    })();
    return () => { annule = true; };
  }, [etablissement, sportId]);

  // Une équipe ou une position d'un autre sport tombe quand le sport change.
  useEffect(() => {
    if (equipeId && equipes.length > 0 && !equipes.some((e) => e.id === equipeId)) setEquipeId("");
  }, [equipes, equipeId]);
  useEffect(() => {
    if (positionId && positions.length > 0 && !positions.some((p) => p.id === positionId)) setPositionId("");
  }, [positions, positionId]);

  const cote = coteFinale(evaluation);
  const evaluationValide = !avecEvaluation || (cote >= 1 && cote <= 5);
  const pret = prenom.trim() !== "" && nom.trim() !== "" && sportId !== "" && atteste && evaluationValide && !enCours;

  async function enregistrer() {
    if (!pret) return;
    setEnCours(true);
    setErreur(null);
    try {
      const p = parametresEvaluation(evaluation);
      const id = await enregistrerCarte(createClient(), carte?.id ?? null, {
        prenom: prenom.trim(),
        nom: nom.trim(),
        sportId,
        positionId: positionId || null,
        schoolId: etablissement?.id ?? null,
        teamId: equipeId || null,
        promotion: promotion ? Number(promotion) : null,
        atteste14Ans: atteste,
        coteGlobale: avecEvaluation ? p.cote : null,
        traits: avecEvaluation ? p.criteres : {},
        badgesPartenaire: badges.partenaire,
        badgesNexus: badges.nexus,
      });
      onEnregistree(id, !carte);
    } catch (e) {
      setErreur(messageErreurCarte(e, "L'enregistrement a échoué. Réessaie dans un instant."));
      setEnCours(false);
    }
  }

  // Rendue dans <body> : dans le <main> du portail (z-10), la barre du haut mobile
  // (z-30) recouvrirait le haut de la fenêtre, quel que soit son z-index.
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="titre-carte-prospect">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !enCours && onClose()} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-5 sm:p-6 max-w-2xl w-full mx-4 my-6 shadow-2xl" data-formulaire-carte>
        <h3 id="titre-carte-prospect" className="font-head text-[18px] font-black text-white uppercase tracking-tight">
          {carte ? "Modifier la carte" : "Nouvelle carte prospect"}
        </h3>
        <p className="text-[13px] text-[#9CA3AF] mt-1">
          Un jeune qui n&apos;est pas encore sur Nexus. Toi seul vois cette carte ; elle s&apos;efface après 60 jours.
          Aucune coordonnée : tu lui enverras le lien toi-même.
        </p>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={etiquette} htmlFor="prospect-prenom">Prénom <span className="text-[#E63946]">*</span></label>
            <input id="prospect-prenom" className={champ} value={prenom} onChange={(e) => setPrenom(e.target.value)} maxLength={60} autoFocus={!carte} />
          </div>
          <div>
            <label className={etiquette} htmlFor="prospect-nom">Nom <span className="text-[#E63946]">*</span></label>
            <input id="prospect-nom" className={champ} value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60} />
          </div>
          <div>
            <label className={etiquette} htmlFor="prospect-sport">Sport <span className="text-[#E63946]">*</span></label>
            <select id="prospect-sport" className={champ} value={sportId} onChange={(e) => setSportId(e.target.value)}>
              {sports.length !== 1 && <option value="">Choisir le sport</option>}
              {sports.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </div>
          <div>
            <label className={etiquette} htmlFor="prospect-position">Position</label>
            <select id="prospect-position" className={champ} value={positionId} onChange={(e) => setPositionId(e.target.value)} disabled={!sportId}>
              <option value="">—</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.abreviation ? `${p.abreviation} — ${p.nom}` : p.nom}</option>)}
            </select>
          </div>

          <div className="sm:col-span-2 relative">
            <span className={etiquette}>École ou club</span>
            {etablissement ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#2a2d36] bg-[#13151a] px-3 py-2">
                <span className="text-[13px] text-white truncate">
                  {etablissement.name}{etablissement.city ? <span className="text-[#6b7280]"> · {etablissement.city}</span> : null}
                </span>
                <button type="button" onClick={() => { setEtablissement(null); setRecherche(""); setEquipeId(""); }}
                  className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] hover:text-white shrink-0">
                  Changer
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-1.5 mb-2" role="radiogroup" aria-label="Scolaire ou civil">
                  {(["SCOLAIRE", "CIVIL"] as Genre[]).map((g) => (
                    <button key={g} type="button" role="radio" aria-checked={genre === g}
                      onClick={() => { setGenre(g); setTous(null); }}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-wider border transition-colors ${genre === g ? "bg-[#E63946]/15 border-[#E63946]/40 text-[#E63946]" : "border-[#2a2d36] text-[#6b7280] hover:text-white"}`}>
                      {g === "SCOLAIRE" ? "Scolaire" : "Civil"}
                    </button>
                  ))}
                </div>
                <input aria-label={genre === "SCOLAIRE" ? "Nom de l'école" : "Nom du club"} className={champ} value={recherche}
                  onChange={(e) => setRecherche(e.target.value)} autoComplete="off"
                  placeholder={genre === "SCOLAIRE" ? "Nom de l'école (2 lettres minimum)" : "Nom du club (2 lettres minimum)"} />
                {suggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-[#2D3748] bg-[#13151a] shadow-xl" role="listbox">
                    {suggestions.map((e) => (
                      <li key={e.id}>
                        <button type="button" role="option" aria-selected={false} onClick={() => setEtablissement(e)}
                          className="w-full text-left px-3 py-2 text-[13px] text-[#e0e0e0] hover:bg-white/5">
                          <span className="font-semibold text-white">{e.name}</span>
                          {e.city && <span className="text-[#6b7280]"> · {e.city}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {recherche.trim().length >= 2 && tous !== null && suggestions.length === 0 && (
                  <p className="text-[12px] text-[#6b7280] mt-1">{genre === "SCOLAIRE" ? "Aucune école ne correspond." : "Aucun club ne correspond."}</p>
                )}
              </>
            )}
          </div>

          {etablissement && sportId && (
            <div className="sm:col-span-2">
              <label className={etiquette} htmlFor="prospect-equipe">Équipe</label>
              <select id="prospect-equipe" className={champ} value={equipeId} onChange={(e) => setEquipeId(e.target.value)} disabled={equipes.length === 0}>
                <option value="">{equipes.length === 0 ? "Aucune équipe de ce sport inscrite" : "— (facultatif)"}</option>
                {equipes.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={etiquette} htmlFor="prospect-promotion">Promotion</label>
            <select id="prospect-promotion" className={champ} value={promotion} onChange={(e) => setPromotion(e.target.value)}>
              <option value="">—</option>
              {promotions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <label className="mt-4 flex items-start gap-3 rounded-lg border border-[#2a2d36] bg-[#13151a] px-3 py-3 cursor-pointer" data-case-14-ans>
          <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#E63946]" checked={atteste} onChange={(e) => setAtteste(e.target.checked)} />
          <span className="text-[13px] text-white">
            Ce jeune a 14 ans ou plus <span className="text-[#E63946]">*</span>
            <span className="block text-[12px] text-[#9CA3AF] mt-0.5">
              Nexus n&apos;accepte personne de moins de 14 ans : une carte pour un plus jeune ne pourra jamais être réclamée.
            </span>
          </span>
        </label>

        <div className="mt-5 border-t border-[#2D3748]/50 pt-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-[#E63946]" checked={avecEvaluation} onChange={(e) => setAvecEvaluation(e.target.checked)} />
            <span className="text-[13px] font-bold text-white">Ajouter une évaluation <span className="font-normal text-[#6b7280]">(facultatif)</span></span>
          </label>
          {avecEvaluation && (
            <div className="mt-4">
              <EditeurEvaluationPartenaire grilleId={grilleId} valeur={evaluation} onChange={setEvaluation} />
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-[#2D3748]/50 pt-4">
          <p className="text-[13px] font-bold text-white mb-3">Badges <span className="font-normal text-[#6b7280]">(facultatif)</span></p>
          <ChoixBadgesCarte sportId={sportId} partenaire={badges.partenaire} nexus={badges.nexus} onChange={setBadges} />
        </div>

        {erreur && <p className="mt-4 text-[13px] text-[#EF4444]" role="alert">{erreur}</p>}

        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#2D3748]/40">
          <button type="button" onClick={onClose} disabled={enCours} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">
            Annuler
          </button>
          <button type="button" onClick={() => void enregistrer()} disabled={!pret}
            className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50">
            {enCours ? "Enregistrement…" : carte ? "Enregistrer" : "Créer la carte"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
