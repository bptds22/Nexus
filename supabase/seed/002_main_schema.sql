-- ============================================================
-- NEXUS — Migration 002: Main Schema
-- Run AFTER 001_school_registry.sql
-- PostgreSQL 15 / Supabase
-- Generated from Nexus_Schema_Review_v16.xlsx
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'ADMIN',
  'COACH',
  'RECRUTEUR',
  'DIRECTEUR_SECONDAIRE',
  'DIRECTEUR_CEGEP',
  'ATHLETE'
);

CREATE TYPE account_status AS ENUM (
  'ACTIF',
  'DESACTIVE',
  'EN_ATTENTE'
);

CREATE TYPE verification_method AS ENUM (
  'auto',
  'manuel_coach',
  'manuel_directeur'
);

CREATE TYPE pipeline_status AS ENUM (
  'NONE',
  'IDENTIFIE',
  'CONTACTE',
  'EN_DISCUSSION',
  'VISITE_PLANIFIEE',
  'ENGAGE',
  'LETTRE_SIGNEE',
  'RETIRE'
);

CREATE TYPE coach_school_role AS ENUM (
  'ADMIN_COACH_INTERIM',
  'ADMIN_COACH',
  'COACH',
  'PENDING'
);

-- ============================================================
-- SIMPLE SCHOOLS TABLE
-- Used by athletes, coaches, recruiters, directors
-- school_registry (MEQ data) is separate — already created
-- ============================================================

CREATE TABLE schools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('SECONDAIRE', 'CEGEP')),
  region      TEXT,
  city        TEXT,
  address     TEXT,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SPORTS
-- ============================================================

CREATE TABLE sports (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        TEXT NOT NULL,
  categorie  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- POSITIONS (child of sports)
-- ============================================================

CREATE TABLE positions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id     UUID NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
  nom          TEXT NOT NULL,
  abreviation  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sport_id, nom)
);

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================

CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  role        user_role NOT NULL,
  status      account_status NOT NULL DEFAULT 'ACTIF',
  school_id   UUID REFERENCES schools(id) ON DELETE SET NULL,
  first_name  TEXT,
  last_name   TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LIGUES
-- ============================================================

