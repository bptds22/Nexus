"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   Section « Parent » de la fiche athlète ADMIN.

   LOTS A + B1 du chantier « gestion des parents depuis la fiche admin » :
   VOIR l'état parental, et INVITER / RELANCER. Délier, corriger le courriel
   et renvoyer la réinitialisation sont les lots B2-B5, pas encore écrits —
   l'écran ne les esquisse pas, il n'y a pas de bouton mort.

   ── POURQUOI UNE RPC ET PAS DES SELECT ────────────────────────────────
   `parent_invitations` a RLS activé et AUCUNE policy : illisible depuis un
   client, quel que soit le rôle. Et `auth.users.email` n'est atteignable que
   depuis une fonction SECURITY DEFINER. Tout l'état passe donc par
   `admin_parent_state`, gardée par `is_admin()`.

   ── FICHIER SÉPARÉ ────────────────────────────────────────────────────
   PageClient.tsx fait déjà 1800 lignes. Cette section est autonome (son
   propre chargement, son propre état, son propre retour d'erreur) et ne
   partage rien avec le formulaire d'édition — la colocaliser ici plutôt que
   de l'y verser garde les deux lisibles.
═══════════════════════════════════════════════════════════════ */

const labelCls = "text-[11px] font-bold tracking-[0.12em] uppercase text-[#9CA3AF]";
const inputCls =
  "w-full bg-[#111317] border border-[#2D3748] rounded-lg px-3 py-2 text-[13px] text-[#E0E0E0] focus:outline-none focus:border-[#E63946]/50";

/** Charge utile de public.admin_parent_state. Les clés sont celles de la RPC —
 *  si elle en ajoute une, c'est ici qu'on la déclare. */
interface ParentState {
  error?: string;
  declare_sur_athlete: {
    parent_email: string | null;
    parent_first_name: string | null;
    parent_last_name: string | null;
    nom_parent: string | null;
    telephone_parent: string | null;
    parent_relationship: string | null;
    parent_notified_at: string | null;
    age: number | null;
  };
  parent: {
    parent_user_id: string;
    lie_le: string;
    first_name: string | null;
    last_name: string | null;
    role: string | null;
    email_public: string | null;
    email_auth: string | null;
    email_confirme_le: string | null;
    compte_cree_le: string | null;
  } | null;
  invitation: {
    invitation_id: string;
    parent_email: string;
    emise_le: string;
    expire_le: string;
    expiree: boolean;
  } | null;
  invitations_reclamees: {
    invitation_id: string;
    parent_email: string;
    emise_le: string;
    reclamee_le: string;
  }[];
  consentements: {
    privacy_preferences: Record<string, string | null>;
    partner_visibility: { opt_in: boolean | null; opted_in_at: string | null; parental_consent: boolean | null };
    coach_attestation: Record<string, unknown> | null;
  };
  journal_consentement: {
    action: string; de: string | null; vers: string | null; le: string;
    metadata: Record<string, unknown> | null;
  }[];
  journal_admin: {
    action: string; le: string; par: string | null;
    parent_email: string | null; details: Record<string, unknown> | null;
  }[];
}

interface InviteResult {
  ok: boolean;
  reason?: string;
  action?: string;
  token?: string;
  parent_email?: string;
  expire_le?: string;
  remis_a_la_passerelle?: boolean;
  erreur_envoi?: string | null;
}

/* Les motifs métier rendus par la RPC, traduits UNE fois. Un motif inconnu
   s'affiche tel quel plutôt que d'être avalé — mieux vaut un mot brut à
   l'écran qu'un échec silencieux sur une surface d'administration. */
const MOTIFS: Record<string, string> = {
  email_invalide: "Adresse courriel invalide.",
  athlete_introuvable: "Athlète introuvable.",
  deja_lie: "Cet athlète a déjà un parent lié — la base n'en accepte qu'un (UNIQUE sur athlete_id). Il faudra délier avant d'inviter quelqu'un d'autre (lot B2).",
};

const dateFr = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" }) : "—";

const dateHeureFr = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString("fr-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/** Une ligne fait / valeur, l'idiome de la fiche. */
function Fait({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-[#2D3748]/40 last:border-0">
      <span className={labelCls}>{label}</span>
      <span className="text-[13px] text-[#E0E0E0] text-right break-all">{children}</span>
    </div>
  );
}

export default function ParentSection({ athleteId }: { athleteId: string }) {
  const [state, setState] = useState<ParentState | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [prenom, setPrenom] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [resultat, setResultat] = useState<InviteResult | null>(null);

  /* Compteur de rechargement. Une invitation reussie l'incremente, ce qui
     rejoue l'effet ci-dessous — plutot qu'un `charger()` extrait en
     useCallback et rappele a la main.

     CE N'EST PAS UNE CONTORSION POUR PLAIRE AU LINTER. La regle
     react-hooks/set-state-in-effect refusait la version precedente, et elle
     avait raison sur le fond : un chargement asynchrone doit porter une garde
     de demontage, sinon un setState arrive apres que l'admin a quitte la
     fiche. L'idiome retenu — IIFE + drapeau `vivant` — est celui de
     PageClient.tsx juste a cote. Une seule facon de charger sur cet ecran. */
  const [rechargement, setRechargement] = useState(0);

  useEffect(() => {
    let vivant = true;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("admin_parent_state", { p_athlete_id: athleteId });
      if (!vivant) return;
      if (error) {
        /* La RPC LÈVE quand l'appelant n'est pas admin (« NEXUS: … »). On
           montre le message tel quel : sur une surface d'administration, un
           refus doit se lire, pas se deviner. */
        setErreur(error.message);
        setChargement(false);
        return;
      }
      const s = data as ParentState;
      setErreur(null);
      setState(s);
      /* Pré-remplissage : l'adresse de l'invitation en cours d'abord, sinon
         celle déclarée sur la fiche athlète. On ne devine rien de plus. */
      setEmail(s?.invitation?.parent_email ?? s?.declare_sur_athlete?.parent_email ?? "");
      setPrenom(s?.declare_sur_athlete?.parent_first_name ?? "");
      setChargement(false);
    })();
    return () => { vivant = false; };
  }, [athleteId, rechargement]);

  async function inviter() {
    setEnvoiEnCours(true);
    setResultat(null);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_invite_parent", {
      p_athlete_id: athleteId,
      p_email: email.trim(),
      p_first_name: prenom.trim() || null,
    });
    setEnvoiEnCours(false);
    if (error) { setResultat({ ok: false, reason: error.message }); return; }
    const r = data as InviteResult;
    setResultat(r);
    if (r.ok) setRechargement((n) => n + 1);
  }

  const carte = "bg-[#1A1D24] border border-[#2D3748] rounded-xl p-6 space-y-4";

  if (chargement) {
    return (
      <section className={carte}>
        <h2 className="font-head text-[16px] font-black text-white uppercase tracking-tight border-b border-[#2D3748] pb-3">Parent</h2>
        <p className="text-[13px] text-[#6b7280]">Chargement…</p>
      </section>
    );
  }

  if (erreur || !state || state.error) {
    return (
      <section className={carte}>
        <h2 className="font-head text-[16px] font-black text-white uppercase tracking-tight border-b border-[#2D3748] pb-3">Parent</h2>
        <p className="text-[13px] text-[#EF4444]">{erreur || state?.error || "État parental indisponible."}</p>
      </section>
    );
  }

  const d = state.declare_sur_athlete;
  const p = state.parent;
  const inv = state.invitation;

  /* LA DÉSYNCHRONISATION, DÉTECTÉE À L'ÉCRAN ET NON EN BASE.
     `claim_parent_invitation` compare l'adresse AUTH ; rien ne la synchronise
     avec `public.users.email`. La RPC rend les deux sans trancher, c'est ici
     qu'on les compare — et le jour où la règle change, elle change à un seul
     endroit visible. */
  const desync =
    !!p && (p.email_auth ?? "").toLowerCase() !== (p.email_public ?? "").toLowerCase();

  /* L'adresse que le claim exigera. C'est celle-là, et pas une autre, qui doit
     correspondre à l'invitation. */
  const emailQuiCompte = p?.email_auth ?? null;
  const invPointeAilleurs =
    !!inv && !!emailQuiCompte && inv.parent_email.toLowerCase() !== emailQuiCompte.toLowerCase();

  return (
    <section className={carte}>
      <h2 className="font-head text-[16px] font-black text-white uppercase tracking-tight border-b border-[#2D3748] pb-3">
        Parent
      </h2>

      {/* ── LE COMPTE PARENT LIÉ ─────────────────────────────── */}
      {p ? (
        <div className="bg-[#111317] border border-[#2D3748] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-bold text-white">
              {[p.first_name, p.last_name].filter(Boolean).join(" ") || "Compte parent"}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30">
              Lié le {dateFr(p.lie_le)}
            </span>
          </div>

          {/* Les DEUX adresses, l'une sous l'autre. C'est la raison d'être de
              cet écran : la saga de cette semaine s'est jouée sur l'écart
              entre ces deux lignes. */}
          <Fait label="Courriel (auth)">
            <span className={desync ? "text-[#F59E0B] font-semibold" : undefined}>{p.email_auth || "—"}</span>
          </Fait>
          <Fait label="Courriel (public.users)">
            <span className={desync ? "text-[#F59E0B] font-semibold" : undefined}>{p.email_public || "—"}</span>
          </Fait>
          <Fait label="Courriel confirmé">{dateFr(p.email_confirme_le)}</Fait>
          <Fait label="Rôle">{p.role || "—"}</Fait>
          <Fait label="Compte créé">{dateFr(p.compte_cree_le)}</Fait>

          {desync && (
            <p className="mt-3 text-[12px] text-[#F59E0B] leading-relaxed">
              Les deux adresses divergent. Celle qui compte est l&apos;adresse <strong>auth</strong> —
              c&apos;est elle que la réclamation d&apos;invitation compare. Rien ne les synchronise ;
              la correction des deux à la fois est le lot B3.
            </p>
          )}
        </div>
      ) : (
        <div className="bg-[#111317] border border-dashed border-[#2D3748] rounded-lg px-4 py-6 text-center">
          <p className="text-[13px] text-[#9CA3AF] font-semibold">Aucun parent lié</p>
          <p className="text-[12px] text-[#6b7280] mt-1">
            Aucun compte parent n&apos;est rattaché à cet athlète.
          </p>
        </div>
      )}

      {/* ── CE QUE LA FICHE ATHLÈTE DÉCLARE ──────────────────────
          Distinct du compte : ces colonnes sont saisies à l'inscription et
          existent même quand aucun compte parent n'a jamais été créé. Les
          confondre est ce qui fait croire qu'un parent « est là » alors qu'il
          n'a qu'été nommé. */}
      <div>
        <p className={labelCls + " mb-2"}>Déclaré sur la fiche athlète</p>
        <div className="bg-[#111317] border border-[#2D3748] rounded-lg p-4">
          <Fait label="Nom déclaré">{d.nom_parent || [d.parent_first_name, d.parent_last_name].filter(Boolean).join(" ") || "—"}</Fait>
          <Fait label="Courriel déclaré">{d.parent_email || "—"}</Fait>
          <Fait label="Téléphone">{d.telephone_parent || "—"}</Fait>
          <Fait label="Lien">{d.parent_relationship || "—"}</Fait>
          <Fait label="Âge de l'athlète">{d.age != null ? `${d.age} ans` : "—"}</Fait>
          <Fait label="Avis parental envoyé">{dateHeureFr(d.parent_notified_at)}</Fait>
        </div>
      </div>

      {/* ── L'INVITATION EN COURS ────────────────────────────── */}
      {inv && (
        <div className={`border rounded-lg p-4 ${inv.expiree ? "bg-[#EF4444]/[0.06] border-[#EF4444]/30" : "bg-[#3B82F6]/[0.06] border-[#3B82F6]/30"}`}>
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: inv.expiree ? "#EF4444" : "#3B82F6" }}>
            {inv.expiree ? "Invitation expirée" : "Invitation en attente"}
          </p>
          <Fait label="Envoyée à">{inv.parent_email}</Fait>
          <Fait label="Émise le">{dateHeureFr(inv.emise_le)}</Fait>
          <Fait label="Expire le">{dateFr(inv.expire_le)}</Fait>
          {invPointeAilleurs && (
            <p className="mt-3 text-[12px] text-[#F59E0B] leading-relaxed">
              L&apos;invitation pointe vers une adresse différente de celle du compte parent
              (<strong>{emailQuiCompte}</strong>). La réclamation échouerait en
              <em> email_mismatch</em>.
            </p>
          )}
        </div>
      )}

      {/* ── INVITER / RELANCER ───────────────────────────────── */}
      {p ? (
        <p className="text-[12px] text-[#6b7280] leading-relaxed">
          Un athlète ne peut avoir qu&apos;un seul parent lié — la contrainte est en base
          (<code className="text-[#9CA3AF]">UNIQUE (athlete_id)</code>). Pour en rattacher un autre,
          il faudra d&apos;abord délier (lot B2).
        </p>
      ) : (
        <div className="bg-[#111317] border border-[#2D3748] rounded-lg p-4 space-y-3">
          <p className={labelCls}>{inv ? "Relancer l'invitation" : "Inviter un parent"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1.5 block">
              <span className={labelCls}>Courriel du parent</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="parent@exemple.com"
                className={inputCls}
              />
            </label>
            <label className="space-y-1.5 block">
              <span className={labelCls}>Prénom (facultatif)</span>
              <input
                type="text"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Pour la formule d'appel"
                className={inputCls}
              />
            </label>
          </div>

          <p className="text-[12px] text-[#6b7280] leading-relaxed">
            Le courriel contient un lien de réclamation valide 30 jours. Le parent y crée son
            compte s&apos;il n&apos;en a pas, ou se connecte s&apos;il en a déjà un — le même lien couvre
            les deux cas. {inv && "Relancer émet un NOUVEAU jeton : l'ancien lien cesse de fonctionner."}
          </p>

          <button
            type="button"
            onClick={() => void inviter()}
            disabled={envoiEnCours || email.trim().length === 0}
            className="px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {envoiEnCours ? "Envoi…" : inv ? "Relancer l'invitation" : "Envoyer l'invitation"}
          </button>

          {resultat && !resultat.ok && (
            <p className="text-[12px] text-[#EF4444] leading-relaxed">
              {MOTIFS[resultat.reason ?? ""] ?? resultat.reason ?? "Échec."}
            </p>
          )}

          {resultat?.ok && (
            <div className="bg-[#13151a] border border-[#2a2d36] rounded-lg p-3 space-y-2">
              {/* « Remis à la passerelle » et non « envoyé » : net.http_post est
                  asynchrone, on ne sait pas si Resend a livré. Le mensonge
                  inverse est celui qui a laissé un partenaire sans accès
                  pendant deux semaines. */}
              <p className="text-[12px] text-[#22C55E] font-semibold">
                {resultat.action === "PARENT_INVITE_RESENT" ? "Invitation renouvelée" : "Invitation créée"} —
                {resultat.remis_a_la_passerelle
                  ? " remise à la passerelle d'envoi."
                  : " mais l'envoi n'est pas parti."}
              </p>
              {resultat.erreur_envoi && (
                <p className="text-[12px] text-[#F59E0B]">Erreur d&apos;envoi : {resultat.erreur_envoi}</p>
              )}
              {/* Le lien copiable est le FILET, pas le chemin nominal : il rend
                  l'invitation utilisable même quand le courriel ne part pas. */}
              {resultat.token && (
                <label className="block space-y-1">
                  <span className={labelCls}>Lien de réclamation (à transmettre au besoin)</span>
                  <input
                    readOnly
                    onFocus={(e) => e.currentTarget.select()}
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/parent/claim?token=${resultat.token}`}
                    className={inputCls}
                  />
                </label>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── CONSENTEMENTS ────────────────────────────────────── */}
      <div>
        <p className={labelCls + " mb-2"}>Consentements</p>
        <div className="bg-[#111317] border border-[#2D3748] rounded-lg p-4">
          {Object.entries(state.consentements.privacy_preferences).map(([cle, valeur]) => (
            <Fait key={cle} label={cle.replace(/^consent_/, "").replace(/_/g, " ")}>
              {valeur ? dateFr(valeur) : <span className="text-[#6b7280]">non accordé</span>}
            </Fait>
          ))}
          <Fait label="Visibilité partenaire">
            {state.consentements.partner_visibility.opt_in
              ? `oui — ${dateFr(state.consentements.partner_visibility.opted_in_at)}`
              : <span className="text-[#6b7280]">non</span>}
          </Fait>
        </div>
      </div>

      {/* ── LES DEUX JOURNAUX ────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <p className={labelCls + " mb-2"}>Journal de consentement</p>
          <div className="bg-[#111317] border border-[#2D3748] rounded-lg p-4 space-y-2">
            {state.journal_consentement.length === 0 ? (
              /* Relevé prod 2026-09-04 : 5 liaisons sur 28 en portent un. Un
                 journal vide est le cas MAJORITAIRE, pas une anomalie — le dire
                 évite une chasse au bogue qui n'existe pas. */
              <p className="text-[12px] text-[#6b7280] leading-relaxed">
                Aucune ligne. C&apos;est le cas de la plupart des liaisons : la réclamation
                d&apos;invitation n&apos;écrit rien ici, seul un consentement donné par le parent
                depuis son portail le fait.
              </p>
            ) : (
              state.journal_consentement.map((l, i) => (
                <div key={i} className="text-[12px] text-[#c8c8cc]">
                  <span className="font-bold text-white">{l.action}</span>
                  {l.de && l.vers && <span className="text-[#6b7280]"> · {l.de} → {l.vers}</span>}
                  <span className="text-[#6b7280]"> · {dateHeureFr(l.le)}</span>
                  {typeof l.metadata?.consent_key === "string" && (
                    <span className="text-[#9CA3AF]"> · {l.metadata.consent_key as string}</span>
                  )}
                  {typeof l.metadata?.acting_role === "string" && (
                    <span className="text-[#6b7280]"> · par {l.metadata.acting_role as string}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <p className={labelCls + " mb-2"}>Journal admin</p>
          <div className="bg-[#111317] border border-[#2D3748] rounded-lg p-4 space-y-2">
            {state.journal_admin.length === 0 ? (
              <p className="text-[12px] text-[#6b7280]">Aucun geste administratif sur ce lien.</p>
            ) : (
              state.journal_admin.map((l, i) => (
                <div key={i} className="text-[12px] text-[#c8c8cc]">
                  <span className="font-bold text-white">{l.action}</span>
                  <span className="text-[#6b7280]"> · {dateHeureFr(l.le)}</span>
                  {l.par && <span className="text-[#6b7280]"> · par {l.par}</span>}
                  {l.parent_email && <span className="text-[#9CA3AF]"> · {l.parent_email}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── INVITATIONS DÉJÀ RÉCLAMÉES ──────────────────────── */}
      {state.invitations_reclamees.length > 0 && (
        <div>
          <p className={labelCls + " mb-2"}>Invitations réclamées</p>
          <div className="bg-[#111317] border border-[#2D3748] rounded-lg p-4 space-y-1">
            {state.invitations_reclamees.map((i) => (
              <p key={i.invitation_id} className="text-[12px] text-[#c8c8cc]">
                {i.parent_email}
                <span className="text-[#6b7280]"> · émise {dateFr(i.emise_le)} · réclamée {dateFr(i.reclamee_le)}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
