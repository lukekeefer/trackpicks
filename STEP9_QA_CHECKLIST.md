# TrackPicks V1.3 — Step 9 QA
## App version: 1.3.9

Step 9 is stabilization/regression QA. No new product feature scope is added here.

### Known regression fixed in 1.3.9
- iOS / installed-PWA bottom navigation could expand vertically and cover Full Slate content.
- Bottom nav is now height-bounded, safe-area-aware, and prevented from stretching.

### Required QA pass

#### Mobile / PWA
- Safari: Full Slate bottom nav stays compact while scrolling.
- Installed PWA: Full Slate bottom nav stays compact while scrolling.
- Rotate portrait -> landscape -> portrait.
- Background the app and reopen it.
- Scroll near the bottom of a long slate.
- Confirm no white overlay blocks cards.
- Confirm Full Slate / Slip buttons remain tappable.
- Confirm content is not hidden behind the nav.

#### Straight wagers
- Spread save/edit/delete.
- Total save/edit/delete.
- Moneyline save/edit/delete.
- Actual Line persists.
- Actual Payout persists.
- Units persist.
- Picker changes do not erase fields.
- Caution works.

#### Payout behavior
- Spread defaults to -110.
- Total defaults to -110.
- Moneyline mirrors selected market price.
- Manual payout edits persist.
- CSV export includes Payout Odds.

#### Parlays
- Spread + Total.
- Spread + Moneyline.
- Total + Moneyline.
- Spread + Total + Moneyline.
- Calculated payout changes with each leg's saved payout.
- Final parlay payout can still be manually overridden.
- Saved/reopened parlay keeps leg payouts.

#### Teasers
- Normal Spread/Total teaser still works.
- Moneyline already in parlay -> Teaser toggle blocked.
- Teaser enabled -> Moneyline cannot be added.
- Both cases show exactly:
  `No moneylines in teasers! Cmon!`

#### Game screen
- Logos render.
- Time / TV / location render.
- Line Movement renders and history buttons open.
- Who's Picks + Mark Caution layout remains intact.
- Missing moneyline is disabled cleanly.

#### Full Slate / navigation
- FBS / FCS filters.
- All / SEC / Big Ten / Big 12 / ACC / G6.
- Historical week navigation.
- Full Slate -> game -> close -> Full Slate.
- Full Slate <-> Slip repeatedly.

#### PWA/cache
- App visibly reports 1.3.9.
- No repeated update prompt loop.
- Installed app updates to 1.3.9 after refresh/relaunch.
