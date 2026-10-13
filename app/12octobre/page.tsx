"use client";

/* ═══════════════════════════════════════════════════════════════
   /12octobre — la démo recruteurs du 12 octobre est passée : la page
   donne accès à son ENREGISTREMENT, par lien personnel (décision BP
   2026-10-13). Public, sans connexion, web seulement.

   Ordre (BP) : en-tête → « Ce que vous allez voir » → offre → formulaire
   « Recevoir l'enregistrement », qui termine la page (aperçu vidéo
   abandonné, BP 2026-10-13). Aucune vidéo sur cette page : la démo ne vit
   que sur /12octobre/video, derrière un jeton.

   Soumission : POST /api/demo-access (route serveur, service_role) — la
   RPC demo_access_demander décide (validation, limite de débit), puis
   l'edge function send-demo-access envoie tout de suite le courriel A
   (le lien) et l'avis à info@. Le jeton ne revient jamais au navigateur.
   MOBILE D'ABORD : une colonne à 375-390 px, champs pleine largeur en
   16 px (pas de zoom iOS), un seul bouton pleine largeur.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import MarketingNav from "@/components/marketing/MarketingNav";
import Footer from "@/components/marketing/Footer";
import PlaybookBackground from "../components/PlaybookBackground";
import { createClient } from "@/lib/supabase/client";
import { trierOptions, SEUIL_RECHERCHE } from "@/lib/demo/rechercheListe";
import ListeRecherche from "./_components/ListeRecherche";
import { DEMO_12_OCTOBRE as D, ROLES_DEMO } from "@/lib/demo/demo12Octobre";
import { CLE_JETON_MERCI, DUREE_MINUTES, messageErreurAcces } from "@/lib/demo/demoAcces";

const LARGEUR = "max-w-[1100px] mx-auto";
const label = "text-[12px] font-bold tracking-[0.16em] uppercase text-[#B4BCC8]";
const champ = "nx-input w-full h-12 px-4 bg-[#060A14] border border-[#1E2D4A] text-white font-sans text-base placeholder:text-[#475569] focus:border-wl-red focus:outline-none transition-colors";
const caseACocher = "w-5 h-5 shrink-0 accent-[#E63946]";
const option = "flex items-center gap-3 text-base text-white cursor-pointer";
const AUTRE = "__autre__";

interface Option { id: string; nom: string }

const POINTS = [
  "Mon processus : votre pipeline de recrutement, de « identifié » à « engagé », avec vos notes et votre cote personnelle. Il remplace votre fichier Excel.",
  "Le calendrier des matchs : les parties de vos cibles, quand le calendrier de leur ligue est publié.",
  "Le profil complet : mesures, stats, highlights, infos scolaires, cégeps ciblés — et l'évaluation validée par le coach.",
  "Les listes et la messagerie encadrée : vos listes partagées à votre staff, les contacts tracés, le coach dans la boucle.",
  "Votre page de programme, gratuite.",
];

export default function Demo12OctobrePage() {
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();
  const router = useRouter();

  const [cegeps, setCegeps] = useState<Option[]>([]);
  const [sports, setSports] = useState<Option[]>([]);
  const [f, setF] = useState({
    prenom: "", nom: "", courriel: "", cegep: "", cegepAutre: "", sport: "", role: "", nx_site: "",
  });
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

  // « Autre » ajouté ici : il n'existe pas en base, et il ouvre le champ libre.
  const optionsCegep = useMemo(() => [...cegeps, { id: AUTRE, nom: "Autre" }], [cegeps]);

  const maj = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [e.target.name]: e.target.value }));

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (envoi) return;
    if (!consentement) { setErreur(messageErreurAcces("consentement")); return; }
    setErreur(null);
    setEnvoi(true);
    let ok = false;
    let message: string | undefined;
    try {
      const res = await fetch("/api/demo-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prenom: f.prenom, nom: f.nom, courriel: f.courriel,
          cegep_id: f.cegep && f.cegep !== AUTRE ? f.cegep : null,
          cegep_autre: f.cegep === AUTRE ? f.cegepAutre : null,
          sport_id: f.sport || null,
          role: f.role || null,
          wants_1on1: unAUn,
          consentement,
          nx_site: f.nx_site,
        }),
      });
      const r = (await res.json().catch(() => ({}))) as { ok?: boolean; erreur?: string; jeton?: string };
      ok = res.ok && r.ok === true;
      message = r.erreur;
      // Le jeton (première demande seulement) passe à /merci par la session,
      // jamais par l'URL ; une demande sans jeton efface celui d'avant.
      if (ok) {
        try {
          if (r.jeton) sessionStorage.setItem(CLE_JETON_MERCI, r.jeton);
          else sessionStorage.removeItem(CLE_JETON_MERCI);
        } catch { /* navigation privée stricte : /merci retombe sur « parti par courriel » */ }
      }
    } catch { /* réseau : message générique */ }
    if (!ok) {
      setEnvoi(false);
      setErreur(message ?? messageErreurAcces(undefined));
      return;
    }
    router.push(unAUn ? "/12octobre/merci?un_a_un=1" : "/12octobre/merci");
  };

  return (
    <div className="hero-playbook nx-no-glow bg-[#060A14] min-h-screen flex flex-col">
      <PlaybookBackground />
      <MarketingNav />

      <section className="relative z-10 px-4 sm:px-6 pt-10 sm:pt-14 pb-8">
        <div className={LARGEUR}>
          <p className="text-[12px] sm:text-[13px] font-bold tracking-[0.22em] uppercase text-wl-red">Démo recruteurs · Enregistrement disponible</p>
          <h1 className="nx-display text-4xl sm:text-5xl lg:text-6xl font-black text-white uppercase leading-[0.95] tracking-tight mt-3">
            La démo Nexus, en {DUREE_MINUTES} minutes.
          </h1>

          <h2 className={`${label} mt-9 mb-4`}>Ce que vous allez voir</h2>
          <ul className="flex flex-col gap-3.5 font-sans text-[17px] sm:text-[18px] text-[#E5E7EB] leading-relaxed">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3"><span className="text-wl-red font-bold" aria-hidden="true">•</span><span>{p}</span></li>
            ))}
          </ul>

          <div className="mt-9 nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-5 sm:p-6 font-sans text-[17px] sm:text-[18px] text-[#E5E7EB] leading-relaxed flex flex-col gap-1.5">
            <p className="text-white font-semibold">Accès complet gratuit jusqu&apos;au 31 octobre.</p>
            <p>On migre votre fichier de suivi pour vous.</p>
            <p>
              Plusieurs recruteurs ? Prix d&apos;équipe :{" "}
              <a href={`mailto:${D.courriel}`} className="text-white font-semibold hover:text-wl-red">{D.courriel}</a>
              {" · "}
              <a href="tel:4384980494" className="text-white font-semibold hover:text-wl-red whitespace-nowrap">{D.telephone}</a>
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-4 sm:px-6 pb-12">
        <div className={`${LARGEUR} nx-auth-card bg-[#0A1428] border border-[#1E2D4A] p-5 sm:p-8 lg:p-10`}>
          <h2 className="nx-display text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-7">Recevoir l&apos;enregistrement</h2>
          <form onSubmit={envoyer} className="flex flex-col gap-8">
            <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="prenom" className={`${label} mb-2 block`}>Prénom *</label>
                <input id="prenom" name="prenom" value={f.prenom} onChange={maj} required maxLength={80} autoComplete="given-name" className={champ} />
              </div>
              <div>
                <label htmlFor="nom" className={`${label} mb-2 block`}>Nom *</label>
                <input id="nom" name="nom" value={f.nom} onChange={maj} required maxLength={80} autoComplete="family-name" className={champ} />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="courriel" className={`${label} mb-2 block`}>Courriel *</label>
                <input id="courriel" name="courriel" type="email" value={f.courriel} onChange={maj} required maxLength={200} autoComplete="email" className={champ} />
              </div>
              <div>
                <label htmlFor="cegep" className={`${label} mb-2 block`}>Cégep</label>
                <ListeRecherche id="cegep" options={optionsCegep} valeur={f.cegep} className={champ}
                  placeholder="Tapez le nom de votre cégep" onChoisir={(v) => setF((p) => ({ ...p, cegep: v }))} />
              </div>
              <div>
                <label htmlFor="sport" className={`${label} mb-2 block`}>Sport recruté</label>
                {sports.length > SEUIL_RECHERCHE ? (
                  <ListeRecherche id="sport" options={sports} valeur={f.sport} className={champ}
                    placeholder="Tapez le sport" onChoisir={(v) => setF((p) => ({ ...p, sport: v }))} />
                ) : (
                  <select id="sport" name="sport" value={f.sport} onChange={maj} className={champ}>
                    <option value="">—</option>
                    {trierOptions(sports).map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                )}
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="role" className={`${label} mb-2 block`}>Rôle</label>
                <select id="role" name="role" value={f.role} onChange={maj} className={champ}>
                  <option value="">—</option>
                  {ROLES_DEMO.map((r) => <option key={r.valeur} value={r.valeur}>{r.libelle}</option>)}
                </select>
              </div>
              {f.cegep === AUTRE && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <label htmlFor="cegepAutre" className={`${label} mb-2 block`}>Votre organisation</label>
                  <input id="cegepAutre" name="cegepAutre" value={f.cegepAutre} onChange={maj} maxLength={160} className={champ} />
                </div>
              )}
            </div>

            <label className={option}>
              <input id="un_a_un" type="checkbox" checked={unAUn} onChange={(e) => setUnAUn(e.target.checked)} className={caseACocher} />
              Je veux aussi une présentation 1:1 avec Nexus
            </label>

            <label className="flex items-start gap-3 text-base text-[#D1D5DB] cursor-pointer border-t border-[#1E2D4A] pt-7">
              <input id="consentement" type="checkbox" checked={consentement} onChange={(e) => setConsentement(e.target.checked)} required className={`${caseACocher} mt-0.5`} />
              <span>
                J&apos;accepte de recevoir par courriel le lien vers l&apos;enregistrement. *{" "}
                <Link href="/confidentialite" target="_blank" className="underline text-white hover:text-wl-red">Politique de confidentialité</Link>
              </span>
            </label>

            {/* Pot de miel — hors écran, jamais display:none (cf. /contact). */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <input type="text" name="nx_site" value={f.nx_site} onChange={maj} tabIndex={-1} autoComplete="off" />
            </div>

            {erreur && <p role="alert" className="text-base text-[#FCA5A5] -mt-2">{erreur}</p>}

            <button type="submit" disabled={envoi}
              className="h-14 w-full bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-black text-base uppercase tracking-[0.18em] transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {envoi ? "Envoi en cours…" : "Recevoir le lien"}
            </button>
            <p className="text-[13px] text-[#6b7280] -mt-4">* obligatoire</p>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
}
