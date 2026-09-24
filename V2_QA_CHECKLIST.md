# TrackPicks V2 QA Checklist

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
