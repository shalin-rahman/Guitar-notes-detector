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
python -X utf8 qa_verify.py     # synth fallback direct, panel/nav/guide geometry, highlight routing
python -X utf8 qa_tone.py       # Settings -> Guitar Tone: both packs, lazy load, persistence
```

The `qa_*.py` scripts are **not tracked in this repo** — they live in the Claude Code
session scratchpad. Copy them next to the repo root before running.

Current results: **qa_phase1 44/44**, **qa_phase2 30/30**, **qa_tasks 15/15**,
**qa_verify 30/30**, **qa_tone 25/25** — 144 checks, no known failures.

Two harness bugs were fixed to get there, both stale assertions rather than product
defects: qa_phase1 hardcoded a 6-sample guitar pack (now 19), and qa_tasks measured the
"unknown voice is silent" window with no settling gap, so it was reading the tail of the
~2 s ride sample that the previous assertion had just fired.

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
per-pack breakdown: `AUDIO  ✓ Guitar 19/19  ✓ Drums 5/5`. `GuitarSampler` and
`DrumSampler` pass their labels. `App.renderSampleStatus()` renders it from classes only
(`state-ok` / `state-warn` / `state-error`, `.sample-pack.incomplete`).

An incomplete pack **stays on screen** — it no longer auto-hides after 4 s. The synth
fallback must not conceal missing production assets.

The `loaded++` increments inside concurrent async callbacks are safe only because JS is
single-threaded per tick; that is now stated in a comment at the site.

*Verified:* qa_tasks — both packs listed with their own SVG mark. With both packs now
shipped it reports Guitar 19/19 and Drums 5/5 and the aggregate state is `ok`; the
incomplete-pack branch (`.incomplete` chip, `warn`/`error` aggregate) was the state
verified while the drum WAVs were absent.

### Group 3.3 (partial) / tasks.txt 2 — Drum synth fallback

`playSynthDrum()` had branches for `kick`, `snare`, `hihat` only. For `ride` and
`hihat-open` it built and connected an oscillator and gain, then returned without
`start()` — silent, and leaking a connected node per hit. All five voices now have
branches, and the unknown-voice branch now builds **nothing at all** rather than creating
and connecting nodes before discovering it has no case.

It was also rebuilt on a noise source. Every voice except the kick body is now filtered
white noise from one shared, cached 2 s buffer (a deterministic LCG, not `Math.random()`,
so the timbre is byte-identical across runs and the peak assertions cannot go flaky).
The previous version had no noise at all — a 250 Hz triangle for the snare and square
waves for the cymbals — which is why it read as a test tone rather than a drum.

*Verified:* `qa_verify.py` calls `playSynthDrum` **directly**, because the shipped sample
buffers now shadow the fallback in `scheduleDrumHit` and qa_tasks therefore exercises the
sample path. Peaks: kick 0.95, snare 0.53, hihat 0.56, hihat-open 0.63, ride 0.41.
`cowbell` throws nothing and measures exactly 0.00000.

### Group 3.3 — Drum sample assets (was blocked)

Resolved. Five WAVs from **Pearl Master Studio Pack 1 by enoe**, via
[Oramics sampled](https://oramics.github.io/sampled/DRUMS/pearl-master-studio/), CC BY
3.0. Attribution is mandatory under that licence and is recorded in
`static/audio/LICENSES.md` with a reusable credit block. `download_samples.py` fetches
them (it previously only *printed* manual instructions).

*Verified:* qa_phase1 network capture — all 5 drum requests return 200, which cleared the
long-standing 43/44 failure. qa_tasks reports Drums 5/5.

### Group 3.2 — Guitar samples

`download_samples.py` is now path-independent (`BASE_DIR = Path(__file__).resolve().parent`),
so it no longer silently writes to the wrong tree when run from the repo root. `main()`
also collects failures and exits non-zero, because a missing sample silently degrades the
app to the synth fallback rather than failing visibly.

The pack went from 6 to 19 notes, and the soundfont changed — see "Acoustic guitar tone".

*Verified:* qa_phase1 network capture — all 19 guitar requests return 200.

### Acoustic guitar tone

The user reported the acoustic guitar sounded wrong. Three separate defects, not one:

1. **Six samples, nothing above E4.** One per open string, so every note past the 12th
   fret of the high E was stretched up from E4 — up to a full octave. That upward
   `playbackRate` shift is where the chipmunk artefact came from. Now 19 notes at roughly
   3-semitone spacing (E2…C6), so nothing shifts more than ~1.5 semitones.
2. **Nearest-sample chosen in linear Hz.** `Math.abs(targetFreq - sampleFreq)` is a
   linear metric on a logarithmic scale, so it systematically preferred the higher
   neighbour. Now `Math.abs(12 * Math.log2(target / sample))` — actual semitone distance.
3. **Asymmetric cutoff.** `diff < sampleFreq * 0.3` was ~+4.7 semitones upward but far
   less downward, for the same reason. Now a symmetric `<= 3` semitones.

### Guitar Tone setting — both soundfonts ship

Fixing the density above also changed the soundfont, from FatBoy nylon to MusyngKite
steel. That is a timbre change, not a defect fix, so rather than choose for the user both
tones now ship and Settings → **Guitar Tone** selects between them (both CC0, both via
`midi-js-soundfonts`): `steel` = MusyngKite `acoustic_guitar_steel` (default, bright),
`nylon` = FatBoy `acoustic_guitar_nylon` (mellow/classical). 19 notes each.

Three things this design has to get right:

1. **Namespaced buffer keys.** `SampleManager.buffers` is one flat `Map` shared by every
   pack, so two guitar packs covering the same note names would collide — the second
   loaded would silently overwrite the first, and switching back would play the wrong
   timbre with no error anywhere. Every guitar buffer key is therefore
   `guitar:<tone>:<note>`; `GuitarSampler.keyFor()` is the only place that shape is built.
2. **Lazy, memoised loading.** `GuitarSampler._loads` maps tone id → `loadSamples()`
   promise, so a cold start fetches only the chosen pack (19 files, not 38) and switching
   back to an already-heard tone is instant and refetch-free.
3. **Two application paths.** `App.applySettings()` runs in the constructor, before
   `initAudioContext()` creates `this.player`, so the tone is applied by a guarded
   `if (this.player) this.player.setGuitarTone(...)` for live changes *and* passed into
   `new AudioPlayer(...)` at construction for cold starts.

The `<option>` list is generated from the exported `GUITAR_TONES`, so a stored value can
never fail to match one and leave the select rendering blank.

`static/audio/guitar/acoustic/` was renamed to `guitar/steel/`; `guitar/nylon/` is new.

*Verified:* qa_tone — 25/25. Steel and nylon `A3` have different waveform fingerprints,
nylon stays unfetched until selected, steel's 19 buffers survive the switch, the choice
persists across reload, and an unsampled note (`A#3`) pitch-shifts from a nylon neighbour
at rate 1.0595 rather than dropping to the synth.

