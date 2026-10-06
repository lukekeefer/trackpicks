# TrackPicks Importer — FROZEN

Canonical importer baseline: **TrackPicks 2.10.1**

The entire screenshot importer subsystem is frozen. Do not refactor, clean up,
relocate, simplify, restyle, or otherwise modify it unless the user explicitly
requests importer work.

This includes the parser/OCR pipeline, sportsbook parsing, reconciliation,
full-screen takeover workflow, review flow, stitched parlays/teasers, duplicate
handling, state transitions, event handlers, completion/cancel behavior, and
the 2.10.1 takeover UI/CSS.

Future TrackPicks work must be built around this subsystem.

## Canonical function fingerprints (SHA-256)

- `queueScreenshotFiles` — `533c29c40342d1c6539487dfde27c3320874e6e20348a8dbb2ac1267f2a1e832`
- `ensureScreenshotOcr` — `0a43916946a6ed96afd4a7e00e3a692f159fe8f20a52205089115325d15c5968`
- `prepareScreenshotForOcr` — `3dbf6dda9989592fcb4058764d512ee5e49dd71dfd9bf5f64d407a44e159f182`
- `normalizeOcrBetText` — `3fb76d0d3961c29cea3b2c2949c6e660b87bb2b2ff808b026b61ad44105fc777`
- `detectScreenshotSportsbook` — `9420151aa60940eda6db7f986f87c916a4a829350e8fd7406a0493aa9052a8c7`
- `parseCompactScreenshotCandidates` — `efc031b783cb98a05d2663c19109afa681bdeca90b2b405d409858ac9dafe68e`
- `parseScreenshotCandidates` — `bf23e1230afc64888e817aa02888a73241e0edb209f93c3ef64ff44258941de6`
- `normalizeImportTeamText` — `d18a8d687a24c0590828754fe9700abb75ba87d064317a1aebc80a8f501fd03d`
- `importTeamForms` — `c2708a44378fb7abacc785d7ac722c4fb4ed593ed5ddac1138d2d48e372bab07`
- `importOcrConfusablePhraseMatch` — `7a859451e0ab36615785620d9c6af5a58b2d0f7a21a0ba4b376ac307d52aa1e1`
- `importOcrSchoolPrefixMatch` — `46dd5336adae72ddef8165bad5461ef58c0161833879f3f5fe9deed16af702c5`
- `importTeamTextScore` — `2d3611e1f8e74317096d883bb182efebf8c653c160dd529628264b7935febfcf`
- `extractImportTeamClues` — `229b268fbda0cb905f652dafb95fcca549a3897c498c74afea23cf5b58a4d614`
- `scoreImportCandidateForGame` — `b45c12b58d1e7680f86a3d5b9fc8359061f2977bfc00ff52e87faefd14960527`
- `extractImportMatchupPair` — `74596f653cead1761492e8a6ebbbf137f382a3c245f4d798828eb3bf16f3783b`
- `importTruncatedTeamSideScore` — `59d1be2d9143257187f57daf4155202994dd5dc4704b8297c3c88b5ee2f2cc4b`
- `directImportMatchupForGame` — `b89679052258ee57b87a546a4660b1b2bae0c9072dba1f196f567d1854918680`
- `bestImportGameMatch` — `b5bca8a0deb394afe805a6030026c05643ac46f480993429594c78df91259ff4`
- `buildImportReconciliationDiagnostic` — `2ad489383e7f87129ab75fb5791b3739e67eb56b8dfa22e49448657ccf0501df`
- `canonicalImportSelectionForMatchedGame` — `54a63ea298c1622657c67a613e4de4d62154d6861e45d04d10fbaa40c44d91f4`
- `finalizeScreenshotCandidateReadiness` — `b4a72cee6b3c25b775e1137260f8630f82392d9f7a270da459950716dd64158c`
- `matchScreenshotCandidateToWeek` — `d0a963a9c2acdd05e82f90ab5e50432abe4d10f32d4cabeef7352a5c8e89b005`
- `matchScreenshotCandidatesToImportWeek` — `bcd9be21b6191ebe1d99c5c45568c3bc6fcebcb756b852b3b096690204552a9b`
- `buildScreenshotParserDiagnostic` — `b52639442f6ef2eb1138424c6faf47590744f88f4418c4d51b56f62e136a7ce3`
- `processScreenshotBatch` — `239e2f7ffb789583b7d3d4737c12c455f0a3097a2a488b600b97bcae6aa26a83`
- `screenshotSelectionFitsMatchedGame` — `f976464a39e3fd88bec8d84dd1a0d0a34703d8a4576368753b705529f871fb0a`
- `screenshotCandidateQuality` — `be7d0382e874930e7db93fee792cf1758a8c6862f05f3f9260a3ebebc7fac001`
- `screenshotCandidateMergeKey` — `97682d6d8569cf3b220f51ef2a6eb56db3f3f1311e048a44eec26b0a351b5999`
- `mergeScreenshotCandidateEvidence` — `e8473224262be5186ffddd1c78ae46802e1ba5b8443ffb783078ebd26e63a9d0`
- `reconcileScreenshotImportBatch` — `fa64f9575d784a008bb663ce780dd04f723a8e4bd69591c0cb0c32706ae8fdbd`
- `parseScreenshotMultiLegTicket` — `ec8482d1b48fd3ac920637c2ed97dd513009fb584de43eb6f9cf1a3251ac7c44`
- `screenshotCandidateToParlayLeg` — `74bb17f4f85137f5c26d92173c13a7afd378d93d0b062a932425c6cd76c576fd`
- `loadStitchedScreenshotParlay` — `21bf3cf372c2350abd21f2ea42cc4004fd4e6e138f5ecbce0ba438b457496164`
- `screenshotCandidateToWager` — `c62908f6c8c0acc1772215b53277d5101f12cd1aa2f58ac4c97baa889a95b345`
- `saveScreenshotCandidate` — `67099a9d672e920ac411971d5968475af70b7112460fcc5d7526d435601d8ef9`
- `startScreenshotSlipWorkflow` — `b68d1ecfcbcf6e9a0c85622db80b63e0947fa2bedf48c5abba9e02a68acaf4e8`
- `advanceScreenshotFlow` — `130cf7daab1ef298ad849bb11b80f8d69f0eede92f4a6894e60328866dd7f1af`
- `confirmReadyScreenshotBets` — `cc4e9031f72140bd80c2d859214dd9d64dd78c029de3e9d1dd36d76a23caa9f9`
- `resolveScreenshotDuplicate` — `b6e3914d22438afa876f54a94c543295f206abc506a5e2916e89258d23fb757e`
- `saveScreenshotReview` — `8cb54c979b6ad626666d66c52e5cf41acdfde0a4b34768c26f3f5a1f1a4cca45`
- `importCandidateLabel` — `9b9ca1a0b5236764f627eddb12b8932fa3229e207ce196244dc513d76a6d2f43`
- `renderScreenshotImportFlow` — `3a3d438d96c9c845f6baeb2e5af72823016794e010bc5bd49e6d2a28a6a15e6c`
- `renderScreenshotImporter` — `5a0811db05bfe6c4bdb1f12ac05e996a43ded7082f814da65657d732e5662612`

## Canonical 2.10.1 takeover CSS

- `tp-2-10-import-ui` — `73b07acc095e9e680879177cb17dd4095c763261f98e037c9fd2f78242856394`
