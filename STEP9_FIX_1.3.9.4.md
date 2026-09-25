# TrackPicks 1.3.9.4

Step 9 revision: iOS installed-PWA cold-start caching.

1.3.9.3 did not solve the mobile cold-launch problem. This revision changes the architecture instead of adding another cache-busted redirect.

## Change
TrackPicks now installs a minimal service worker (`sw.js`) whose job is NOT offline caching. Its job is to control app navigations and force `index.html` / `version.json` through the network with `cache: no-store`.

This addresses the observed failure mode:
1. Reload updates to the newest build.
2. User closes the installed PWA.
3. iOS reopens an older cached root document.
4. Old build appears and asks for Reload again.

Once 1.3.9.4 has loaded and the service worker is controlling the app, future home-screen cold launches should request the current root document instead of resurrecting a stale one.

Also:
- lifecycle checks run on pageshow, focus, and returning to the foreground;
- the update flow updates the service worker instead of unregistering it;
- Cache Storage is cleared, but the service worker itself is retained;
- service-worker script updates bypass HTTP cache via `updateViaCache: none`.

No SQL required.

## Required test
Because this is the first build that installs the navigation service worker, do ONE normal refresh/reload after deploying 1.3.9.4 so the service worker can install and claim the app.

Then:
1. Confirm app says 1.3.9.4.
2. Fully close the installed PWA.
3. Reopen from the home-screen icon.
4. Confirm 1.3.9.4 loads without the Reload banner.
5. Repeat the close/reopen test a second time.
