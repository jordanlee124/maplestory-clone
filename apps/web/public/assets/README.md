# Approved runtime art

No approved replacement PNGs have been supplied. The game currently uses explicitly identified procedural placeholders.

`review/` contains six original AI-assisted **candidate** PNGs for the isolated `/art-validation` scene. They are not production-approved replacements. Provenance and hashes are in `art/source/review/`; the live game does not load this set.

Follow `docs/art/ART_DIRECTION.md` for new art. The first scene uses `/assets/validation/` exports and `packages/game-client/src/visuals/validationAssets.ts` approval/atlas metadata, with no fixed sprite cell size. Existing temporary assets retain their legacy `art/manifest.ts` contract. Do not copy visual regression PNGs or QA calibration markers into production art.
