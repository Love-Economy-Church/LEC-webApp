# LEC-webApp Foundation Audit

Scope: production-readiness, scalability, data/auth foundation, and organizational-platform identity for **Love Economy Church**. React 19 + Vite + Ionic + Supabase (Postgres/PostgREST), Google + password auth, Capacitor for native, Vercel hosting.

Goal of this pass: confirm the foundation is strong *before* new features are added, and identify what stands between "internal Alpha prototype" and "official platform of an established organization."

> Verification note: two items flagged by automated review were checked directly and corrected.
> - **`.env` is NOT committed** — it is in `.gitignore` and has no git history. "Secrets in version control" is a **false positive**.
> - **Membership-state math is not off-by-one** — the three copies reconcile once `AttendanceMarking`'s `-1` current-session offset is accounted for. The real defect is the **duplicated rule in 3–4 files**, not wrong thresholds.

---

## 1. Critical — must resolve before real production use

### C1. Authorization is enforced only on the client; server-side RLS unverified
- Evidence: `src/components/attendance/AttendanceMarking.jsx:362-365` (`if (!canMark) { alert(...); return }`), `src/utils/permissionsUtils.js:21-86`, and every `src/services/*` query selects without an org/tenant filter (e.g. `hierarchyService.js:11-35`, `peopleService.js:11`).
- Risk: if Supabase Row-Level Security policies are not present and correct, any authenticated user can read/write any church's rows by calling PostgREST directly with the public anon key — the UI guard is cosmetic.
- Action: **This must be verified in the Supabase project.** Confirm RLS is enabled on `people`, `position_assignments`, `attendance_sessions`, `attendance_records`, `organizational_units`, and that policies scope by role/unit. If absent, this is the single biggest production risk.

### C2. Multi-write sequences run without transactions
- Evidence: `peopleService.js:246-262` (deactivate old assignment → insert new, two calls); `AttendanceMarking.jsx:387-413` (upsert session → upsert records, two calls).
- Risk: a crash or network failure between the two writes leaves a person with **no active assignment**, or attendance records pointing at the wrong/missing session. Concurrent edits can create duplicate active assignments.
- Action: move each of these into a single Postgres RPC / Edge Function so the writes are atomic.

### C3. Service-role key lives alongside client keys in `.env`
- Evidence: `.env` contains `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ACCESS_KEY` next to the public `VITE_`/`EXPO_PUBLIC_` keys.
- Risk: Vite only bundles `VITE_`-prefixed vars, so the service key is *not* currently shipped — but keeping it in the app's `.env` invites an accidental rename/import that would expose full DB admin to the browser.
- Action: move service-role/access keys out of the frontend project entirely (server-only secret store). Rotate them if this file was ever shared.

---

## 2. High — will hurt at scale or cause data loss

### H1. No pagination anywhere — full tables fetched to the client
- Evidence: `hierarchyService.js:13`, `peopleService.js:11` select all rows, no `.range()`/`.limit()`.
- Risk: fine at 200 people, degrades badly at thousands; slow loads, memory bloat, PostgREST timeouts.

### H2. Hard deletes, no soft-delete or audit trail
- Evidence: `peopleService.js:388-397` (`hardDeletePerson`), session delete `AttendanceMarking.jsx:449-453`.
- Risk: deleting a person destroys their historical attendance; no "who changed what/when." Irreversible and a compliance gap.
- Action: add `deleted_at` soft-delete + an audit/event table before scaling.

### H3. N+1 query in person de-duplication
- Evidence: `peopleService.js:213-222` queries `position_assignments` once per candidate match inside a loop.
- Risk: each add-person can fan out into 5+ sequential round-trips; slow rapid-add workflow.

### H4. PII cached in `localStorage` with a 5-minute TTL
- Evidence: `cacheService.js` (`PEOPLE`, `HIERARCHY`, `POSITIONS`, `DEFAULT_TTL_MINUTES = 5`).
- Risk: member names/emails/photos readable via DevTools and persist on shared devices; multi-user edits show stale data for up to 5 min with no cross-client invalidation.

### H5. Attendance date handling is timezone-naive
- Evidence: `AttendanceMarking.jsx:20-50` (`getServiceDate` off local `new Date()`), undo window uses client `Date.now()` at `:434`.
- Risk: sessions can land on the wrong calendar day near midnight / across timezones; weekly metrics skew. Undo window is also bypassable by changing system clock.

