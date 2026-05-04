# Recruiter Interest Trigger

**Status:** SPEC LOCKED — implementation pending Loi 25 lawyer review and infrastructure audit  
**Spec date:** 2026-05-03  
**Owner:** Bruno-Philippe  
**Lawyer review batch:** Bundle with P1 partner visibility consent wording review

## Problem

A recruiter sees an athlete profile and wants to make contact, but the athlete has no coach on the Nexus platform. Today the recruiter has no in-platform path forward — they either reach out off-platform (Instagram DM, email if they can find one) or they pass on the athlete entirely. Both outcomes lose value:

- Off-platform contact bypasses Nexus's trust architecture (no audit trail, no Loi 25 protection for minors, no coach mediation)
- Passing on the athlete means recruiters self-select toward already-coached athletes, leaving uncoached athletes invisible
- Either way, Nexus loses the transaction and the chance to onboard the missing coach

## Solution

A structured "express interest" trigger that recruiters fire on uncoached athletes. Athletes (or parents, for minors) receive a notification with the recruiter's professional information and a Nexus-prominent CTA. The athlete's coach gets brought to the platform via the athlete forwarding the trigger — bottom-up coach acquisition.

Key principle: **this is a one-way notification, not a conversation.** No two-way messaging between recruiter and athlete. The structured form prevents the Loi 25 surface that would come with free-form recruiter-to-minor contact.

## Trust architecture preserved

The coach is still the eventual mediator. The athlete is just the on-ramp for getting the coach onto the platform. Once the coach signs up, the recruiter-coach messaging path takes over and this feature is no longer needed for that pair.

This means: **the feature is gated to fire ONLY when athlete.coach_id IS NULL** (or however the data model represents "no Nexus coach bound"). When a coach exists on platform, the existing recruiter→coach messaging path is the only option. Recruiters cannot use this to route around an existing coach they don't like.

## Scope decisions (locked)

### Audience
- Adult athletes (calculated age >= 18 from date_naissance): direct notification to athlete
- Minor athletes (age < 18): notification routed to parent contact, not directly to athlete
- Both routes share the same recruiter-side flow and status state machine

### Information shared in the trigger
- **Required, included:** Recruiter first name + last name, CÉGEP name, role/title (e.g., "Recruteur en chef"), professional email
- **Required, included:** Link to recruiter's Nexus profile (the prominent CTA)
- **Required, included:** Athlete first name + last name (so the parent/athlete knows who the trigger is about)
- **Forbidden:** Phone number, personal social handles, any free-text personal message
- **Forbidden:** Any side-channel contact mechanism

### Connection mechanism
- **Primary CTA:** Nexus profile link, prominently displayed. "Find this recruiter on Nexus → [link]"
- **Fallback:** Professional email shown below as a secondary fallback if the coach refuses to sign up
- **Design intent:** Make signing up to Nexus the path of least resistance. The email exists so the connection isn't blocked, but the visual hierarchy points to Nexus signup first.

### Coach gate (strict)
- Trigger button on recruiter view of athlete profile renders ONLY when `athlete.coach_id IS NULL`
- If a coach exists on platform, the existing coach-messaging path is the only option
- No "soft gate" — recruiters cannot use this when a coach exists, even if the coach is unresponsive

### Cooldown / cap
- Soft cap: max 5 active triggers open per athlete simultaneously
- "Active" = status in (sent, read, forwarded). Terminal states (coach_joined, declined, expired) free the slot.
- Recruiter-athlete pair cooldown: one trigger per pair per 30 days (mirrors expiry)
- Recruiter-side daily rate limit: TBD during implementation, suggest 10/day as starting point

### State machine

States in order, transitions as marked:

| State | Triggered by | Visible to recruiter | Visible to athlete/parent |
|---|---|---|---|
| `sent` | Recruiter fires the trigger | "Sent at [time]" | New notification arrives |
| `read` | Athlete/parent opens the notification | "Read at [time]" | Notification marked seen |
| `forwarded` | Athlete clicks "Forward to my coach" | "Forwarded at [time] — expect coach outreach" | Confirmation, instructions |
| `coach_joined` | Coach signs up via the link AND binds to this athlete (highest-value outcome) | "Coach joined Nexus — they are [Coach Name], message them" | "Your coach joined Nexus" |
| `declined` | Athlete clicks "Not interested" | "Declined at [time]" | Removed from athlete list |
| `expired` | 30 days from `sent` with no terminal transition | "Expired" | Removed from athlete list |

### UI surfaces (all three)
1. **Athlete dashboard** — banner / widget showing active triggers
2. **Athlete profil page** — dedicated section listing recruiter cards with current status + CTAs (Forward / Not interested)
3. **Email notification** — sent on trigger creation, addresses athlete (adult) or parent (minor)

### Recruiter-side surface
- Status display on the athlete profile (replacing the trigger button after firing)
- Aggregate "My active triggers" list somewhere in recruiter dashboard
- Status-changes generate recruiter-side notifications (read, forwarded, coach_joined, declined)

### Analytics
- Coach acquisition attribution: when a coach signs up via a trigger link, attribute the signup to the originating trigger AND the originating recruiter
- Conversion funnel: sent → read → forwarded → coach_joined
- Per-recruiter trigger volume + conversion rate (for soft moderation if a recruiter has very low forward rates)

## Loi 25 considerations

This feature touches the most sensitive surfaces of Quebec privacy law because it involves recruiter contact information being delivered to (or about) minors.

**Required before implementation can ship:**

1. Lawyer review of the email template wording (both adult and parent variants)
2. Lawyer review of the in-app notification wording
3. Confirmation that the parent-routing path satisfies Loi 25 disclosure requirements
4. Confirmation that the recruiter-side audit trail (who sent what, when, to whom) meets Loi 25 record-keeping standards
5. Decision on whether parents need to opt-in to receive these notifications, or whether parental consent at signup time is sufficient blanket consent

