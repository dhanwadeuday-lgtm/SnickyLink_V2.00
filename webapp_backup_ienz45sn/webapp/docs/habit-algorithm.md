# SnickyLink — Verification & Habit-Formation Algorithm

This document specifies the algorithm that decides **which Snick is verified how**, and
**which Snicks unlock when**, so that gameplay actually builds a real relationship habit
instead of just being a checklist. It intentionally separates ALGORITHM (this doc + backend)
from UI (implemented afterward, see `docs/architecture.md` for the Home-screen spec).

## 1. Verification Algorithm

### 1.1 Input data
`SNICKS_updated.xlsx` ("Final Master") gives every mission a **raw verification method**
string (47 distinct variants across 365 rows), a `Verification Level` (Low/Medium), a
`Safety Status`, a `Privacy Rule`, and an optional `Recommended Verification Upgrade`.

Our existing schema's `snicks.verification_type` is a **functional** 4-value enum that the
backend state machine already knows how to execute:

| verification_type | Who must act | Behavior in `snicks.ts` |
|---|---|---|
| `SELF_CONFIRMATION` | Starter only | Auto-approved on `/complete` |
| `OPTIONAL_NON_SENSITIVE_EVIDENCE` | Starter only (evidence optional) | Auto-approved on `/complete` |
| `PARTNER_CONFIRMATION` | The *other* partner | Stays `PENDING`, partner must call `/verify` |
| `MUTUAL_COMPLETION` | The *other* partner (mutual) | Stays `PENDING`, partner must call `/verify` |

Rather than throwing away the 4-value state machine (it's simple, auditable, and already
wired end-to-end), we **classify** each of the 47 raw strings down into one of the 4 buckets
with a deterministic keyword classifier, and keep the raw string + level + safety status as
extra *display/consent* metadata. This gives us the richer Excel taxonomy for the UI/consent
layer while keeping one small, testable state machine underneath.

### 1.2 Classifier (priority order, first match wins)

```
1. contains "partner confirmation"                              -> PARTNER_CONFIRMATION
2. contains "mutual" | "simultaneous" | "independent answers"
   | "answer reveal" | "answer submission"                       -> MUTUAL_COMPLETION
3. contains "photo" | "video" | "voice" | "image"                -> OPTIONAL_NON_SENSITIVE_EVIDENCE
4. everything else (in-app submission/score/completion/list/
   plan/itinerary/timeline/playlist/puzzle/quiz/timer)           -> SELF_CONFIRMATION
```

This is deterministic and covers all 47 observed strings with no leftovers (verified against
the full `Final Master` sheet — 0 unmapped rows).

### 1.3 Upgrade override
62 rows carry `Recommended Verification Upgrade = "In-app message box + Partner Confirmation"`
(all Communication-pillar Snicks where self-report alone was judged too weak). Rule:

```
if upgrade_recommended and classified_type in (SELF_CONFIRMATION, OPTIONAL_NON_SENSITIVE_EVIDENCE):
    classified_type = PARTNER_CONFIRMATION   # force a real second-party confirm
# if already MUTUAL_COMPLETION, leave it — that's already stronger than the upgrade asks for.
```

### 1.4 Safety / consent layer (new columns, not new states)
`snicks` gains `verification_method` (raw label, for the detail sheet), `verification_level`
(`LOW`/`MEDIUM`), `safety_status` (`OK` / `REVIEW_CONSENT_SAFETY` / `CONSENT_SKIP_OPTION`),
and `privacy_rule` (shown verbatim in the detail modal — e.g. *"Never require a private chat
screenshot; verify completion, not private conversation"*).

Runtime enforcement in `POST /snicks/:id/complete`:
- `safety_status = REVIEW_CONSENT_SAFETY` → the request **must** include `{ consent: true }`
  or the API returns `428 Precondition Required` with the privacy_rule text, so the client is
  forced to show a one-time consent sheet before the mission can be marked done.
- `safety_status = CONSENT_SKIP_OPTION` → the client may instead call
  `POST /snicks/:id/complete { skip: true }`, which resolves the completion as `SKIPPED`
  (no XP, no streak break, no penalty) — this is the literal "skip option" the spreadsheet
  calls for on sensitive/personal prompts.
- The server **never** stores or requires chat ciphertext/screenshots as proof for any Snick —
  consistent with the existing E2EE "server never sees plaintext" guarantee in `docs/security.md`.

### 1.5 Frequency mapping
Excel's 5th bucket, `Challenge` (126 rows), is not "urgent/scheduled" like Daily/Weekly/Monthly
— it's optional variety content. It is imported as `frequency = 'CHALLENGE'` (new enum value,
alongside existing `DAILY/WEEKLY/MONTHLY/SPECIAL/MYSTERY`). Challenges are **never gated** —
always available, no streak requirement — because their game-design purpose is the
*variable/novel reward* described below (§2.4), not habit repetition.

---

