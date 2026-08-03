# Ahordian — Remaining Work Plan (dependency-ordered)

Supersedes `tasks.txt`, which is stale. Batches A, B, C, D and E described there are
already committed on `dev`:

| tasks.txt claim | Verified reality |
|---|---|
| `detectionHistory` not initialized | initialized — `App.js:136` |
| `replayHistoryBtn` not registered | registered `App.js:129`, wired `App.js:196` |
| Global mute / master / Now Playing missing | present — `index.html:85-98`, wired `App.js:179-208` |
| Nav still emoji | done — emoji stripped, `Icons.js` injected via `App.initIcons()` (`App.js:163`) |
| Jam BPM / guitar / drum sliders missing | present — `index.html:467-476`, wired `App.js:381-387` |
| Guide screen missing | present — `index.html:44`, `index.html:706` |

What follows is only what is actually still broken or absent.

---

## Group 1 — Session lifecycle (foundation; Group 2 depends on it)

### 1.1 Exclusive sessions never stop the previous engine

`AudioSessionManager.startSession()` (`AudioSessionManager.js:81-93`) mutates a `Set`
and nothing else:

```js
if (options.exclusive) { this.activeSessions.clear(); }
this.activeSessions.add(sessionTypeObj);
```

The manager holds no reference to any engine, so cleared sessions keep producing sound.
Session state and audible output diverge.

### 1.2 The override is asymmetric — two distinct failures

- `BackingTrackEngine.start()` → `startSession(JAM_TRACK, { exclusive: true })` (`BackingTrackEngine.js:93`)
- `Metronome.start()` → `startSession(METRONOME)` — **no options**, so non-exclusive (`Metronome.js:77`)

Therefore:

| Sequence | Current behaviour |
|---|---|
| Metronome → Jam | Metronome state cleared, metronome **still ticking**; pill says "Jam Station" |
| Jam → Metronome | Jam not cleared at all; **both** sound; pill says "Metronome" |

### 1.3 Five of seven session types are dead

`AudioSessionType` declares `METRONOME, JAM_TRACK, EAR_TRAINING, NOTE_PREVIEW,
TRANSCRIPTION, ANALYSIS, TAB_PLAYER` (`AudioSessionManager.js:1-9`). Only `METRONOME`
and `JAM_TRACK` are ever passed to `startSession`. Tab Player, Ear Training and mic
transcription never appear in the Now Playing pill and are invisible to exclusivity.

### Fix

**`AudioSessionManager.js`** — add a stop-handler registry:

- `this.stopHandlers = new Map()` in the constructor.
- `registerStopHandler(sessionTypeObj, fn)`.
- `startSession(type, { exclusive })`: when exclusive, snapshot
  `Array.from(this.activeSessions)`, and for every entry `!== type` invoke its handler
  then `delete` it — **before** adding the new session and before `notifyStateChange()`.
- `stopAll()`: same, over every active session.
- Guard against re-entry: handlers call `engine.stop()`, which calls
  `stopSession()` → `notifyStateChange()`. Set `this._stopping = true` around the
  sweep, make `notifyStateChange()` a no-op while it is set, and fire one
  notification at the end. Iterate the snapshot array, never the live `Set`.
- Handler bodies must be exception-isolated (`try/catch`) so one failing engine
  cannot abort the sweep and leave the rest playing.

**`Metronome.js:77`** — pass `{ exclusive: true }` so both directions of 1.2 behave
identically.

**`App.js` `initAudioContext()`** (`App.js:893`) — register handlers. Tab Player, Ear
Training and Lessons are lazy-initialised in the nav handler (`App.js:245-260`), so
register late-bound closures, not method references:

```
METRONOME    -> () => this.metronome?.stop()
JAM_TRACK    -> () => this.backingEngine?.stop()
TAB_PLAYER   -> () => this.tabPlayer?.stop?.()
EAR_TRAINING -> () => this.earTraining?.stop?.()
```

Then start/stop `TAB_PLAYER` inside `TabPlayer`, and `EAR_TRAINING` inside
`EarTrainingManager`, mirroring how `Metronome` and `BackingTrackEngine` already do it.

`NOTE_PREVIEW` / `ANALYSIS` are one-shot and should stay unregistered — a session type
with no stop handler must be treated as "nothing to stop", not as an error.

