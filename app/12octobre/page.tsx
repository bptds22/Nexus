"use client";

/* ═══════════════════════════════════════════════════════════════
   /12octobre — inscription à la démo recruteurs du 12 octobre (public,
   sans connexion, web seulement).

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
  DEMO_12_OCTOBRE as D, ROLES_DEMO, INTERETS_DEMO, messageErreurInscription, type Participation,
} from "@/lib/demo/demo12Octobre";

const label = "text-[10px] font-bold tracking-[0.25em] uppercase text-[#9AA3B2]";
const champ = "nx-input w-full h-11 px-4 bg-[#060A14] border border-[#1E2D4A] text-white font-sans text-sm placeholder:text-[#475569] focus:border-wl-red focus:outline-none transition-colors";
const AUTRE = "__autre__";

interface Option { id: string; nom: string }

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
    if (!participation) { setErreur("Choisissez comment vous souhaitez participer."); return; }
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
    router.push(`/12octobre/merci?choix=${participation}`);
  };

  const choix: { v: Participation; titre: string }[] = [
    { v: "DIRECT", titre: `Je participe à la démo en direct le ${D.libelleCourt} (heure de Montréal)` },
    { v: "ENREGISTREMENT", titre: "Je ne peux pas y être — envoyez-moi le lien de l'enregistrement" },
    { v: "UN_A_UN", titre: "Je préfère une présentation 1:1 avec Bruno-Philippe" },
  ];

  return (
    <div className="hero-playbook nx-no-glow bg-[#060A14] min-h-screen flex flex-col">
      <PlaybookBackground />
      <MarketingNav />

      <section className="relative z-10 text-center pt-14 pb-8 px-4 sm:px-6">
        <div className="inline-flex items-center gap-3 mb-5">
          <span className="w-6 h-px bg-wl-red" />
          <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-wl-red">Démo recruteurs</span>
          <span className="w-6 h-px bg-wl-red" />
        </div>
        <h1 className="nx-display text-4xl sm:text-5xl font-black text-white uppercase leading-[0.95] tracking-tight">
          Démo Nexus — 12 octobre
        </h1>
        <p className="font-sans text-sm text-[#9AA3B2] mt-3 max-w-xl mx-auto leading-relaxed">
          En direct le {D.libelle}.
        </p>
      </section>

      <section className="relative z-10 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="relative w-full aspect-video overflow-hidden border border-[#1E2D4A] bg-black">
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${D.videoId}?rel=0`}
              title="Nexus — présentation"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>

          <div className="mt-8 nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-6 sm:p-8 font-sans text-[15px] text-[#D1D5DB] leading-relaxed space-y-3">
            <p>
              Le 12 octobre, on vous montre la plateforme en direct — les outils, le processus, la recherche — et on
              répond à vos questions.
            </p>
            <p>
              Tous ceux qui participent, visionnent l&apos;enregistrement ou demandent une présentation 1:1 reçoivent
              ensuite <strong className="text-white">un accès complet et gratuit à Nexus pendant deux semaines</strong>,
              pour tester avant la période intensive de recrutement.
            </p>
            <p>Plusieurs recruteurs dans votre organisation ? Écrivez-nous pour un prix d&apos;équipe.</p>
            <p className="text-[#9AA3B2]">
              Questions : <a href={`mailto:${D.courriel}`} className="text-white hover:text-wl-red">{D.courriel}</a>
              {" · "}
              <a href="tel:4384980494" className="text-white hover:text-wl-red">{D.telephone}</a>
            </p>
          </div>
        </div>
      </section>

      <section className="flex-1 relative z-10 px-4 sm:px-6 py-10">
        <div className="max-w-3xl mx-auto nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-6 sm:p-10">
          <h2 className="nx-display text-xl font-black text-white uppercase tracking-tight mb-6">Inscription</h2>
          <form onSubmit={envoyer} className="flex flex-col gap-5" noValidate={false}>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="prenom" className={`${label} mb-1.5 block`}>Prénom *</label>
                <input id="prenom" name="prenom" value={f.prenom} onChange={maj} required maxLength={80} autoComplete="given-name" className={champ} />
              </div>
              <div>
                <label htmlFor="nom" className={`${label} mb-1.5 block`}>Nom *</label>
                <input id="nom" name="nom" value={f.nom} onChange={maj} required maxLength={80} autoComplete="family-name" className={champ} />
              </div>
            </div>
            <div>
              <label htmlFor="courriel" className={`${label} mb-1.5 block`}>Courriel *</label>
              <input id="courriel" name="courriel" type="email" value={f.courriel} onChange={maj} required maxLength={200} autoComplete="email" className={champ} />
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label htmlFor="cegep" className={`${label} mb-1.5 block`}>Cégep</label>
                <select id="cegep" name="cegep" value={f.cegep} onChange={maj} className={champ}>
                  <option value="">—</option>
                  {cegeps.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  <option value={AUTRE}>Autre</option>
                </select>
              </div>
              <div>
                <label htmlFor="sport" className={`${label} mb-1.5 block`}>Sport recruté</label>
                <select id="sport" name="sport" value={f.sport} onChange={maj} className={champ}>
                  <option value="">—</option>
                  {sports.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>
            </div>
            {f.cegep === AUTRE && (
              <div>
                <label htmlFor="cegepAutre" className={`${label} mb-1.5 block`}>Votre organisation</label>
                <input id="cegepAutre" name="cegepAutre" value={f.cegepAutre} onChange={maj} maxLength={160} className={champ} />
              </div>
            )}

            <fieldset>
              <legend className={`${label} mb-2`}>Rôle</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ROLES_DEMO.map((r) => (
                  <label key={r.valeur} className="flex items-center gap-2.5 text-sm text-white cursor-pointer">
                    <input type="radio" name="role" value={r.valeur} checked={f.role === r.valeur} onChange={maj} className="accent-[#E63946]" />
                    {r.libelle}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className={`${label} mb-2`}>Ce qui m&apos;intéresse chez Nexus</legend>
              <div className="flex flex-col gap-2">
                {INTERETS_DEMO.map((i) => (
                  <label key={i.valeur} className="flex items-center gap-2.5 text-sm text-white cursor-pointer">
                    <input type="checkbox" checked={interets.includes(i.valeur)} onChange={() => basculerInteret(i.valeur)} className="accent-[#E63946]" />
                    {i.libelle}
                  </label>
                ))}
              </div>
              {interets.includes("AUTRE") && (
                <input name="interetAutre" value={f.interetAutre} onChange={maj} maxLength={500} placeholder="Précisez" aria-label="Autre intérêt" className={`${champ} mt-2`} />
              )}
            </fieldset>

            <label className="flex items-center gap-2.5 text-sm text-white cursor-pointer">
              <input type="checkbox" checked={veutCompte} onChange={(e) => setVeutCompte(e.target.checked)} className="accent-[#E63946]" />
              Je suis intéressé à ouvrir un compte Nexus
            </label>

            <fieldset>
              <legend className={`${label} mb-2`}>Comment participer *</legend>
              <div className="flex flex-col gap-2.5">
                {choix.map((c) => (
                  <label key={c.v} className={`flex items-start gap-2.5 text-sm cursor-pointer border px-3.5 py-3 transition-colors ${participation === c.v ? "border-wl-red text-white" : "border-[#1E2D4A] text-[#D1D5DB]"}`}>
                    <input type="radio" name="participation" value={c.v} checked={participation === c.v} onChange={() => setParticipation(c.v)} className="accent-[#E63946] mt-0.5" />
                    <span>{c.titre}</span>
                  </label>
                ))}
              </div>
              {participation === "UN_A_UN" && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <a href={D.reservation} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center h-10 px-5 bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-black text-xs uppercase tracking-widest">
                    Choisir un moment
                  </a>
                  <span className="text-[13px] text-[#9AA3B2]">L&apos;agenda s&apos;ouvre dans un nouvel onglet ; envoyez aussi ce formulaire.</span>
                </div>
              )}
            </fieldset>

            <label className="flex items-start gap-2.5 text-sm text-[#D1D5DB] cursor-pointer">
              <input type="checkbox" checked={consentement} onChange={(e) => setConsentement(e.target.checked)} required className="accent-[#E63946] mt-0.5" />
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

            <button type="submit" disabled={envoi}
              className="nx-ghost-btn h-12 w-full border font-head font-black text-sm uppercase tracking-widest mt-1 disabled:opacity-60 disabled:cursor-not-allowed">
              {envoi ? "Envoi en cours…" : "M'inscrire"}
            </button>
            <p className="text-[12px] text-[#6b7280]">* obligatoire</p>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
}