## 2. Habit-Formation Scheduling Algorithm (Atomic Habits)

We deliberately ground the cadence/unlock logic in James Clear's *Atomic Habits* framework
rather than inventing an arbitrary XP curve. Four mechanisms map directly onto the Four Laws
of Behavior Change:

| Atomic Habits principle | SnickyLink mechanism |
|---|---|
| **Make it obvious** (cue) | One single, unmissable **"Today's Mission"** card — not a 163-item list. The couple always knows exactly the one thing to do today. |
| **Make it easy** (2-minute rule / minimum viable habit) | Daily tier is *always* Easy, flat **5 XP**, ≤10 min — intentionally trivial so the couple can never fail to start. |
| **Make it satisfying** (immediate + variable reward) | Instant XP + streak flame on every Daily; unpredictable bonus **Challenges** injected for novelty (variable-ratio reward, the same mechanism slot machines and Duolingo streaks use). |
| **Identity-based habits + "never miss twice"** | The reward for consistency is not "more of the same" — it's **unlocking a new tier** (Weekly, then Monthly). This reframes the goal from "finish the checklist" to "become the couple who shows up every day," and escalating unlocks make relapse costly (motivation to protect the streak), matching Clear's habit-stacking / identity-reinforcement argument. |

### 2.1 Daily tier — rotating single mission, not a checklist
There are 163 Daily Snicks. Presenting them as one giant list contradicts "make it obvious" —
so instead the backend picks **exactly one** Daily Snick per couple per UTC day:

```
today_key      = hash(coupleId + today_date_utc)             # deterministic per couple/day
recent_ids     = Daily snicks this couple completed in the last 14 days   (spaced repetition:
                  don't repeat the same ritual too soon — keeps the cue-routine fresh)
pillar_deficit = the one of {communication, emotional, efforts, trust} with the
                 LOWEST XP gained by this couple in the trailing 7 days   (keeps the
                 relationship "identity" well-rounded instead of over-training one pillar)

candidates = Daily snicks NOT in recent_ids
           , preferring candidates whose dominant pillar == pillar_deficit
           , falling back to the full Daily pool if candidates is empty
today's mission = candidates[ today_key % len(candidates) ]
```

This is idempotent (same couple + same day ⇒ same mission, safe to call repeatedly), varies
day-to-day and couple-to-couple, and self-balances the four pillars over time — the concrete
answer to "how to permutate/combine which Snicks to give."

### 2.2 Weekly tier — unlocked by consistency, not by "level"
Per the user's own framing ("weekly 6 dino baad"): a couple's **first** Weekly Snick unlocks
the moment their `couples.streak_count` (already tracked by the existing XP engine in
`src/lib/game.ts` — no new column needed) reaches **6**. This is a direct, literal encoding of
Clear's idea that a habit needs roughly a week of unbroken repetition before it's safe to layer
a second, harder habit on top of it (habit stacking).

Subsequent Weeklies require the couple to bank **6 more days of Daily streak since the last
Weekly was approved** — i.e. the gate resets and must be re-earned, so Weekly access is a
standing reward for *sustained* engagement, not a one-time unlock. Within the Weekly pool,
selection is **sequential** (`sequence_index` order, first not-yet-approved), not randomized —
unlike Daily variety, Weekly/Monthly are meant to read as a narrative arc the couple progresses
through together.

### 2.3 Monthly tier — unlocked by compounding commitment
Monthly unlocks once **both** are true:
- the couple has **approved ≥ 2 Weekly Snicks** (demonstrated they can sustain the harder tier,
  not just unlock it once), **and**
- `streak_count ≥ 14` (two full weeks of daily consistency — roughly the point Clear cites
  where a habit starts to feel like "who you are" rather than "something you're forcing").

This creates one clean escalation ladder:

```
Daily (always on, 5 XP, rotates daily)
   └─ streak ≥ 6 days ────────────► Weekly unlocked (15-30 XP, sequential)
         └─ ≥2 Weeklies approved AND streak ≥ 14 ──► Monthly unlocked (40-100 XP, sequential)
```

All three thresholds are derived live from existing tables (`couples.streak_count`,
`snick_completions`) — **no new state table**, so there is nothing to fall out of sync.

### 2.4 Challenges — the variable-reward layer
126 Challenge Snicks (10-30 XP) are always unlocked, never gated, and are surfaced as an
optional "spice it up" pool the couple can dip into anytime — the deliberate unpredictability
(picked randomly per view, not deterministically) is the "make it attractive" / dopamine-novelty
half of the loop that the strict, predictable Daily/Weekly/Monthly ladder intentionally does
NOT provide.

### 2.5 Non-goals / explicitly deferred
- Server-side Cron auto-expiry of stale `PENDING` completions (flagged as a known gap in
  `docs/security.md` already) is unaffected by this change and remains future work.
- Streak "grace days" (skip a day without losing the streak) are not implemented in this pass;
  `app_config.streak_grace_hours` exists but is currently informational only.
