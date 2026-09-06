# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

FUZZ is a French-language idle/incremental garden-clicker game (click → buy buildings → research → prestige →
ascend), packaged as a native desktop app with Tauri v2. The entire game — HTML, CSS, and JS — lives in one
file: [dist/index.html](dist/index.html) (~4360 lines). Tauri just opens a native window that loads this
static file; there is no separate frontend build step, bundler, or framework. `src-tauri/` is a thin Rust
shell (Tauri config + a handful of plugins) around that file.

The same `dist/index.html` also works standalone as a website/PWA (it detects `window.__TAURI__` at runtime
via `isTauriApp()` and falls back to browser APIs — `<a download>`, `navigator.clipboard`, service worker —
when not running inside Tauri).

## Commands

All commands run from the repo root (`package.json` lives here, not in a subfolder).

```bash
npm install                       # one-time: installs @tauri-apps/cli
npx tauri icon app-icon-source.png  # regenerate icons/.ico/.icns from the source PNG (run after changing app-icon-source.png)
npm run tauri dev                 # launch the native window pointed at dist/index.html (no dev server/HMR — it's a static file)
npm run tauri build               # build the installer for the current OS -> src-tauri/target/release/bundle/{msi,nsis,dmg,deb,appimage}/
```

There is no test suite, linter, or JS build/bundling step in this repo. To verify a change, run
`npm run tauri dev` (or just open `dist/index.html` in a browser) and play through the affected flow manually.

### Releasing

