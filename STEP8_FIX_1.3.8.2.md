# TrackPicks 1.3.8.2

Step 8 revision: CSV payout recordkeeping.

Changes:
- Adds `Payout Odds` to all CSV report exports.
- Straight wagers export the saved `payout_odds` value.
- Parlays/teasers export the saved final parlay odds in `Payout Odds`.
- Parlay/teaser `Line/Total` is left blank because the aggregate wager does not have one single line.
- Weekly, monthly, season, and Slip CSV exports all use the same updated row builder, so the new column is present everywhere.

No database migration is required for 1.3.8.2.
