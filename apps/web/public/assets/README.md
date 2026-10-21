# Approved runtime art

The user approved the first visual direction on 2026-10-21. Fernreach now uses the reviewed adventurer, Fern Frog, platform, background/foreground and effect designs; other maps and unfinished monsters retain identified placeholders.

`review/` preserves the eight direction-approved raster masters, including: `twig-creature-v01.png` and `woodland-panel-v01.png`. Explicit live approval metadata is in `visuals/approvedAssets.ts`; source candidate history is preserved in `visuals/validationCandidates.ts`. Provenance and hashes are in `art/source/review/`. Full action coverage, character layer separation and final alpha/crop cleanup remain unfinished.

Follow `docs/art/ART_DIRECTION.md` and `ASSET_PIPELINE.md` for new art. The first scene combines explicit approval aliases with preserved review history from these existing URLs; there is no duplicate asset directory or fixed sprite cell size. Existing temporary assets retain their legacy `art/manifest.ts` contract. Do not copy visual regression PNGs or QA calibration markers into production art.
