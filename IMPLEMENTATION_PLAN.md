# Ahordian — Implementation Status & Remaining Work

Supersedes `tasks.txt`. Every item below is either **done and verified in a browser**,
**still open**, or **blocked on a decision**. Nothing is marked done on the strength of
"the code looks right" — the verification column names the check that proved it.

Verification harness (Playwright against system Chrome, `channel="chrome"`, so no
browser download):

```
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8123
python -X utf8 tests/qa_phase1.py      # session lifecycle, replay, mute/volume, Now Playing
python -X utf8 tests/qa_phase2.py      # visual pass: 13 screens, no functional emoji
python -X utf8 tests/qa_tasks.py       # aggregate sample status, all 5 drum voices audible
python -X utf8 tests/qa_verify.py      # synth fallback direct, panel/nav/guide geometry, highlight routing
python -X utf8 tests/qa_tone.py        # Settings -> Guitar Tone: both packs, lazy load, persistence
python -X utf8 tests/qa_practice.py    # practice routine cards, no uninterpolated ${...}, nav round-trip
python -X utf8 tests/qa_cof.py         # Circle of Fifths empty state, topbar cluster, nav glyphs
python -X utf8 tests/qa_mic_session.py # mic raises no session, survives nav, Stop ends the tracks
```

The suites are **tracked in `tests/`** as of Q-1 — see [`tests/README.md`](tests/README.md)
for setup, per-suite coverage and the known traps. They no longer live only in a Claude Code
scratchpad, which purges after 30 days and would have taken every "verified in a browser"
claim below with it. Screenshot-writing suites resolve their output from `__file__` into
`tests/screenshots/`, so the working directory no longer matters.

Current results: **qa_phase1 44/44**, **qa_phase2 30/30**, **qa_tasks 15/15**,
**qa_verify 30/30**, **qa_tone 25/25**, **qa_practice 20/20**, **qa_cof 20/20**,
**qa_mic_session 18/18** — 202 checks across eight suites, no known failures.

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

*Verified:* qa_phase2 30/30, and the re-taken `tests/screenshots/shot_fretboard-screen.png` /
`tests/screenshots/shot_topbar_status.png` confirm a single-row topbar and correct label
spacing.

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

## Open — Group P: Guided Practice (suggest *how*, then verify)

**The gap.** `App.generatePracticeRoutine()` (App.js:677) emits four prose cards and stops.
It tells the user *what* — "Drill G → C → D → Em transitions. Clean fret contact. 40 BPM",
"focus on full ring" — but never *how*, never times it, and never checks whether it happened.
There is no Start button, no timer, no record of having done it. The routine is a suggestion
printed to a div.

**The honest constraint on "verify".** "Clean fret contact" and "full ring" mean *all six
strings sounding, none muted or buzzing* — that is polyphonic note detection, and the current
detector is monophonic pitch tracking. So verification splits in two: the structural half
(timer, sequencing, self-report, history) ships now against no ML at all; the listening half
is **downstream of tasks.txt P1–P2** (Basic Pitch + chord inference) and must not be started
before them or it will be rebuilt. P-1…P-5 and P-9 are independent. P-6…P-8 are not.

Token figures are the Claude budget to implement *and* browser-verify each item, including
iteration — not a single-pass generation cost. Treat ±40% as normal.

**Revised 2026-08-04, down ~25–30% across the board.** The originals were budgeted before
`.claude/skills/` existed. Two costs they included are now largely gone:

- **Symbol discovery.** `references/codebase-map.md` lists the public surface of all 24
  modules for ~1.8K tokens, replacing the grep-then-read-then-grep-again loop that used to
  precede every change. Regenerate with `scripts/generate_codebase_map.py` (`--check` exits 1
  when stale) rather than trusting a stale map.
- **Domain re-derivation.** `guitar-audio-intelligence` carries tuning/MIDI, the frequency
  bounds, the latency arithmetic and the chord-scoring rules in ~1.1K always-loaded tokens,
  so the mic items no longer spend budget re-establishing them or exploring dead ends the
  skill already rules out.

What did **not** get cheaper is browser verification — Playwright iteration, audio proof via
`AnalyserNode`, and re-running the suites still dominate every item, which is why P-6/P-7 fall
proportionally less than the structural work.

