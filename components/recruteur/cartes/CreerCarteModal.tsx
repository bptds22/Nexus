"use client";

/* ═══════════════════════════════════════════════════════════════
   CreerCarteModal — créer une CARTE PROSPECT depuis Mon processus (lot C).

   Formulaire court : prénom, nom et ÉQUIPE RÉELLE obligatoires, puis
   position, numéro, promotion, taille, poids, lien vidéo, courriel — tous
   facultatifs. Aucune autre coordonnée (décision BP).

   L'équipe se choisit EN DEUX TEMPS (retour BP) : Scolaire ou Civil, puis
   l'établissement (école ou club) cherché par son nom — seuls ceux qui ont
   une équipe du sport de l'unité —, puis une de SES équipes de ce sport,
   libellée « Football juvénile D1 · Masculin ». L'école se déduit de
   l'équipe.

   Doublons (décision BP : avertir, jamais bloquer) :
   - même NOM normalisé + même ÉTABLISSEMENT, prénom compatible (composé ou
     abrégé) : contre les cartes de l'unité et contre les athlètes Nexus ;
   - même COURRIEL : contre une carte de l'unité ou un athlète Nexus.
   Un athlète MASQUÉ n'est jamais suggéré : la recherche recruteur et
   athlete_nexus_par_courriel ne rendent une identité que si elle est
   visible. Le premier « Créer » affiche l'avertissement ; un second clic
   crée quand même.

   La base pose l'unité d'après le créateur et refuse une équipe d'un autre
   sport : le formulaire ne propose que le bon sport, la base le garantit.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  creerCarte, cartesDoublons, carteAuCourriel, athleteAuCourriel,
  memePersonneProbable, libelleEquipe,
} from "@/lib/cartes/carteProspect";

type Genre = "SCOLAIRE" | "CIVIL";
/** Scolaire = les écoles (secondaire, et le collégial pour un transfert) ;
 *  Civil = les clubs (LIGUE_CIVILE, rangés dans schools pour la plomberie). */
const TYPES: Record<Genre, string[]> = { SCOLAIRE: ["SECONDAIRE", "CEGEP"], CIVIL: ["LIGUE_CIVILE"] };

interface Etablissement { id: string; name: string; city: string | null }
interface Equipe { id: string; name: string; age_group: string | null; division: string | null; gender: string | null; libelle: string }
interface Position { id: string; abreviation: string | null; nom: string }

const champ = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const etiquette = "block text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7280] mb-1";

