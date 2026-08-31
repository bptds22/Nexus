"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MediaPartner, PartnerStatus, PartnerTier } from "@/lib/types/models";
import { uploadImage, cheminStorageDepuisUrl } from "@/lib/upload/uploadImage";

/* ═══════════════════════════════════════════════════════════════
   /admin/partenaires — Phase 1 closed-beta admin panel
   - List all partners (status, homepage flag, created date)
   - Create new partner via /api/admin/partners/create
     (returns one-time temp password — copy and email manually)
   - Approve / Suspend / Revoke status changes
   - Toggle homepage display

   Gating: API route checks is_platform_admin = true on the
   requester. UI is implicitly gated — non-admins will see the
   list (RLS limits what they see) but mutations will 403.
═══════════════════════════════════════════════════════════════ */

const STATUS_COLORS: Record<PartnerStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: "bg-[#F59E0B]/15", text: "text-[#F59E0B]", label: "En attente" },
  APPROVED: { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", label: "Approuvé" },
  SUSPENDED: { bg: "bg-[#6B7280]/15", text: "text-[#9CA3AF]", label: "Suspendu" },
  REVOKED: { bg: "bg-[#EF4444]/15", text: "text-[#EF4444]", label: "Révoqué" },
};

/* Activation state — derived from media_partners columns, not stored.
   Partners are created APPROVED with a temp password; this tracks
   whether they've actually onboarded. Priority order matters. */
type ActivationState = "pending" | "terms" | "active";
function getActivationState(p: MediaPartner): ActivationState {
  if (!p.password_reset_completed_at) return "pending";
  if (!p.terms_accepted_at) return "terms";
  return "active";
}
const ACTIVATION_META: Record<ActivationState, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-[#F59E0B]/15", text: "text-[#F59E0B]", label: "En attente d'activation" },
  terms:   { bg: "bg-[#FB923C]/15", text: "text-[#FB923C]", label: "Conditions non acceptées" },
  active:  { bg: "bg-[#22C55E]/15", text: "text-[#22C55E]", label: "Actif" },
};

/* Rangs d'affichage. Miroir de media_partners_tier_check — toute valeur
   ajoutee ici doit l'etre AUSSI dans la contrainte, sinon l'update est
   rejete a l'ecriture. */
const TIERS: { value: PartnerTier; label: string; aide: string }[] = [
  { value: "OFFICIEL",   label: "Officiel",   aide: "Grand format, seul en haut du bandeau" },
  { value: "MAJEUR",     label: "Majeur",     aide: "Rangee secondaire, en premier" },
  { value: "PARTENAIRE", label: "Partenaire", aide: "Rangee secondaire" },
];

/* Ecrite ICI, sous le bouton, et pas dans un document que personne ne
   rouvre : c'est au moment de choisir le fichier qu'elle sert. Un logo
   carre et un logo horizontal ne peuvent pas occuper la meme surface a
   hauteur egale — un canevas 3:1 commun supprime le probleme a la
   source, au lieu de le rattraper en CSS. */
const CONSIGNE_LOGO = "PNG a fond transparent, canevas carre ou 3:1. Sert aux surfaces CARREES : page publique du partenaire, barre laterale.";

/* L'image de carte n'est PAS un logo : c'est la composition finie qui
   remplit le creneau OFFICIEL bord a bord, logo deja integre. Le ratio
   2,27:1 est celui du creneau (340x150) — s'en ecarter fait rogner. */
const BUCKET_PARTENAIRES = "partner-logos";

/* Un an. Legitime UNIQUEMENT parce que le chemin est horodate a chaque
   televersement : l'URL est unique, donc son contenu est immuable. Sur
   l'ancien chemin fixe, meme 3600 servait une heure d'image perimee apres
   un remplacement — le defaut que BP a rencontre. */
const CACHE_IMMUABLE = "31536000";

const CONSIGNE_CARTE = "Composition complete, logo deja integre. Ratio 2,27:1 — ex. 1360 x 600 px. Remplit la carte du bandeau, bord a bord.";

