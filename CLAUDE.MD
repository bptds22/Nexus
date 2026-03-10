# CLAUDE.md — Nexus (Recruitment Platform) Coding Rules

This file contains non-negotiable rules for Claude while building Nexus.
Follow these instructions exactly.

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

## Phase 2 Notes (do not build yet)

Phase 2 will add:
- Athlete authentication + claim profile
- Messaging
- Scheduling
- Analytics dashboards
- Subscription enforcement
- (Optional) controlled media uploads

Unless explicitly requested, stay in Phase 1.