### 1.4 Extract `showScreen()` (required by Group 2)

The nav click handler (`App.js:226-264`) mixes three concerns: screen switching, audio
teardown, and lazy init. Split the screen-switching half into
`showScreen(target)` and have the click handler call it. Group 2 needs to navigate
*without* tearing down audio; today it cannot.

Behaviour must be unchanged for real clicks — this is a pure extraction.

### Regression risk

`stopAll()` is called on every navigation (`App.js:240`). Once it actually stops
engines, any engine whose `stop()` is not idempotent will throw. Both current engines
are safe (`Metronome.js:85`, `BackingTrackEngine.js:107` — both just set a flag and
`clearInterval`), but verify the same for `TabPlayer.stop()` before registering it.

---

## Group 2 — Detection replay lifecycle (depends on 1.4)

`replayDetection()` is `App.js:860-891`.

### 2.1 Replay destroys the audio it is about to use

```js
const fbBtn = Array.from(this.elements.navBtns).find(b => b.dataset.target === 'fretboard-screen');
if (fbBtn) fbBtn.click();                       // App.js:871-872
```

Clicking the nav button runs the full nav handler, including
`this.sessionManager.stopAll()` (`App.js:240`). After Group 1 lands this becomes worse,
not better: `stopAll()` will start genuinely stopping engines mid-replay.

**Fix:** call `this.showScreen('fretboard-screen')` from 1.4 instead of `.click()`.

### 2.2 The replay loop has no abort guard

The `for` loop (`App.js:876-883`) checks nothing. `playSequence()` right below it does
this correctly with `sequenceAbortFlag` + `_currentSeqId` (`App.js:1140-1160`). So
navigating away mid-replay leaves the loop running — up to 32 s of notes and fretboard
writes on a screen the user has left, and two overlapping replays if the button is
re-armed.

**Fix:** mirror the existing idiom — `this._replayAbort` / `this._replayId`, checked
each iteration; set `_replayAbort = true` in `showScreen()`/the nav handler and in
`stop()`. Reuse the established pattern rather than inventing a second one.

### 2.3 No Stop Replay control

`index.html:176` has only `replay-history-btn`. Rather than add a second button, make
the existing one a toggle: `Replay (n)` ⇄ `■ Stop`, since it is already relabelled
during replay (`App.js:867`). Avoids new markup and a second disabled-state to reason about.

### 2.4 Replay discards the user's rhythm

`App.js:1210` pushes bare note names and replay hardcodes `noteDuration = 500`
(`App.js:874`), so every performance replays as a metronomic run.

**Fix:** push `{ note, t: performance.now() }`; keep the 64 cap (`App.js:1211-1212`).
On replay, convert to inter-onset gaps and **clamp** them — an unclamped gap replays a
30-second pause between two notes verbatim. Suggest clamping to 80–1200 ms, with a
fixed 500 ms fallback when a history entry predates the change (defensive: the array
can already hold strings from a session in progress).

Register a `REPLAY` session type so the pill shows it and Group 1 exclusivity can
interrupt it.

---

## Group 3 — Sample assets (independent of 1 and 2)

### 3.1 Path resolution is correct — confirmed, no change needed

`GuitarSampler.js:12-17` and `DrumSampler.js:8-12` use page-relative `./audio/...`.
`main.py:86` mounts `static/` at `/` with `html=True`, so `/audio/guitar/acoustic/E2.mp3`
resolves to `app/static/audio/guitar/acoustic/E2.mp3`. The paths are right; the files
are missing.

### 3.2 Guitar samples — tooling already exists

`app/download_samples.py` fetches the six CC0 FatBoy nylon MP3s. Its paths are relative
(`static/audio/...`), so it **must be run with `app/` as cwd** or it silently writes to
the wrong tree. Worth making the script path-independent (`Path(__file__).parent`) while
touching it.

`app/static/audio/` currently contains only `LICENSES.md` — zero audio files.

### 3.3 Drum samples — the one item needing your input

Five WAVs are referenced and no source is defined; `LICENSES.md:10` only says
"intended to be user-supplied". Options: extend `download_samples.py` to a specific
CC0 pack, or drop the files in manually. **Decision needed — I can't pick a licensed
source on your behalf.**