export default function CreerCarteModal({ sportId, onClose, onCreee }: {
  sportId: string;
  onClose: () => void;
  onCreee: (message: string) => void;
}) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [genre, setGenre] = useState<Genre>("SCOLAIRE");
  const [recherche, setRecherche] = useState("");
  const [etablissements, setEtablissements] = useState<Etablissement[]>([]);
  const [etablissement, setEtablissement] = useState<Etablissement | null>(null);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipeId, setEquipeId] = useState("");
  const [nomSport, setNomSport] = useState("");
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionId, setPositionId] = useState("");
  const [numero, setNumero] = useState("");
  const [promotion, setPromotion] = useState("");
  const [pieds, setPieds] = useState("");
  const [pouces, setPouces] = useState("");
  const [poids, setPoids] = useState("");
  const [video, setVideo] = useState("");
  const [courriel, setCourriel] = useState("");
  const [avertissements, setAvertissements] = useState<{ texte: string; lien?: string }[] | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Positions et nom du sport de l'unité.
  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const [{ data }, { data: sport }] = await Promise.all([
        supabase.from("positions").select("id, abreviation, nom").eq("sport_id", sportId).order("nom"),
        supabase.from("sports").select("nom").eq("id", sportId).maybeSingle(),
      ]);
      setPositions((data ?? []) as Position[]);
      setNomSport((sport?.nom as string | undefined) ?? "");
    })();
  }, [sportId]);

  // 1. L'établissement, par son nom, parmi ceux du bon genre qui ont au
  //    moins une équipe du sport de l'unité.
  useEffect(() => {
    const q = recherche.trim();
    if (etablissement || q.length < 2) { setEtablissements([]); return; }
    let annule = false;
    const t = window.setTimeout(async () => {
      const { data } = await createClient()
        .from("schools")
        .select("id, name, city, teams!inner(id)")
        .in("type", TYPES[genre])
        .eq("teams.sport_id", sportId)
        .ilike("name", `%${q.replace(/[%_]/g, "")}%`)
        .order("name")
        .limit(15);
      if (annule) return;
      setEtablissements(((data ?? []) as { id: string; name: string; city: string | null }[])
        .map((e) => ({ id: e.id, name: e.name, city: e.city })));
    }, 250);
    return () => { annule = true; window.clearTimeout(t); };
  }, [recherche, etablissement, genre, sportId]);

  // 2. Ses équipes du sport de l'unité.
  useEffect(() => {
    if (!etablissement) { setEquipes([]); setEquipeId(""); return; }
    let annule = false;
    void (async () => {
      const { data } = await createClient()
        .from("teams")
        .select("id, name, age_group, division, gender")
        .eq("school_id", etablissement.id)
        .eq("sport_id", sportId)
        .order("age_group")
        .order("division");
      if (annule) return;
      const lignes = ((data ?? []) as Omit<Equipe, "libelle">[])
        .map((e) => ({ ...e, libelle: libelleEquipe(nomSport, e) }));
      // Deux équipes au même libellé (fréquent chez les clubs) : on ajoute le nom.
      const vus = new Map<string, number>();
      for (const e of lignes) vus.set(e.libelle, (vus.get(e.libelle) ?? 0) + 1);
      const finales = lignes.map((e) => (vus.get(e.libelle)! > 1 ? { ...e, libelle: `${e.libelle} — ${e.name}` } : e));
      setEquipes(finales);
      setEquipeId(finales.length === 1 ? finales[0].id : "");
    })();
    return () => { annule = true; };
  }, [etablissement, sportId, nomSport]);

  const equipe = equipes.find((e) => e.id === equipeId) ?? null;

  const nombre = (v: string) => (v.trim() === "" ? null : Number(v));
  const valide = prenom.trim().length > 0 && nom.trim().length > 0 && !!equipe;
  const promotions = useMemo(() => {
    const an = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => an + i);
  }, []);

  const verifierDoublons = async (): Promise<{ texte: string; lien?: string }[]> => {
    if (!equipe || !etablissement) return [];
    const supabase = createClient();
    const trouves: { texte: string; lien?: string }[] = [];

    // Même nom + même établissement, prénom compatible — cartes de l'unité.
    const cartes = await cartesDoublons(supabase, { prenom, nom, sportId, schoolId: etablissement.id });
    if (cartes.length > 0) {
      const c = cartes[0];
      trouves.push({ texte: `Ton unité suit déjà « ${c.prenom} ${c.nom} » (${etablissement.name}).` });
    }

    // … et athlètes Nexus : la recherche ne rend un nom que s'il est visible.
    const { data } = await supabase.rpc("recruiter_search_athletes", { p_search: nom.trim(), p_limit: 50 });
    const nexus = ((data ?? []) as { id: string; identity_visible: boolean; first_name: string | null; last_name: string | null; school_id: string | null }[])
      .find((a) => a.identity_visible && a.school_id === etablissement.id
        && memePersonneProbable(prenom, nom, a.first_name ?? "", a.last_name ?? ""));
    if (nexus) {
      trouves.push({
        texte: `« ${nexus.first_name} ${nexus.last_name} », de ${etablissement.name}, est déjà sur Nexus — ajoute-le plutôt à ton processus depuis sa fiche.`,
        lien: `/recruteur/athletes/${nexus.id}`,
      });
    }

    // Même courriel.
    if (courriel.trim()) {
      const [carteC, athleteC] = await Promise.all([
        carteAuCourriel(supabase, courriel, sportId),
        athleteAuCourriel(supabase, courriel),
      ]);
      if (carteC) trouves.push({ texte: `Ce courriel est déjà celui de la carte « ${carteC.prenom} ${carteC.nom} » de ton unité.` });
      if (athleteC && athleteC.id !== nexus?.id) {
        trouves.push({
          texte: `Ce courriel est celui de « ${athleteC.first_name} ${athleteC.last_name} », déjà sur Nexus.`,
          lien: `/recruteur/athletes/${athleteC.id}`,
        });
      }
    }
    return trouves;
  };

  const soumettre = async () => {
    if (!valide || enCours || !equipe) return;
    setErreur(null);
    setEnCours(true);
    try {
      if (avertissements === null) {
        const trouves = await verifierDoublons();
        if (trouves.length > 0) { setAvertissements(trouves); return; }
      }
      const { error } = await creerCarte(createClient(), {
        prenom, nom, teamId: equipe.id,
        positionId: positionId || null,
        numero: numero || null,
        promotion: nombre(promotion),
        taillePieds: nombre(pieds), taillePouces: nombre(pouces), poidsLbs: nombre(poids),
        lienVideo: video || null,
        courriel: courriel || null,
      });
      if (error) {
        setErreur(error.code === "23514"
          ? "Un champ n'est pas valide (courriel, lien vidéo, taille ou poids)."
          : "La carte n'a pas pu être créée. Réessaie.");
        return;
      }
      onCreee(`Carte prospect créée : ${prenom.trim()} ${nom.trim()}`);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="titre-carte">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <h3 id="titre-carte" className="font-head text-[18px] font-black text-white uppercase tracking-tight">Ajouter un prospect</h3>
        <p className="text-[13px] text-[#9CA3AF] mt-1">
          Un athlète qui n&apos;est pas encore sur Nexus. La carte appartient à ton unité : seuls tes collègues Pro la voient.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <label className={etiquette} htmlFor="carte-prenom">Prénom <span className="text-[#E63946]">*</span></label>
            <input id="carte-prenom" className={champ} value={prenom} onChange={(e) => { setPrenom(e.target.value); setAvertissements(null); }} maxLength={80} autoFocus />
          </div>
          <div>
            <label className={etiquette} htmlFor="carte-nom">Nom <span className="text-[#E63946]">*</span></label>
            <input id="carte-nom" className={champ} value={nom} onChange={(e) => { setNom(e.target.value); setAvertissements(null); }} maxLength={80} />
          </div>

          <div className="col-span-2 relative">
            <span className={etiquette}>École ou club <span className="text-[#E63946]">*</span></span>
            {etablissement ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#2a2d36] bg-[#13151a] px-3 py-2">
                <span className="text-[13px] text-white truncate" data-testid="carte-etablissement-choisi">
                  {etablissement.name}{etablissement.city ? <span className="text-[#6b7280]"> · {etablissement.city}</span> : null}
                </span>
                <button type="button" onClick={() => { setEtablissement(null); setRecherche(""); setAvertissements(null); }} className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] hover:text-white shrink-0">
                  Changer
                </button>
              </div>
            ) : (
              <>
                <div className="flex gap-1.5 mb-2" role="radiogroup" aria-label="Scolaire ou civil">
                  {(["SCOLAIRE", "CIVIL"] as Genre[]).map((g) => (
                    <button key={g} type="button" role="radio" aria-checked={genre === g}
                      onClick={() => { setGenre(g); setEtablissements([]); }}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-wider border transition-colors ${genre === g ? "bg-[#E63946]/15 border-[#E63946]/40 text-[#E63946]" : "border-[#2a2d36] text-[#6b7280] hover:text-white"}`}>
                      {g === "SCOLAIRE" ? "Scolaire" : "Civil"}
                    </button>
                  ))}
                </div>
                <input id="carte-etablissement" aria-label={genre === "SCOLAIRE" ? "Nom de l'école" : "Nom du club"} className={champ} value={recherche} onChange={(e) => setRecherche(e.target.value)}
                  placeholder={genre === "SCOLAIRE" ? "Nom de l'école (2 lettres minimum)" : "Nom du club (2 lettres minimum)"} autoComplete="off" />
                {etablissements.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-[#2D3748] bg-[#13151a] shadow-xl" role="listbox" aria-label={genre === "SCOLAIRE" ? "Écoles" : "Clubs"}>
                    {etablissements.map((e) => (
                      <li key={e.id}>
                        <button type="button" role="option" aria-selected={false} onClick={() => { setEtablissement(e); setEtablissements([]); setAvertissements(null); }} className="w-full text-left px-3 py-2 text-[13px] text-[#e0e0e0] hover:bg-white/5">
                          <span className="font-semibold text-white">{e.name}</span>
                          {e.city && <span className="text-[#6b7280]"> · {e.city}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {recherche.trim().length >= 2 && etablissements.length === 0 && (
                  <p className="text-[12px] text-[#6b7280] mt-1">
                    {genre === "SCOLAIRE" ? "Aucune école" : "Aucun club"} avec une équipe de ce sport ne correspond.
                  </p>
                )}
              </>
            )}
          </div>

          {etablissement && (
            <div className="col-span-2">
              <label className={etiquette} htmlFor="carte-equipe">Équipe <span className="text-[#E63946]">*</span></label>
              <select id="carte-equipe" className={champ} value={equipeId} onChange={(e) => { setEquipeId(e.target.value); setAvertissements(null); }}>
                {equipes.length !== 1 && <option value="">{equipes.length === 0 ? "Aucune équipe de ce sport" : "Choisir l'équipe"}</option>}
                {equipes.map((e) => <option key={e.id} value={e.id}>{e.libelle}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={etiquette} htmlFor="carte-position">Position</label>
            <select id="carte-position" className={champ} value={positionId} onChange={(e) => setPositionId(e.target.value)}>
              <option value="">—</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.abreviation ? `${p.abreviation} — ${p.nom}` : p.nom}</option>)}
            </select>
          </div>
          <div>
            <label className={etiquette} htmlFor="carte-numero">Numéro</label>
            <input id="carte-numero" className={champ} value={numero} onChange={(e) => setNumero(e.target.value.slice(0, 4))} inputMode="numeric" />
          </div>
          <div>
            <label className={etiquette} htmlFor="carte-promotion">Promotion</label>
            <select id="carte-promotion" className={champ} value={promotion} onChange={(e) => setPromotion(e.target.value)}>
              <option value="">—</option>
              {promotions.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <span className={etiquette}>Taille</span>
            <div className="flex gap-2">
              <input aria-label="Taille, pieds" className={champ} value={pieds} onChange={(e) => setPieds(e.target.value.replace(/\D/g, "").slice(0, 1))} placeholder="pi" inputMode="numeric" />
              <input aria-label="Taille, pouces" className={champ} value={pouces} onChange={(e) => setPouces(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="po" inputMode="numeric" />
            </div>
          </div>
          <div>
            <label className={etiquette} htmlFor="carte-poids">Poids (lb)</label>
            <input id="carte-poids" className={champ} value={poids} onChange={(e) => setPoids(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" />
          </div>
          <div>
            <label className={etiquette} htmlFor="carte-courriel">Courriel</label>
            <input id="carte-courriel" type="email" className={champ} value={courriel} onChange={(e) => { setCourriel(e.target.value); setAvertissements(null); }} placeholder="Facultatif" />
          </div>
          <div className="col-span-2">
            <label className={etiquette} htmlFor="carte-video">Lien vidéo</label>
            <input id="carte-video" type="url" className={champ} value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://…" />
          </div>
        </div>

        {avertissements && avertissements.length > 0 && (
          <div role="alert" className="mt-4 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-3 space-y-1.5">
            {avertissements.map((a, i) => (
              <p key={i} className="text-[13px] text-[#F5D08B]">
                {a.texte}{" "}
                {a.lien && <Link href={a.lien} className="font-bold underline text-white">Voir sa fiche</Link>}
              </p>
            ))}
            <p className="text-[12px] text-[#9CA3AF]">« Créer quand même » ajoute la carte malgré tout.</p>
          </div>
        )}
        {erreur && <p role="alert" className="mt-3 text-[13px] text-[#EF4444]">{erreur}</p>}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors">Annuler</button>
          <button type="button" onClick={() => void soumettre()} disabled={!valide || enCours} className="px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[13px] font-bold rounded-lg transition-colors">
            {enCours ? "…" : avertissements && avertissements.length > 0 ? "Créer quand même" : "Créer la carte"}
          </button>
        </div>
      </div>
    </div>
  );
}
