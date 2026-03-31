-- ============================================================
-- NEXUS — School Registry Seed Migration
-- Supabase PostgreSQL
-- 
-- This migration creates the school_registry table and 
-- related structures for pre-seeding all Quebec schools.
-- Run BEFORE any coach/recruiter/athlete data.
-- ============================================================

-- ENUM for school type
CREATE TYPE school_type AS ENUM (
  'SECONDAIRE_PUBLIC',
  'SECONDAIRE_PRIVE',
  'CEGEP_PUBLIC',
  'CEGEP_PRIVE',
  'COLLEGE_GOUVERNEMENTAL',
  'UNIVERSITAIRE'
);

-- ENUM for school claim status
CREATE TYPE school_claim_status AS ENUM (
  'UNCLAIMED',        -- Pre-seeded, no coach has claimed it yet
  'CLAIMED_FREE',     -- Claimed by a coach, free tier (1 admin, 2 teams, 25 athletes)
  'CLAIMED_STANDARD', -- Paying Standard tier
  'CLAIMED_PREMIUM',  -- Paying Premium tier
  'CLAIMED_ENTERPRISE' -- Enterprise (CEGEP only)
);

-- ENUM for network type (réseau)
CREATE TYPE school_network AS ENUM (
  'PUBLIC_FR',        -- Public francophone
  'PUBLIC_EN',        -- Public anglophone
  'PUBLIC_SPECIAL',   -- Statut particulier (Crie, Kativik, Littoral)
  'PRIVE',            -- Privé
  'GOUVERNEMENTAL'    -- Gouvernemental
);

-- ============================================================
-- MAIN TABLE: school_registry
-- Pre-seeded from MEQ open data. Coaches JOIN schools, 
-- they don't CREATE them. This prevents duplicates.
-- ============================================================
CREATE TABLE school_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- MEQ identifiers (from the CSV)
  meq_code VARCHAR(10) NOT NULL UNIQUE,        -- CD_ORGNS or code organisme
  meq_css_code VARCHAR(10),                     -- CD_CS (centre de services scolaire)
  
  -- Core info
  name VARCHAR(255) NOT NULL,                   -- NOM_OFFCL (official name)
  name_normalized VARCHAR(255),                 -- Lowercase, accent-stripped for search
  school_type school_type NOT NULL,
  network school_network NOT NULL,
  
  -- Location
  address VARCHAR(500),                         -- ADRESSE
  city VARCHAR(100),                            -- VILLE
  postal_code VARCHAR(7),                       -- CD_POSTL
  region_admin VARCHAR(100),                    -- REGION_ADMIN
  latitude DECIMAL(10, 7),                      -- COORD_Y_LL84
  longitude DECIMAL(10, 7),                     -- COORD_X_LL84
  
  -- CSS / Commission scolaire
  css_name VARCHAR(255),                        -- NOM_CS
  css_type VARCHAR(50),                         -- TYPE_CS (Francophone, Anglophone, etc.)
  
  -- Contact
  phone VARCHAR(20),
  website VARCHAR(500),                         -- SITE_WEB
  
  -- Teaching levels (from ORDRE_ENS field)
  has_prescolaire BOOLEAN DEFAULT FALSE,
  has_primaire BOOLEAN DEFAULT FALSE,
  has_secondaire BOOLEAN DEFAULT FALSE,
  has_formation_pro BOOLEAN DEFAULT FALSE,
  has_collegial BOOLEAN DEFAULT FALSE,
  has_universitaire BOOLEAN DEFAULT FALSE,
  
  -- Nexus platform status
  claim_status school_claim_status DEFAULT 'UNCLAIMED',
  claimed_at TIMESTAMPTZ,
  claimed_by UUID,                              -- FK to profiles (admin coach)
  subscription_tier VARCHAR(50),
  subscription_expires_at TIMESTAMPTZ,
  
  -- Metadata
  meq_data_date DATE,                           -- DT_MAJ_GDUNO from CSV
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Soft delete
  status VARCHAR(20) DEFAULT 'ACTIVE'           -- ACTIVE, DESACTIVE
);