Releases are built by `.github/workflows/build.yml`, triggered by pushing a `vX.X.X` tag (or manually via
`workflow_dispatch`, which builds but doesn't publish). It builds Windows/macOS/Linux in parallel via
`tauri-apps/tauri-action`, regenerates icons, and creates a **draft** GitHub Release with all installers plus
a signed `latest.json` for the auto-updater. Before tagging a release:
1. Bump `"version"` in [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) — the in-app updater compares this.
2. The updater requires `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` GitHub secrets to
   already be configured (one-time setup, documented in [README.md](README.md)); the public key lives in
   `tauri.conf.json` under `plugins.updater.pubkey`.

## Architecture of dist/index.html

Everything is global functions/objects operating on one mutable `state` object (no framework, no modules,
no build step — just `<script>` tags in load order). When editing, find the relevant `// ================`
section comment rather than searching for a file.

Key structural pieces, roughly in file order:

- **`ITEM_SPRITES` / `BUILDINGS` (~L982-1050)** — static game-content config: building definitions
  (id, bilingual name/desc, `baseCost`, `baseCps`) and which items have pixel-art sprites. Cost scaling is
  `baseCost * GROWTH^n` (`GROWTH = 1.15`).
- **`UI_STRINGS` / `tr()` / `L()` (~L1054-1136)** — bilingual FR/EN system. `tr(key)` looks up a UI string in
  the current `state.lang`; `L(obj, field)` reads a bilingual field (`{fr, en}`) off a content object (e.g. a
  building's name). FR is the default/fallback language.
- **Dialogue & scenes (~L1137-1623)** — the Papi Feuillage / Leroy narrative system: `showDialogue` (single
  speaker popup), `showScene` (two-character JRPG-style face-off, used for the opening scene), a typewriter
  text effect, and `PAPI_LINES` pools of contextual one-liners (`pickPapiLine`/`papiSaysFromCategory`) shown
  on shop visits, quitting, returning after a break, etc.
- **Upgrade/config tables (~L1624-1841)**: `CLICK_UPGRADES`, `UNIQUE_BUILDINGS`, click cosmetics/skins,
  `RESEARCH_TREE` (knowledge-gated upgrades, tiered by prestige/ascension progress), `ASCENSION_UPGRADES`
  (Stellar Shards — never reset), `PRESTIGE_UPGRADES` (Cosmic Seeds), weather config, `ACHIEVEMENTS`, and
  `TAB_DEFS` — the list of UI tabs, each with an `unlock(state)` predicate controlling when it appears.
- **`defaultState()` (~L1843)** — the single source of truth for save-file shape. Persisted via `localStorage`
  under `SAVE_KEY = 'fuzzSave'` (with `LEGACY_SAVE_KEY = 'jardinIdleSave'` migration from before the game was
  renamed, and a `SAVE_KEY_BACKUP` safety copy). `SAVE_VERSION` gates `applyLoadedState()` migrations — bump
  it and add a migration step there when changing state shape in a way old saves can't just default-merge.
- **Economy/helpers (~L1971-2410)** — `totalCps()`, `clickGain()`, multiplier stacking (`totalProdMultiplier`,
  `achievementMultiplier`, `seedMultiplier`, `shardMultiplier`, weather/combo/boost multipliers), buy/sell
  logic per system (`buyBuilding`, `buyResearch`, `buyPrestigeUpgrade`, `buyAscensionUpgrade`, ...), and the
  prestige/ascension reset flows (`doPrestige`, `doAscension` — check what each does/doesn't reset before
  touching them).
- **Audio (~L2458-2572)** — procedural sound effects via Web Audio (`playTone` and friends), no audio files
  for SFX; background music uses `<audio>` elements with fade helpers. (Note: `dist/assets/audio/` currently
  has untracked files per git status — check before assuming audio assets are complete/committed.)
- **Timed events (~L2633-2807)** — weather changes, invasive weed spawns, daily quests (`generateQuests`,
  reset via `todayStr()`), daily login rewards (streak-based, `dailyRewardForDay`).
- **Navigation/modals (~L2859-3075)** — tab unlock/visibility logic (`unlockedTabs`, `renderTabsRow`), modal
  open/close helpers, and `queueOrShowPapi`/`flushPendingPapiCategories`, which queues Papi dialogue so it
  never overlaps another blocking UI (see `isMainScreenBlocked()`).
- **Render layer (~L3076-3690)** — one `render*()` function per panel/tab (`renderShop`, `renderResearch`,
  `renderPrestige`, `renderAscension`, `renderAchievements`, etc.), all called from `renderAll()`. There is no
  virtual DOM/diffing — renders re-generate `innerHTML` for their panel. `scheduleRenderAll()` debounces
  `renderAll()` calls for perf during rapid state changes (e.g. the idle tick).
- **Click/idle loop (~L3696-3913)** — click handler + particle/combo feedback, golden weed and butterfly
  random events, auto-buy, the idle tick (periodic `state.verdure` accrual), and offline-progress catch-up on
  load (`applyOfflineProgress`).
- **Export/import/reset (~L3914-4198)** — save code is base64(JSON) via `encodeSave()`/`atob`. File
  save/open and clipboard both branch on `isTauriApp()`: native uses `window.__TAURI__.dialog` +
  `window.__TAURI__.fs`/`clipboardManager`; browser falls back to a Blob download link /
  `navigator.clipboard`. `performFullReset()` preserves only the chosen language across a reset.
- **Updater UI (~L3915-4019)** — wraps `window.__TAURI__.updater`/`process`; entirely inert (hidden card) when
  not running inside Tauri, so this code path can't be tested in a browser.
- **Boot sequence (~L4249-4345)** — strictly sequential via callbacks (never parallel, to avoid flashing raw
  UI): splash screen → language picker (first run only) → silent update check/prompt → opening JRPG scene +
  tutorial (first run only) → daily login reward. Follow the existing reveal-callback pattern
  (`proceedToUpdateCheck`, `runOpeningIfNeeded`, etc.) if inserting a new first-run step.

## Tauri shell (src-tauri/)

- [src-tauri/src/main.rs](src-tauri/src/main.rs) is intentionally minimal — it only registers plugins
  (`dialog`, `fs`, `clipboard-manager`, `updater`, `process`) and opens the window. All game logic stays in
  `dist/index.html`; do not add business logic to Rust.
- [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) — window size, bundle targets, and the updater
  endpoint/pubkey. `frontendDist` points at `../dist`, so anything referenced by `index.html` (images, fonts,
  `manifest.json`) must live under `dist/`.
- [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json) — Tauri v2 permission grants
  (dialog, fs with full `**` scope, clipboard, updater, process restart). Adding a call to a new
  `window.__TAURI__.*` API from `index.html` usually requires adding its permission here too.
