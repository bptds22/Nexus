# CLAUDE.md — Nexus (Recruitment Platform) Coding Rules

This file contains non-negotiable rules for Claude while building Nexus.
Follow these instructions exactly.

---

## STRICT DESIGN RULES — NEVER OVERRIDE

### Backgrounds
- Page background: #111317 — everywhere, every portal, every page
- Card / Surface: #1A1D24 — all cards, modals, sidebar, dropdowns
- Card border: border-white/5 (#FFFFFF0D) — subtle, consistent
- Never white, never pure black, never any other dark color

### Accent Colors (only 3 primary accents)
- Red #E63946: Nexus brand — CTAs, favorite hearts, sidebar active,
  commitment-phase pipeline (EN_DISCUSSION, VISITE, ENGAGÉ, LETTRE),
  suspended status, labels on landing pages, Admin badge, Recruteur badge
- Blue #3B82F6: verification ONLY — verified badge (≥60%), profile
  completion ≥70%, Coach role badge, École revenue chart
- Green #22C55E: positive status — active user pill, Athlète role badge,
  CÉGEP revenue chart, success toasts
- #EF4444: ONLY for error/critical alerts, profile completion <40%,
  Entreprise tier badge. Nowhere else.

### Two Reds Rule
- #E63946 = brand red (95% of all red usage)
- #EF4444 = error/danger red (5% — critical alerts, completion <40%,
  Entreprise tier ONLY)
- Default is ALWAYS #E63946. Use #EF4444 only for the 3 cases above.

### Verification Badge
- Verified (profile_completeness ≥ 60%): Blue checkmark #3B82F6. Always.
- Not verified (< 60%): Gray circle #6B7280. Always.
- Binary — NO intermediate states.

### Favorite Heart
- Favorited: Filled heart #E63946. Always.
- Not favorited: Outline heart #6B7280. Always.

### Star Ratings
- Filled stars: #F59E0B (gold/amber). Always.
- Empty stars: #374151 dark gray fill with #F59E0B star-shaped outline.

### Pipeline Status Badges (2 AUTO + 4 MANUAL)

