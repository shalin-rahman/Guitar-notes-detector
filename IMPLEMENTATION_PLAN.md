# Ahordian — Implementation Status & Remaining Work

Supersedes `tasks.txt`. Every item below is either **done and verified in a browser**,
**still open**, or **blocked on a decision**. Nothing is marked done on the strength of
"the code looks right" — the verification column names the check that proved it.

Verification harness (Playwright against system Chrome, `channel="chrome"`, so no
browser download):

```
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8123
python -X utf8 qa_phase1.py     # session lifecycle, replay, mute/volume, Now Playing
python -X utf8 qa_phase2.py     # visual pass: 13 screens, no functional emoji
python -X utf8 qa_tasks.py      # aggregate sample status, all 5 drum voices audible
```

Current results: **qa_phase1 43/44**, **qa_phase2 30/30**, **qa_tasks 17/17**. The one
qa_phase1 failure is the drum-WAV 404s — the open decision at the bottom of this file,
not a code defect.

---

## Done

### Group 1 — Session lifecycle

`AudioSessionManager` previously mutated a `Set` and held no reference to any engine, so
a "cleared" session kept producing sound; `Metronome.start()` was additionally
non-exclusive, so Jam→Metronome left both sounding.

Now: a stop-handler registry (`registerStopHandler(type, fn)`), an exclusive
`startSession()` that sweeps a *snapshot* of the active set and invokes each handler
before adding the new session, a re-entry guard (`_stopping`) that collapses the cascade
into one `notifyStateChange()`, and per-handler `try/catch` so one failing engine cannot
abort the sweep. Handlers are late-bound closures (`() => this.tabPlayer?.stop?.()`)
because Tab Player / Ear Training / Lessons are lazy-initialised in the nav handler.
`Metronome.start()` passes `{ exclusive: true }`. `NOTE_PREVIEW` and `ANALYSIS` stay
unregistered — a type with no handler means "nothing to stop", not an error.

`showScreen(target)` is extracted from the nav click handler, so navigation and audio
teardown are separable.

*Verified:* qa_phase1 — six override sequences in both directions, each followed by an
"exactly one session active" assertion; navigation stops real sound and leaves no
orphaned session; the stolen-from screen's Play button re-enables and its Stop disables.

### Group 2 — Detection replay lifecycle

Replay called `fbBtn.click()`, which ran the whole nav handler including `stopAll()` —
it destroyed the audio it was about to use. The loop also had no abort guard, so
navigating away left up to 32 s of notes playing on an abandoned screen, and two
overlapping replays were possible.

Now: replay calls `showScreen('fretboard-screen')`; the loop checks `_replayAbort` /
`_replayId` each iteration, mirroring the existing `sequenceAbortFlag` idiom rather than
inventing a second one; the existing button toggles `Replay (n)` ⇄ `Stop` instead of
adding a second control; history entries carry `{ note, t }` so the user's rhythm is
preserved, with inter-onset gaps clamped to 80–1200 ms and a 500 ms fallback for legacy
string-only entries. A `REPLAY` session type is registered so the pill shows it and
exclusivity can interrupt it. The 64-entry cap is unchanged.

This is rhythm-*approximating* replay driven by `performance.now()` onsets — not
sample-accurate scheduling, and it is not described as such anywhere in the UI.

*Verified:* qa_phase1 — empty history disables the button; replay survives its own
navigation; Replay→Jam stops the replay; navigation mid-replay halts notes and fretboard
writes; repeated replays never overlap.

### Group 3.4 / tasks.txt 1 — Aggregate sample-loading state

Two packs load concurrently against one shared `SampleManager`, and each
`loadSamplePack()` call used to compute `READY`/`PARTIAL`/`ERROR` from its own `total`.
Whichever finished last owned the verdict, so a complete guitar pack reported `ERROR`
when drums 404'd.

Now `SampleManager` accumulates across packs (`_expected` / `_loaded` / `_pending`) and
reports a verdict only when `_pending` reaches 0. It also keeps a `packs` map keyed by
label, exposed as `getPackProgress()`, so the UI can render one aggregate line with a
per-pack breakdown: `AUDIO  ✓ Guitar 6/6  ⚠ Drums 0/5`. `GuitarSampler` and
`DrumSampler` pass their labels. `App.renderSampleStatus()` renders it from classes only
(`state-ok` / `state-warn` / `state-error`, `.sample-pack.incomplete`).

