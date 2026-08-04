---
name: ahordian-frontend
description: Ahordian's UI conventions and the CSS/DOM traps that have caused real layout bugs — screen and nav model, the Icons.js hydration contract, flex/grid pitfalls, select population, and how to assert layout honestly. Use when changing index.html, style.css, or any DOM/render code.
---

# Ahordian Frontend

Vanilla ES modules, one `index.html` (869 lines), one `style.css` (2055 lines). **No build
step, no framework, no CSS preprocessor, no utility framework.** Do not introduce one.

## Screen model

13 screens, each a `.screen` section with `id="<name>-screen"`: `home`, `tools`, `detector`,
`fretboard`, `chord-explorer`, `scale-explorer`, `circle`, `practice`, `lessons`,
`ear-training`, `tab-player`, `guide`, `settings`.

Navigation is `.nav-btn[data-target="<name>-screen"]` in the sidebar. `App.showScreen(target)`
swaps visibility; `App.enterScreen(target, {stopAudio = true})` is the one that also tears down
audio. Use `enterScreen` for user navigation — `showScreen` alone leaves sound running.

A control on a non-active screen is **not visible to the DOM or to Playwright**. Anything that
must be read or driven requires navigating to its screen first.

## Icon contract

One visual language: Feather-style inline SVG, 24×24 viewBox, `fill="none"
stroke="currentColor" stroke-width="2"`, **all of it in `Icons.js`** — never per-icon files
(this was explicitly rejected). Markup declares a role (`data-icon="loading"`) and
`hydrateIcons(root)` injects the SVG, idempotent via `data-icon-done`.

- `textContent =` **wipes a hydrated SVG.** Use `App.setBtnLabel()` / `App.setIconOnly()`.
- `icon(name, {size})` emits explicit `width`/`height`. A raw inline `<svg>` with only a
  `viewBox` does **not** shrink as a flex child — it takes the replaced-element default
  (~100–150 px). That is why `icon()` output was always fine and hand-written nav SVG strings
  blew up. CSS must constrain those (`.nav-btn > svg`).

## Layout traps that have already caused bugs

- **A flex child defaults to `flex-shrink: 1`, so it squashes instead of overflowing** — and
  an ancestor's `overflow-y: auto` therefore never engages. Content vanishes with no scrollbar
  to reveal it. This was the User Guide "cut off after expanding multiples" bug; the fix is
  `.guide-page > * { flex: 0 0 auto }`.
- **A grid with more children than `grid-template-columns` entries silently creates an
  implicit row**, which splits the parent's `flex: 1` remainder and halves every panel's
  height. Detect it by asserting all siblings share one `getBoundingClientRect().top`.
- **Fretboard panels must be content-sized with no inner scrolling.** `.fb-page` is the single
  scroll container. `overflow-y: auto; min-height: 0` on `.fb-btn-group` starved them to ~20 px
  and was overruled twice: *"avoid scroll" meant the inner contents, never smaller boxes.*
- **Specificity beats source order.** `.settings-mini label` (0,2,0) out-ranks a bare
  `.jam-slider-label` (0,1,0) — qualify as `.settings-mini label.jam-slider-label`. At *equal*
  specificity the later rule wins, so `.is-hidden` sitting after `.sample-status` means
  `.sample-status.is-hidden` is required.
- **Never move a hidden default from an inline style into CSS.** It breaks both
  `el.style.display === 'none'` (reads `''`) and `el.style.display = ''` (stays hidden).
  Toggle classes only.
- **`select.value = x` with no matching `<option>` silently selects nothing** and renders
  blank. Any default feeding a select must match its option generator
  (`StorageManager.DEFAULT_SETTINGS.defaultTuning` ↔ `AppConfig.ALTERNATE_TUNINGS`), and reads
  should fall back to `selectedIndex = 0`.
- **`.styled-input` is `width: 100%`.** Never apply it to a control inside a flex row such as
  the topbar; restyle the native element locally.
- Style checkboxes with `accent-color`, not a `::before` box — the latter loses keyboard focus
  and the indeterminate state.
- `#metronome-light`'s background and box-shadow are written **inline** by `Metronome.onTick`,
  so CSS there may only own shape and the resting colour.

## Fretboard highlighting

Three `FretboardManager` instances exist, one per screen. Route a playback flash by
**visibility** (`isVisible()`), and use the transient `.fb-flash` path — never the persistent
marker path — for notes that are merely sounding.

## Asserting layout honestly

`scrollHeight > clientHeight + 1` is the only honest DOM test for "this box scrolls". A visible
scrollbar is not assertable, and a clipped box may show none at all. Code inspection is not
verification — browser-verify, and see the `verification-workflow` project memory for the
Playwright-via-system-Chrome setup.