### H6. Auth failure silently logs the user out
- Evidence: `contexts/AuthContext.jsx:44-82` — if `get_current_user_role` RPC fails, `userRole` is set null and the user is signed out with only a console warning.
- Risk: valid users with a transient RPC error get bounced to login with no explanation.

---

## 3. Medium — correctness, maintainability, UX

- **M1. Membership-state rule duplicated 3–4×** — `peopleService.js:72-76`, `hierarchyService.js:66-69`, `AttendanceMarking.jsx:294-297`, plus `AttendanceAnalytics.jsx`. Thresholds currently reconcile but edge-handling at count 0/1 differs; any future rule change will drift. Centralize into one `membershipState(person)` util.
- **M2. Destructive actions without confirmation** — member unit transfer (`PersonActionModal.jsx:199-203`, `PeopleDirectoryPage.jsx:158-162`) applies immediately on submit.
- **M3. No input bounds on attendance/first-timer counts** — `AttendanceMarking.jsx:130-133` accepts arbitrarily large numbers; garbage into reports.
- **M4. Position selection not reset on unit change** — `PersonActionModal.jsx:29-30`; stale position id can be submitted for a different unit.
- **M5. Admin roles hardcoded as string lists** — `AttendanceMarking.jsx:431` and duplicated in `AttendanceAnalytics.jsx`; adding a role needs code edits in multiple places.
- **M6. Dashboard depends on `attendance_analytics_view`** — `DashboardPage.jsx:165`; no migration/setup in repo, so a fresh deploy renders blank with no error.
- **M7. Empty attendance sessions can be submitted** — `AttendanceMarking.jsx:360-377` has no "at least one marked" guard.

---

## 4. Identity — from "Alpha prototype" to "Love Economy Church platform"

The app reads as an internal, multi-tenant *template* rather than a proprietary org platform. This is the biggest gap for the stated goal.

### Codename & placeholder leakage (user-facing)
- **"Alpha" everywhere:** `index.html:18,22,32` (title `LEC - Alpha`, apple title), `vite.config.js:13-14` (manifest `name`/`short_name`), `capacitor.config.json` (`appName`, `appId com.lec.alpha`), `Login.jsx:165`, `DashboardPage.jsx` fallback `'Alpha Branch'`, PDF export footer in `NetRevelationExportModal.jsx`.
- **Placeholder domains shown to users:** `Login.jsx:222` tells people to sign in with `@churchone.com` / `@churchtwo.com`; `peopleService.js:149` defaults email domain to `churchone.com`. Field name `churchone_email` (`AuthContext.jsx:64`, `ProfilePage.jsx:638`) leaks the generic template origin.
- **Version `0.0.0`** — `package.json:4`; reads as an unfinished build.

### Missing professional signals
- No footer, copyright, privacy policy, terms, "About"/contact, or visible version anywhere in `src/`.
- README is the stock Vite template (`README.md`), not product docs.
- No single source of truth for identity — org name, branch, domains, colors, contact are scattered across ~10 files, so a rebrand or a second branch means find-and-replace across the codebase.
- Design tokens are generically named `church-*` (`tailwind.config.js:11-90`) with no documented link to an LEC brand.

### PWA / icon polish
- `vite.config.js:21-39`: same `lec-logo.jpeg` reused for 192/512/1024, JPEG (artifacts on flat color), `purpose: 'any maskable'` on one entry rather than a dedicated maskable PNG; no `favicon.ico`.

**Foundational recommendation:** introduce a single `src/config/organization.js` (name, legal name, branch, primary domain, support contact, brand colors, feature flags) and drive **all** identity strings + metadata from it. That one change simultaneously (a) removes "Alpha"/`churchone` leakage, (b) makes the eventual multi-branch/multi-church expansion a config concern instead of a fork, and (c) gives you the place to hang legal/version/contact info.

---

## 5. Suggested sequencing

1. **Verify & lock the backend (C1, C2, C3)** — RLS audit, atomic RPCs, secret hygiene. Nothing else matters if the data layer is open.
2. **Data-safety net (H2, H4, H5)** — soft-delete + audit table, drop PII from `localStorage`, normalize dates to UTC.
3. **Identity spine (Section 4)** — `organization.js` config, purge "Alpha"/placeholder domains, real version, footer with legal/contact, README.
4. **Scale & correctness (H1, H3, M1, M6)** — pagination, centralize membership logic, ship the analytics view migration.
5. **UX hardening (M2, M3, M4, M7)** — confirmations, input bounds, form validation.

This document is analysis only — no code was changed.