An incomplete pack **stays on screen** — it no longer auto-hides after 4 s. The synth
fallback must not conceal missing production assets.

The `loaded++` increments inside concurrent async callbacks are safe only because JS is
single-threaded per tick; that is now stated in a comment at the site.

*Verified:* qa_tasks — both packs listed with their own SVG mark, guitar reports 6/6
while drums report 0/5, the drum chip carries `.incomplete`, and the aggregate state is
`warn`/`error` rather than `ok`.

### Group 3.3 (partial) / tasks.txt 2 — Drum synth fallback

`playSynthDrum()` had branches for `kick`, `snare`, `hihat` only. For `ride` and
`hihat-open` it built and connected an oscillator and gain, then returned without
`start()` — silent, and leaking a connected node per hit. All five voices now have
branches, and the trailing `else` disconnects both nodes so an unknown voice cannot
leave an unstarted oscillator wired into the graph.

*Verified:* qa_tasks measures peak amplitude on `sessionManager.masterGain` through an
`AnalyserNode` while each voice fires — kick 0.88, snare 0.88, hihat 0.44, hihat-open
0.39, ride 0.32. An unknown voice (`cowbell`) throws nothing and measures 0.00000.

### Group 3.2 — Guitar samples

`download_samples.py` is now path-independent (`BASE_DIR = Path(__file__).resolve().parent`),
so it no longer silently writes to the wrong tree when run from the repo root. All six
CC0 FatBoy nylon MP3s are present.

*Verified:* qa_phase1 network capture — all six guitar requests return 200.

### Group 4 — Incorrect label

The drop zone read "Analyze Server-Side"; the drop path runs entirely in the browser
(`FileReader` → `decodeAudioData` → `PitchDetector.autoCorrelate`). Now reads "Analyze
Locally" (`index.html:220`). The `/analyze` endpoint still exists but the drop zone does
not use it.

### tasks.txt 4 — Functional emoji removed

One visual language: Feather-style inline SVG, single 24×24 viewBox,
`fill="none" stroke="currentColor" stroke-width="2"`, all of it in `Icons.js` — no
per-icon files. Markup declares a role (`data-icon="loading"`) and `hydrateIcons(root)`
injects the SVG, idempotently via `data-icon-done`.

Two traps this pattern carries, both now handled:

- `textContent =` wipes a hydrated SVG. Use `setBtnLabel()` / `setIconOnly()`, which
  rebuild icon and label together.
- Moving a hidden default from an inline style into CSS breaks
  `el.style.display === 'none'` (reads `''`) and `el.style.display = ''` (leaves the
  element hidden). The status renderer therefore toggles classes only.

*Verified:* qa_phase2 scans all 13 screens for pictographs by codepoint range.

### tasks.txt 5 — Jam Station visual finish

Separate panel with a gold `border-top` and purple gradient, `JAM STATION` /
`VIRTUAL BAND` heading, Progression / Key / Solo-Guide row, Play/Stop transport, and a
Tempo / Guitar / Drums mixer row with the BPM value right-aligned. A polish pass, not an
architectural change.

Two defects found by reading the screenshots — both root-caused in CSS, not patched
around:

- The topbar wrapped onto three rows. There was **no `.topbar-right` rule at all**, so
  the flex `.master-vol-control` became block-level and claimed its own line. Added a
  `flex` / `nowrap` rule. (My first hypothesis — the global
  `input[type=range] { width: 100% }` — was wrong; `.master-vol-control input[type=range]`
  already pins 80 px.)
- "Tempo120 BPM" ran together because `.settings-mini label { display: block }`
  out-specifies a bare `.jam-slider-label` (0,2,0 vs 0,1,0) regardless of source order.
  Fixed by qualifying the selector as `.settings-mini label.jam-slider-label`.

A related source-order trap: `.is-hidden` (style.css:1569) comes *before* `.sample-status`
(1584), so at equal specificity the later rule wins and `.sample-status.is-hidden` is
required.

*Verified:* qa_phase2 30/30, and the re-taken `shot_fretboard-screen.png` /
`shot_topbar_status.png` confirm a single-row topbar and correct label spacing.

---

## Screenshot review — complete

