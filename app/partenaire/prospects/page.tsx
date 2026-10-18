"use client";

/* ═══════════════════════════════════════════════════════════════
   /partenaire/prospects — « Mes athlètes » (W4b ; « Mes prospects » renommée en 1.4.5, P3 —
   pas de puce « Ouverte »).

   Les cartes d'un partenaire ÉVALUATEUR pour des jeunes qui ne sont pas
   encore sur Nexus. Base W4a (en prod) : tout passe par ses RPC.

   - Le statut affiché est CELUI QUE REND LE SERVEUR (masqué) : « À envoyer »,
     « Lien envoyé », « Correspondance possible ». L'écran n'en déduit rien —
     une réservation par le lien ou une proposition de Nexus ne se voient pas
     d'ici, et ne doivent pas se voir (Loi 25).
   - Le lien n'est affiché qu'une fois (EnvoyerLien).
   - « Terminées » (W4d) : une réclamation est nommée, avec le résumé du transfert,
     seulement si le jeune lui est encore visible (partenaire_prospects_terminees) ;
     sinon « Réclamée — profil non visible ». Les autres issues restent sans nom.
═══════════════════════════════════════════════════════════════ */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import FormulaireCarte from "@/components/partenaire/prospects/FormulaireCarte";
import EnvoyerLien from "@/components/partenaire/prospects/EnvoyerLien";
import { adressePublique } from "@/lib/partage/adressePublique";
import {
  adresseLien,
  chargerCartesTerminees,
  chargerMesCartes,
  genererLien,
  LIBELLE_EVALUATION_TRANSFERT,
  LIBELLE_ISSUE,
  LIBELLE_RAISON_BADGE,
  LIBELLE_STATUT,
  LIMITE_CARTES,
  messageErreurCarte,
  revoquerLien,
  supprimerCarte,
  type CartePartenaire,
  type CarteTerminee,
} from "@/lib/partenaires/prospects";
import { Avis, Chargement, classesBouton, classesPage, classesSurface, EnTetePartenaire, EtatVide, Pastille, type TonPastille } from "@/components/partenaire/kit/KitPartenaire";

interface Partenaire { id: string; organizationName: string; peutEvaluer: boolean; approuve: boolean }