Independently fixable: `playSynthDrum()` (`DrumSampler.js:43-75`) has branches for
`kick`, `snare`, `hihat` only. For `ride` and `hihat-open` it creates and connects an
oscillator and gain, then returns without calling `start()` — silent, and leaks a
connected node per hit. Add branches or an early return.

### 3.4 SampleManager status race — real bug

`App.js:949-950` fires two packs concurrently against one shared `SampleManager`:

```js
this.player.loadSamples();      // guitar pack, 6 files
this.rhythmEngine.loadSamples();// drum pack, 5 files
```

Each `loadSamplePack()` call independently does `setStatus(LOADING)` and then computes
`READY`/`PARTIAL`/`ERROR` from *its own* `total` (`SampleManager.js:40-61`). The two
runs interleave and the last to finish overwrites the verdict. A fully-loaded guitar
pack reports `ERROR` when drums 404, and vice versa — so the "Audio Load Error (Using
Synth)" indicator (`App.js:937`) is already unreliable and will misreport during 3.2/3.3
verification.

**Fix before verifying samples**, or the indicator can't be trusted as a test signal.
Aggregate loaded/total across all packs on the manager instead of per call.

Also note `loadedCount++` inside concurrent async callbacks is only safe because JS is
single-threaded per tick — fine, but fragile; make it explicit when rewriting.

---

## Group 4 — Incorrect label (independent, trivial)

`index.html:217` reads "Drag & Drop Audio File to Analyze **Server-Side**". The drop
path runs `FileReader` → `decodeAudioData` → `PitchDetector.autoCorrelate` in the
browser. A `/analyze` endpoint does exist (`main.py:46`) but the drop zone does not use
it. Change to "Analyze Locally".

---

## Group 5 — Verification (last)

Run `python -m uvicorn app.main:app --reload` from the repo root.

**Session exclusivity (Group 1)**
- [ ] Metronome → Jam: metronome audibly stops; pill = Jam Station
- [ ] Jam → Metronome: jam audibly stops; pill = Metronome
- [ ] Tab Player → Jam and Jam → Tab Player both override
- [ ] Navigation away stops actual sound, not just the pill
- [ ] Pill hides on stop; Go button lands on the right screen
- [ ] Mute silences everything; unmute restores prior master volume
- [ ] No console errors from double `stop()` on a stopped engine

**Replay (Group 2)**
- [ ] Button disabled until first detection
- [ ] Replay navigates to fretboard and audio survives the navigation
- [ ] Detected rhythm audibly preserved; long pauses clamped
- [ ] Toggle stops replay immediately
- [ ] Navigating away mid-replay halts notes and fretboard writes
- [ ] Two rapid replays never overlap
- [ ] Legacy string-only history entries still replay

**Samples (Group 3 — after 3.4)**
- [ ] Zero 404s for `/audio/**` in the Network tab
- [ ] Guitar samples load; status indicator reads Ready
- [ ] Drums load, or synth fallback sounds on all five voices
- [ ] Deliberately break one URL → `PARTIAL`, not `ERROR`
- [ ] Break all → `ERROR` and synth fallback still plays

**Jam (regression only — already implemented)**
- [ ] BPM 40–250 changes live without restarting the track
- [ ] Guitar / drum / master volumes independent
- [ ] Progression, key, style changes; drums stay in sync

---

## Explicitly out of scope

- No `PlaybackManager` — `AudioSessionManager` is the right owner.
- No `setVolume()` on `AudioPlayer`/`DrumSampler` — `setInstrumentVolume()` already
  covers it via dedicated gain nodes.
- No `App.js` split. It is ~1250 lines and does want decomposition, but not while
  changing audio lifecycle behaviour. The only refactor here is `showScreen()` (1.4),
  which is a prerequisite, not cleanup.

## Order

```
1.1 → 1.2 → 1.3 → 1.4      (must be sequential)
        ↓
2.1 → 2.2 → 2.3 → 2.4      (needs 1.4)

3.4 → 3.2 → 3.3            (3.4 first, else 3.2/3.3 can't be verified)
4                          (any time)
        ↓
5                          (after all)
```

Group 3 and Group 4 are independent of Groups 1–2 and can be done in either order or
in parallel.

## Open decision

Drum sample source (3.3) — needs a licensed CC0 pack chosen before that item can close.
Everything else is actionable as written.