const inputCls = "w-full bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] placeholder:text-[#4a4d56] focus:border-[#E63946] outline-none transition-colors";
const labelCls = "block text-[12px] font-bold tracking-[0.25em] uppercase text-[#6B7280] mb-1.5";

export default function AdminPartenairesPage() {
  const [partners, setPartners] = useState<MediaPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [activationFilter, setActivationFilter] = useState<"all" | "inactive">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const showToast = (kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Panneau « Presentation » (rang, etiquette, ordre, logo) — un seul ouvert.
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ tier: PartnerTier; category: string; order: string }>(
    { tier: "PARTENAIRE", category: "", order: "" },
  );
  const [panelBusy, setPanelBusy] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    email: "",
    organization_name: "",
    contact_name: "",
    tier: "PARTENAIRE" as PartnerTier,
    category: "",
    instagram_handle: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  /* `sent` / `sendError` : l'ENVOI est désormais automatique, mais il peut
     échouer. Dans ce cas le mot de passe est déjà posé — l'ancien est donc
     déjà invalidé — et cet encart devient le SEUL exemplaire du nouveau.
     L'échec doit donc être visible, jamais silencieux. */
  const [tempPassword, setTempPassword] = useState<
    { email: string; password: string; sent: boolean; sendError?: string; resend?: boolean } | null
  >(null);
  /** id du partenaire dont le renvoi est en cours — désactive son bouton. */
  const [resending, setResending] = useState<string | null>(null);

  const loadPartners = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("media_partners")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[admin/partenaires] load:", error);
      showToast("error", "Impossible de charger la liste");
    } else {
      setPartners((data || []) as MediaPartner[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  async function handleCreate() {
    if (!form.email || !form.organization_name || !form.contact_name) {
      showToast("error", "Email, nom de l'organisation et personne-contact sont requis");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/partners/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast("error", json.error || `Erreur ${res.status}`);
        setSubmitting(false);
        return;
      }
      setTempPassword({
        email: json.email,
        password: json.temp_password,
        sent: !!json.email_envoye,
        sendError: json.email_erreur,
      });
      setForm({ email: "", organization_name: "", contact_name: "", tier: "PARTENAIRE", category: "", instagram_handle: "", description: "" });
      setShowCreate(false);
      await loadPartners();
    } catch (e) {
      console.error("[admin/partenaires] create:", e);
      showToast("error", "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  }

  /* Régénère un mot de passe temporaire et renvoie les accès.
     Le mot de passe temporaire n'est JAMAIS stocké : s'il n'a pas été
     transmis, il est perdu et le partenaire ne peut plus entrer. C'est
     arrivé — Jules Regimbald, créé le 2026-08-13, jamais connecté.
     La route ré-arme aussi l'onboarding (password_reset_completed_at → NULL)
     pour que le nouveau mot de passe temporaire soit bien remplacé à la
     première connexion. */
  async function resendAccess(partnerId: string, orgName: string) {
    setResending(partnerId);
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}/resend`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        showToast("error", json.error || `Erreur ${res.status}`);
        return;
      }
      /* On affiche TOUJOURS le mot de passe, envoi réussi ou non : c'est le
         repli manuel, et après régénération c'est son seul exemplaire. */
      setTempPassword({
        email: json.email,
        password: json.temp_password,
        sent: !!json.email_envoye,
        sendError: json.email_erreur,
        resend: true,
      });
      if (json.email_envoye) showToast("success", `Accès renvoyés à ${orgName}`);
      await loadPartners();
    } catch (e) {
      console.error("[admin/partenaires] resend:", e);
      showToast("error", "Erreur réseau");
    } finally {
      setResending(null);
    }
  }

  async function changeStatus(partnerId: string, status: PartnerStatus) {
    const supabase = createClient();
    const updates: Record<string, unknown> = { status };
    if (status === "APPROVED") {
      updates.approved_at = new Date().toISOString();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) updates.approved_by = user.id;
    }
    const { data, error } = await supabase.from("media_partners").update(updates).eq("id", partnerId).select();
    if (error) {
      console.error("[admin/partenaires] status update:", error);
      showToast("error", `Erreur : ${error.message}`);
      return;
    }
    // 0 rows + no error = RLS silently filtered the update. Without
    // .select() this returns {data:null,error:null} and looks like success.
    if (!data || data.length === 0) {
      showToast("error", "Action refusée — vérifie tes permissions.");
      return;
    }
    showToast("success", `Statut mis à jour : ${STATUS_COLORS[status].label}`);
    await loadPartners();
  }

  function ouvrirPanneau(p: MediaPartner) {
    if (openPanel === p.id) { setOpenPanel(null); return; }
    setOpenPanel(p.id);
    setDraft({
      tier: p.tier ?? "PARTENAIRE",
      category: p.category ?? "",
      order: p.homepage_order?.toString() ?? "",
    });
  }

  async function enregistrerPresentation(partnerId: string) {
    setPanelBusy(true);
    try {
      const supabase = createClient();
      /* homepage_order : chaine vide -> null, pas 0. Un 0 se placerait EN
         TETE du tri au lieu de laisser la ligne se ranger par nom. */
      const ordre = draft.order.trim() === "" ? null : Number(draft.order);
      if (ordre !== null && !Number.isFinite(ordre)) {
        showToast("error", "L'ordre doit etre un nombre.");
        return;
      }
      const { data, error } = await supabase
        .from("media_partners")
        .update({
          tier: draft.tier,
          category: draft.category.trim() || null,
          homepage_order: ordre,
        })
        .eq("id", partnerId)
        .select();
      if (error) {
        /* 23514 = check_violation : category > 24 caracteres, ou un rang
           hors media_partners_tier_check. Le dire au lieu de rendre le
           message brut de Postgres. */
        showToast("error", error.code === "23514"
          ? "Refuse : etiquette de plus de 24 caracteres, ou rang invalide."
          : error.message);
        return;
      }
      if (!data || data.length === 0) {
        showToast("error", "Action refusee — verifie tes permissions.");
        return;
      }
      setPartners((prev) => prev.map((p) => (p.id === partnerId ? (data[0] as MediaPartner) : p)));
      showToast("success", "Presentation mise a jour.");
      setOpenPanel(null);
    } finally {
      setPanelBusy(false);
    }
  }

  /* Chemin HORODATE, et non plus fixe. Le dossier reste {id}/ — c'est ce
     que la policy « partner logos insert » scope, et ce que la contrainte
     media_partners_logo_url_interne exige dans l'URL. Seul le nom du
     fichier porte l'horodatage, ce qui rend chaque URL unique et tue le
     cache perime a toutes les couches (navigateur, CDN, proxy).

     Ordre volontaire : upload -> ecriture de la colonne -> purge de
     l'ancien. Purger d'abord laisserait une image cassee si l'ecriture
     echouait ; dans cet ordre, le pire cas est un orphelin, pas un trou. */
  async function televerserLogo(p: MediaPartner, file: File) {
    setPanelBusy(true);
    try {
      const ancien = cheminStorageDepuisUrl(p.logo_url, BUCKET_PARTENAIRES);
      const res = await uploadImage(file, {
        bucket: BUCKET_PARTENAIRES,
        pathBase: `${p.id}/logo-${Date.now()}`,
        preserveTransparency: true,
        maxDimension: 512,
        maxBytes: 500_000,
        cacheControl: CACHE_IMMUABLE,
      });
      if (!res.ok) {
        showToast("error", `Erreur logo : ${res.message}`);
        return;
      }
      const supabase = createClient();
      const { data, error } = await supabase
        .from("media_partners")
        .update({ logo_url: res.publicUrl })
        .eq("id", p.id)
        .select();
      if (error) { showToast("error", error.message); return; }
      if (!data || data.length === 0) {
        showToast("error", "Action refusee — verifie tes permissions.");
        return;
      }
      setPartners((prev) => prev.map((x) => (x.id === p.id ? (data[0] as MediaPartner) : x)));
      await purgerAncien(ancien, res.path);
      showToast("success", "Logo mis a jour.");
    } finally {
      setPanelBusy(false);
    }
  }

  /* Plafonds CORRIGES par la mesure du 2026-08-31, apres un echec reel.
     Mon estimation initiale (PIL, ~372 Ko a 1360) etait fausse : le canvas
     du navigateur produit 864 Ko sur le meme fichier — 2,3x plus. Et il
     VARIE d'un navigateur a l'autre : au plafond 512, celui-ci rend 97 Ko
     la ou celui de BP en a stocke 121 Ko, soit +24 %.

     Consequence : relever maxBytes ne pouvait pas suffire, il aurait fallu
     depasser le 1 Mo du bucket. Le levier est le PLAFOND DE DIMENSION.

       cap 1360 -> 864 Ko     cap 1024 -> 465 Ko     cap 680 -> 166 Ko

     1024 laisse ~2x de marge contre la variation d'encodeur, et reste 3x
     la taille de rendu (la carte fait 340 px CSS). PNG n'a PAS de boucle
     de qualite dans le helper : au-dessus du plafond, c'est un echec sec,
     pas une degradation. La marge doit donc etre reelle. */
  async function televerserCarte(p: MediaPartner, file: File) {
    setPanelBusy(true);
    try {
      const ancien = cheminStorageDepuisUrl(p.card_image_url, BUCKET_PARTENAIRES);
      const res = await uploadImage(file, {
        bucket: BUCKET_PARTENAIRES,
        pathBase: `${p.id}/carte-${Date.now()}`,
        preserveTransparency: true,
        maxDimension: 1024,
        maxBytes: 950_000,
        cacheControl: CACHE_IMMUABLE,
      });
      if (!res.ok) {
        showToast("error", `Erreur image : ${res.message}`);
        return;
      }
      const supabase = createClient();
      const { data, error } = await supabase
        .from("media_partners")
        .update({ card_image_url: res.publicUrl })
        .eq("id", p.id)
        .select();
      if (error) { showToast("error", error.message); return; }
      if (!data || data.length === 0) {
        showToast("error", "Action refusee — verifie tes permissions.");
        return;
      }
      setPartners((prev) => prev.map((x) => (x.id === p.id ? (data[0] as MediaPartner) : x)));
      await purgerAncien(ancien, res.path);
      showToast("success", "Image de carte mise a jour.");
    } finally {
      setPanelBusy(false);
    }
  }

  /* Purge « best effort » de l'objet remplace. Un echec ici laisse un
     orphelin dans le bucket — genant, jamais visible. On journalise au
     lieu d'alerter : l'admin vient de reussir son televersement, lui
     annoncer une erreur serait faux. */
  async function purgerAncien(ancien: string | null, nouveau: string) {
    if (!ancien || ancien === nouveau) return;
    const supabase = createClient();
    const { error } = await supabase.storage.from(BUCKET_PARTENAIRES).remove([ancien]);
    if (error) console.warn("[partner] orphelin non purge :", ancien, error);
  }

  /* Retrait generique. Vide la colonne ET purge le fichier : sans ca, une
     image deposee par erreur reste servable a son URL publique meme apres
     avoir disparu de l'interface. La suppression Storage est « best
     effort » — si elle echoue, on vide quand meme la colonne, parce que
     l'affichage est ce que l'admin cherchait a corriger. */
  async function retirerImage(p: MediaPartner, champ: "logo_url" | "card_image_url") {
    setPanelBusy(true);
    try {
      const supabase = createClient();
      /* Le chemin est DERIVE de l'URL stockee, jamais reconstruit. Depuis
         que les noms sont horodates, supprimer un « logo.png » en dur ne
         toucherait plus rien et laisserait le vrai fichier servable a son
         URL publique. Fonctionne aussi sur les anciennes URL a nom fixe. */
      const cible = cheminStorageDepuisUrl(
        champ === "logo_url" ? p.logo_url : p.card_image_url,
        BUCKET_PARTENAIRES,
      );
      if (cible) {
        const { error: errStorage } = await supabase.storage
          .from(BUCKET_PARTENAIRES)
          .remove([cible]);
        if (errStorage) {
          console.warn("[partner] purge storage echouee — la colonne est quand meme videe", errStorage);
        }
      }
      const { data, error } = await supabase
        .from("media_partners")
        .update({ [champ]: null })
        .eq("id", p.id)
        .select();
      if (error) { showToast("error", error.message); return; }
      if (!data || data.length === 0) {
        showToast("error", "Action refusee — verifie tes permissions.");
        return;
      }
      setPartners((prev) => prev.map((x) => (x.id === p.id ? (data[0] as MediaPartner) : x)));
      showToast("success", champ === "logo_url"
        ? "Logo retire."
        : "Image de carte retiree — le logo reprend la main dans le bandeau.");
    } finally {
      setPanelBusy(false);
    }
  }

  async function toggleHomepage(partnerId: string, current: boolean) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("media_partners")
      .update({ show_on_homepage: !current })
      .eq("id", partnerId)
      .select();
    if (error) {
      console.error("[admin/partenaires] homepage toggle:", error);
      showToast("error", `Erreur : ${error.message}`);
      return;
    }
    // 0 rows + no error = RLS silently filtered the update. Without
    // .select() this returns {data:null,error:null} and looks like success.
    if (!data || data.length === 0) {
      showToast("error", "Action refusée — vérifie tes permissions.");
      return;
    }
    showToast("success", !current ? "Affiché en page d'accueil" : "Retiré de la page d'accueil");
    await loadPartners();
  }

  const filteredPartners = activationFilter === "all"
    ? partners
    : partners.filter((p) => getActivationState(p) !== "active");

  return (
    <div className="px-6 sm:px-10 py-8 max-w-[1280px] mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-head text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">Partenaires médias</h1>
          <p className="text-[14px] text-[#9CA3AF] mt-1">Gestion des partenaires en bêta fermée</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors uppercase tracking-wider"
        >
          + Créer un partenaire
        </button>
      </div>

      {/* Encart mot de passe temporaire — affiché une seule fois.
          Le cadre passe au ROUGE quand l'envoi a échoué : dans ce cas le mot
          de passe est déjà posé côté auth (donc l'ancien est invalidé) et cet
          encart est le SEUL exemplaire du nouveau. Le fermer sans copier
          reproduirait exactement le cas Jules. */}
      {tempPassword && (
        <div
          className={`rounded-xl p-5 space-y-3 border-2 ${
            tempPassword.sent
              ? "bg-[#22C55E]/10 border-[#22C55E]/40"
              : "bg-[#EF4444]/10 border-[#EF4444]/50"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-[14px] font-bold ${tempPassword.sent ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                {tempPassword.sent
                  ? tempPassword.resend
                    ? "Accès renvoyés par courriel"
                    : "Compte créé — accès envoyés par courriel"
                  : "ENVOI ÉCHOUÉ — transmets ce mot de passe manuellement"}
              </p>
              <p className="text-[12px] text-[#9CA3AF] mt-1">
                {tempPassword.sent
                  ? "Le partenaire a reçu ses accès. Ce mot de passe ne sera plus affiché — inutile de le copier, sauf si le courriel n'arrive pas."
                  : "Le mot de passe est DÉJÀ actif et l'ancien ne fonctionne plus. Copie-le maintenant : il n'est stocké nulle part et ne sera plus affiché."}
              </p>
              {!tempPassword.sent && tempPassword.sendError && (
                <p className="text-[11px] text-[#EF4444]/90 mt-2 font-mono break-all">
                  {tempPassword.sendError}
                </p>
              )}
            </div>
            <button type="button" onClick={() => setTempPassword(null)} className="text-[#9CA3AF] hover:text-white text-[18px] leading-none">×</button>
          </div>
          <div className="bg-[#13151a] border border-[#2D3748] rounded-lg p-3 font-mono text-[13px] space-y-1">
            <p><span className="text-[#6B7280]">Courriel :</span> <span className="text-white">{tempPassword.email}</span></p>
            <p><span className="text-[#6B7280]">Mot de passe :</span> <span className="text-white select-all">{tempPassword.password}</span></p>
          </div>
        </div>
      )}

      {/* Partner list */}
      <div className="bg-[#1A1D24] rounded-xl border border-[#2D3748] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2D3748] flex items-center justify-between">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Liste des partenaires ({filteredPartners.length})</h2>
          <div className="flex items-center bg-[#13151a] border border-[#2a2d36] rounded-lg overflow-hidden">
            <button type="button" onClick={() => setActivationFilter("all")}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${activationFilter === "all" ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}>
              Tous
            </button>
            <button type="button" onClick={() => setActivationFilter("inactive")}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${activationFilter === "inactive" ? "bg-[#E63946] text-white" : "text-[#6b7280] hover:text-white"}`}>
              Non activés
            </button>
          </div>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-[13px] text-[#6B7280]">Chargement…</p>
        ) : filteredPartners.length === 0 ? (
          <p className="px-5 py-8 text-[13px] text-[#6B7280] text-center">
            {activationFilter === "inactive"
              ? "Tous les partenaires sont activés."
              : "Aucun partenaire pour l'instant. Crée le premier ci-dessus."}
          </p>
        ) : (
          <div className="divide-y divide-[#2D3748]/40">
            {filteredPartners.map((p) => {
              const cfg = STATUS_COLORS[p.status];
              const act = ACTIVATION_META[getActivationState(p)];
              return (
                <div key={p.id} className="px-5 py-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[15px] font-bold text-white">{p.organization_name}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${act.bg} ${act.text}`}>
                        {act.label}
                      </span>
                      {p.show_on_homepage && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#3B82F6]/15 text-[#3B82F6]">
                          Page d&apos;accueil
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                      {p.contact_name} · {p.contact_email}
                      {p.instagram_handle && <span> · @{p.instagram_handle}</span>}
                    </p>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">
                      Créé le {new Date(p.created_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => toggleHomepage(p.id, p.show_on_homepage)}
                      className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#3B82F6]/30 text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-colors"
                    >
                      {p.show_on_homepage ? "Retirer du site" : "Afficher au site"}
                    </button>
                    <button
                      type="button"
                      onClick={() => ouvrirPanneau(p)}
                      className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#2D3748] text-[#9CA3AF] hover:border-[#E63946]/40 hover:text-white rounded-lg transition-colors"
                    >
                      {openPanel === p.id ? "Fermer" : "Présentation"}
                    </button>
                    {p.status !== "APPROVED" && (
                      <button
                        type="button"
                        onClick={() => changeStatus(p.id, "APPROVED")}
                        className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-lg transition-colors"
                      >
                        Approuver
                      </button>
                    )}
                    {/* RENVOYER LES ACCÈS — régénère un mot de passe temporaire
                        et le renvoie par courriel. Réservé aux APPROVED : le
                        renvoyer à un compte suspendu ou révoqué rouvrirait la
                        porte que la bascule de statut a fermée (la route le
                        refuse aussi, en 409 — double garde).
                        Confirmation demandée parce que l'action INVALIDE le mot
                        de passe actuel : un partenaire déjà activé serait
                        déconnecté de fait. */}
                    {p.status === "APPROVED" && (
                      <button
                        type="button"
                        disabled={resending === p.id}
                        onClick={() => {
                          if (
                            confirm(
                              `Renvoyer les accès à ${p.organization_name} ?\n\nUn NOUVEAU mot de passe temporaire sera généré : l'actuel cessera de fonctionner immédiatement.`,
                            )
                          ) {
                            resendAccess(p.id, p.organization_name);
                          }
                        }}
                        className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#E63946]/40 text-[#E63946] hover:bg-[#E63946]/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resending === p.id ? "Envoi…" : "Renvoyer les accès"}
                      </button>
                    )}
                    {p.status === "APPROVED" && (
                      <button
                        type="button"
                        onClick={() => changeStatus(p.id, "SUSPENDED")}
                        className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#F59E0B]/40 text-[#F59E0B] hover:bg-[#F59E0B]/10 rounded-lg transition-colors"
                      >
                        Suspendre
                      </button>
                    )}
                    {p.status !== "REVOKED" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Révoquer ${p.organization_name} ? Cette action coupe l'accès du partenaire.`)) {
                            changeStatus(p.id, "REVOKED");
                          }
                        }}
                        className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#EF4444]/40 text-[#EF4444] hover:bg-[#EF4444]/10 rounded-lg transition-colors"
                      >
                        Révoquer
                      </button>
                    )}
                  </div>

                  {openPanel === p.id && (
                    <div className="w-full mt-4 pt-4 border-t border-[#2D3748]/60 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className={labelCls}>Rang</label>
                        <select
                          value={draft.tier}
                          onChange={(e) => setDraft({ ...draft, tier: e.target.value as PartnerTier })}
                          className={inputCls}
                        >
                          {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <p className="text-[11px] text-[#6B7280] mt-1">
                          {TIERS.find((t) => t.value === draft.tier)?.aide}
                        </p>
                      </div>

                      <div>
                        <label className={labelCls}>Étiquette</label>
                        <input
                          type="text"
                          maxLength={24}
                          value={draft.category}
                          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                          placeholder="Média, Ligue, Équipementier…"
                          className={inputCls}
                        />
                        <p className="text-[11px] text-[#6B7280] mt-1">
                          {draft.category.length}/24 — affichée sous le logo.
                        </p>
                      </div>

                      <div>
                        <label className={labelCls}>Ordre</label>
                        <input
                          type="number"
                          value={draft.order}
                          onChange={(e) => setDraft({ ...draft, order: e.target.value })}
                          placeholder="—"
                          className={inputCls}
                        />
                        <p className="text-[11px] text-[#6B7280] mt-1">
                          Départage à rang égal. Vide = classé par nom.
                        </p>
                      </div>

                      {/* ZONE 1 — LOGO. Volontairement dissemblable de la zone
                          « image de carte » : apercu CARRE, liseré bleu, accent
                          bleu sur le bouton. Les deux zones se ressemblaient
                          trop et une image de carte a fini dans ce champ, ce
                          qui casse la page publique et la barre laterale. */}
                      <div className="sm:col-span-3 rounded-lg border-l-2 border-[#3B82F6]/40 bg-[#3B82F6]/[0.03] pl-4 py-3">
                        <label className={labelCls}>Logo — surfaces carrées</label>
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="w-[96px] h-[96px] rounded-lg border border-[#2a2d36] bg-[#13151a] flex items-center justify-center overflow-hidden shrink-0">
                            {p.logo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.logo_url} alt="" className="max-h-[76px] max-w-[76px] object-contain" />
                            ) : (
                              <span className="text-[11px] text-[#4a4d56] text-center px-2">Aucun logo</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <label className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#3B82F6]/40 text-[#3B82F6] hover:bg-[#3B82F6]/10 rounded-lg transition-colors cursor-pointer">
                              {panelBusy ? "Envoi…" : p.logo_url ? "Remplacer" : "Téléverser"}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                className="hidden"
                                disabled={panelBusy}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  e.target.value = "";
                                  if (f) void televerserLogo(p, f);
                                }}
                              />
                            </label>
                            {p.logo_url && (
                              <button
                                type="button"
                                disabled={panelBusy}
                                onClick={() => void retirerImage(p, "logo_url")}
                                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#2D3748] text-[#9CA3AF] hover:text-white hover:border-[#EF4444]/40 rounded-lg transition-colors disabled:opacity-50"
                              >
                                Retirer
                              </button>
                            )}
                          </div>
                        </div>
                        {/* La consigne vit ICI, a cote du bouton — c'est le
                            seul endroit ou elle est lue au bon moment. */}
                        <p className="text-[11px] text-[#6B7280] mt-2">{CONSIGNE_LOGO}</p>
                      </div>

                      {/* Image de carte — OFFICIEL uniquement. On lit `draft.tier`
                          et non `p.tier` : l'admin qui vient de promouvoir un
                          partenaire doit pouvoir televerser dans la foulee, sans
                          enregistrer d'abord. */}
                      {draft.tier === "OFFICIEL" && (
                        <div className="sm:col-span-3 rounded-lg border-l-2 border-[#E63946]/50 bg-[#E63946]/[0.03] pl-4 py-3">
                          <label className={labelCls}>Image de carte — bandeau d&apos;accueil</label>
                          <div className="flex items-center gap-4 flex-wrap">
                            <div className="w-[204px] h-[90px] rounded-lg border border-[#2a2d36] bg-[#13151a] flex items-center justify-center overflow-hidden shrink-0">
                              {p.card_image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.card_image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[11px] text-[#4a4d56]">Aucune image</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <label className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#E63946]/40 text-[#E63946] hover:bg-[#E63946]/10 rounded-lg transition-colors cursor-pointer">
                                {panelBusy ? "Envoi…" : p.card_image_url ? "Remplacer" : "Téléverser"}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  className="hidden"
                                  disabled={panelBusy}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.target.value = "";
                                    if (f) void televerserCarte(p, f);
                                  }}
                                />
                              </label>
                              {p.card_image_url && (
                                <button
                                  type="button"
                                  disabled={panelBusy}
                                  onClick={() => void retirerImage(p, "card_image_url")}
                                  className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-[#2D3748] text-[#9CA3AF] hover:text-white hover:border-[#EF4444]/40 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  Retirer
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-[11px] text-[#6B7280] mt-2">{CONSIGNE_CARTE}</p>
                          <p className="text-[11px] text-[#6B7280] mt-1">
                            Remplace le logo <strong className="text-[#9CA3AF]">dans le bandeau uniquement</strong>.
                            Le logo carré ci-dessus reste utilisé sur la page publique du
                            partenaire et dans son portail — les deux sont nécessaires.
                          </p>
                        </div>
                      )}

                      <div className="sm:col-span-3 flex justify-end">
                        <button
                          type="button"
                          disabled={panelBusy}
                          onClick={() => void enregistrerPresentation(p.id)}
                          className="px-4 py-2 text-[12px] font-bold uppercase tracking-wider bg-[#E63946] hover:bg-[#c62d3a] text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          {panelBusy ? "Enregistrement…" : "Enregistrer"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !submitting && setShowCreate(false)} />
          <div className="relative bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-head text-lg font-black text-white uppercase tracking-tight mb-1">Créer un partenaire</h3>
            <p className="text-[13px] text-[#9CA3AF] mb-5">
              Le partenaire est créé avec le statut <span className="font-bold text-[#22C55E]">APPROUVÉ</span>. Un mot de passe temporaire est généré et affiché une seule fois — copie-le et envoie-le manuellement.
            </p>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Courriel <span className="text-[#EF4444]">*</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contact@partenaire.ca"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Nom de l&apos;organisation <span className="text-[#EF4444]">*</span></label>
                <input
                  type="text"
                  value={form.organization_name}
                  onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
                  placeholder="Ex: Sport Québec Média"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Personne-contact <span className="text-[#EF4444]">*</span></label>
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  placeholder="Prénom Nom"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Rang</label>
                <select
                  value={form.tier}
                  onChange={(e) => setForm({ ...form, tier: e.target.value as PartnerTier })}
                  className={inputCls}
                >
                  {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Étiquette</label>
                <input
                  type="text"
                  maxLength={24}
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Média, Ligue, Équipementier…"
                  className={inputCls}
                />
                <p className="text-[11px] text-[#6B7280] mt-1">
                  Affichée sous le logo. 24 caractères max.
                </p>
              </div>
              {/* Le logo ne se televerse pas ici : il lui faut l'id de la
                  ligne, qui n'existe qu'apres creation. Bouton
                  « Presentation » sur la ligne du partenaire. */}
              <div>
                <label className={labelCls}>Instagram</label>
                <input
                  type="text"
                  value={form.instagram_handle}
                  onChange={(e) => setForm({ ...form, instagram_handle: e.target.value.replace(/^@/, "") })}
                  placeholder="nomdupartenaire (sans @)"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Quelques mots sur le partenaire…"
                  className={`${inputCls} h-auto resize-none`}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#2D3748]/40">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                disabled={submitting}
                className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="px-5 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? "Création…" : "Créer le compte"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
          <div className={`bg-[#1A1D24] border rounded-lg px-5 py-3 shadow-lg flex items-center gap-3 ${toast.kind === "success" ? "border-[#22C55E]/30" : "border-[#EF4444]/30"}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={toast.kind === "success" ? "#22C55E" : "#EF4444"} strokeWidth="2.5" strokeLinecap="round">
              {toast.kind === "success" ? <path d="M20 6L9 17l-5-5" /> : <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>}
            </svg>
            <span className="text-[13px] font-bold text-white">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