### RhythmEngine groove + double-swing bug

Patterns are velocity maps over 16 steps rather than 1/0 hit maps, and all five voices
are used. Before: `shuffle`/`swing` were plain aliases of `blues`, `straight` aliased
`rock`, and `playTick` only ever fired kick/snare/hihat at a flat velocity — so
`hihat-open` and `ride` were dead code and every triplet-feel style played straight.
There are now six genuinely distinct patterns.

Swing was also being **applied twice**. `BackingTrackEngine.advanceTick()` swung by
stretching alternate 16ths of the grid itself (`*= 1.33` / `*= 0.67`), which dragged
chord placement along with it; `RhythmEngine` then had its own feel. The grid is straight
now (`secondsPer16th()`) and `RhythmEngine` owns the feel, displacing individual drum
hits via `swingOffsetIn16ths()`. Do not reintroduce grid-level swing.

`playTick`'s `sixteenthDur` defaults to 0, which collapses every offset to zero — a
caller that cannot supply the tempo gets a straight feel rather than wrong timing.

### Fretboard panel density

The three panels (SCALES & RAAGS, CAGED / TNPS BOXES, BENGALI PATTERNS) had collapsed to
~20 px with their own scrollbars. **Two** compounding defects, not the one reported:

- `.fb-buttons-row` was `grid-template-columns: 2fr 1fr` with **three** children, so the
  third wrapped into an implicit second row and the two rows split an already-thin
  `flex: 1` remainder. Now `2fr 1fr 1fr`.
- `.fb-btn-group` was `overflow-y: auto; min-height: 0`.

