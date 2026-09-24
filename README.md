# TrackPicks

## V1.2 — Parlays & Teasers
This build adds parlays without changing the existing straight-wager data model.

- Game page: new **Add to Parlay** action.
- Slip: **Straight Picks / Parlays** segmented view.
- Parlay Builder supports 2+ legs, spreads and totals, units, picker, and one user-entered locked American payout-odds value.
- Teaser toggle supports a user-selected point amount and applies it to both spread and total legs in the bettor's favor.
- Saved parlays can be edited, removed, and manually graded Win/Loss/Push/DDL.
- Straight-pick CSV/reporting remains unchanged; parlay legs do not count as straight picks.
- Visible app version is V1.2; cache build is 20260923-13.

### Deploy order
1. Run `TRACKPICKS_V1_2_PARLAYS.sql` manually in Supabase SQL Editor.
2. Upload the frontend files from the V1.2 package to GitHub and commit to `main`.
3. Let GitHub Pages republish.
4. Open TrackPicks and accept the update prompt if shown.
5. QA one normal parlay and one teaser before relying on it for real tracking.

This version adds Supabase authentication and persistent cloud storage while preserving the existing TrackPicks workflow.

## What is cloud-synced
- Weekly game boards: shared by authenticated users.
- Wagers/Slip: private to the signed-in account.
- Actual line taken, units, Who, Pick and Result all sync.
- Same login can be used on phone and desktop.

## One-time Supabase setup
1. Create a Supabase project.
2. Open the SQL Editor in Supabase.
3. Paste and run the entire `SUPABASE_SETUP.sql` file from this package.
4. In Supabase project settings/API, copy:
   - Project URL
   - public anon/publishable key
5. Deploy this folder to Netlify.
6. Open the app. On the Cloud Setup screen, paste those two public project values.
7. Create your first account or log in.
8. In Settings, paste your existing The Odds API key on each device that needs to run `Load Week`.

## Important prototype note
The Odds API key remains in browser local storage in V3.0. Supabase login/picks are cloud-backed, but the Odds API key should be moved to a serverless function before this is distributed beyond a trusted private group.

## Auth email confirmation
Supabase projects may require email confirmation for new users. If enabled, a new account must confirm its email before it can log in. This can be adjusted in Supabase Auth settings if desired.

## Export
CSV remains:
Matchup, Bet Type, Line/Total, Who, Pick, Result

Units remain cloud-stored but are not exported yet.


## V3.1 — Admin-only weekly board
1. Run `SUPABASE_ADMIN_UPDATE.sql` in Supabase SQL Editor.
2. Then run the final `update public.profiles...` statement with your login email.
3. Log out and back in.

Behavior:
- Admins see `Load Week`.
- Normal users do not see `Load Week`.
- Database rules also block non-admin users from changing the shared board.
- Wagers remain private to each signed-in user.


## V3.3 — Safe admin UI fix
This build starts from the known-working V3.1 auth/cloud code and makes only the admin-role changes.

- Cloud Setup and Login bindings are preserved unchanged.
- Admin status uses `state.sb` and `state.user`.
- Role is refreshed when the session loads and whenever auth state changes.
- Only admins render `Load Week`.
- Non-admin users see a neutral 'board not published yet' message when a week is empty.
- `loadSelectedWeek()` also checks the admin role before importing.
- Supabase RLS remains the authoritative security layer.


## V3.4.1 — Permanent cloud config, safe rebuild
- Rebuilt from the known-working V3.3 source.
- Supabase Project URL and publishable key are embedded in the app.
- Cloud Setup controls are hidden.
- The original working auth/startup code is preserved intact.
- New devices should open directly to Login/Create Account.
- Admin/user behavior is unchanged.
- Odds API key remains device-local for now.


## V3.5 — Admin API key settings
- Adds an admin-only Odds API Key field in Settings.
- Regular users do not see the field.
- Admin can save or clear the key.
- The key is stored in browser localStorage on that device.
- Load Week automatically uses the saved key.
- Future improvement: move the key to a server-side secret so it syncs across admin devices without exposing it in browser storage.


## V3.5.1 — Admin API visibility fix
- Removes the old Odds API field that was visible to every user.
- Only admin accounts can see or edit the Odds API key.
- Regular-user Settings now show only cloud sync and logout controls.


