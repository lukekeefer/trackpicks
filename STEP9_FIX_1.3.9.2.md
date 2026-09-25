# TrackPicks 1.3.9.2

Step 9 revision: stuck Reload/update banner.

Fixes:
- Update prompt now uses numeric semantic version comparison.
- Banner only appears when the deployed version is actually newer than the running app.
- A stale/older `version.json` can no longer cause an endless Reload loop.
- Reload clears Cache Storage and unregisters service workers on a best-effort basis.
- Reload navigates to a clean URL with fresh version/timestamp parameters.
- Button changes to `Reloading…` while processing.

No SQL required.