| # | Task | Effort | Tokens | Depends on |
|---|---|---|---|---|
| P-1 | **Fix `${key}` rendering literally** in the Diatonic Triads title — App.js:720 used `'…'` where it needed a backtick, so the card read `Diatonic Triads in ${key}`. | done | ~2k | — |
| P-2 | **Structured routine model.** Replace `{title, desc, duration, icon}` with machine-readable targets: `{id, title, howTo[], duration, icon, verify: {type:'chord-sequence', targets:['G','C','D','Em'], bpm}}`. Nothing downstream can verify a prose string, so this is the enabling change — do it first even though it ships no visible feature. | 2–3 h | 45–65k | — |
| P-3 | **"How do I do this?" content.** Each step expands to concrete instruction: finger placement, what *clean contact* means, the common failure mode, what success sounds like. Plus deep links — Barre Chord Focus jumps to F Major in the Chord Explorer, Diatonic Triads to that key in the Circle of Fifths. Content-heavy, low risk; the deep-link targets are in `codebase-map.md` so the wiring no longer needs discovery. | 3–4 h | 60–90k | P-2 |
| P-4 | **Session runner.** Start / pause / skip / next, per-step countdown, auto-advance, progress bar, and the metronome auto-started at the routine BPM. Must register a stop handler with `AudioSessionManager` — a practice session is a sound source and the exclusivity rule applies to it like any other. | 4–5 h | 70–100k | P-2 |
| P-5 | **Self-report verification.** After each step: *Got it / Shaky / Skipped*, persisted per step id. This is the whole verify loop minus the microphone, and it is what makes P-8 possible. Ships real value with zero ML. | 2 h | 35–50k | P-4 |
| P-6 | **Mic verification v1 — chord hold.** User holds F Major; the app confirms all six strings ring and names the ones muted or buzzing. This is the first genuine answer to "focus on full ring". | 1–2 d | 150–220k | tasks.txt P1+P2 |
| P-7 | **Mic verification v2 — timed change drill.** G → C → D → Em against the click: did the change land on the beat, and was it clean on arrival. The real payoff for routine step 1, and the hardest item here — onset timing plus polyphonic identification under a metronome. | 2–3 d | 190–300k | P-6 |
| P-8 | **History and weak-spot targeting.** Per-step pass/fail over time, surfaced on the Practice screen, and `generatePracticeRoutine()` weighted toward what keeps failing instead of `Math.random()`. This is what turns four cards into a practice *programme*. | 3–4 h | 55–75k | P-5 |
| P-9 | **Extend `qa_practice.py`.** The suite already exists and passes 20/20 (card render, nav round-trip, and the uninterpolated-`${…}` assertion that pins the P-1 bug class). What it does not yet cover: timer advances and stops, the session registers *and releases* its audio session, and self-report persists across a reload. Extension of a working harness, not a new one. | 1–2 h | 40–55k | P-4 |

**Structural half (P-2…P-5, P-9): ~12–14 h, ~250–360k tokens** (was 350–500k). Ships a
practice session you can actually run and log.
**Listening half (P-6…P-8): ~4–6 d, ~395–595k tokens** (was 530–800k), and only after the
detection work.

Suggested order: P-2 → P-4 → P-5 → P-3 → P-9, then reassess once tasks.txt P1–P2 exist.
P-3 sits late deliberately — it is the easiest to write and the easiest to rewrite, so it
should follow the model that constrains its shape rather than lead it.

---

## Open — Group Q: Reproducibility and setup honesty

**The gap (Q-1, closed 2026-08-04).** The checks above were the only evidence that anything in
"Done" is actually done, and they existed in exactly one place: a Claude Code session
scratchpad that purges after 30 days. Nobody else could reproduce them, and once they were gone
every "verified in a browser" claim in this document became unfalsifiable. That was the single
largest risk in the repo — not a feature gap, the plan losing its own foundation. All eight
suites are now tracked under `tests/`.

A code review on 2026-08-04 also claimed the audio samples were not committed and that setup
required `python app/download_samples.py`. **That claim was wrong** — all 44 files
(38 guitar mp3 + 5 drum wav + LICENSES.md) are tracked, added in `a063715`, 1.5 MB total, and
the downloader skips files that already exist, so it is a re-fetch tool and a no-op on a fresh
checkout. But the review reached that conclusion honestly, by reading the default branch, and
nothing in the repo says otherwise. Q-3 exists so the next reader does not repeat it.

