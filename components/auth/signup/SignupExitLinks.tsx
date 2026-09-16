import Link from "next/link";

/* ═══════════════════════════════════════════════════════════════
   SignupExitLinks — la porte de sortie sous un formulaire d'inscription.

   POURQUOI UN COMPOSANT, ET POURQUOI STATIQUE (2026-09-16)

   Les deux pages de réclamation (/claim, /parent/claim) n'avaient AUCUN
   lien sous leur formulaire : le bouton « Créer mon compte » était le
   dernier élément de la page. Un parent ou un athlète déjà inscrit qui
   arrivait par le courriel d'invitation n'avait littéralement nulle part
   où aller — sauf réessayer une inscription qui échouait.

   ⚠ CE COMPOSANT NE PREND AUCUNE CONDITION, ET C'EST LE POINT.
   La tentation naturelle est de n'afficher « Déjà inscrit ? » QUE
   lorsqu'on a détecté que le compte existe. Ce serait un oracle
   d'énumération : la présence du lien deviendrait la réponse à
   « est-ce que cette adresse a un compte ? », exactement ce que le
   message neutre de translateAuthError existe pour empêcher. Le lien
   s'affiche donc EN PERMANENCE, pour tout le monde, avant même que le
   formulaire soit rempli.

   Si quelqu'un veut un jour le rendre conditionnel : non. Relire ce
   paragraphe. Un lien permanent ne coûte rien ; un lien conditionnel
   annule la mesure anti-énumération de toute la surface signup.

   La destination `/mot-de-passe-oublie` est la page de DEMANDE de
   réinitialisation (celle qui appelle resetPasswordForEmail), pas
   `/auth/reinitialiser` qui est l'atterrissage du lien reçu par
   courriel. Libellé aligné sur `T.login.forgot`
   (lib/i18n/dictionaries.ts:1441).
   ═══════════════════════════════════════════════════════════════ */

export default function SignupExitLinks({ className = "" }: { className?: string }) {
  const lien = "font-bold text-white hover:text-[#E63946] transition-colors";
  return (
    <p className={`text-[12px] text-[#9CA3AF] text-center leading-snug ${className}`}>
      Déjà inscrit&nbsp;?{" "}
      <Link href="/auth" className={lien}>Connecte-toi</Link>
      <span className="mx-1.5 text-[#4a4d56]">·</span>
      <Link href="/mot-de-passe-oublie" className={lien}>Mot de passe oublié&nbsp;?</Link>
    </p>
  );
}
