# Development Instructions

## NEVER grep minified/bundled JS files

**DO NOT** run grep, rg, or similar on files like:
- `/tmp/strudel-bundle.js`
- `/tmp/strudel-web-bundle.js`
- Any file under `node_modules/`
- Any `.min.js` file

These files have lines that are 100s of KB long. Grep output will overwhelm
the terminal, cause unresponsive states, and waste time.

### What to do instead
- Read the **package README/docs** first
- Use `curl -sL` to fetch **source files** from unpkg/npm (e.g. `web.mjs`, not `dist/index.mjs`)
- Check the project's **source repository** on Codeberg/GitHub
- If you must inspect a bundle, use `sed -n 'START,ENDp'` with known line numbers
  or `dd bs=1 skip=X count=Y` to extract small byte-range snippets

## Architecture

- **strudel-engine.js** — Audio engine module using individual `@strudel/*` npm packages
  (`core`, `webaudio`, `transpiler`, `mini`, `tonal`, `soundfonts`).
  Exports: `init()`, `evaluateCode()`, `resume()`, `pause()`, `stop()`, `seekToCycleFromMs()`.
- **app.js** — Pure UI: CodeMirror editor, sidebar song list, playback controls.
  Delegates all audio to the engine module.

## No-op polyfills (strudel-engine.js → `installPolyfills()`)

The following Pattern methods are **no-ops** because the full strudel REPL
visualization layer (`@strudel/draw`, canvas draws) is not integrated yet:

| Method | Underscore variant | Notes |
|---|---|---|
| `.piano()` | — | Keyboard visualization |
| `.pianoroll()` | `._pianoroll()` | Piano-roll draw |
| `.scope()` | `._scope()` | Oscilloscope |
| `.punchcard()` | `._punchcard()` | Punchcard grid |
| — | `._spectrum()` | Spectrum analyzer |

Additionally, `window.slider()` and `window.sliderWithID()` return their
default value instead of creating interactive UI controls.

### TODO: Implement visualizations
- Integrate `@strudel/draw` or a custom canvas for `.pianoroll()`, `.scope()`,
  `.piano()`, `.punchcard()`, `._spectrum()`.
- Implement interactive `slider()` / `sliderWithID()` controls in the UI
  (currently they just pass through the default value).

## Common preset bugs (chrisZdk / Pink Chaos)

These patterns recur in presets and produce console warnings:
- **`.pan("0 3 ...")`** — `3` is a typo for `.3`. Strudel pan 0–1 maps to
  Web Audio StereoPanner -1–1, so `3` → value `5` (clamped).
- **`.compressor(.85)`** — `0.85` is passed as threshold in dB but valid range
  is [-100, 0]. Use `-10` for light compression.
- **`.scale('D minor')`** — Spaces not allowed; use colon: `.scale('D:minor')`.
