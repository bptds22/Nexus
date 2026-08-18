/* ═══════════════════════════════════════════════════════════════
   content/legal/collecte-donnees.ts — iter 7.50-a-bis (legal-1)

   Collecte et traitement des données. Extrait de
   app/collecte-donnees/page.tsx avec NORMALISATION du modèle plat
   `{ content, bullets?, after? }` vers le Block model unifié, en
   préservant l'ORDRE et le SPACING ORIGINAL :

   - `content[]` → blocs `{ type: "p", text }` (mb-4 par défaut)
   - `bullets?[]` → bloc `{ type: "bullets", items }` (my-5)
   - `after?[]` → blocs `{ type: "p", text, trailing: true }` (mt-4)
     ← le flag `trailing` préserve le rendu byte-identique du
     fichier d'origine où les paragraphes after avaient mt-4 (et
     pas mb-4 comme les autres p).

   AUCUN mot du contenu n'a été changé / reformulé / ajouté. Vérif
   diff = 0 sur le texte.

   ⚠️ Contenu juridique : ne PAS modifier sans accord BP + counsel.
═══════════════════════════════════════════════════════════════ */

import type { Section } from "./types";

export const SECTIONS_COLLECTE_DONNEES: Section[] = [
  {
    id: "renseignements-collectes",
    title: "Renseignements collectés",
    blocks: [
      { type: "p", text: "Nexus recueille différentes catégories de renseignements personnels selon votre rôle sur la plateforme (athlète, entraîneur, recruteur, directeur). Voici le détail complet des données collectées :" },
      {
        type: "bullets",
        items: [
          "Identité : prénom, nom de famille, adresse courriel, mot de passe (haché), numéro de téléphone",
          "Profil athlète : date de naissance, genre, photo, année de diplomation, école secondaire, sport principal et secondaire, position, numéro de jersey",
          "Données académiques : moyenne générale, matières fortes, mentions académiques, programme CÉGEP visé, ouverture CÉGEP privé/anglophone, régions préférées",
          "Données physiques : taille, poids, envergure, taille des mains, main dominante, pied dominant",
          "Tests athlétiques : 40 verges, saut vertical, saut en longueur, développé couché, navette d'agilité, sprint 100m",
          "Médias : vidéos de faits saillants, liens Hudl/YouTube/Instagram, vidéo d'entraînement, vidéo de match complet",
          "Évaluations d'entraîneur : leadership, discipline, coachabilité, intelligence de jeu, compétitivité, esprit d'équipe, résilience, attitude/mentalité, cote globale, distinctions, rapport d'entraîneur",
          "Données de recrutement : statut de recrutement, favoris, notes de pipeline, étapes de recrutement, lettres d'intention",
          "Données parentales (mineurs) : nom du parent/tuteur, téléphone du parent, consentement parental et date",
          "Données d'utilisation : pages consultées, profils vus, messages envoyés, connexions, horodatages",
          "Données techniques : adresse IP, type de navigateur, système d'exploitation, résolution d'écran",
        ],
      },
    ],
  },
  {
    id: "finalite",
    title: "Finalités du traitement",
    blocks: [
      { type: "p", text: "Chaque donnée collectée répond à une finalité précise et légitime :" },
      {
        type: "bullets",
        items: [
          "Mise en relation : connecter les athlètes du secondaire avec les recruteurs CÉGEP via le réseau RSEQ",
          "Profils athlètes : permettre aux entraîneurs de créer des profils complets pour maximiser la visibilité des athlètes",
          "Recherche et filtrage : permettre aux recruteurs de trouver des athlètes selon leurs critères sportifs, académiques et physiques",
          "Évaluations : fournir aux recruteurs des évaluations d'entraîneurs fiables et vérifiées",
          "Communication : faciliter les échanges entre recruteurs et entraîneurs concernant les athlètes",
          "Pipeline de recrutement : permettre aux recruteurs de suivre l'avancement du recrutement de chaque athlète",
          "Vérification : assurer la fiabilité des profils via la vérification par les entraîneurs",
          "Statistiques : fournir aux entraîneurs et recruteurs des données analytiques sur l'engagement",
          "Sécurité : protéger la plateforme contre les utilisations frauduleuses et non autorisées",
          "Amélioration : analyser l'utilisation pour améliorer l'expérience utilisateur",
        ],
      },
    ],
  },
  {
    id: "base-juridique",
    title: "Base juridique du traitement",
    blocks: [
      { type: "p", text: "Conformément à la Loi 25 sur la protection des renseignements personnels du Québec, le traitement de vos données repose sur les bases juridiques suivantes :" },
      {
        type: "bullets",
        items: [
          "Consentement explicite : vous acceptez la collecte et le traitement de vos données lors de l'inscription. Ce consentement est libre, éclairé et spécifique",
          "Exécution du contrat : certaines données sont nécessaires pour fournir le service de recrutement sportif",
          "Intérêt légitime : les données d'utilisation et techniques sont collectées pour assurer la sécurité et améliorer le service",
          "Obligation légale : certaines données peuvent être conservées pour répondre à des exigences réglementaires",
        ],
      },
      { type: "p", trailing: true, text: "Le consentement parental est requis pour tout athlète mineur (14-17 ans). Un processus de notification parentale avec délai de réponse de 7 à 14 jours est en place." },
    ],
  },
  {
    id: "roles",
    title: "Données par rôle",
    blocks: [
      { type: "p", text: "Le niveau de données collectées varie selon votre rôle sur la plateforme :" },
      {
        type: "bullets",
        items: [
          "Athlète : profil complet (identité, académique, physique, sportif, médias). L'athlète peut s'inscrire directement avec données auto-déclarées, marquées « Non vérifié » jusqu'à validation par un entraîneur",
          "Entraîneur : identité, école/ligue, sport, évaluations d'athlètes. Les entraîneurs sont le canal de distribution principal et créent/gèrent les profils d'athlètes",
          "Recruteur : identité, CÉGEP, sport recruté, favoris, pipeline, notes, messages. Les recruteurs accèdent aux profils d'athlètes actifs uniquement",
          "Directeur : identité, institution (école ou CÉGEP), rôle administratif. Les directeurs sont des entraîneurs ou recruteurs avec des permissions d'administration supplémentaires",
        ],
      },
    ],
  },
  {
    id: "visibilite",
    title: "Visibilité des données",
    blocks: [
      { type: "p", text: "Nexus applique un contrôle strict sur qui peut voir quoi :" },
      {
        type: "bullets",
        items: [
          "Entraîneurs : voient et gèrent uniquement les athlètes de leur propre école ou équipe",
          "Recruteurs (gratuit) : voient les profils anonymisés — statistiques, école, sport et cote visibles, mais le nom, la photo, la position et le numéro de jersey sont masqués",
          "Recruteurs (payant) : accès complet aux profils d'athlètes actifs, incluant nom, photo, coordonnées de l'entraîneur pour contact",
          "Favoris, notes et pipeline : strictement privés à chaque recruteur. Aucun recruteur ne peut voir les listes d'un autre",
          "Directeurs : accès administratif aux données de leur propre institution uniquement",
          "Athlètes : ne voient pas qui les a consultés ni ajoutés en favoris (données privées recruteur)",
        ],
      },
      { type: "p", trailing: true, text: "Les politiques de sécurité au niveau des lignes (RLS) de la base de données garantissent techniquement ces restrictions d'accès." },
    ],
  },
  {
    id: "conservation",
    title: "Durée de conservation",
    blocks: [
      { type: "p", text: "Vos données personnelles sont conservées selon les règles suivantes :" },
      {
        type: "bullets",
        items: [
          "Compte actif : tant que votre compte est actif et que vous utilisez la plateforme",
          "Compte inactif : 24 mois après la dernière connexion, un avis de suppression est envoyé",
          "Profils archivés : conservés 3 ans maximum après archivage, puis supprimés définitivement",
          "Athlètes diplômés : profils conservés 2 ans après l'année de graduation prévue",
          "Données de recrutement : favoris, notes et pipeline supprimés avec le compte recruteur",
          "Logs techniques : conservés 12 mois pour la sécurité et le diagnostic",
          "Suppression volontaire : délai de grâce de 30 jours, puis suppression irréversible de toutes les données",
        ],
      },
    ],
  },
  {
    id: "hebergement",
    title: "Hébergement et résidence des données",
    blocks: [
      { type: "p", text: "Conformément aux exigences de la Loi 25, toutes les données personnelles sont hébergées au Québec :" },
      {
        type: "bullets",
        items: [
          "Serveur principal : Amazon Web Services, région Canada Central (ca-central-1), Montréal, Québec, Canada",
          "Base de données : Supabase (PostgreSQL) hébergé sur infrastructure Amazon Web Services au Québec",
          "Fichiers et médias : stockage Supabase Storage sur la même infrastructure",
          "Aucun transfert transfrontalier : vos données ne quittent pas le territoire canadien",
          "Sauvegardes : chiffrées et stockées dans la même région québécoise",
        ],
      },
      { type: "p", trailing: true, text: "Le déploiement de l'application web est assuré par Vercel, configuré sur la région de Montréal." },
    ],
  },
  {
    id: "securite",
    title: "Mesures de sécurité",
    blocks: [
      { type: "p", text: "Nexus applique des mesures techniques et organisationnelles robustes pour protéger vos données :" },
      {
        type: "bullets",
        items: [
          "Chiffrement en transit : toutes les communications utilisent HTTPS/TLS",
          "Chiffrement au repos : les données sont chiffrées dans la base de données",
          "Hachage des mots de passe : algorithme bcrypt avec salt unique par utilisateur",
          "Contrôle d'accès par rôle (RBAC) : chaque utilisateur n'accède qu'aux données autorisées pour son rôle",
          "Politiques RLS (Row-Level Security) : filtrage au niveau de la base de données, pas seulement de l'application",
          "Journaux d'audit : toutes les actions sensibles sont journalisées (consultations de profils, modifications, connexions)",
          "Authentification sécurisée : tokens JWT avec expiration, refresh tokens",
          "Validation côté serveur : toutes les entrées utilisateur sont validées et assainies",
        ],
      },
    ],
  },
  {
    id: "droits",
    title: "Exercer vos droits",
    blocks: [
      { type: "p", text: "Conformément à la Loi 25, vous disposez de droits sur vos données personnelles. Pour les exercer, contactez notre RPRP :" },
      {
        type: "bullets",
        items: [
          "Accès : demandez une copie complète de vos données à confidentialite@nexussports.ca",
          "Rectification : corrigez vos informations directement dans votre profil ou contactez-nous",
          "Suppression : demandez la suppression de votre compte via les paramètres ou par courriel",
          "Portabilité : demandez l'export de vos données en format JSON ou CSV",
          "Retrait du consentement : retirez votre consentement à tout moment (sauf consentements requis pour le service)",
        ],
      },
      { type: "p", trailing: true, text: "Responsable de la protection des renseignements personnels (RPRP) : Bruno-Philippe Desfossés Simard — confidentialite@nexussports.ca — 856 Basile-Routhier, Repentigny, Québec." },
      { type: "p", trailing: true, text: "Délai de réponse : 30 jours ouvrables maximum." },
    ],
  },
];