CREATE TABLE ligues (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_id          UUID NOT NULL REFERENCES sports(id) ON DELETE RESTRICT,
  nom               TEXT NOT NULL,
  division          TEXT,
  categorie         TEXT,
  genre             TEXT,
  gestionnaire      TEXT,
  saison            TEXT,
  niveau_provincial BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EQUIPES
-- ============================================================

CREATE TABLE equipes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom        TEXT NOT NULL,
  school_id  UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  sport_id   UUID NOT NULL REFERENCES sports(id) ON DELETE RESTRICT,
  ligue_id   UUID REFERENCES ligues(id) ON DELETE SET NULL,
  categorie  TEXT,
  genre      TEXT,
  saison     TEXT,
  actif      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AMBASSADORS (created before subscriptions — FK dep)
-- ============================================================

CREATE TABLE ambassadors (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                    TEXT NOT NULL CHECK (type IN ('COACH', 'RECRUTEUR')),
  region_rseq             TEXT,
  referral_code           TEXT NOT NULL UNIQUE,
  status                  TEXT NOT NULL DEFAULT 'CANDIDAT'
                          CHECK (status IN ('CANDIDAT','ACTIF','CONFIRME','ELITE','INACTIF')),
  activated_at            TIMESTAMPTZ,
  elite_at                TIMESTAMPTZ,
  inactivated_at          TIMESTAMPTZ,
  free_months_earned      INTEGER NOT NULL DEFAULT 0,
  free_months_used        INTEGER NOT NULL DEFAULT 0,
  commission_rate         NUMERIC(4,2) NOT NULL DEFAULT 0.15,
  commission_balance_cents INTEGER NOT NULL DEFAULT 0,
  payout_threshold_cents  INTEGER NOT NULL DEFAULT 5000,
  stripe_connect_id       TEXT,
  stripe_connect_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ATHLETES (consent_id added via ALTER TABLE after parental_consents)
-- ============================================================

CREATE TABLE athletes (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID REFERENCES users(id) ON DELETE SET NULL,
  school_id                 UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  coach_id                  UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Info personnelle
  first_name                TEXT NOT NULL,
  last_name                 TEXT NOT NULL,
  date_naissance            DATE,
  genre                     TEXT,
  photo_url                 TEXT,
  email                     TEXT,
  telephone                 TEXT,
  nom_parent                TEXT,
  telephone_parent          TEXT,
  consentement_parental     BOOLEAN NOT NULL DEFAULT FALSE,
  consentement_parental_date TIMESTAMPTZ,
  annee_diplomation         INTEGER,

  -- Profil académique
  moyenne_generale          NUMERIC(5,2),
  matieres_fortes           JSONB DEFAULT '[]',
  mentions_academiques      JSONB DEFAULT '[]',
  programme_cegep_vise      JSONB DEFAULT '[]',
  ouvert_cegep_prive        BOOLEAN DEFAULT FALSE,
  ouvert_cegep_anglophone   BOOLEAN DEFAULT FALSE,
  pret_changer_region       BOOLEAN DEFAULT FALSE,
  regions_cegep_preferees   JSONB DEFAULT '[]',

  -- Profil physique
  taille_pieds              INTEGER,
  taille_pouces             INTEGER,
  poids_lbs                 NUMERIC(5,1),
  envergure                 TEXT,
  taille_mains              TEXT,
  main_dominante            TEXT,
  pied_dominant             TEXT,
  test_40_verges            TEXT,
  saut_vertical             TEXT,
  saut_longueur             TEXT,
  developpe_couche          TEXT,
  navette_agilite           TEXT,
  sprint_100m               TEXT,

  -- Infos sportives
  sport_id                  UUID REFERENCES sports(id) ON DELETE SET NULL,
  position_id               UUID REFERENCES positions(id) ON DELETE SET NULL,
  numero_jersey             TEXT,
  sport_secondaire_id       UUID REFERENCES sports(id) ON DELETE SET NULL,
  position_secondaire_id    UUID REFERENCES positions(id) ON DELETE SET NULL,
  equipe_id                 UUID REFERENCES equipes(id) ON DELETE SET NULL,
  ligue_id                  UUID REFERENCES ligues(id) ON DELETE SET NULL,
  numero_association        TEXT,
  ouvert_entraineur_cegep   BOOLEAN DEFAULT FALSE,

  -- Vidéo & Médias
  video_faits_saillants_url TEXT,
  hudl_url                  TEXT,
  youtube_url               TEXT,
  instagram_url             TEXT,
  video_match_complet_url   TEXT,
  video_entrainement_url    TEXT,

  -- Vérification (binary)
  verified                  BOOLEAN NOT NULL DEFAULT FALSE,
  verification_method       verification_method,
  verified_at               TIMESTAMPTZ,
  verified_by               UUID REFERENCES users(id) ON DELETE SET NULL,
  profile_completion        INTEGER NOT NULL DEFAULT 0,

  -- Évaluation simplifiée
  cote_globale_entraineur   NUMERIC(3,2),

  -- Status & meta
  status                    account_status NOT NULL DEFAULT 'ACTIF',
  notes_coach               TEXT,
  bio                       TEXT,
  programme_interet         TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PARENTAL CONSENTS (Loi 25)
-- ============================================================

CREATE TABLE parental_consents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id            UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  coach_id              UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  school_id             UUID NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,

  -- Attestation
  status                TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','ATTESTED','WITHDRAWN','EXPIRED')),
  attested_at           TIMESTAMPTZ,
  attestation_text      TEXT,
  school_year           TEXT NOT NULL,

  -- PDF
  pdf_template_version  TEXT,
  pdf_downloaded_at     TIMESTAMPTZ,
  pdf_upload_url        TEXT,

  -- Portée du consentement
  consent_profile_public BOOLEAN DEFAULT TRUE,
  consent_photo         BOOLEAN DEFAULT TRUE,
  consent_stats         BOOLEAN DEFAULT TRUE,
  consent_contact       BOOLEAN DEFAULT FALSE,

  -- Retrait
  withdrawn_at          TIMESTAMPTZ,
  withdrawn_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  withdrawal_reason     TEXT,

  -- Expiry
  expires_at            TIMESTAMPTZ,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (athlete_id, school_year)
);

-- Add consent_id FK to athletes (circular dep resolved here)
ALTER TABLE athletes
  ADD COLUMN consent_id UUID REFERENCES parental_consents(id) ON DELETE SET NULL;

-- ============================================================
-- CONSENT AUDIT TRAIL (append-only)
-- ============================================================

CREATE TABLE consent_audit_trail (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id      UUID NOT NULL REFERENCES parental_consents(id) ON DELETE CASCADE,
  athlete_id      UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  coach_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  action          TEXT NOT NULL
                  CHECK (action IN ('ATTESTED','WITHDRAWN','EXPIRED','PDF_DOWNLOADED','PDF_UPLOADED')),
  previous_status TEXT,
  new_status      TEXT,
  ip_address      TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
  -- Never updated — append only
);

-- ============================================================
-- EVALUATIONS (Coach evaluates Athlete — 8 criteria, 1-5 stars)
-- ============================================================

CREATE TABLE evaluations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  athlete_id          UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,

  -- 8 criteria (1-5 stars)
  leadership          INTEGER CHECK (leadership BETWEEN 1 AND 5),
  discipline          INTEGER CHECK (discipline BETWEEN 1 AND 5),
  coachabilite        INTEGER CHECK (coachabilite BETWEEN 1 AND 5),
  intelligence_jeu    INTEGER CHECK (intelligence_jeu BETWEEN 1 AND 5),
  competitivite       INTEGER CHECK (competitivite BETWEEN 1 AND 5),
  esprit_equipe       INTEGER CHECK (esprit_equipe BETWEEN 1 AND 5),
  resilience          INTEGER CHECK (resilience BETWEEN 1 AND 5),
  attitude_mentalite  INTEGER CHECK (attitude_mentalite BETWEEN 1 AND 5),

  -- Auto-computed average /5
  cote_globale        NUMERIC(3,2),

  distinctions        JSONB DEFAULT '[]',
  rapport_entraineur  TEXT CHECK (char_length(rapport_entraineur) <= 300),
  commentaires        TEXT,

  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (coach_id, athlete_id)
);

-- ============================================================
-- COACH REVIEWS (Recruiter evaluates Coach — 4 criteria, 1-5)
-- ============================================================

CREATE TABLE coach_reviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  coach_id              UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  athlete_id            UUID REFERENCES athletes(id) ON DELETE SET NULL,

  qualite_profils       INTEGER CHECK (qualite_profils BETWEEN 1 AND 5),
  reactivite            INTEGER CHECK (reactivite BETWEEN 1 AND 5),
  honnetete_evaluations INTEGER CHECK (honnetete_evaluations BETWEEN 1 AND 5),
  professionnalisme     INTEGER CHECK (professionnalisme BETWEEN 1 AND 5),

  note_globale          NUMERIC(3,2),
  recommande            BOOLEAN,
  commentaire           TEXT,
  reponse_coach         TEXT,
  reponse_at            TIMESTAMPTZ,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (recruiter_id, coach_id)
);