## V3.6.1 — Safe Slip/result rebuild
- Rebuilt from stable V3.5.1.
- Preserves the Full Slate game-detail renderer and all game selection behavior.
- Renames Market to Full Slate.
- Makes Slip cards more compact.
- Adds Set Result / Edit Result flow with Win, Loss, Push.
- Saving a result shows the green ✓ Saved confirmation before the badge settles.


## V3.7 — Display Name + custom picker names

Before deploying:
1. Run `SUPABASE_PROFILE_NAMES_UPDATE.sql` in Supabase SQL Editor.
2. Deploy the V3.7 folder to Netlify.

Behavior:
- First login without a Display Name prompts: “What should we call you?”
- Display Name becomes the default on new wagers.
- Display Name is editable in Settings.
- Game screen now says “Who’s picks are these?”
- Tapping it opens a quick selector:
  - Display Name first
  - added names in creation order
  - + Add Name always last
- Added names are saved to the signed-in user’s profile and sync across devices.
- Existing historical wager labels are not rewritten when Display Name changes.


## V3.7.2 — Surgical picker fix
- Built directly from the original V3.7 source.
- Fixes `defaultWho` without replacing any app functions.
- Preserves Settings, Full Slate, Slip, login, cloud sync, and admin controls.
- Custom picker-name selections persist while the game screen re-renders.


## V3.7.3 — Picker menu render fix
- Fixes “Who’s picks are these?” not opening.
- The selector sheet is now included in the main app render.
- Display Name, saved names, and + Add Name now appear in the intended popup.
- No other workflow logic was changed.


## Odds API monthly usage counter
Admin Settings now shows:
- credits used this month
- total monthly credit allowance
- credits remaining
- cost of the most recent Load Week

The values come directly from The Odds API response headers and refresh automatically after Load Week.


## TrackPicks: caution, DDL, and reports

Run `SUPABASE_CAUTION_DDL_UPDATE.sql` before deploying.

- ⚠️ Caution is user-specific and appears on Full Slate and Slip.
- DDL is selectable as a result but grades exactly like Loss.
- DDL exports as `Result = Loss` and `DDL = Yes`.
- Weekly, Monthly, and Season CSV reports are available in Settings.
- Reports include graded picks only.
- CSV columns:
  `Week | Matchup | Bet Type | Line/Total | Who | Pick | Units | Result | Caution | DDL`

## Line movement tracking
- Each successful admin `Load Week` keeps `games` as the current DraftKings market and appends a snapshot to `game_odds_history`.
- Full Slate shows a compact movement note only when the spread and/or total has changed from the first TrackPicks-captured snapshot.
- The single-game screen shows recent captured line changes.
- Movement is measured from the first line TrackPicks captured; it is not labeled as a sportsbook opening line.
- Saved wagers are not modified by market updates or history snapshots.
- Run `TRACKPICKS_LINE_MOVEMENT.sql` manually in Supabase before deploying this build. Do not commit the SQL file to the public repository.


## Deploy/cache behavior

TrackPicks now uses build-versioned JavaScript and CSS filenames plus `version.json` update detection.

For each future deploy:
1. Generate new versioned asset filenames (for example `app.YYYYMMDD-N.js` and `styles.YYYYMMDD-N.css`).
2. Point `index.html` at those new filenames.
3. Set the same build value in `BUILD_VERSION` and `version.json`.
4. Upload/commit the changed files together.

Open browser tabs and installed home-screen users check `version.json` when the app opens, when it returns to the foreground, and every five minutes. If a newer build exists, TrackPicks shows an update banner. Tapping Reload adds the new version to the page URL so the browser requests a fresh `index.html`, which then loads the new versioned assets.

Do not add aggressive service-worker caching unless deliberately redesigned; TrackPicks depends on live Supabase data and favors predictable updates over offline caching.


## Line history charts
Single-game market info includes **Spread History** and **Total History** buttons when at least two snapshots exist. Charts use `game_odds_history` and normalize spreads to the home-team line. The first captured TrackPicks line is a baseline, not a claimed sportsbook opener.


## V1.2 fix — build 20260923-13
- Restores/keeps the Full Slate FBS/FCS + conference filters.
- Removes all default wager selection on a newly opened game. The user must choose Spread or Total, then choose the side/Over/Under.
- Normal parlay payout odds auto-fill from leg count assuming every leg is -110; the user can overwrite the value before saving.
- Teasers do not get an automatic odds estimate; the user enters teaser payout odds manually.
- Visible app version remains V1.2.
- No additional Supabase SQL is required if the V1.2 parlay SQL has already been run.