const TON_STATUT: Record<CartePartenaire["statut"], TonPastille> = {
  A_ENVOYER: "neutre",
  ENVOYEE: "succes",
  CORRESPONDANCE_POSSIBLE: "attention",
};

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}
function joursRestants(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function Etoiles({ cote }: { cote: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Cote ${cote.toFixed(1)} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={i <= Math.round(cote) ? "#F59E0B" : "#4a4d56"}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
      <span className="ml-1 text-[12px] text-[#9CA3AF]">{cote.toFixed(1)}</span>
    </span>
  );
}

export default function MesProspectsPage() {
  const [partenaire, setPartenaire] = useState<Partenaire | null>(null);
  const [sportsPermis, setSportsPermis] = useState<{ id: string; nom: string }[]>([]);
  const [cartes, setCartes] = useState<CartePartenaire[]>([]);
  const [terminees, setTerminees] = useState<CarteTerminee[]>([]);
  const [noms, setNoms] = useState<{ sports: Record<string, string>; positions: Record<string, string>; ecoles: Record<string, string>; equipes: Record<string, string> }>({ sports: {}, positions: {}, ecoles: {}, equipes: {} });
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState(false);
  const [formulaire, setFormulaire] = useState<{ carte: CartePartenaire | null } | null>(null);
  const [lien, setLien] = useState<{ carteId: string; adresse: string; evalue: boolean } | null>(null);
  const [confirmation, setConfirmation] = useState<{ carteId: string; action: "supprimer" | "nouveau-lien" | "revoquer" } | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [avis, setAvis] = useState<{ type: "succes" | "erreur"; texte: string } | null>(null);

  const notifier = (type: "succes" | "erreur", texte: string) => {
    setAvis({ type, texte });
    setTimeout(() => setAvis(null), 4000);
  };

  const charger = useCallback(async () => {
    const supabase = createClient();
    try {
      const [c, t] = await Promise.all([chargerMesCartes(supabase), chargerCartesTerminees(supabase)]);
      setCartes(c);
      setTerminees(t);
      // Libellés lisibles : sports, positions, établissements et équipes des cartes.
      const ids = (f: (x: CartePartenaire) => string | null) => [...new Set(c.map(f).filter((x): x is string => !!x))];
      const [sp, po, ec, eq] = await Promise.all([
        supabase.from("sports").select("id, nom"),
        ids((x) => x.positionId).length ? supabase.from("positions").select("id, nom, abreviation").in("id", ids((x) => x.positionId)) : Promise.resolve({ data: [] }),
        ids((x) => x.schoolId).length ? supabase.from("schools").select("id, name").in("id", ids((x) => x.schoolId)) : Promise.resolve({ data: [] }),
        ids((x) => x.teamId).length ? supabase.from("teams").select("id, name, age_group, division").in("id", ids((x) => x.teamId)) : Promise.resolve({ data: [] }),
      ]);
      setNoms({
        sports: Object.fromEntries(((sp.data ?? []) as { id: string; nom: string }[]).map((r) => [r.id, r.nom])),
        positions: Object.fromEntries(((po.data ?? []) as { id: string; nom: string }[]).map((r) => [r.id, r.nom])),
        ecoles: Object.fromEntries(((ec.data ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name])),
        equipes: Object.fromEntries(((eq.data ?? []) as { id: string; name: string; age_group: string | null; division: string | null }[])
          .map((r) => [r.id, [r.age_group, r.division].filter(Boolean).join(" ") || r.name])),
      });
      setErreurChargement(false);
    } catch (e) {
      console.error("[prospects] chargement :", (e as { message?: string })?.message ?? e);
      setErreurChargement(true);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: mp } = await supabase.from("media_partners")
        .select("id, organization_name, peut_evaluer, status").eq("user_id", user.id).maybeSingle();
      if (mp) {
        setPartenaire({ id: mp.id as string, organizationName: (mp.organization_name as string) ?? "", peutEvaluer: !!mp.peut_evaluer, approuve: mp.status === "APPROVED" });
        const { data: permis } = await supabase.from("partenaire_sports_permis")
          .select("sport_id, sports!sport_id(nom)").eq("partner_id", mp.id);
        setSportsPermis(((permis ?? []) as { sport_id: string; sports: { nom: string } | { nom: string }[] | null }[])
          .map((r) => ({ id: r.sport_id, nom: (Array.isArray(r.sports) ? r.sports[0]?.nom : r.sports?.nom) ?? "" }))
          .sort((a, b) => a.nom.localeCompare(b.nom, "fr")));
      }
      await charger();
      setChargement(false);
    })();
  }, [charger]);

  const autorise = !!partenaire?.peutEvaluer && partenaire.approuve && sportsPermis.length > 0;
  const plein = cartes.length >= LIMITE_CARTES;

  const envoyer = async (carteId: string) => {
    setOccupe(carteId);
    setConfirmation(null);
    try {
      const jeton = await genererLien(createClient(), carteId);
      // Domaine public (NEXT_PUBLIC_APP_URL), jamais l'adresse locale de la WebView de l'appli.
      // Le texto ne dit « t'a évalué » que si la carte porte une évaluation.
      const evalue = cartes.find((c) => c.id === carteId)?.coteGlobale != null;
      setLien({ carteId, adresse: adresseLien(adressePublique(), jeton), evalue });
      await charger();
    } catch (e) {
      notifier("erreur", messageErreurCarte(e, "Le lien n'a pas pu être créé."));
    } finally {
      setOccupe(null);
    }
  };

  const revoquer = async (carteId: string) => {
    setOccupe(carteId);
    setConfirmation(null);
    try {
      await revoquerLien(createClient(), carteId);
      notifier("succes", "Lien révoqué : il ne fonctionne plus.");
      await charger();
    } catch (e) {
      notifier("erreur", messageErreurCarte(e, "Le lien n'a pas pu être révoqué."));
    } finally {
      setOccupe(null);
    }
  };

  const supprimer = async (carteId: string) => {
    setOccupe(carteId);
    setConfirmation(null);
    try {
      await supprimerCarte(createClient(), carteId);
      notifier("succes", "Carte supprimée.");
      await charger();
    } catch (e) {
      notifier("erreur", messageErreurCarte(e, "La carte n'a pas pu être supprimée."));
    } finally {
      setOccupe(null);
    }
  };

  const terminesTries = useMemo(() => [...terminees].sort((a, b) => b.termineeLe.localeCompare(a.termineeLe)), [terminees]);

  if (chargement) return <Chargement />;

  return (
    <div className={classesPage()} data-page-prospects>
      <EnTetePartenaire
        titre="Mes athlètes"
        sousTitre="Des jeunes que tu as repérés et qui ne sont pas encore sur Nexus. Crée leur carte, envoie-leur le lien : s'ils confirment que c'est eux, ton évaluation et tes badges passent sur leur profil."
        actions={autorise && (
          <>
            <span className={`text-[12px] font-bold ${plein ? "text-[#F59E0B]" : "text-[#9CA3AF]"}`} data-compteur-cartes>
              {cartes.length} / {LIMITE_CARTES} cartes actives
            </span>
            <button type="button" disabled={plein} onClick={() => setFormulaire({ carte: null })}
              className={classesBouton("principal")}
              title={plein ? "Limite de 50 cartes actives atteinte" : undefined}>
              + Nouvelle carte
            </button>
          </>
        )}
      />

      {avis && <div className="mt-5"><Avis ok={avis.type === "succes"}>{avis.texte}</Avis></div>}

      {!autorise ? (
        <div className="mt-8">
          <EtatVide
            titre="Les cartes prospects sont réservées aux partenaires évaluateurs."
            texte={partenaire && !partenaire.approuve
              ? "Ton organisation n'est pas encore approuvée."
              : "Ton organisation n'a pas encore la permission d'évaluer, ou aucun sport ne lui est attribué. Écris à l'équipe Nexus pour en parler."}
          />
        </div>
      ) : erreurChargement ? (
        <div className="mt-8"><Avis ok={false}>Tes cartes n&apos;ont pas pu être chargées. Recharge la page dans un instant.</Avis></div>
      ) : (
        <>
          {cartes.length === 0 ? (
            <div className="mt-8">
              <EtatVide titre="Aucune carte pour l'instant" texte="Crée ta première carte, puis envoie le lien au jeune par texto." />
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {cartes.map((c) => {
                const lieu = [c.teamId ? noms.equipes[c.teamId] : null, c.schoolId ? noms.ecoles[c.schoolId] : null].filter(Boolean).join(" · ");
                const jours = joursRestants(c.expireLe);
                const conf = confirmation?.carteId === c.id ? confirmation.action : null;
                const lienEnvoye = c.statut !== "A_ENVOYER";
                return (
                  <li key={c.id} className={`${classesSurface()} p-4 sm:p-5`} data-carte-prospect={c.id}>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-head text-[17px] font-black text-white uppercase tracking-tight">{c.prenom} {c.nom}</h2>
                          <Pastille ton={TON_STATUT[c.statut]} data-statut={c.statut}>{LIBELLE_STATUT[c.statut]}</Pastille>
                        </div>
                        <p className="text-[13px] text-[#c8c8cc] mt-1">
                          {[noms.sports[c.sportId], c.positionId ? noms.positions[c.positionId] : null, c.promotion ? `Promotion ${c.promotion}` : null].filter(Boolean).join(" · ")}
                        </p>
                        {lieu && <p className="text-[12px] text-[#9CA3AF] mt-0.5">{lieu}</p>}
                        <div className="flex items-center gap-3 flex-wrap mt-2">
                          {c.coteGlobale != null ? <Etoiles cote={c.coteGlobale} /> : <span className="text-[12px] text-[#6b7280]">Sans évaluation</span>}
                          {c.badgesPartenaire.length + c.badgesNexus.length > 0 && (
                            <span className="text-[12px] text-[#F59E0B]">
                              {c.badgesPartenaire.length + c.badgesNexus.length} badge{c.badgesPartenaire.length + c.badgesNexus.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        {c.statut === "CORRESPONDANCE_POSSIBLE" && (
                          <p className="text-[12px] text-[#F5C46B] mt-2 max-w-lg">
                            Un athlète déjà inscrit, qui accepte d&apos;être vu des partenaires, pourrait être ce jeune. Nexus lui a demandé de confirmer ; c&apos;est lui qui décide.
                          </p>
                        )}
                      </div>
                      <p className={`text-[12px] shrink-0 ${jours <= 7 ? "text-[#F59E0B]" : "text-[#6b7280]"}`}>
                        Expire le {dateCourte(c.expireLe)}{jours <= 7 ? ` (${jours} j)` : ""}
                      </p>
                    </div>

                    {conf ? (
                      <div className="mt-4 flex items-center gap-2 flex-wrap rounded-lg border border-[#E63946]/40 bg-[#13151a] px-3 py-2">
                        <span className="text-[13px] text-[#c8c8cc]">
                          {conf === "supprimer" ? "Supprimer cette carte ? Le lien cessera de fonctionner."
                            : conf === "revoquer" ? "Révoquer le lien ? Le jeune ne pourra plus l'ouvrir."
                            : "Créer un nouveau lien ? L'ancien cessera de fonctionner."}
                        </span>
                        <button type="button" disabled={occupe === c.id}
                          onClick={() => void (conf === "supprimer" ? supprimer(c.id) : conf === "revoquer" ? revoquer(c.id) : envoyer(c.id))}
                          className={classesBouton("principal", true)}>
                          Confirmer
                        </button>
                        <button type="button" onClick={() => setConfirmation(null)} className={classesBouton("discret", true)}>
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 flex items-center gap-2 flex-wrap">
                        <button type="button" disabled={occupe === c.id}
                          onClick={() => (lienEnvoye ? setConfirmation({ carteId: c.id, action: "nouveau-lien" }) : void envoyer(c.id))}
                          className={classesBouton("principal", true)}
                          data-action="envoyer">
                          {lienEnvoye ? "Nouveau lien" : "Envoyer par texto"}
                        </button>
                        <button type="button" disabled={occupe === c.id} onClick={() => setFormulaire({ carte: c })}
                          className={classesBouton("secondaire", true)}>
                          Modifier
                        </button>
                        {lienEnvoye && (
                          <button type="button" disabled={occupe === c.id} onClick={() => setConfirmation({ carteId: c.id, action: "revoquer" })}
                            className={classesBouton("secondaire", true)}>
                            Révoquer le lien
                          </button>
                        )}
                        <button type="button" disabled={occupe === c.id} onClick={() => setConfirmation({ carteId: c.id, action: "supprimer" })}
                          className={classesBouton("danger", true)}>
                          Supprimer
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <section className="mt-10" data-section-terminees>
            <h2 className="font-head text-[18px] font-black text-white uppercase tracking-tight">Terminées</h2>
            <p className="text-[12px] text-[#6b7280] mt-1">
              Une carte réclamée affiche le jeune tant qu&apos;il garde sa visibilité partenaire ; les autres issues restent sans nom.
            </p>
            {terminesTries.length === 0 ? (
              <p className="text-[13px] text-[#9CA3AF] mt-3">Aucune carte terminée.</p>
            ) : (
              <ul className={`mt-3 divide-y divide-white/[0.06] ${classesSurface()}`}>
                {terminesTries.map((t) => (
                  <li key={`${t.carteId}-${t.termineeLe}`} className="flex flex-col gap-2 px-4 py-3" data-terminee={t.issue}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <span className="text-[13px] text-white">
                        {t.issue === "RECLAMEE" && !t.profilVisible ? "Réclamée — profil non visible" : LIBELLE_ISSUE[t.issue]}
                        {t.profilVisible && t.athleteId && (
                          <Link href={`/partenaire/athletes/${t.athleteId}`} className="ml-2 text-[#E63946] underline underline-offset-2 text-[12px]">Voir sa fiche</Link>
                        )}
                      </span>
                      <span className="text-[12px] text-[#6b7280]">
                        Carte du {dateCourte(t.creeLe)} · terminée le {dateCourte(t.termineeLe)}
                      </span>
                    </div>
                    {t.profilVisible && (
                      <div className="rounded-lg bg-[#111317] border border-[#2D3748] px-3 py-2.5" data-reclamee-visible>
                        <p className="text-[14px] font-semibold text-white">{`${t.prenom ?? ""} ${t.nom ?? ""}`.trim()}</p>
                        <p className="text-[12px] text-[#9CA3AF]">
                          {[t.sport, t.poste, t.ecole].filter(Boolean).join(" · ") || "—"}
                        </p>
                        <p className="text-[12px] text-[#c8c8cc] mt-1.5">
                          {t.evaluation ? LIBELLE_EVALUATION_TRANSFERT[t.evaluation] ?? t.evaluation : "—"}
                        </p>
                        {t.badges.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {t.badges.map((b, i) => (
                              <li key={i} className="text-[12px]">
                                <span className={b.transfere ? "text-[#22C55E]" : "text-[#F59E0B]"}>
                                  {b.transfere ? "✓ Badge transféré" : "Badge sauté"}
                                </span>
                                <span className="text-white"> : {b.libelle ?? "—"}</span>
                                {!b.transfere && b.raison && (
                                  <span className="text-[#9CA3AF]"> ({LIBELLE_RAISON_BADGE[b.raison] ?? b.raison})</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {formulaire && (
        <FormulaireCarte
          sports={sportsPermis}
          carte={formulaire.carte}
          onClose={() => setFormulaire(null)}
          onEnregistree={(_id, nouvelle) => {
            setFormulaire(null);
            notifier("succes", nouvelle ? "Carte créée. Envoie-lui maintenant le lien." : "Carte enregistrée.");
            void charger();
          }}
        />
      )}
      {lien && partenaire && (
        <EnvoyerLien organisation={partenaire.organizationName} adresse={lien.adresse} evalue={lien.evalue}
          onClose={() => setLien(null)} />
      )}
    </div>
  );
}
