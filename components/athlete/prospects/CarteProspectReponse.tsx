"use client";

/* ═══════════════════════════════════════════════════════════════
   CarteProspectReponse — le jeune répond à une carte d'un partenaire (W4c).

   Utilisé par /p/[jeton] (carte ouverte par le lien) et par
   /athlete/cartes-partenaires (cartes réservées, propositions de Nexus).

   - « C'est moi » : avec la visibilité partenaire active, l'évaluation et les
     badges passent tout de suite sur le profil (règles W2/W3/W3b, côté
     serveur) ; sans elle, la carte attend (CONFIRMEE_ATTENTE_OPTIN) et le
     transfert part tout seul dès que le jeune l'active, avant l'échéance.
   - « Ce n'est pas moi » : par le lien, la carte est retirée ; sur une
     proposition de Nexus, elle n'est plus proposée à ce jeune.
   - La visibilité partenaire s'active DANS cet écran, par la même RPC que
     les paramètres (set_my_partner_visibility) : 14 ans et plus consentent
     eux-mêmes, et pour un 14-17 ans le parent est avisé par le mécanisme
     existant (aviser_parent_partenaires). Rien de nouveau n'est décidé ici.

   Ton : un jeune de 14 à 17 ans. Phrases courtes, « tu », aucune pression.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PRIVACY_POLICY_VERSION } from "@/lib/legal/policyVersion";
import { partnerResponsibilityText } from "@/lib/legal/partnerMediaCopy";
import { badgeSvgPath } from "@/lib/config/badges";
import { iconeBadgeUrl } from "@/lib/badges/partenaire";
import {
  chargerCartesJeune,
  confirmerCarte,
  infirmerCarte,
  messageErreurCarte,
  type CarteJeune,
  type ReponseConfirmation,
} from "@/lib/partenaires/prospects";
import { demanderAuParentDepuisCarte, texteEtatDemande } from "@/lib/partenaires/demandeVisibilite";

type Issue =
  | { type: "transferee"; r: Extract<ReponseConfirmation, { statut: "transferee" }> }
  | { type: "attente"; expireLe: string }
  | { type: "pas-moi" };

function dateLongue(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
}

function Etoiles({ cote }: { cote: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Cote ${cote.toFixed(1)} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="18" height="18" viewBox="0 0 24 24" fill={i <= Math.round(cote) ? "#F59E0B" : "#4a4d56"}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
      <span className="ml-1.5 text-[14px] font-bold text-white">{cote.toFixed(1)}</span>
    </span>
  );
}

export default function CarteProspectReponse({
  carte: carteInitiale,
  onRepondue,
}: {
  carte: CarteJeune;
  /** Appelé quand la carte n'attend plus de réponse (transférée, refusée). */
  onRepondue?: () => void;
}) {
  const [carte, setCarte] = useState(carteInitiale);
  const [issue, setIssue] = useState<Issue | null>(carteInitiale.statut === "CONFIRMEE_ATTENTE_OPTIN" ? { type: "attente", expireLe: carteInitiale.expireLe } : null);
  const [confirmerRefus, setConfirmerRefus] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Un AVIS (pas une erreur) : la demande est partie au parent.
  const [avis, setAvis] = useState<string | null>(null);
  const [mineur, setMineur] = useState(false);
  const [plus, setPlus] = useState(false);
  const partenaire = carte.partenaire ?? "Un partenaire de Nexus";

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("athletes").select("date_naissance").eq("user_id", user.id).maybeSingle();
      const dn = data?.date_naissance as string | null | undefined;
      if (dn) {
        const age = (Date.now() - new Date(dn).getTime()) / (365.25 * 86_400_000);
        setMineur(age < 18);
      }
    })();
  }, []);

  const repondre = async (moi: boolean) => {
    setEnvoi(true);
    setErreur(null);
    try {
      if (moi) {
        const r = await confirmerCarte(createClient(), carte.carteId);
        if (r.statut === "transferee") { setIssue({ type: "transferee", r }); onRepondue?.(); }
        else setIssue({ type: "attente", expireLe: r.expireLe || carte.expireLe });
      } else {
        await infirmerCarte(createClient(), carte.carteId);
        setIssue({ type: "pas-moi" });
        onRepondue?.();
      }
    } catch (e) {
      setErreur(messageErreurCarte(e, "Ta réponse n'a pas pu être enregistrée. Réessaie dans un instant."));
    } finally {
      setEnvoi(false);
      setConfirmerRefus(false);
    }
  };

  const activerVisibilite = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const { data, error } = await createClient().rpc("set_my_partner_visibility", {
        p_granted: true,
        p_policy_version: PRIVACY_POLICY_VERSION,
      });
      const res = data as { ok?: boolean; reason?: string } | null;
      if (error || !res?.ok) {
        // Sous 14 ans : la MÊME demande au parent que « Accepter » dans la cloche
        // (décision BP 2026-10-16) — jamais une activation directe.
        if (res?.reason === "parent_required") {
          const m = await demanderAuParentDepuisCarte(createClient(), carte.carteId, issue?.type === "attente", PRIVACY_POLICY_VERSION);
          if (m === texteEtatDemande("DEMANDE_PARENT")) setAvis(m); else setErreur(m);
        } else {
          setErreur("L'activation n'a pas fonctionné. Réessaie dans un instant.");
        }
        return;
      }
      if (issue?.type === "attente") {
        // Déjà confirmée : le transfert part tout seul à l'activation (trigger
        // W4a). On relit pour le constater, sans deviner son résultat.
        const restantes = await chargerCartesJeune(createClient());
        if (restantes.some((c) => c.carteId === carte.carteId)) {
          setErreur("La visibilité est activée, mais l'évaluation n'est pas encore passée. Recharge la page dans un instant.");
          return;
        }
        setIssue({ type: "transferee", r: { statut: "transferee", partenaire: carte.partenaire, evaluation: "automatique", badgesTransferes: 0 } });
        onRepondue?.();
      } else {
        setCarte({ ...carte, visibilitePartenaireActive: true });
      }
    } finally {
      setEnvoi(false);
    }
  };

  const blocVisibilite = (
    <div className="mt-5 rounded-xl border border-[#F59E0B]/35 bg-[#F59E0B]/8 p-4" data-bloc-visibilite>
      <p className="text-[14px] font-bold text-white">Une étape pour recevoir l&apos;évaluation</p>
      <p className="text-[13px] text-[#c8c8cc] mt-1.5 leading-relaxed">
        Pour que l&apos;évaluation de {partenaire} apparaisse sur ton profil, accepte que les partenaires
        approuvés de Nexus puissent voir ta carte (ton nom, ta position, ton école et ta photo).
        Tu peux changer d&apos;idée quand tu veux, dans tes paramètres.
      </p>
      {mineur && (
        <p className="text-[13px] text-[#c8c8cc] mt-1.5">Comme tu as moins de 18 ans, ton parent en sera avisé.</p>
      )}
      <button type="button" onClick={() => setPlus((v) => !v)} className="mt-2 text-[12px] font-semibold text-[#9CA3AF] underline underline-offset-2 hover:text-white">
        {plus ? "Masquer les détails" : "En savoir plus"}
      </button>
      {plus && <p className="mt-2 text-[12px] text-[#9CA3AF] leading-relaxed">{partnerResponsibilityText("self")}</p>}
      <button type="button" disabled={envoi} onClick={() => void activerVisibilite()}
        className="mt-3 w-full sm:w-auto px-5 py-2.5 bg-white text-[#111317] hover:bg-[#e5e7eb] text-[13px] font-bold rounded-lg disabled:opacity-50"
        data-action="activer-visibilite">
        Activer la visibilité partenaire
      </button>
    </div>
  );

  // ── Réponses terminées ──
  if (issue?.type === "transferee") {
    const { r } = issue;
    return (
      <div className="rounded-2xl border border-[#22C55E]/40 bg-[#1A1D24] p-5 sm:p-6" data-carte-issue="transferee">
        <p className="font-head text-[20px] font-black text-white uppercase tracking-tight">C&apos;est fait !</p>
        <p className="text-[14px] text-[#c8c8cc] mt-2 leading-relaxed">
          {r.evaluation === "transferee" && <>L&apos;évaluation de {r.partenaire ?? partenaire} est maintenant sur ton profil. </>}
          {r.evaluation === "deja_evalue" && <>{r.partenaire ?? partenaire} t&apos;avait déjà évalué : ton évaluation reste la même. </>}
          {r.evaluation === "autre_sport" && <>Cette carte est dans un sport qui n&apos;est pas le tien : rien n&apos;a été ajouté à ton profil. </>}
          {r.evaluation === "automatique" && <>Ce que {r.partenaire ?? partenaire} a noté pour toi est maintenant sur ton profil. </>}
          {r.badgesTransferes > 0 && <>{r.badgesTransferes === 1 ? "Un badge s'ajoute" : `${r.badgesTransferes} badges s'ajoutent`} à tes distinctions.</>}
        </p>
        <Link href="/athlete/profil" className="mt-4 inline-block px-5 py-2.5 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg">
          Voir mon profil
        </Link>
      </div>
    );
  }
  if (issue?.type === "pas-moi") {
    return (
      <div className="rounded-2xl border border-[#2D3748] bg-[#1A1D24] p-5 sm:p-6" data-carte-issue="pas-moi">
        <p className="font-head text-[20px] font-black text-white uppercase tracking-tight">Merci, c&apos;est noté</p>
        <p className="text-[14px] text-[#c8c8cc] mt-2">
          {carte.proposition ? "Cette évaluation ne te sera plus proposée." : "Cette carte a été retirée. Rien n'a été ajouté à ton profil."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#2D3748] bg-[#1A1D24] p-5 sm:p-6" data-carte-jeune={carte.carteId}>
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">Évaluation d&apos;un partenaire</p>
      <h2 className="font-head text-[22px] font-black text-white uppercase tracking-tight mt-1">{partenaire} t&apos;a évalué</h2>
      <p className="text-[14px] text-[#c8c8cc] mt-2 leading-relaxed">
        {issue?.type === "attente"
          ? "Tu as confirmé que c'est toi. Il reste une étape."
          : carte.proposition
            ? "Nexus pense que cette évaluation pourrait te concerner. Regarde les informations : est-ce bien toi ?"
            : `Voici la carte que ${partenaire} a préparée. Est-ce bien toi ?`}
      </p>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#13151a] p-4">
        <p className="font-head text-[18px] font-black text-white uppercase tracking-tight">{carte.prenom} {carte.nom}</p>
        <p className="text-[13px] text-[#c8c8cc] mt-1">{[carte.sport, carte.position, carte.promotion ? `Promotion ${carte.promotion}` : null].filter(Boolean).join(" · ")}</p>
        {(carte.ecole || carte.equipe) && <p className="text-[13px] text-[#9CA3AF] mt-0.5">{[carte.equipe, carte.ecole].filter(Boolean).join(" · ")}</p>}
        {carte.coteGlobale != null && <div className="mt-3"><Etoiles cote={carte.coteGlobale} /></div>}
        {carte.badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {carte.badges.map((b, i) => {
              const src = b.nexus ? badgeSvgPath(b.code ?? "") : iconeBadgeUrl(createClient(), b.icone_path ?? null);
              return (
                <span key={`${b.libelle}-${i}`} className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full border border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[12px] font-semibold text-white">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="w-5 h-5 object-contain" />
                  ) : (
                    <span className="w-5 h-5 rounded-full border border-[#F59E0B]/50 flex items-center justify-center text-[10px] font-bold text-[#F59E0B]">
                      {b.libelle.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  {b.libelle}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {issue?.type === "attente" ? (
        <>
          <p className="mt-4 text-[13px] text-[#F5C46B]">
            Active la visibilité partenaire avant le {dateLongue(issue.expireLe)} : après, la carte s&apos;efface.
          </p>
          {blocVisibilite}
        </>
      ) : (
        <>
          {!carte.visibilitePartenaireActive && (
            <p className="mt-4 text-[13px] text-[#9CA3AF]">
              Si c&apos;est toi, tu pourras confirmer tout de suite. Pour que l&apos;évaluation apparaisse sur ton profil,
              il faudra aussi activer la visibilité partenaire (juste en dessous).
            </p>
          )}
          {confirmerRefus ? (
            <div className="mt-5 rounded-xl border border-[#E63946]/40 bg-[#13151a] p-4">
              <p className="text-[13px] text-white">
                {carte.proposition
                  ? "Ce n'est pas toi ? Cette évaluation ne te sera plus proposée."
                  : "Ce n'est pas toi ? La carte sera retirée."}
              </p>
              <div className="mt-3 flex gap-2 flex-wrap">
                <button type="button" disabled={envoi} onClick={() => void repondre(false)}
                  className="px-4 py-2 bg-[#E63946] hover:bg-[#D42B22] text-white text-[13px] font-bold rounded-lg disabled:opacity-50">
                  Oui, ce n&apos;est pas moi
                </button>
                <button type="button" disabled={envoi} onClick={() => setConfirmerRefus(false)} className="px-4 py-2 text-[13px] font-bold text-[#9CA3AF] hover:text-white">
                  Retour
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex flex-col sm:flex-row gap-2">
              <button type="button" disabled={envoi} onClick={() => void repondre(true)}
                className="flex-1 px-5 py-3 bg-[#E63946] hover:bg-[#D42B22] text-white font-head text-[13px] font-bold uppercase tracking-widest rounded-xl disabled:opacity-50"
                data-action="c-est-moi">
                C&apos;est moi
              </button>
              <button type="button" disabled={envoi} onClick={() => setConfirmerRefus(true)}
                className="flex-1 px-5 py-3 border border-[#2D3748] text-white hover:bg-white/5 font-head text-[13px] font-bold uppercase tracking-widest rounded-xl disabled:opacity-50"
                data-action="pas-moi">
                Ce n&apos;est pas moi
              </button>
            </div>
          )}
          {!carte.visibilitePartenaireActive && blocVisibilite}
        </>
      )}

      {avis && <p className="mt-4 text-[13px] text-[#F5C46B]" role="status" data-avis-parent>{avis}</p>}
      {erreur && <p className="mt-4 text-[13px] text-[#EF4444]" role="alert">{erreur}</p>}
    </div>
  );
}
