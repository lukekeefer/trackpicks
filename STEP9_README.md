# TrackPicks V1.3 Step 9
## App version: 1.3.9

This is the V1.3 stabilization / regression QA build.

Primary code fix:
- hardens the bottom Full Slate / Slip navigation for iOS Safari and installed PWA safe-area / viewport behavior.

No SQL migration is required for 1.3.9.

Deployment:
1. Replace the current GitHub frontend files with this package.
2. Commit to `main`.
3. Confirm app version `1.3.9`.
4. Run `STEP9_QA_CHECKLIST.md`.

If a Step 9 regression needs a fix, the next build becomes `1.3.9.2`.
