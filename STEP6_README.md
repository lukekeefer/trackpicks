# TrackPicks V1.3 — Step 6 Game Page Redesign

Internal build: `20260924-06`

This package is based directly on the deployed V1.2 build `20260923-14`.

Changes in this step only:
- loads ESPN team `logo_url` and `abbreviation`
- loads `tv_network`, `venue_name`, `venue_city`, `venue_state`, and `espn_event_id` from games
- replaces the old game-sheet header with a team-vs-team matchup hero
- shows kickoff time, TV, venue, city/state
- fully removes the DraftKings Market Snapshot card from the game sheet
- keeps Line Movement as its own card
- leaves the existing wager controls/logic unchanged for now

Important:
- Step 7 will replace the wager-selection controls with the new Spread / Moneyline / Total grid.
- The visible app subtitle remains V1.2 until the final V1.3 version step.
- `version.json`, `BUILD_VERSION`, and versioned JS/CSS references are aligned to `20260924-06` to prevent PWA update-loop issues.
