# Verification suites

Every "verified" claim in [`IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) is backed by
one of the suites in this directory. They drive **real Chrome** through Playwright and assert
against the live DOM and the live audio graph — code inspection is not verification here.

## Running them

Start the server first. The suites hardcode `http://127.0.0.1:8123`.

```
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8123
```

`[Errno 10048]` means a server is already bound to that port. Check for a 200 rather than
restarting.

Then, **from the repository root** (several suites write screenshots to the current working
directory, and the committed `shot_*.png` / `v_*.png` live at the root):

```
python -X utf8 tests/qa_phase1.py       # 44 checks
python -X utf8 tests/qa_phase2.py       # 30 checks
python -X utf8 tests/qa_tasks.py        # 15 checks
python -X utf8 tests/qa_verify.py       # 30 checks
python -X utf8 tests/qa_tone.py         # 25 checks
python -X utf8 tests/qa_practice.py     # 20 checks
python -X utf8 tests/qa_cof.py          # 20 checks
python -X utf8 tests/qa_mic_session.py  # 18 checks
```

Each prints one line per check and a `N passed, M failed` summary. **They do not set an exit
code** — read the summary line. `-X utf8` is required on Windows: the check marks are non-ASCII
and the default console codepage will raise `UnicodeEncodeError` before any check runs.

## Setup

```
python -m pip install playwright
```

Deliberately **no** `playwright install`. The suites launch with `channel="chrome"`, which uses
the system Chrome already on the machine and avoids a ~150 MB browser download. If Chrome is not
installed, that is the one thing to fix — do not switch to bundled Chromium, because the audio
assertions were calibrated against Chrome's decoder.

## What each suite covers

| Suite | Checks | Covers |
|---|---|---|
| `qa_phase1` | 44 | Session lifecycle and exclusivity (six override sequences both directions), detection replay, navigation teardown, mute/volume, the Now Playing pill, and a network capture proving all 19 guitar + 5 drum requests return 200. |
| `qa_phase2` | 30 | Visual pass over all 13 screens: scans for functional emoji by codepoint range and for authored inline styles, and writes `shot_<screen>.png` for each. |
| `qa_tasks` | 15 | Aggregate sample-loading state across two concurrent packs, the per-pack breakdown chips, and all 5 drum voices audible through the sample path. |
| `qa_verify` | 30 | `playSynthDrum` called **directly** (the shipped samples otherwise shadow the fallback), fretboard panel geometry, sidebar density, User Guide expansion, and highlight routing across the three fretboards. |
| `qa_tone` | 25 | Settings → Guitar Tone: both packs load, nylon stays unfetched until selected, steel's buffers survive the switch, the choice persists across reload, pitch-shift fallback for unsampled notes. |
| `qa_practice` | 20 | Practice routine cards, the uninterpolated-`${...}` assertion, the session runner (timer, transport, audio-session acquire *and* release), self-report persistence across reload, and nav round-trip. |
| `qa_cof` | 20 | Circle of Fifths empty state, key selection, the topbar metronome cluster geometry, and that the three reworked nav glyphs are distinct at 20 px. |
| `qa_mic_session` | 18 | Microphone semantics against Chrome's fake capture device: detection raises no session and no pill, survives navigation, and Stop Detection ends the tracks. |

**Keep these names.** Each one maps to a documented pass count in `IMPLEMENTATION_PLAN.md`, and
the natural-looking regrouping (`qa_audio` / `qa_ui` / …) does not match how they are actually
organised — `qa_phase2` is 13 screens of visual assertions spanning every feature, and
`qa_verify` mixes synth fallback, panel geometry, nav and highlight routing.

## Known traps

- **A control on a non-active screen is invisible to Playwright.** Navigate to its screen first.
- **Audio assertions need a settling gap.** `qa_tasks` once measured the "unknown voice is
  silent" window with no gap and read the tail of the ~2 s ride sample the previous assertion
  had just fired. Anything asserting silence needs ~2.5 s of clearance.
- **Prove audio with an `AnalyserNode` on `sessionManager.masterGain`**, not a `try`/`catch`
  that did not throw. Several of these suites do exactly that; follow the pattern when adding
  assertions.
- `window.AhordianApp` is the global app handle, not `window.app`.
- Suites that assert sample counts hardcode them (19 guitar, 5 drums). Changing a pack means
  updating the assertion — a stale count here reads as a product defect and has already cost
  one debugging round.

## CI

`.github/workflows/python-app.yml` runs the static checks (`compileall`, FastAPI import) on
every push. It deliberately does **not** run these suites: they need system Chrome *and* an
audio device, and the timing-sensitive checks are the classic shared-runner flake. See Q-4 in
`IMPLEMENTATION_PLAN.md` for what enabling them would take.
