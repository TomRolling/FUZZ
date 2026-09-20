# CLAUDE.md — src-tauri/

Guidance for the Tauri shell. This file loads only when working under `src-tauri/`.

## What this is

- [src-tauri/src/main.rs](src-tauri/src/main.rs) is intentionally minimal — it only registers plugins
  (`dialog`, `fs`, `clipboard-manager`, `updater`, `process`, `opener`) and opens the window. All game logic stays in
  `dist/jeu/`; do not add business logic to Rust.
- [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) — window size, bundle targets, and the updater
  endpoint/pubkey. `frontendDist` points at `../dist`, so anything referenced by `index.html` (the `dist/jeu/` scripts,
  images, fonts, `manifest.json`) must live under `dist/`.
- [src-tauri/capabilities/default.json](src-tauri/capabilities/default.json) — Tauri v2 permission grants
  (dialog, fs with full `**` scope, clipboard, updater, process restart, `opener` limited to
  `https://github.com/*`). Adding a call to a new `window.__TAURI__.*` API from `dist/jeu/` usually requires
  adding its permission here too — and mind that a permission may carry its own **scope** on top (see
  `opener`, where granting the command without declaring an allowed URL refuses every link).
