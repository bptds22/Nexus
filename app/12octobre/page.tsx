"use client";

/* ═══════════════════════════════════════════════════════════════
   /12octobre — inscription à la démo recruteurs du 12 octobre (public,
   sans connexion, web seulement).

   Ordre (retour BP 2026-09-29) : titre → points courts → FORMULAIRE →
   vidéo en bas. Le bouton d'inscription tient à l'écran d'un ordinateur
   sans défiler : formulaire serré en trois colonnes dès lg.

   La base décide (RPC inscrire_demo : validation, pot de miel, limite de
   débit) ; les courriels partent ensuite par l'edge function
   send-demo-inscription, avec l'id rendu par la RPC. Un échec d'envoi ne
   bloque pas l'inscription : elle est en base, statut visible sur
   /admin/demo.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import MarketingNav from "@/components/marketing/MarketingNav";
import Footer from "@/components/marketing/Footer";
import PlaybookBackground from "../components/PlaybookBackground";
import { createClient } from "@/lib/supabase/client";
import {
  DEMO_12_OCTOBRE as D, ROLES_DEMO, INTERETS_DEMO, messageErreurInscription, lienOuvrirCompte, type Participation,
} from "@/lib/demo/demo12Octobre";

const label = "text-[10px] font-bold tracking-[0.2em] uppercase text-[#9AA3B2]";
const champ = "nx-input w-full h-10 px-3 bg-[#060A14] border border-[#1E2D4A] text-white font-sans text-sm placeholder:text-[#475569] focus:border-wl-red focus:outline-none transition-colors";
const AUTRE = "__autre__";

interface Option { id: string; nom: string }

const POINTS = [
  "Le 12 octobre à midi : la plateforme en direct, les outils, vos questions.",
  "Vous manquez la démo ? On vous envoie l'enregistrement.",
  "Après : accès complet gratuit deux semaines, avant la période intensive.",
];

export default function Demo12OctobrePage() {
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();
  const router = useRouter();

  const [cegeps, setCegeps] = useState<Option[]>([]);
  const [sports, setSports] = useState<Option[]>([]);
  const [f, setF] = useState({
    prenom: "", nom: "", courriel: "", cegep: "", cegepAutre: "", sport: "", role: "",
    interetAutre: "", nx_site: "",
  });
  const [interets, setInterets] = useState<string[]>([]);
  const [veutCompte, setVeutCompte] = useState(false);
  const [participation, setParticipation] = useState<Participation | null>(null);
  const [unAUn, setUnAUn] = useState(false);
  const [consentement, setConsentement] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.from("schools").select("id, name").eq("type", "CEGEP").order("name")
      .then(({ data }) => setCegeps((data ?? []).map((s) => ({ id: s.id as string, nom: s.name as string }))));
    void supabase.from("sports").select("id, nom").order("nom")
      .then(({ data }) => setSports((data ?? []).map((s) => ({ id: s.id as string, nom: s.nom as string }))));
  }, []);

  const maj = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [e.target.name]: e.target.value }));
  const basculerInteret = (v: string) =>
    setInterets((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    if (!participation) { setErreur("Choisissez : la démo en direct ou l'enregistrement."); return; }
    if (!consentement) { setErreur(messageErreurInscription("consentement")); return; }
    setErreur(null);
    setEnvoi(true);
    const supabase = createClient();
    const { data: id, error } = await supabase.rpc("inscrire_demo", {
      p_prenom: f.prenom, p_nom: f.nom, p_courriel: f.courriel,
      p_cegep_id: f.cegep && f.cegep !== AUTRE ? f.cegep : null,
      p_cegep_autre: f.cegep === AUTRE ? f.cegepAutre : null,
      p_sport_id: f.sport || null,
      p_role: f.role || null,
      p_interets: interets,
      p_interet_autre: interets.includes("AUTRE") ? f.interetAutre : null,
      p_veut_compte: veutCompte,
      p_participation: participation,
      p_presentation_1a1: unAUn,
      p_consentement: consentement,
      p_site_web: f.nx_site,
    });
    if (error || typeof id !== "string") {
      setEnvoi(false);
      setErreur(messageErreurInscription(error?.message));
      return;
    }
    // Les courriels : un échec ne défait pas l'inscription (statut en base).
    try {
      await supabase.functions.invoke("send-demo-inscription", { body: { id } });
    } catch {
      /* statut A_ENVOYER / ECHEC visible sur /admin/demo */
    }
    // Le courriel ne passe pas par l'URL (journaux, historique) : il sert au
    // bouton « Ouvrir mon compte Nexus » de la page suivante.
    try { sessionStorage.setItem("demo12-courriel", f.courriel.trim()); } catch { /* navigation privée stricte */ }
    const q = new URLSearchParams({ choix: participation, id });
    if (unAUn) q.set("un_a_un", "1");
    router.push(`/12octobre/merci?${q.toString()}`);
  };

  const choix: { v: Participation; titre: string }[] = [
    { v: "DIRECT", titre: `Je participe à la démo en direct le ${D.libelleCourt}` },
    { v: "ENREGISTREMENT", titre: "Envoyez-moi l'enregistrement" },
  ];

  return (
    <div className="hero-playbook nx-no-glow bg-[#060A14] min-h-screen flex flex-col">
      <PlaybookBackground />
      <MarketingNav />

      <section className="relative z-10 px-4 sm:px-6 pt-6 pb-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-wl-red">Démo recruteurs · {D.libelle}</p>
          <h1 className="nx-display text-3xl sm:text-4xl font-black text-white uppercase leading-[0.95] tracking-tight mt-1.5">
            Démo Nexus — 12 octobre
          </h1>
          <ul className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2 font-sans text-[14px] text-[#D1D5DB] leading-snug">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-2"><span className="text-wl-red" aria-hidden="true">•</span><span>{p}</span></li>
            ))}
            <li className="flex gap-2">
              <span className="text-wl-red" aria-hidden="true">•</span>
              <span>
                Plusieurs recruteurs ? Prix d&apos;équipe :{" "}
                <a href={`mailto:${D.courriel}`} className="text-white hover:text-wl-red">{D.courriel}</a>
                {" · "}
                <a href="tel:4384980494" className="text-white hover:text-wl-red whitespace-nowrap">{D.telephone}</a>
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="relative z-10 px-4 sm:px-6 pb-8">
        <div className="max-w-5xl mx-auto nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-5 sm:p-6">
          <form onSubmit={envoyer} className="flex flex-col gap-3.5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="prenom" className={`${label} mb-1 block`}>Prénom *</label>
                <input id="prenom" name="prenom" value={f.prenom} onChange={maj} required maxLength={80} autoComplete="given-name" className={champ} />
              </div>
              <div>
                <label htmlFor="nom" className={`${label} mb-1 block`}>Nom *</label>
                <input id="nom" name="nom" value={f.nom} onChange={maj} required maxLength={80} autoComplete="family-name" className={champ} />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="courriel" className={`${label} mb-1 block`}>Courriel *</label>
                <input id="courriel" name="courriel" type="email" value={f.courriel} onChange={maj} required maxLength={200} autoComplete="email" className={champ} />
              </div>
              <div>
                <label htmlFor="cegep" className={`${label} mb-1 block`}>Cégep</label>
                <select id="cegep" name="cegep" value={f.cegep} onChange={maj} className={champ}>
                  <option value="">—</option>
                  {cegeps.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  <option value={AUTRE}>Autre</option>
                </select>
              </div>
              <div>
                <label htmlFor="sport" className={`${label} mb-1 block`}>Sport recruté</label>
                <select id="sport" name="sport" value={f.sport} onChange={maj} className={champ}>
                  <option value="">—</option>
                  {sports.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="role" className={`${label} mb-1 block`}>Rôle</label>
                <select id="role" name="role" value={f.role} onChange={maj} className={champ}>
                  <option value="">—</option>
                  {ROLES_DEMO.map((r) => <option key={r.valeur} value={r.valeur}>{r.libelle}</option>)}
                </select>
              </div>
              {f.cegep === AUTRE && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <label htmlFor="cegepAutre" className={`${label} mb-1 block`}>Votre organisation</label>
                  <input id="cegepAutre" name="cegepAutre" value={f.cegepAutre} onChange={maj} maxLength={160} className={champ} />
                </div>
              )}
            </div>

            <fieldset className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <legend className={`${label} mb-1.5 w-full`}>Ce qui m&apos;intéresse chez Nexus</legend>
              {INTERETS_DEMO.map((i) => (
                <label key={i.valeur} className="flex items-center gap-2 text-sm text-white cursor-pointer">
                  <input type="checkbox" checked={interets.includes(i.valeur)} onChange={() => basculerInteret(i.valeur)} className="accent-[#E63946]" />
                  {i.libelle}
                </label>
              ))}
              {interets.includes("AUTRE") && (
                <input name="interetAutre" value={f.interetAutre} onChange={maj} maxLength={500} placeholder="Précisez" aria-label="Autre intérêt" className={`${champ} sm:max-w-xs`} />
              )}
            </fieldset>

            <fieldset>
              <legend className={`${label} mb-1.5`}>Comment participer *</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {choix.map((c) => (
                  <label key={c.v} className={`flex items-center gap-2.5 text-sm cursor-pointer border px-3 py-2.5 transition-colors ${participation === c.v ? "border-wl-red text-white" : "border-[#1E2D4A] text-[#D1D5DB]"}`}>
                    <input type="radio" name="participation" value={c.v} checked={participation === c.v} onChange={() => setParticipation(c.v)} className="accent-[#E63946]" />
                    <span>{c.titre}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-2.5 text-sm text-white cursor-pointer">
                <input id="un_a_un" type="checkbox" checked={unAUn} onChange={(e) => setUnAUn(e.target.checked)} className="accent-[#E63946]" />
                Je veux aussi une présentation 1:1 avec Nexus
              </label>
              {unAUn && (
                <a href={D.reservation} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center h-9 px-4 bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-black text-[11px] uppercase tracking-widest">
                  Choisir un moment
                </a>
              )}
            </div>

            <label className="flex items-start gap-2.5 text-sm text-[#D1D5DB] cursor-pointer">
              <input id="consentement" type="checkbox" checked={consentement} onChange={(e) => setConsentement(e.target.checked)} required className="accent-[#E63946] mt-0.5" />
              <span>
                J&apos;accepte de recevoir les courriels liés à cet événement. *{" "}
                <Link href="/confidentialite" target="_blank" className="underline text-white hover:text-wl-red">Politique de confidentialité</Link>
              </span>
            </label>

            {/* Pot de miel — hors écran, jamais display:none (cf. /contact). */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <input type="text" name="nx_site" value={f.nx_site} onChange={maj} tabIndex={-1} autoComplete="off" />
            </div>

            {erreur && <p role="alert" className="text-sm text-[#FCA5A5]">{erreur}</p>}

            <div className="flex flex-col sm:flex-row gap-3">
              <button type="submit" disabled={envoi}
                className="nx-ghost-btn h-11 flex-1 border font-head font-black text-sm uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed">
                {envoi ? "Envoi en cours…" : "M'inscrire"}
              </button>
              {/* L'intérêt est gardé : le clic pose veut_compte, envoyé avec l'inscription. */}
              <a href={lienOuvrirCompte(f.courriel)} target="_blank" rel="noopener noreferrer"
                onClick={() => setVeutCompte(true)}
                className="inline-flex items-center justify-center h-11 px-5 border border-[#1E2D4A] text-[#D1D5DB] hover:text-white hover:border-[#9AA3B2] font-head font-black text-xs uppercase tracking-widest">
                Ouvrir mon compte Nexus
              </a>
            </div>
            <p className="text-[12px] text-[#6b7280]">* obligatoire</p>
          </form>
        </div>
      </section>

      <section className="relative z-10 px-4 sm:px-6 pb-14">
        <div className="max-w-3xl mx-auto">
          <div className="relative w-full aspect-video overflow-hidden border border-[#1E2D4A] bg-black">
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${D.videoId}?rel=0`}
              title="Nexus — présentation"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