All 13 qa_phase2 screens were read. Layout is correct on every one; no regression from the
inline-style removal. The "SCALES & RAAGS" / "BENGALI PATTERNS" mid-row clipping is **by
design** — `.fb-btn-group` (style.css:601) is `overflow-y: auto; min-height: 0`, a
deliberate scroll container inside a flex parent.

Two real defects were found in the review, both root-caused rather than patched at the
call site:

- **Nav icons rendered ~100 px tall**, pushing nav items past the sidebar bottom and
  clipping the "Scale Explorer" label. The nav SVG strings in `Icons.js` carry a
  `viewBox` but no `width`/`height` (unlike `icon()`, which emits explicit dimensions),
  so as flex children they fell back to the replaced-element default. Fixed with
  `.nav-btn > svg { width: 20px; height: 20px; flex-shrink: 0 }`. This is why *inline*
  icons were always fine and only nav icons blew up.
- **Settings → Default Tuning rendered as an empty select.**
  `StorageManager.DEFAULT_SETTINGS.defaultTuning` was
  `'Standard (E2-A2-D3-G3-B3-E4)'`, which matches no `<option>` value — the options are
  generated from `AppConfig.ALTERNATE_TUNINGS` names (`"Standard"`, `"Drop D"`, …), and
  `select.value = x` with no matching option silently selects nothing. Fixed in two
  places: the stored default is now `'Standard'`, and `applySettings()` falls back to
  `selectedIndex = 0` for users holding the old saved string.

All three suites re-run after both fixes — no regression.

---

## Cosmetic pass — done

Four things the screenshot review surfaced as taste rather than defect, now closed:

- **Scale Explorer nav glyph** was literally a smiley face → ascending steps.
- **Interactive Fretboard and Tab Player shared one music-note glyph.** Fretboard now
  gets strings-crossing-frets; Tab Player keeps the note (it is the "& Songs" screen).
- **Topbar metronome cluster** was a bare number input plus two native selects. Now one
  glass pill with a boxed BPM field and selects, mirroring `.master-vol-control` on the
  other side of the topbar. It is deliberately *not* given `.styled-input` — that class
  is `width: 100%` and would blow the row apart. `#metronome-light` gets shape and a
  resting colour only, because `Metronome.onTick` drives its background inline.
- **Circle of Fifths empty state** rendered three bare `--` rows plus two section
  headings with nothing under them. The metadata is now wrapped in `#cof-key-meta`,
  hidden until `selectKey()` runs, with `#cof-empty-hint` in its place. Checkboxes get
  `accent-color: var(--primary)` rather than a hand-built `::before` box, which would
  have lost keyboard focus and the indeterminate state.

*Verified:* `qa_cof.py` 20/20 — empty state shows the hint with no `--` and no orphaned
headings; after clicking a wheel segment the title reads `C Major (Ionian)` with 7 note
pills, 7 diatonic triads, and a populated signature; the metronome cluster measures 37 px
inside a 58 px topbar with a 46 px BPM field; and the three reworked nav glyphs are
mutually distinct at 20 px. qa_phase1 43/44, qa_phase2 30/30, qa_tasks 17/17 — no
regression.

---

## Blocked — needs your decision

**Drum sample assets (Group 3.3).** Five WAVs are referenced and no source is defined;
`LICENSES.md:10` says only that they are "intended to be user-supplied". Until a CC0
pack is named, `download_samples.py` cannot be extended and `LICENSES.md` cannot be
completed, and qa_phase1 stays at 43/44.

The synth fallback covers all five voices and is verified audible, so the app is usable
— but Acoustic Audio is not a complete feature while the production assets are absent,
and the status line now says so instead of hiding it.

---

## Deferred — do not start without confirmation

- **Controller extraction.** `App.js` is ~1250 lines and does want decomposition into
  `AudioController` / `NavigationController` / `PracticeController` /
  `DetectionController` / `JamController`. This is the next architectural cleanup, not
  urgent, and explicitly not to be started while audio lifecycle behaviour is in flux.
- **Product features.**

## Explicitly out of scope

- No `PlaybackManager` — `AudioSessionManager` is the right owner.
- No `setVolume()` on `AudioPlayer` / `DrumSampler` — `setInstrumentVolume()` already
  covers it via dedicated gain nodes.
- No refactor of working architecture for the sake of clean code.
