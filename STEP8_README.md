# TrackPicks V1.3 — Step 8
## App version: 1.3.8

### Deployment order
1. Run `TRACKPICKS_V1_3_STEP8_PAYOUT_MIGRATION.sql` in Supabase SQL Editor.
2. Confirm `wagers.payout_odds` is NOT NULL.
3. Replace the GitHub frontend files with this package.
4. Commit to `main`.
5. Confirm the visible app version is `1.3.8`.
6. Start Step 8 QA.

### Included
- Actual Line | Actual Payout | Units on one editable row.
- Spread/Total defaults Actual Payout to -110.
- Moneyline mirrors selected market ML into Actual Payout.
- Straight wagers persist `payout_odds`.
- Parlay legs persist the exact Actual Payout entered.
- Standard parlay calculation multiplies each leg's saved payout odds.
- Final parlay payout remains manually editable.
- Normal parlays allow Moneyline legs.
- Teasers reject Moneyline in both required cases with:
  `No moneylines in teasers! Cmon!`
- Save-time validation also rejects any ML teaser.

### QA
- Save/edit Spread, Total, and Moneyline wagers and verify payout persists.
- Confirm Spread/Total payout starts at -110.
- Confirm ML payout mirrors the selected ML button.
- Build mixed Spread + Total + ML parlay.
- Verify calculated payout responds to edited leg payouts.
- Override final parlay payout and save.
- ML already in Parlay -> toggle Teaser -> exact error.
- Teaser enabled -> add ML -> exact error.
- Confirm Spread/Total teaser behavior still works.