-- ============================================================
-- INDEXES for search performance
-- ============================================================
CREATE INDEX idx_school_registry_name_normalized ON school_registry (name_normalized);
CREATE INDEX idx_school_registry_type ON school_registry (school_type);
CREATE INDEX idx_school_registry_claim_status ON school_registry (claim_status);
CREATE INDEX idx_school_registry_city ON school_registry (city);
CREATE INDEX idx_school_registry_region ON school_registry (region_admin);
CREATE INDEX idx_school_registry_css ON school_registry (meq_css_code);
CREATE INDEX idx_school_registry_secondaire ON school_registry (has_secondaire) WHERE has_secondaire = TRUE;
CREATE INDEX idx_school_registry_collegial ON school_registry (has_collegial) WHERE has_collegial = TRUE;

-- Full text search index for coach signup search
CREATE INDEX idx_school_registry_fts ON school_registry 
  USING GIN (to_tsvector('french', coalesce(name, '') || ' ' || coalesce(city, '') || ' ' || coalesce(css_name, '')));

-- ============================================================
-- COACH-SCHOOL relationship (replaces school creation by coach)
-- ============================================================
CREATE TYPE coach_school_role AS ENUM (
  'ADMIN_COACH',      -- First coach to claim, or designated by director
  'COACH',            -- Approved coach member
  'PENDING'           -- Requested to join, awaiting admin approval
);

CREATE TABLE school_coaches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES school_registry(id),
  coach_id UUID NOT NULL,  -- FK to profiles
  role coach_school_role NOT NULL DEFAULT 'PENDING',
  sport VARCHAR(100),
  team_name VARCHAR(255),
  approved_at TIMESTAMPTZ,
  approved_by UUID,        -- FK to profiles (admin coach or director)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(school_id, coach_id)  -- A coach belongs to a school only once
);

CREATE INDEX idx_school_coaches_school ON school_coaches (school_id);
CREATE INDEX idx_school_coaches_coach ON school_coaches (coach_id);

-- ============================================================
-- RLS (Row Level Security) policies for Supabase
-- ============================================================
ALTER TABLE school_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_coaches ENABLE ROW LEVEL SECURITY;

-- Anyone can read the school registry (it's public data)
CREATE POLICY "School registry is publicly readable" 
  ON school_registry FOR SELECT 
  USING (true);

-- Only admin can update school claim status
CREATE POLICY "Admin coaches can update their school" 
  ON school_registry FOR UPDATE 
  USING (claimed_by = auth.uid());

-- Coaches can read their school's coaches
CREATE POLICY "School coaches readable by members" 
  ON school_coaches FOR SELECT 
  USING (
    school_id IN (
      SELECT school_id FROM school_coaches WHERE coach_id = auth.uid()
    )
  );

-- Admin coaches can approve/reject join requests
CREATE POLICY "Admin coaches can manage members" 
  ON school_coaches FOR UPDATE 
  USING (
    school_id IN (
      SELECT school_id FROM school_coaches 
      WHERE coach_id = auth.uid() AND role = 'ADMIN_COACH'
    )
  );

-- ============================================================
-- HELPER FUNCTION: normalize school name for search
-- ============================================================
CREATE OR REPLACE FUNCTION normalize_school_name(name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    translate(
      name,
      'àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ',
      'aaaeeeeiioouuyccaaaeeeeiioouuycc'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Auto-populate name_normalized on insert/update
CREATE OR REPLACE FUNCTION update_name_normalized()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name_normalized := normalize_school_name(NEW.name);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_school_name_normalized
  BEFORE INSERT OR UPDATE ON school_registry
  FOR EACH ROW EXECUTE FUNCTION update_name_normalized();