Auto-tracking statuses (gray #6B7280 — triggered by actions):
- IDENTIFIE: gray — auto on favorite
- CONTACTE: gray — auto on first message sent

Commitment statuses (red #E63946 — manual recruiter decision):
- EN_DISCUSSION: red — recruiter manually sets "actively pursuing"
- VISITE_PLANIFIEE: red — manual
- ENGAGE: red — manual
- LETTRE_SIGNEE: red — manual

Withdrawn:
- RETIRE: gray #6B7280 — can be set from any status, final state

Movement rules:
- Forward only EXCEPT: EN_DISCUSSION can go back to CONTACTÉ
  (re-engage a cold conversation). No other backward movement.
- Auto-triggers (favorite → IDENTIFIÉ, message → CONTACTÉ) do NOT
  override manual statuses.
- Cards in LETTRE_SIGNÉE can only go to RETIRÉ.
- Cards in RETIRÉ cannot move anywhere.

### User Status Pills
- Actif: green #22C55E bg/10, green text
- En attente: yellow #EAB308 bg/10, yellow text
- Suspendu: red #E63946 bg/10, red text
- Inactif / Expiré: gray #6B7280 bg/10, gray text

### Role Badges
- Admin: #E63946 (red)
- Coach: #3B82F6 (blue)
- Recruteur: #E63946 (red)
- Directeur: #EAB308 (yellow/amber)
- Athlète: #22C55E (green)

### Profile Completeness Colors
- < 40%: #EF4444 (bright red — incomplete)
- 40% — 69%: #6B7280 (gray — in progress)
- ≥ 70%: #3B82F6 (blue — ready)
Both progress bar fill AND percentage text use these colors.

### Subscription Tier Badges (Medal System)
- Gratuit / Découverte / Essentiel: Bronze #A48261
- Standard / Pro: Silver #B4BCC8
- Premium / Élite: Gold #DAB65A
- Entreprise: #EF4444

### Revenue Chart Colors
- CÉGEP revenue: #E63946 (red)
- École revenue: #3B82F6 (blue)
- Athlète revenue (Phase 2): #22C55E (green)

### Text Colors
- Headings: #FFFFFF (white)
- Body text: #9CA3AF (muted gray)
- Red labels (landing pages): #E63946, uppercase, 12px, letter-spacing 2px
- Muted / disabled: #6B7280

### Alert Indicators
- Info: #9CA3AF (gray)
- Warning: #EAB308 (yellow)
- Critical / Error: #EF4444 (bright red)
- Success: #22C55E (green)

### Typography (NO EXCEPTIONS)
- ALL headings: Nexa Bold
- ALL body text: Nexa Regular
- NEVER Inter, Montserrat, Arial, or any system font
- If Nexa is not loaded, the component is broken — fix the font import

### Card Style
- Background: #1A1D24
- Border: border-white/5
- Radius: rounded-xl

---

## Always Do First (every session)

1. Ask: **“What phase are we in (Phase 1 MVP or Phase 2)?”** Default to **Phase 1 MVP**.
2. Confirm: **Tech stack** + **DB provider** (default: Next.js + Supabase Postgres).
3. Confirm: **Which app area** we’re working on:
   - Database schema / RLS
   - Auth + roles
   - Coach portal
   - Director portal
   - Recruiter portal
   - Admin approval
4. Output changes as:
   - ✅ files to create/edit
   - ✅ exact code blocks for each file
   - ✅ commands to run
   - ✅ what to test manually
5. Invoke the 'frontend-Design' /skill before writting any frontend code, every session, no exceptions.

Do not generate large features without completing the above checklist.

---

## Project Summary

**Nexus** is a web recruiting platform for Quebec:
- **Coaches** submit “top recruits” (athlete profiles)
- **Directors** manage their organization (coaches/recruiters + oversight)
- **Recruiters (CEGEP)** search/filter athletes and send contact requests
- **Platform Admin** approves profiles and manages reference data (sports/divisions/etc.)
- **Athlete role** exists as a profile in Phase 1; becomes real authenticated users in Phase 2

Phase 1 goals:
- Structured athlete database
- Approvals workflow
- Search + filters
- Favorites + contact requests
- External links only (Hudl/YouTube). **NO uploads.**

---

## Non-Negotiable MVP Rules

### Media
- ✅ Only external links (Hudl, YouTube, other URL).
- ❌ No file uploads.
- ❌ No images/documents storage.
- Do not create storage buckets in MVP.

### Privacy
- Athletes are minors: minimize sensitive data.
- ✅ Do NOT store DOB in Phase 1.
- Recruiters should not automatically see private personal contact info.
- Use **Contact Requests** as the controlled workflow.

### Data Integrity
- No duplicated “division/age group” fields in `teams`.
- Division + age group must be tied to a **competition context** (season-based).

---

## Roles (RBAC)

### Global Role
- `platform_admin`: full access to platform operations.

### Organization Roles
- `director`: org admin for their high school/CEGEP
- `coach`: manages athlete data for their org
- `recruiter`: searches + favorites + contact requests
- `athlete` (Phase 1: no login) → Phase 2: authenticated user who can manage their profile

### Key Permission Rules
- Coaches can only create/manage data within their organization.
- Directors can manage all users in their organization (invite/disable).
- Recruiters can only browse **approved** profiles.
- Platform admin can approve/reject any profile and manage reference tables.

---

## Tech Stack Defaults (unless user overrides)

- Next.js (App Router) + TypeScript
- TailwindCSS
- Supabase (Postgres + Auth) OR Clerk + Supabase DB
- Zod for validation
- React Hook Form for forms
- TanStack Query optional (only if needed)

---

## Database Model (Phase 1)

### Sports Structure (Season-Based)

#### sports
- id (uuid pk), name, created_by, created_at

#### divisions
- id, sport_id, code (D1), label (Division 1), created_by, created_at

#### age_groups
- id, sport_id, code (cadet/juvenile/u16), label, created_by, created_at

#### competitions
Represents “league bucket” like Soccer / Juvenile / D1 / 2025
- id, sport_id, season_year, age_group_id, division_id, league_name, created_by, created_at

#### teams
Represents actual school team entity (Team A / Team B)
- id, organization_id, sport_id, team_name, created_by, created_at

#### team_competition_entries
Links a team to a competition for that season
- id, team_id, competition_id, squad_label, created_by, created_at
Constraints:
- UNIQUE(team_id, competition_id)

---

### Athletes

#### athletes
Stable identity (no DOB in Phase 1)
- id, first_name, last_name, grad_year
- height_cm, weight_kg
- primary_position, secondary_position
- handedness (left/right/both)
- hometown_city, hometown_region
- created_at, updated_at

#### athlete_team_profiles
Recruiting card per season/team context
- id, athlete_id, team_competition_entry_id
- coach_owner_user_id
- recruiting_level (D1/D2/D3/unknown)
- status (draft/pending_approval/approved/rejected/archived)
- jersey_number, bio, coach_notes
- created_at, updated_at
Constraints:
- UNIQUE(athlete_id, team_competition_entry_id)

#### athlete_metrics
Flexible stats per sport
- id, athlete_team_profile_id
- key, value, unit, source, created_at
Constraints:
- UNIQUE(athlete_team_profile_id, key)

#### athlete_links (external only)
- id, athlete_team_profile_id
- type (hudl/youtube/other)
- url, title, created_at

---

### Recruiter Actions

#### favorites
- id, user_id, athlete_team_profile_id, created_at
Constraints:
- UNIQUE(user_id, athlete_team_profile_id)

#### contact_requests
- id, requester_user_id, athlete_team_profile_id
- message, status (open/approved/declined/closed)
- created_at, updated_at

---

## App Screens (Phase 1 MVP)

### Coach
- Create team
- Create athlete
- Create athlete profile (recruiting card)
- Add metrics + links
- Submit for approval

### Director (Org Admin)
- Invite/disable coaches (high school org)
- Invite/disable recruiters (cegep org)
- Org overview dashboard (basic counts)

### Recruiter
- Search/filter athletes (approved only)
- View athlete profile
- Favorite
- Send contact request

### Platform Admin
- Approve/reject athlete_team_profiles
- Manage sports/divisions/age_groups/competitions

---

## Implementation Order (do not skip)

1. DB schema + constraints
2. Auth + roles + org membership
3. RLS policies (Supabase) or server authorization checks
4. Admin approval workflow
5. Coach portal (create/submit)
6. Recruiter search + filters + favorites
7. Contact requests workflow
8. Director org admin pages

---

## DATA FLOW RULE: Coach Input → Recruiter Display

The coach's form mode (Simplifié/Détaillé) controls **DATA ENTRY** depth.
The recruiter's toggle (Simplifié/Détaillé) controls **DATA DISPLAY** depth.
These are **INDEPENDENT**.

### Simplified recruiter view ALWAYS benefits from detailed coach input:
- 8 trait criteria → condensed to 1 **Cote Globale** (auto-calculated average)
- Full mensurations → condensed to **taille + poids** only
- All academic fields → condensed to **moyenne + programme + graduation** + preference pills
- All media links → condensed to **1 CTA button** (if highlight video exists)
- Full sport info → condensed to sport + position on the player card (no separate section)
- Coach report → **quote + Cote Globale stars** only

### Detailed recruiter view shows EVERYTHING the coach entered:
- All 8 trait criteria individually with stars
- Full mensurations grid + all athletic tests
- Matières fortes, honneurs, régions préférées, programme CÉGEP visé
- All media link cards (Hudl, YouTube, Instagram, match complet, entraînement)
- Sport info section with secondary sport, team, league
- Coach reputation mini-card

### Empty field handling:
If a field is empty (coach used simplified), show **nothing** — no empty state,
no placeholder, just skip that field cleanly.

### Section-by-section breakdown:

**Évaluation du coach**
- Coach detailed → 8 individual star criteria
- Recruiter simplified → 1 Cote Globale (average of 8) with stars
- Recruiter detailed → all 8 criteria individually with stars
- Coach simplified (overall rating only) → both views show same single score, no breakdown

**Profil physique**
- Coach detailed → taille, poids, envergure, taille des mains, main/pied dominants + 6 athletic tests
- Recruiter simplified → only taille + poids (e.g. 6'2" | 195 lbs)
- Recruiter detailed → full mensurations grid + all tests with progress bars
- Coach simplified (taille + poids only) → simplified same, detailed shows taille/poids + "Aucun test athlétique enregistré"

**Profil académique**
- Coach detailed → moyenne, matières fortes, mentions, programme visé, ouvert privé/anglophone/déménager, régions préférées
- Recruiter simplified → 82% | Sport-études | Juin 2026 + preference tags
- Recruiter detailed → everything: matières fortes chips, mentions, régions préférées checkboxes
- Coach simplified (moyenne + programme only) → simplified shows 3 stats, detailed shows those + empty states for rest

**Informations sportives**
- Coach detailed → sport principal, position, numéro, sport secondaire, position secondaire, équipe/ligue
- Recruiter simplified → sport + position + numéro already on the player card, no separate section
- Recruiter detailed → full section with secondary sport, team name, league
- Coach simplified (sport + position + numéro only) → same card, detailed shows no secondary sport

**Médias**
- Coach detailed → highlight video + Hudl + YouTube + Instagram + match complet + entraînement
- Recruiter simplified → only ▶ VOIR LES FAITS SAILLANTS CTA button (if highlight video exists)
- Recruiter detailed → embedded player + all link cards
- Coach simplified (highlight video only) → simplified CTA button, detailed shows player + no additional links

**Rapport de l'entraîneur**
- Coach detailed → 8 star criteria + distinctions + texte libre
- Recruiter simplified → texte libre quote + Cote Globale stars only
- Recruiter detailed → quote + full 8-criteria grid + distinctions
- Coach simplified (texte libre + overall rating only) → both views show quote + score, no breakdown

---

## Coding Standards

- Use TypeScript everywhere.
- Use Zod schema validation at boundaries (forms + API).
- Keep database access server-side only.
- No client-side secrets or service role keys.
- Prefer simple, explicit code over abstractions.

Folder suggestions:
- `app/` routes
- `lib/` (db client, auth helpers, rbac helpers)
- `db/` (migrations, schema notes)
- `components/` reusable UI
- `types/` shared TS types
- `constants/` enums and lists

---

## Output Format Requirements (for Claude responses)

When generating code, always provide:

1. **Files changed**
2. **Code blocks per file** (complete file content if new, patch if existing)
3. **Commands to run**
4. **Manual test steps**
5. **Notes/assumptions**

Do not include vague steps. Be concrete.

---
---

## UI / UX Design System (Match Reference Screens)

Goal: **Very clean, SportsRecruits-inspired** layout.
If screenshots/reference are provided, **match layout, spacing, typography, and color closely**. Do not “improve” the design. Use placeholder content where needed.

### Core Layout Colors
- App Background: var(--wl-bg)
- Card / Surface Background: var(--wl-surface-2)
- Secondary Surface: var(--wl-surface)
- Primary Text: var(--wl-text)
- Secondary Text: var(--wl-text-muted)
- Borders / Dividers: var(--wl-border)

### Brand Colors
- Primary Brand Color: var(--wl-red-500)
- Dark Brand Base (nav / footer): var(--wl-charcoal-900)

### Semantic Colors
- Success: var(--wl-success)
- Info / Highlight: var(--wl-info)
- Warning: var(--wl-warning)
- Error: var(--wl-error)

---

## Chips / Pills

Selected Chip
- Background: var(--wl-red-500)
- Text: #FFFFFF
- Border radius: var(--wl-radius-pill)

Unselected Chip
- Background: transparent
- Border: var(--wl-border)
- Text: var(--wl-text)

---

## Typography

Font Families
- Body: var(--wl-font-sans)
- Headings: var(--wl-font-head)

Font Sizes
- H1: var(--wl-h1)
- H2: var(--wl-h2)
- H3: var(--wl-h3)
- Body: var(--wl-body)
- Caption: var(--wl-caption)

Font Weights
- Regular: var(--wl-weight-regular)
- Medium: var(--wl-weight-medium)
- Semibold: var(--wl-weight-semibold)
- Bold: var(--wl-weight-bold)

---

## Spacing System

Use the 8-point grid system.

Spacing tokens:

- var(--wl-space-1) → 8px
- var(--wl-space-2) → 16px
- var(--wl-space-3) → 24px
- var(--wl-space-4) → 32px
- var(--wl-space-5) → 48px
- var(--wl-space-6) → 64px

Standard Usage
- Card padding: var(--wl-space-2) to var(--wl-space-3)
- Section spacing: var(--wl-space-3)
- Page margins: var(--wl-space-4)

---

## Border Radius

Use WeLead radius tokens:

- Small components: var(--wl-radius-sm)
- Cards / containers: var(--wl-radius-lg)
- Pills / chips: var(--wl-radius-pill)

---

## Shadows

- Cards: var(--wl-shadow-sm)
- Elevated panels / modals: var(--wl-shadow-md)

Avoid heavy shadows.

---

## Buttons

Primary Button
- Background: var(--wl-btn-primary-bg)
- Text: var(--wl-btn-primary-fg)
- Hover: var(--wl-btn-primary-hover)
- Height: var(--wl-btn-height)
- Padding X: var(--wl-btn-padding-x)
- Font: var(--wl-btn-font)
- Radius: var(--wl-radius-sm)

Secondary Button
- Background: var(--wl-btn-secondary-bg)
- Text: var(--wl-btn-secondary-fg)
- Border: var(--wl-btn-secondary-border)

Ghost Button
- Background: var(--wl-btn-ghost-bg)
- Text: var(--wl-btn-ghost-fg)
- Border: var(--wl-btn-ghost-border)

---

## Focus & Glow

- Focus ring: var(--wl-focus-ring)
- Accent glow: var(--wl-glow-red)

Apply only on:
- active cards
- hover states
- selected items

Avoid overuse.

---

## Icons

- Use simple line icons
- Consistent stroke width
- Minimal color usage
- Prefer var(--wl-text-muted) or var(--wl-text)

---

## UI Component Rules

Cards
- Background: var(--wl-surface-2)
- Border radius: var(--wl-radius-lg)
- Shadow: var(--wl-shadow-sm)
- Padding: var(--wl-space-2) to var(--wl-space-3)

Tabs
- Active indicator: var(--wl-red-500)
- Text: var(--wl-text)

Checkboxes
- Align to right side in filter lists
- Use brand red for checked state

---

## Layout Philosophy

Design should feel:
- Elite sports performance
- Modern SaaS
- Clean grid-based layout
- Structured information hierarchy

Key design principles:
- Strong whitespace
- Clear card grouping
- Minimal clutter
- High readability

---

## Reference-First Implementation Rule

When implementing UI:

1. Create layout structure first (top navigation / sidebar / main content)
2. Implement grid and spacing system using WeLead spacing tokens
3. Build reusable card components
4. Implement filters, chips, and buttons
5. Connect real data last

If no reference image is available for a screen, keep the same design language (clean cards, left filters, top dark nav, blue + green accents).

---

## Official Design Patterns

### Settings Page with Sub-Navigation

**Reference file:** `app/admin/settings/page.tsx`
**When to use:** Any page with multiple configuration sections (settings, preferences, parameters).

**Structure:**
```
Page header (title + subtitle)
├── Left sub-nav (lg:w-[240px])
│   └── Buttons: icon + label, red active state (bg-[#E63946]/12 text-[#E63946])
│   └── Horizontal scroll on mobile, vertical stack on desktop
└── Content panel (flex-1)
    └── bg-[#111317]/60 backdrop-blur-sm rounded-xl border border-[#1e2128] p-6 sm:p-8
    └── Section-based rendering (useState, no routing)
```

**Specs:**
- Nav button active: `bg-[#E63946]/12 text-[#E63946]`, icon matches
- Nav button idle: `text-[#8a8d96] hover:text-white hover:bg-white/5`
- Label class: `text-[12px] font-bold tracking-[0.25em] uppercase text-[#6b7280]`
- Input class: `bg-[#13151a] border border-[#2a2d36] rounded-lg px-4 py-2.5 text-[14px] text-[#e0e0e0] focus:border-[#E63946]`
- Rule cards: green dot indicator (w-2 h-2 bg-[#22C55E]) left + label + badge/value right
- Toggle switches: `w-12 h-7 rounded-full` with `w-5 h-5` white circle, green (#22C55E) for on, gray (#2D3748) for off
- Danger sections: `border-[#E63946]/30` border, red title text
- Save buttons: `bg-[#E63946] hover:bg-[#D42B22] text-white font-bold rounded-lg`
- Responsive: `flex flex-col lg:flex-row gap-8`

**Brand red:** Always use `#E63946` for the active nav state and accent color across all settings pages.

**Existing pages using this pattern:**
- `app/admin/settings/page.tsx` ← canonical reference
- `app/coach/settings/page.tsx`
- `app/recruteur/parametres/page.tsx`
- `app/directeur-ecole/parametres/page.tsx`
- `app/directeur-cegep/parametres/page.tsx`

---

## Coach Portal Structure (School Side)

### Director École Merger
- The Director École portal no longer exists as a separate portal
- Director features are PRO features inside the Coach portal at /coach/ecole/*
- PRO features are unlocked by: Coach Pro subscription ($14.99/mo) OR Admin École role (invited director, free access)
- Every school MUST have an Admin École — enforced during onboarding
- The sidebar shows a "GESTION ÉCOLE" section with PRO badge
- Free coaches see Pro items at 0.6 opacity with lock icons
- Clicking a Pro item shows the page with SchoolGate (blur + CTA)

### Admin École Role
- First coach to create a school = temporary Admin École
- Onboarding forces "Who is the director?" choice (self or invite)
- Invited director = free account, full school management access via /auth/invite-admin
- Admin flag: is_school_admin (boolean) + school_admin_type (owner/collaborator)
- Only one owner per school, collaborators possible
- Transfer requires Nexus admin approval

### CÉGEP Director Portal — UNCHANGED
- /directeur-cegep/* is a SEPARATE portal and is NOT affected
- CÉGEP directors still sign up through the public signup
- CÉGEP directors still have their own onboarding flow
- Do NOT merge CÉGEP director into coach portal

---

## Phase 2 Notes (do not build yet)

Phase 2 will add:
- Athlete authentication + claim profile
- Messaging
- Scheduling
- Analytics dashboards
- Subscription enforcement
- (Optional) controlled media uploads

Unless explicitly requested, stay in Phase 1.