The requirement is no scrolling anywhere *inside* these panels: they size to their
content (`flex: 0 0 auto`, no `overflow`, no `min-height`) and `.fb-page` is the single
scroll container.

*Verified:* qa_verify — all three panels share one row top (427 px, so no implicit second
row), neither the panels nor their inner `.button-grid`s scroll, and every populated panel
is ≥ 60 px (measured 274 px / 147 px). "CAGED / TNPS Boxes" measures 32 px on a cold load
because `#fb-position-filters` is empty until `CircleManager.updatePositionFilters()`
mirrors the buttons across — driving that grows it to 247 px, still without scrolling.

### Sidebar density

`.nav-btn` padding 10px 15px → 6px 12px, `font-size` 0.95 → 0.9rem, explicit
`line-height: 1.25`; `.nav-section-title` margin 15px/5px → 9px/2px; logo margin-bottom
30 → 16px. `.sidebar-nav` keeps `overflow-y: auto` as a safety valve for short viewports,
but at this spacing it never engages.

*Verified:* qa_verify — 13 nav destinations (12 in `.sidebar-nav`, Settings in
`.sidebar-footer`) plus 5 section titles, with `scrollHeight === clientHeight` on both
`.sidebar-nav` (838 px) and `.sidebar`.

### User Guide content cut off after expanding multiple sections

Flex children default to `flex-shrink: 1`, so once two or three sections were open the
column absorbed the excess by squashing them instead of overflowing — `.guide-page`'s
`overflow-y: auto` never engaged, and `.guide-section`'s own `overflow: hidden` clipped
the text. Fixed by pinning every child to its content height (`.guide-page > * { flex: 0 0 auto }`).

*Verified:* qa_verify — with 4 of 8 sections expanded, zero `.guide-section` elements have
`scrollHeight > clientHeight`, and every `.guide-page` child computes `flex-shrink: 0`.

### Fretboard highlight routing

*Verified:* qa_verify — three `FretboardManager` instances exist (`guitar-fretboard`,
`scale-exp-fretboard`, `chord-exp-fretboard`); exactly one reports `isVisible()` on the
fretboard screen; a `flashNotes(['C3','E3','G3'])` lights 3 `.fb-flash` nodes on the
visible board and **0 on either off-screen board**; and the flash is transient — 0
`.fb-flash` remain after the duration elapses.

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
inline-style removal.

~~The "SCALES & RAAGS" / "BENGALI PATTERNS" mid-row clipping is **by design** —
`.fb-btn-group` is `overflow-y: auto; min-height: 0`, a deliberate scroll container
inside a flex parent.~~ **Wrong, and overruled — this was a real defect.** See
"Fretboard panel density" under Done.

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

## Microphone session semantics — decided and closed

`AudioSessionType.TRANSCRIPTION` was declared and referenced nowhere, so the detector's
`start()` never opened a session. The decision: **a session type means "the user is
listening to this"**, and the microphone is input — there is nothing to hear and nothing
for exclusivity to silence. So the type is **removed rather than wired up**, and Now
Playing never represents the mic.

This is already the right split in the UI: the mic has its own topbar indicator
(`#mic-status`, "Live Detection Active" / "Microphone Off"), independent of the Now
Playing pill. It also explains a behaviour that is deliberate, not a leak — `enterScreen()`
calls `stopAll()`, which fans out only to *registered* handlers, so navigating away leaves
detection running and the fretboard mirrors it. `stop()` still ends the mic tracks.

`ANALYSIS` was dead for the identical reason (the drop path decodes and autocorrelates
without ever playing back) and is removed with it. The enum now carries only the six
genuinely audible types. A comment at the declaration records the reasoning, including the
condition for reversing it: if either ever gains real playback, add the type back *with* a
stop handler, because an unregistered type is silently unstoppable by navigation.

*Verified:* `qa_mic_session.py` 18/18 against Chrome's fake capture device — detection
raises no session and no pill; starting the metronome shows `Metronome` in the pill and
does **not** stop the mic; navigation clears playback sessions while detection survives;
Stop Detection ends the mic tracks and the badge returns to "Microphone Off".

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
mutually distinct at 20 px. qa_phase1 44/44, qa_phase2 30/30, qa_tasks 15/15, qa_verify 30/30 — no
regression.

---

## Blocked — needs your decision

*(none — the drum-asset block below was resolved; see Group 3.3 in Done.)*

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
