# TrackPicks V1.2 QA Checklist

1. Run the SQL migration before deploying the frontend.
2. Log in and confirm existing straight picks still appear and can be edited/graded.
3. Open a game, choose a spread, optionally change Actual line taken, and tap **Add to Parlay**.
4. Add a total from a second game. Confirm the builder shows 2 legs and did not create straight wagers.
5. Enter locked payout odds (example `+575`), units, and picker; save the parlay.
6. Confirm the saved parlay appears under Slip → Parlays and the displayed To Win math is sensible.
7. Edit the parlay, remove/add a leg, and save again.
8. Build a teaser, choose a point amount, and verify:
   - favorite spread moves toward zero
   - underdog spread receives more points
   - Over total moves down
   - Under total moves up
9. Save and grade a parlay as Win/Loss/Push/DDL.
10. Export the existing CSV and confirm only straight picks are included.
11. Refresh/reopen the PWA and confirm saved parlays reload from Supabase.


## Build 20260923-13 checks
- Open a new game: Spread, Total, teams, Over, and Under should all start unselected.
- Tap Spread: neither team should auto-select. Tap Total: neither Over nor Under should auto-select.
- Confirm Bet / Add to Parlay without a complete selection should show a validation message instead of creating a wager.
- Add a second normal parlay leg: odds should auto-fill to +264 (assumes -110 per leg).
- 3 normal legs should estimate about +596; changing leg count should refresh the estimate.
- Manually overwrite the parlay odds and save: the entered value should be the one stored.
- Toggle Teaser on: automatic parlay estimate should clear and teaser odds should be entered manually.
- Full Slate filter row should still show FBS / FCS / All / SEC / Big Ten / Big 12 / ACC / G6.
- All visible version markings should read V1.2.

- New game shows all four wager buttons with none selected: away spread, home spread, Over, Under.
- Selecting any one button is a complete wager choice; Confirm Bet and Add to Parlay use that selection.
- A week containing only a graded parlay/teaser exports successfully from Slip > Export CSV.
- Parlay/teaser appears as one CSV row; legs are listed inside the Pick field and are not exported as straight wagers.