-- ============================================================
-- COACH BADGES
-- ============================================================

CREATE TABLE coach_badges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge      TEXT NOT NULL
             CHECK (badge IN ('EVALUE','RECOMMANDE','COACH_ELITE','PLACEUR')),
  earned_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (coach_id, badge)
);

-- ============================================================
-- PIPELINE (8 statuses)
-- ============================================================

CREATE TABLE pipeline (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  athlete_id    UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  status        pipeline_status NOT NULL DEFAULT 'NONE',
  favorited_at  TIMESTAMPTZ,
  contacted_at  TIMESTAMPTZ,
  engaged_at    TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (recruiter_id, athlete_id)
);

-- ============================================================
-- PROFILE VIEWS
-- ============================================================

CREATE TABLE profile_views (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  recruiter_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  cegep_id      UUID REFERENCES schools(id) ON DELETE SET NULL,
  region        TEXT,
  viewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CONVERSATIONS
-- ============================================================

CREATE TABLE conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id    UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  coach_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  athlete_id      UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  pipeline_id     UUID REFERENCES pipeline(id) ON DELETE SET NULL,
  status          TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ARCHIVE')),
  last_message_at TIMESTAMPTZ,
  unread_count    INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MESSAGES
-- ============================================================

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content         TEXT NOT NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ATHLETE SUGGESTIONS
-- ============================================================

CREATE TABLE athlete_suggestions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  coach_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  champ           TEXT NOT NULL,
  valeur_actuelle TEXT,
  valeur_proposee TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'EN_ATTENTE'
                  CHECK (status IN ('EN_ATTENTE','APPROUVEE','REJETEE')),
  raison_rejet    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at     TIMESTAMPTZ
);

-- ============================================================
-- REPORTS (Modération & Signalements)
-- ============================================================

CREATE TABLE reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type             TEXT NOT NULL CHECK (type IN ('PROFIL','MESSAGE','ABUS_CONTACT')),
  target_id        UUID,
  target_type      TEXT,
  reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reported_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  raison           TEXT NOT NULL,
  contenu_signale  TEXT,
  status           TEXT NOT NULL DEFAULT 'OUVERT'
                   CHECK (status IN ('OUVERT','EN_EXAMEN','RESOLU','REJETE')),
  action_prise     TEXT CHECK (action_prise IN ('AVERTISSEMENT','SUSPENSION','AUCUNE')),
  reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at      TIMESTAMPTZ,
  note_admin       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DELETION REQUESTS (Loi 25 — right to deletion)
-- ============================================================

CREATE TABLE deletion_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scope             TEXT NOT NULL
                    CHECK (scope IN ('FULL_ACCOUNT','MESSAGES_ONLY','PROFILE_DATA')),
  status            TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','REJECTED')),
  raison            TEXT,
  note_admin        TEXT,
  completed_at      TIMESTAMPTZ,
  completed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  retention_override BOOLEAN DEFAULT FALSE,
  retention_reason  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROSPECT LISTS
-- ============================================================

CREATE TABLE prospect_lists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nom           TEXT NOT NULL,
  description   TEXT CHECK (char_length(description) <= 200),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE prospect_list_athletes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id    UUID NOT NULL REFERENCES prospect_lists(id) ON DELETE CASCADE,
  athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ DEFAULT NOW(),
  note       TEXT,
  UNIQUE (list_id, athlete_id)
);

