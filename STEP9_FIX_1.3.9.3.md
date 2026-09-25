# TrackPicks 1.3.9.3

Step 9 revision: installed-PWA cold-launch cache fix.

Observed behavior in 1.3.9.2:
- Reload button updated the app successfully.
- After closing the installed app and reopening from the home-screen icon, an older cached root document could load again and show Reload.

Fix in 1.3.9.3:
- Reload now explicitly refreshes the canonical root document before navigating.
- Cache Storage is cleared on a best-effort basis.
- Existing service workers are updated/unregistered on a best-effort basis.
- Final navigation lands on the clean canonical root URL, not a one-off query-string URL.
- App startup asks registered service workers to update without blocking startup.
- Existing semantic version comparison from 1.3.9.2 remains in place.

No SQL required.

Required QA sequence:
1. Open an older installed build that shows Reload.
2. Tap Reload.
3. Confirm app shows 1.3.9.3.
4. Fully close the installed PWA.
5. Reopen from the home-screen icon.
6. Confirm it still shows 1.3.9.3 and no Reload banner appears.
7. Repeat on desktop browser with a normal close/reopen.