**Bundle with:** existing P1 partner visibility consent wording review (open in `docs/post-launch-bugs.md`). Don't engage lawyer twice.

## Infrastructure dependencies (audit before implementation)

The following must be confirmed to exist (or built) before this feature can ship:

1. **Parent contact email** — Is there a column on `athletes` or `parental_consents` table holding a parent's email for minors? If not, this needs a schema addition AND a backfill UX (existing minor athletes need their parents' emails captured).

2. **Email-sending infrastructure** — Does the codebase already have a wired-up transactional email integration (Resend, Postmark, Supabase Auth emails, SendGrid)? If yes, reuse it. If no, this feature requires picking one and integrating.

3. **In-app notification system** — Is there an existing notification framework (DB table, real-time subscription, UI surface)? Or are notifications ad-hoc per feature today? Affects the dashboard widget implementation.

4. **Coach acquisition tracking** — How is coach signup currently attributed? When a coach signs up, can we tag the signup with "came from trigger X"? Likely needs a `referral_source` field on users or a separate attribution table.

5. **Cron / scheduled jobs** — The `expired` state transition requires a job that scans for triggers >30 days old and transitions them. Does the project have an existing cron/edge-function setup, or is this the first scheduled task?

A 30-minute infrastructure audit, documented in this file under a new section "Infrastructure audit — [date]", is the first implementation task.

## Schema sketch (subject to refinement during implementation)

```sql
CREATE TABLE recruiter_interest_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  athlete_id uuid NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN (
    'sent', 'read', 'forwarded', 'coach_joined', 'declined', 'expired'
  )),
  
  sent_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  forwarded_at timestamptz,
  coach_joined_at timestamptz,
  declined_at timestamptz,
  expired_at timestamptz,
  
  -- Snapshot recruiter info at trigger time so the athlete sees what 
  -- the recruiter looked like when they expressed interest, even if 
  -- the recruiter later updates their profile.
  recruiter_snapshot jsonb NOT NULL,
  
  -- Track whether the trigger was routed to athlete (adult) or parent (minor)
  routing text NOT NULL CHECK (routing IN ('athlete_direct', 'parent_routed')),
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recruiter_interest_triggers_athlete_active 
  ON recruiter_interest_triggers (athlete_id) 
  WHERE status IN ('sent', 'read', 'forwarded');

CREATE INDEX idx_recruiter_interest_triggers_recruiter 
  ON recruiter_interest_triggers (recruiter_id, sent_at DESC);

-- Soft cap enforcement (max 5 active per athlete) likely via 
-- trigger function or application-layer check at insert time.

-- Cooldown enforcement (one per recruiter-athlete pair per 30 days) 
-- via partial unique index or trigger.
```

RLS to be specified during implementation but principles:
- Recruiter can read/write their own triggers
- Athletes can read triggers targeting them, can update status (read, forwarded, declined)
- No cross-athlete or cross-recruiter visibility
- Parents do NOT have direct DB access — they receive emails only

## Phased implementation plan

### Phase 1 — Schema + adult-only trigger (~3-4 days, after lawyer review unblocks)
- Migration for `recruiter_interest_triggers` table + RLS
- "Express interest" button on recruiter view (gated on `athlete.coach_id IS NULL`)
- Adult-athlete-only routing (calculated age >= 18). Minors blocked at this phase.
- Athlete-side surface (dashboard widget + profile page section)
- Status state machine with transitions read/forwarded/declined
- Manual expiration (cron deferred to Phase 3)
- No email integration yet (in-app notifications only at this phase)
- Recruiter-side status display

### Phase 2 — Minor athlete handling (~2-3 days, BLOCKS on lawyer review)
- Parent contact email infrastructure (column + backfill UX)
- Parent-routing logic for triggers when athlete is a minor
- Email templates (parent variant + adult variant)
- Email-sending integration if not already present

### Phase 3 — Polish + flywheel (~2-3 days, post-launch)
- Cron for expired state transitions
- Coach acquisition attribution
- Analytics surface (per-recruiter conversion rates)
- Cooldown + rate-limit enforcement
- Email integration for adults (if Phase 1 was in-app only)

## Open questions for tomorrow's audit

1. Does parent email column exist? If not, where does it live and how do existing minor athletes get backfilled?
2. What's the email-sending infra today? (None? Resend? Postmark? Supabase Auth only?)
3. Is there a notifications table / framework, or is each feature doing it ad-hoc?
4. How is the recruiter-Nexus-profile URL structured today? (Need stable URL pattern for the prominent CTA.)
5. Cron / scheduled job infra — exists or needs to be built?

Audit owner: tomorrow-Bruno-Philippe (or Claude Code via diagnostic prompt)

## Decision log

- **Coach gate:** Strict (only when athlete.coach_id IS NULL). Decided 2026-05-03. Rationale: preserves trust architecture; a soft gate would let recruiters route around coaches they don't like.
- **Connection mechanism:** Nexus-link-prominent + email fallback below. Decided 2026-05-03. Rationale: turns the feature into a coach-acquisition flywheel rather than an off-platform leakage channel.
- **Minor handling:** Parent-routed (Option Y). Decided 2026-05-03. Rationale: lower Loi 25 surface than direct-to-minor.
- **Free text:** Forbidden. Decided 2026-05-03. Rationale: Loi 25 + structured-only prevents coercive language.
- **Phone:** Forbidden. Decided 2026-05-03.
- **Active cap:** 5 per athlete. Decided 2026-05-03.
- **Expiry:** 30 days. Decided 2026-05-03.