-- ============================================================
-- RECRUITER PREFERENCES (onboarding step 4)
-- ============================================================

CREATE TABLE recruiter_preferences (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport_id         UUID REFERENCES sports(id) ON DELETE SET NULL,
  position_ids     UUID[] DEFAULT '{}',
  divisions        TEXT[] DEFAULT '{}',
  regions_preferees TEXT[] DEFAULT '{}',
  graduation_years INTEGER[] DEFAULT '{}',
  moyenne_min      NUMERIC(5,2) DEFAULT 50.00,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (recruiter_id)
);

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

CREATE TABLE subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id      TEXT UNIQUE,
  stripe_subscription_id  TEXT UNIQUE,
  stripe_price_id         TEXT,
  tier                    TEXT NOT NULL DEFAULT 'free',
  status                  TEXT NOT NULL DEFAULT 'active',
  billing_cycle           TEXT CHECK (billing_cycle IN ('monthly','annual')),
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  trial_ends_at           TIMESTAMPTZ,
  cancel_at_period_end    BOOLEAN DEFAULT FALSE,
  canceled_at             TIMESTAMPTZ,
  referral_code           TEXT,
  ambassador_id           UUID REFERENCES ambassadors(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

-- ============================================================
-- REFERRALS
-- ============================================================

CREATE TABLE referrals (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id              UUID REFERENCES ambassadors(id) ON DELETE CASCADE,
  referred_user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code              TEXT NOT NULL,
  status                     TEXT NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING','ACTIVE','CONVERTED','EXPIRED')),
  signed_up_at               TIMESTAMPTZ DEFAULT NOW(),
  activated_at               TIMESTAMPTZ,
  converted_at               TIMESTAMPTZ,
  commission_rate            NUMERIC(4,2),
  commission_amount_cents    INTEGER,
  commission_paid_at         TIMESTAMPTZ,
  stripe_invoice_id          TEXT,
  commission_months_remaining INTEGER DEFAULT 12,
  created_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STRIPE WEBHOOK EVENTS (idempotency)
-- ============================================================

CREATE TABLE stripe_webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type      TEXT NOT NULL,
  payload         JSONB DEFAULT '{}',
  status          TEXT DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING','PROCESSED','FAILED','IGNORED')),
  error           TEXT,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUBSCRIPTION FEATURE FLAGS
-- ============================================================

-- Recruiter (free / starter / pro)
CREATE TABLE subscription_features_recruteur (
  tier                    TEXT PRIMARY KEY,
  can_see_athlete_name    BOOLEAN DEFAULT FALSE,
  can_see_athlete_photo   BOOLEAN DEFAULT FALSE,
  can_see_jersey_number   BOOLEAN DEFAULT FALSE,
  can_see_highlights      BOOLEAN DEFAULT FALSE,
  can_see_coach_comments  BOOLEAN DEFAULT FALSE,
  can_see_academic_full   BOOLEAN DEFAULT FALSE,
  can_see_detailed_profile BOOLEAN DEFAULT FALSE,
  can_see_recruitment_status BOOLEAN DEFAULT FALSE,
  can_see_who_viewed      BOOLEAN DEFAULT FALSE,
  max_favorites           INTEGER DEFAULT 10,
  max_search_results      INTEGER DEFAULT 10,
  coaches_per_team        INTEGER DEFAULT 1,
  pipeline_enabled        BOOLEAN DEFAULT FALSE,
  pipeline_statuses       TEXT[] DEFAULT '{}',
  can_send_messages       BOOLEAN DEFAULT FALSE,
  can_send_auto_message   BOOLEAN DEFAULT FALSE,
  has_full_inbox          BOOLEAN DEFAULT FALSE,
  has_activity_feed       BOOLEAN DEFAULT FALSE,
  has_athlete_trends      BOOLEAN DEFAULT FALSE,
  has_full_gestion_cegep  BOOLEAN DEFAULT FALSE,
  has_list_access         BOOLEAN DEFAULT FALSE
);

INSERT INTO subscription_features_recruteur VALUES
('free',
  FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE,
  10, 10, 1,
  FALSE, '{}',
  FALSE, FALSE, FALSE,
  FALSE, FALSE, FALSE, FALSE),
('starter',
  TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, FALSE, FALSE, FALSE,
  NULL, NULL, 1,
  TRUE, '{IDENTIFIE,CONTACTE}',
  TRUE, TRUE, FALSE,
  TRUE, FALSE, FALSE, FALSE),
('pro',
  TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
  NULL, NULL, NULL,
  TRUE, '{NONE,IDENTIFIE,CONTACTE,EN_DISCUSSION,VISITE_PLANIFIEE,ENGAGE,LETTRE_SIGNEE,RETIRE}',
  TRUE, FALSE, TRUE,
  TRUE, TRUE, TRUE, TRUE);

-- Coach (free / pro / all_star)
CREATE TABLE subscription_features_coach (
  tier                TEXT PRIMARY KEY,
  can_see_mon_ecole   BOOLEAN DEFAULT FALSE,
  can_see_stats_ecole BOOLEAN DEFAULT FALSE,
  can_see_placement   BOOLEAN DEFAULT FALSE,
  can_see_reputation  BOOLEAN DEFAULT FALSE,
  can_see_analytics   BOOLEAN DEFAULT FALSE,
  can_access_all      BOOLEAN DEFAULT FALSE,
  price_monthly_cents INTEGER DEFAULT 0,
  price_annual_cents  INTEGER DEFAULT 0
);

INSERT INTO subscription_features_coach VALUES
('free',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 0,    0),
('pro',     TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE, 599,  2999),
('all_star',TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  2999, 20000);

-- Athlete (free / pro / all_star Phase 2)
CREATE TABLE subscription_features_athlete (
  tier                       TEXT PRIMARY KEY,
  can_see_vus_count          BOOLEAN DEFAULT TRUE,
  can_see_vus_trend          BOOLEAN DEFAULT FALSE,
  can_see_likes_count        BOOLEAN DEFAULT TRUE,
  can_see_likes_trend        BOOLEAN DEFAULT FALSE,
  can_see_favorites_count    BOOLEAN DEFAULT TRUE,
  can_see_who_viewed         BOOLEAN DEFAULT FALSE,
  can_see_who_liked          BOOLEAN DEFAULT FALSE,
  can_see_who_favorited      BOOLEAN DEFAULT FALSE,
  can_search_programs        BOOLEAN DEFAULT FALSE,
  can_access_blog            BOOLEAN DEFAULT FALSE,
  can_use_interactive_map    BOOLEAN DEFAULT FALSE,
  can_see_cegep_selling      BOOLEAN DEFAULT FALSE,
  can_access_recruiting_guide BOOLEAN DEFAULT FALSE,
  price_monthly_cents        INTEGER DEFAULT 0,
  price_annual_cents         INTEGER DEFAULT 0
);

INSERT INTO subscription_features_athlete VALUES
('free',
  TRUE, FALSE, TRUE, FALSE, TRUE,
  FALSE, FALSE, FALSE,
  FALSE, FALSE, FALSE, FALSE, FALSE,
  0, 0),
('pro',
  TRUE, TRUE, TRUE, TRUE, TRUE,
  TRUE, TRUE, TRUE,
  FALSE, FALSE, FALSE, FALSE, FALSE,
  499, 0),
('all_star',
  TRUE, TRUE, TRUE, TRUE, TRUE,
  TRUE, TRUE, TRUE,
  TRUE, TRUE, TRUE, TRUE, TRUE,
  0, 0);

-- ============================================================
-- SCHOOL_REGISTRY additions
-- (school_registry table already created by 001_school_registry.sql)
-- Add director_id column
-- ============================================================

ALTER TABLE school_registry
  ADD COLUMN IF NOT EXISTS director_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================
-- SCHOOL COACHES (junction — school_registry + users)
-- ============================================================

CREATE TABLE school_coaches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES school_registry(id) ON DELETE CASCADE,
  coach_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        coach_school_role NOT NULL DEFAULT 'PENDING',
  sport       VARCHAR(100),
  team_name   VARCHAR(255),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (school_id, coach_id)
);

-- ============================================================
-- ACTIVITY FEED
-- ============================================================

CREATE TABLE activity_feed (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  school_id  UUID REFERENCES schools(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_users_school          ON users(school_id);
CREATE INDEX idx_users_role            ON users(role);
CREATE INDEX idx_athletes_school       ON athletes(school_id);
CREATE INDEX idx_athletes_coach        ON athletes(coach_id);
CREATE INDEX idx_athletes_verified     ON athletes(verified);
CREATE INDEX idx_athletes_sport        ON athletes(sport_id);
CREATE INDEX idx_athletes_status       ON athletes(status);
CREATE INDEX idx_athletes_completion   ON athletes(profile_completion);
CREATE INDEX idx_evaluations_athlete   ON evaluations(athlete_id);
CREATE INDEX idx_evaluations_coach     ON evaluations(coach_id);
CREATE INDEX idx_coach_reviews_coach   ON coach_reviews(coach_id);
CREATE INDEX idx_pipeline_recruiter    ON pipeline(recruiter_id);
CREATE INDEX idx_pipeline_athlete      ON pipeline(athlete_id);
CREATE INDEX idx_pipeline_status       ON pipeline(status);
CREATE INDEX idx_profile_views_athlete ON profile_views(athlete_id);
CREATE INDEX idx_profile_views_time    ON profile_views(viewed_at DESC);
CREATE INDEX idx_conversations_athlete ON conversations(athlete_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created      ON messages(created_at DESC);
CREATE INDEX idx_subscriptions_user    ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_tier    ON subscriptions(tier);
CREATE INDEX idx_activity_user         ON activity_feed(user_id);
CREATE INDEX idx_activity_created      ON activity_feed(created_at DESC);
CREATE INDEX idx_parental_consents_athlete ON parental_consents(athlete_id);
CREATE INDEX idx_prospect_list_recruiter   ON prospect_lists(recruiter_id);
CREATE INDEX idx_referrals_ambassador      ON referrals(ambassador_id);
CREATE INDEX idx_school_coaches_school     ON school_coaches(school_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at        BEFORE UPDATE ON users        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_athletes_updated_at     BEFORE UPDATE ON athletes     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_evaluations_updated_at  BEFORE UPDATE ON evaluations  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_coach_reviews_updated_at BEFORE UPDATE ON coach_reviews FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_pipeline_updated_at     BEFORE UPDATE ON pipeline     FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_equipes_updated_at      BEFORE UPDATE ON equipes      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_prospect_lists_updated_at BEFORE UPDATE ON prospect_lists FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_parental_consents_updated_at BEFORE UPDATE ON parental_consents FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_deletion_requests_updated_at BEFORE UPDATE ON deletion_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ambassadors_updated_at  BEFORE UPDATE ON ambassadors  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_reports_updated_at      BEFORE UPDATE ON reports      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-verify athlete at profile_completion >= 60%
CREATE OR REPLACE FUNCTION auto_verify_athlete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.profile_completion >= 60 AND (OLD.profile_completion < 60 OR OLD.verified = FALSE) THEN
    NEW.verified := TRUE;
    NEW.verification_method := 'auto';
    NEW.verified_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_verify
  BEFORE UPDATE OF profile_completion ON athletes
  FOR EACH ROW EXECUTE FUNCTION auto_verify_athlete();

-- Auto cote_globale on evaluations (avg of 8 criteria /5)
CREATE OR REPLACE FUNCTION calc_cote_globale()
RETURNS TRIGGER AS $$
DECLARE
  total   NUMERIC := 0;
  count   INTEGER := 0;
  criteria INTEGER[];
  c       INTEGER;
BEGIN
  criteria := ARRAY[NEW.leadership, NEW.discipline, NEW.coachabilite,
                    NEW.intelligence_jeu, NEW.competitivite, NEW.esprit_equipe,
                    NEW.resilience, NEW.attitude_mentalite];
  FOREACH c IN ARRAY criteria LOOP
    IF c IS NOT NULL THEN
      total := total + c;
      count := count + 1;
    END IF;
  END LOOP;
  IF count > 0 THEN
    NEW.cote_globale := ROUND(total::NUMERIC / count, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cote_globale
  BEFORE INSERT OR UPDATE ON evaluations
  FOR EACH ROW EXECUTE FUNCTION calc_cote_globale();

-- Auto note_globale on coach_reviews (avg of 4 criteria /5)
CREATE OR REPLACE FUNCTION calc_note_globale()
RETURNS TRIGGER AS $$
DECLARE
  total NUMERIC := 0;
  count INTEGER := 0;
  criteria INTEGER[];
  c     INTEGER;
BEGIN
  criteria := ARRAY[NEW.qualite_profils, NEW.reactivite,
                    NEW.honnetete_evaluations, NEW.professionnalisme];
  FOREACH c IN ARRAY criteria LOOP
    IF c IS NOT NULL THEN
      total := total + c;
      count := count + 1;
    END IF;
  END LOOP;
  IF count > 0 THEN
    NEW.note_globale := ROUND(total::NUMERIC / count, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_note_globale
  BEFORE INSERT OR UPDATE ON coach_reviews
  FOR EACH ROW EXECUTE FUNCTION calc_note_globale();

-- Auto-set pipeline to IDENTIFIE when favorited
CREATE OR REPLACE FUNCTION auto_pipeline_identifie()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.favorited_at IS NOT NULL AND OLD.favorited_at IS NULL THEN
    NEW.status := 'IDENTIFIE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pipeline_identifie
  BEFORE UPDATE OF favorited_at ON pipeline
  FOR EACH ROW EXECUTE FUNCTION auto_pipeline_identifie();

-- Auto-create free subscription on new user
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_subscription
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_default_subscription();

-- Director takeover — demote ADMIN_COACH_INTERIM to COACH
CREATE OR REPLACE FUNCTION director_takeover()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.director_id IS NOT NULL AND OLD.director_id IS NULL THEN
    UPDATE school_coaches
    SET role = 'COACH'
    WHERE school_id = NEW.id AND role = 'ADMIN_COACH_INTERIM';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_director_takeover
  AFTER UPDATE OF director_id ON school_registry
  FOR EACH ROW EXECUTE FUNCTION director_takeover();

-- First coach to claim school with no director → ADMIN_COACH_INTERIM
CREATE OR REPLACE FUNCTION first_coach_claim()
RETURNS TRIGGER AS $$
DECLARE
  v_director_id UUID;
  v_coach_count INTEGER;
BEGIN
  SELECT director_id INTO v_director_id
  FROM school_registry WHERE id = NEW.school_id;

  SELECT count(*) INTO v_coach_count
  FROM school_coaches
  WHERE school_id = NEW.school_id AND role != 'PENDING' AND id != NEW.id;

  IF v_director_id IS NULL AND v_coach_count = 0 THEN
    NEW.role := 'ADMIN_COACH_INTERIM';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_first_coach_claim
  BEFORE INSERT ON school_coaches
  FOR EACH ROW EXECUTE FUNCTION first_coach_claim();

-- Consent audit trail — auto-log every status change
CREATE OR REPLACE FUNCTION log_consent_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO consent_audit_trail
      (consent_id, athlete_id, action, previous_status, new_status)
    VALUES
      (NEW.id, NEW.athlete_id, NEW.status, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_consent_audit_log
  AFTER UPDATE OF status ON parental_consents
  FOR EACH ROW EXECUTE FUNCTION log_consent_change();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE athletes                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE schools                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sports                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ligues                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipes                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_reviews                ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_badges                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_views                ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations                ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE athlete_suggestions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_requests            ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_lists               ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospect_list_athletes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE parental_consents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_audit_trail          ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_preferences        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE ambassadors                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_coaches               ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed                ENABLE ROW LEVEL SECURITY;

-- Public reference tables (read by everyone)
CREATE POLICY "sports public read"    ON sports    FOR SELECT USING (true);
CREATE POLICY "positions public read" ON positions FOR SELECT USING (true);
CREATE POLICY "ligues public read"    ON ligues    FOR SELECT USING (true);
CREATE POLICY "schools public read"   ON schools   FOR SELECT USING (true);
CREATE POLICY "sub_features_recruteur public read" ON subscription_features_recruteur FOR SELECT USING (true);
CREATE POLICY "sub_features_coach public read"     ON subscription_features_coach     FOR SELECT USING (true);
CREATE POLICY "sub_features_athlete public read"   ON subscription_features_athlete   FOR SELECT USING (true);

-- Users read own record
CREATE POLICY "users read own" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "users update own" ON users FOR UPDATE USING (id = auth.uid());

-- Subscriptions — own record only
CREATE POLICY "subscriptions own" ON subscriptions FOR SELECT USING (user_id = auth.uid());

-- Athletes — verified only for recruiters (full RLS to be expanded in Migration 003)
CREATE POLICY "athletes read verified" ON athletes FOR SELECT USING (verified = TRUE OR coach_id = auth.uid());

-- Pipeline — own records
CREATE POLICY "pipeline own" ON pipeline FOR ALL USING (recruiter_id = auth.uid());

-- Evaluations — coach owns
CREATE POLICY "evaluations coach" ON evaluations FOR ALL USING (coach_id = auth.uid());

-- Prospect lists — own
CREATE POLICY "prospect_lists own" ON prospect_lists FOR ALL USING (recruiter_id = auth.uid());

-- Deletion requests — own
CREATE POLICY "deletion_requests own" ON deletion_requests FOR SELECT USING (user_id = auth.uid());

-- Recruiter preferences — own
CREATE POLICY "recruiter_preferences own" ON recruiter_preferences FOR ALL USING (recruiter_id = auth.uid());

-- Conversations — participants only
CREATE POLICY "conversations participants" ON conversations
  FOR SELECT USING (recruiter_id = auth.uid() OR coach_id = auth.uid());

-- Messages — via conversation
CREATE POLICY "messages participants" ON messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE recruiter_id = auth.uid() OR coach_id = auth.uid()
    )
  );

-- ============================================================
-- SEED DATA — Sports (matches web app exactly)
-- ============================================================

INSERT INTO sports (nom, categorie) VALUES
  ('Football',         'Collectif'),
  ('Basketball',       'Collectif'),
  ('Soccer',           'Collectif'),
  ('Hockey',           'Collectif'),
  ('Volleyball',       'Collectif'),
  ('Athlétisme',       'Individuel'),
  ('Flag football',    'Collectif'),
  ('Rugby',            'Collectif'),
  ('Cheerleading',     'Collectif'),
  ('Natation',         'Individuel'),
  ('Badminton',        'Individuel'),
  ('Cross-country',    'Individuel'),
  ('Futsal',           'Collectif'),
  ('Baseball',         'Collectif'),
  ('Ultimate frisbee', 'Collectif'),
  ('Autre',            'Autre');

-- ============================================================
-- SEED DATA — Positions
-- ============================================================

INSERT INTO positions (sport_id, nom, abreviation)
SELECT id, 'Quart-arrière',   'QB'  FROM sports WHERE nom = 'Football'
UNION ALL SELECT id, 'Demi offensif',  'RB'  FROM sports WHERE nom = 'Football'
UNION ALL SELECT id, 'Receveur',       'WR'  FROM sports WHERE nom = 'Football'
UNION ALL SELECT id, 'Bout rapproché', 'TE'  FROM sports WHERE nom = 'Football'
UNION ALL SELECT id, 'Ligne offensive','OL'  FROM sports WHERE nom = 'Football'
UNION ALL SELECT id, 'Ligne défensive','DL'  FROM sports WHERE nom = 'Football'
UNION ALL SELECT id, 'Secondeur',      'LB'  FROM sports WHERE nom = 'Football'
UNION ALL SELECT id, 'Demi défensif',  'DB'  FROM sports WHERE nom = 'Football'
UNION ALL SELECT id, 'Botteur',        'K'   FROM sports WHERE nom = 'Football'
UNION ALL SELECT id, 'Punter',         'P'   FROM sports WHERE nom = 'Football'
UNION ALL SELECT id, 'Meneur',         'PG'  FROM sports WHERE nom = 'Basketball'
UNION ALL SELECT id, 'Arrière',        'SG'  FROM sports WHERE nom = 'Basketball'
UNION ALL SELECT id, 'Petit ailier',   'SF'  FROM sports WHERE nom = 'Basketball'
UNION ALL SELECT id, 'Grand ailier',   'PF'  FROM sports WHERE nom = 'Basketball'
UNION ALL SELECT id, 'Centre',         'C'   FROM sports WHERE nom = 'Basketball'
UNION ALL SELECT id, 'Gardien',        'G'   FROM sports WHERE nom = 'Hockey'
UNION ALL SELECT id, 'Défenseur',      'D'   FROM sports WHERE nom = 'Hockey'
UNION ALL SELECT id, 'Ailier gauche',  'AG'  FROM sports WHERE nom = 'Hockey'
UNION ALL SELECT id, 'Ailier droit',   'AD'  FROM sports WHERE nom = 'Hockey'
UNION ALL SELECT id, 'Centre',         'C'   FROM sports WHERE nom = 'Hockey'
UNION ALL SELECT id, 'Passeur',        'PA'  FROM sports WHERE nom = 'Volleyball'
UNION ALL SELECT id, 'Libéro',         'L'   FROM sports WHERE nom = 'Volleyball'
UNION ALL SELECT id, 'Attaquant',      'AT'  FROM sports WHERE nom = 'Volleyball'
UNION ALL SELECT id, 'Réceptionneur',  'R'   FROM sports WHERE nom = 'Volleyball'
UNION ALL SELECT id, 'Pointu',         'PT'  FROM sports WHERE nom = 'Volleyball'
UNION ALL SELECT id, 'Central',        'CT'  FROM sports WHERE nom = 'Volleyball'
UNION ALL SELECT id, 'Gardien',        'GK'  FROM sports WHERE nom = 'Soccer'
UNION ALL SELECT id, 'Défenseur central','DC' FROM sports WHERE nom = 'Soccer'
UNION ALL SELECT id, 'Latéral',        'LAT' FROM sports WHERE nom = 'Soccer'
UNION ALL SELECT id, 'Milieu défensif','MD'  FROM sports WHERE nom = 'Soccer'
UNION ALL SELECT id, 'Milieu central', 'MC'  FROM sports WHERE nom = 'Soccer'
UNION ALL SELECT id, 'Ailier',         'AI'  FROM sports WHERE nom = 'Soccer'
UNION ALL SELECT id, 'Attaquant',      'AT'  FROM sports WHERE nom = 'Soccer'
UNION ALL SELECT id, 'Lanceur',        'P'   FROM sports WHERE nom = 'Baseball'
UNION ALL SELECT id, 'Receveur',       'C'   FROM sports WHERE nom = 'Baseball'
UNION ALL SELECT id, 'Premier but',    '1B'  FROM sports WHERE nom = 'Baseball'
UNION ALL SELECT id, 'Deuxième but',   '2B'  FROM sports WHERE nom = 'Baseball'
UNION ALL SELECT id, 'Troisième but',  '3B'  FROM sports WHERE nom = 'Baseball'
UNION ALL SELECT id, 'Arrêt-court',    'SS'  FROM sports WHERE nom = 'Baseball'
UNION ALL SELECT id, 'Voltigeur gauche','LF' FROM sports WHERE nom = 'Baseball'
UNION ALL SELECT id, 'Voltigeur centre','CF' FROM sports WHERE nom = 'Baseball'
UNION ALL SELECT id, 'Voltigeur droit', 'RF' FROM sports WHERE nom = 'Baseball';

-- ============================================================
-- VERIFY
-- ============================================================
-- Run this after migration to confirm:
-- SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT nom, categorie FROM sports ORDER BY categorie, nom;
-- SELECT count(*) FROM positions;
