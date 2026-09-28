"use client";

/* ═══════════════════════════════════════════════════════════════
   CreerCarteModal — créer une CARTE PROSPECT depuis Mon processus (lot C).

   Formulaire court : prénom, nom et ÉQUIPE RÉELLE obligatoires (recherche
   par nom parmi les vraies équipes du sport de l'unité), puis position,
   numéro, promotion, taille, poids, lien vidéo, courriel — tous facultatifs.
   Aucune autre coordonnée (décision BP).

   Doublons (décision BP : avertir sans bloquer) :
   - une carte de l'unité au même nom dans la même équipe ;
   - un athlète NEXUS au même nom dans la même école et le même sport — lu
     par la recherche recruteur (recruiter_search_athletes), qui ne rend un
     nom que si l'identité est visible : aucun nom masqué n'est confirmé.
   Le premier « Créer » affiche l'avertissement ; un second clic crée quand
   même.

   La base pose l'unité d'après le créateur et refuse une équipe d'un autre
   sport : le formulaire ne propose que le bon sport, la base le garantit.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { creerCarte, carteDoublon } from "@/lib/cartes/carteProspect";

interface Equipe { id: string; name: string; division: string | null; school_id: string | null; ecole: string | null }
interface Position { id: string; abreviation: string | null; nom: string }

function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const champ = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-3 py-2 text-[13px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const etiquette = "block text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b7280] mb-1";

export default function CreerCarteModal({ sportId, onClose, onCreee }: {
  sportId: string;
  onClose: () => void;
  onCreee: (message: string) => void;
}) {
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [rechercheEquipe, setRechercheEquipe] = useState("");
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipe, setEquipe] = useState<Equipe | null>(null);
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

  // Positions du sport de l'unité.
  useEffect(() => {
    void (async () => {
      const { data } = await createClient().from("positions").select("id, abreviation, nom").eq("sport_id", sportId).order("nom");
      setPositions((data ?? []) as Position[]);
    })();
  }, [sportId]);

  // Recherche d'équipe par nom, du sport de l'unité seulement.
  useEffect(() => {
    const q = rechercheEquipe.trim();
    if (equipe || q.length < 2) { setEquipes([]); return; }
    let annule = false;
    const t = window.setTimeout(async () => {
      const { data } = await createClient()
        .from("teams")
        .select("id, name, division, school_id, schools!school_id(name)")
        .eq("sport_id", sportId)
        .ilike("name", `%${q.replace(/[%_]/g, "")}%`)
        .order("name")
        .limit(15);
      if (annule) return;
      setEquipes(((data ?? []) as unknown as { id: string; name: string; division: string | null; school_id: string | null; schools: { name: string | null } | { name: string | null }[] | null }[])
        .map((e) => {
          const ecole = Array.isArray(e.schools) ? e.schools[0] : e.schools;
          return { id: e.id, name: e.name, division: e.division, school_id: e.school_id, ecole: ecole?.name ?? null };
        }));
    }, 250);
    return () => { annule = true; window.clearTimeout(t); };
  }, [rechercheEquipe, equipe, sportId]);

  const nombre = (v: string) => (v.trim() === "" ? null : Number(v));
  const valide = prenom.trim().length > 0 && nom.trim().length > 0 && !!equipe;
  const promotions = useMemo(() => {
    const an = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => an + i);
  }, []);

  const verifierDoublons = async (): Promise<{ texte: string; lien?: string }[]> => {
    if (!equipe) return [];
    const supabase = createClient();
    const trouves: { texte: string; lien?: string }[] = [];
    if (await carteDoublon(supabase, prenom, nom, equipe.id)) {
      trouves.push({ texte: `Ton unité a déjà une carte « ${prenom.trim()} ${nom.trim()} » dans cette équipe.` });
    }
    const { data } = await supabase.rpc("recruiter_search_athletes", {
      p_search: `${prenom.trim()} ${nom.trim()}`,
      p_sport_id: sportId,
      p_limit: 10,
    });
    const cible = `${sansAccents(prenom)} ${sansAccents(nom)}`;
    const nexus = ((data ?? []) as { id: string; identity_visible: boolean; first_name: string | null; last_name: string | null; school_id: string | null }[])
      .find((a) => a.identity_visible && a.school_id === equipe.school_id
        && `${sansAccents(a.first_name ?? "")} ${sansAccents(a.last_name ?? "")}` === cible);
    if (nexus) {
      trouves.push({
        texte: "Un athlète de ce nom, de cette école, est déjà sur Nexus — ajoute-le plutôt à ton processus depuis sa fiche.",
        lien: `/recruteur/athletes/${nexus.id}`,
      });
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
            <label className={etiquette} htmlFor="carte-equipe">Équipe <span className="text-[#E63946]">*</span></label>
            {equipe ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#2a2d36] bg-[#13151a] px-3 py-2">
                <span className="text-[13px] text-white truncate">
                  {equipe.name}{equipe.division ? ` · ${equipe.division}` : ""}{equipe.ecole ? ` — ${equipe.ecole}` : ""}
                </span>
                <button type="button" onClick={() => { setEquipe(null); setRechercheEquipe(""); setAvertissements(null); }} className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280] hover:text-white shrink-0">
                  Changer
                </button>
              </div>
            ) : (
              <>
                <input id="carte-equipe" className={champ} value={rechercheEquipe} onChange={(e) => setRechercheEquipe(e.target.value)} placeholder="Nom de l'équipe (2 lettres minimum)" autoComplete="off" />
                {equipes.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-[#2D3748] bg-[#13151a] shadow-xl" role="listbox" aria-label="Équipes">
                    {equipes.map((e) => (
                      <li key={e.id}>
                        <button type="button" role="option" aria-selected={false} onClick={() => { setEquipe(e); setEquipes([]); setAvertissements(null); }} className="w-full text-left px-3 py-2 text-[13px] text-[#e0e0e0] hover:bg-white/5">
                          <span className="font-semibold text-white">{e.name}</span>
                          {e.division && <span className="text-[#9CA3AF]"> · {e.division}</span>}
                          {e.ecole && <span className="block text-[12px] text-[#6b7280]">{e.ecole}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {rechercheEquipe.trim().length >= 2 && equipes.length === 0 && (
                  <p className="text-[12px] text-[#6b7280] mt-1">Aucune équipe de ce sport ne correspond. L&apos;équipe doit exister sur Nexus.</p>
                )}
              </>
            )}
          </div>

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
            <input id="carte-courriel" type="email" className={champ} value={courriel} onChange={(e) => setCourriel(e.target.value)} placeholder="Facultatif" />
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