| # | Task | Effort | Tokens | Depends on |
|---|---|---|---|---|
| Q-1 | **Commit the `qa_*.py` suites under `tests/`** with their existing names — `qa_phase1`, `qa_phase2`, `qa_tasks`, `qa_verify`, `qa_tone`, `qa_practice`, and (found during the move) `qa_cof`, `qa_mic_session` — plus a short `tests/README.md` giving the server command and each suite's expected count. Keep the names: renaming breaks the mapping between a file and its documented pass count, and the natural-looking splits (`qa_audio`/`qa_ui`/…) do not match how the suites are actually organised — `qa_phase2` is 13 screens of visual assertions across every feature, `qa_verify` mixes synth fallback, panel geometry, nav and highlight routing. One confirming run after the move; no new assertions. | done | ~20k | — |
| Q-2 | **Stop tracking bytecode.** Two `app/__pycache__/*.pyc` files are tracked; `.gitignore` covers `.venv/` but has no `__pycache__/` entry. Add it and `git rm --cached` the two files. | done | ~4k | — |
| Q-3 | **Say what setup actually is.** README states that a fresh checkout already contains every sample and that `download_samples.py` is *re-fetch if assets are missing or corrupt*, explicitly not a required step. Then make the missing-asset path name its own remedy: `SampleStatus.PARTIAL` / `ERROR` already reach the UI through `onStatusChange` → `App.renderSampleStatus()`, so the fallback is not silent, but the text is generic where it could say *run `python app/download_samples.py`*. Browser-verify by removing one sample and reading the indicator. | done | ~15k | — |
| Q-4 | **CI, if wanted.** Only after Q-1, and not free: the suites drive real Chrome via `channel="chrome"` and assert audio levels through an `AnalyserNode`, so a runner needs system Chrome *and* an audio device, and the timing-sensitive checks (the ~2.5 s settling gap) are the classic shared-runner flake. Expect to quarantine the audio-level assertions and run the geometry/nav ones green first. | 2–3 h | 40–60k | Q-1 |

**Q-1 and Q-2 are done** (2026-08-04) — see below. Q-3 and Q-4 remain, and both are
independent of Group P.

### Q-1 — suites committed *(done)*

Eight suites live in `tests/`, not six: `qa_cof` (20) and `qa_mic_session` (18) were written
after the 164-check figure was recorded and bring the total to **202**. Two scratchpads held
divergent copies of `qa_phase1` and `qa_tasks`; the newer of each was taken by mtime, and
`qa_phase2` was byte-identical in both. No assertions were changed. `tests/README.md` carries
the server command, per-suite coverage, the `-X utf8` requirement on Windows, the deliberate
absence of `playwright install`, and the traps that produce false failures.

### Q-1a — screenshots moved out of the repo root *(done)*

20 tracked `shot_*.png` / `v_*.png` were sitting at the repository root because five suites
wrote them CWD-relative. They are now `git mv`-ed to `tests/screenshots/`, and each of those
suites resolves `SHOTS` from `__file__`, so the run location is free and re-running a suite
overwrites its baseline in place — `git diff --stat tests/screenshots` is the visual-regression
signal. *Verified:* `qa_cof` run from an unrelated working directory, 20/20, zero PNGs written
to the CWD.

### Q-3 — setup honesty, README half *(done)*

Two README claims were false as of `a063715` and have been corrected: the Technical Hardening
bullet said drum WAVs are "intentionally **not** bundled … until you supply a CC0 pack", and a
closing blockquote said the five WAVs "will 404 in a clean checkout". All 44 files ship. The
README now states that there is no asset-download step, that `download_samples.py` is a
re-fetch tool that no-ops on a clean checkout, that the drum kit is CC-BY 3.0 and its
attribution is a licence condition, and it points at `tests/` for verification. It also flags
that the documented port (8000) is not the port the suites hardcode (8123).

### Q-3 — setup honesty, in-app half *(done)*

`App.renderSampleStatus()` now appends `<span class="sample-pack incomplete">Run: python app/download_samples.py</span>` to the status label when `PARTIAL` or `ERROR` occurs, making the fallback remedy clear directly in the UI.

### Q-2 — bytecode untracked *(done)*

`__pycache__/` and `*.py[cod]` added to `.gitignore`; the two tracked
`app/__pycache__/*.pyc` removed with `git rm --cached`. *Verified:* `git ls-files | grep -c
pycache` → 0.

---

## Blocked — needs your decision

- **`origin/main` is 22 commits behind `dev`** and is the GitHub default branch
  (`origin/HEAD → origin/main`). It has **no `app/static/audio/` directory at all**, no
  `download_samples.py`, no `SampleManager.js`, no `audio/` module dir and no
  `AudioSessionManager` — 14 files under `app/static/js/` against the current 24. It predates
  the entire audio-session architecture. So a `git clone` or a browse of this project shows a
  months-old app, which is what caused the 2026-08-04 review to conclude the samples were
  missing. Merging `dev` → `main` fixes that and nothing else on this list depends on it, but
  it is a push to a shared default branch, so it needs your explicit go-ahead rather than
  being inferred.

*(The former drum-asset block here was resolved — see Group 3.3 in Done.)*

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
