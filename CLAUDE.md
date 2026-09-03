# Ahordian — Guitar Notes Detector

Vanilla-JS ES-module frontend + FastAPI backend. **No build step, no framework, no bundler.**
Do not introduce one.

## Run

```
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8123
```

`[Errno 10048]` means a server is already bound to 8123 — check for a 200, don't restart.
`app/main.py` mounts `static/` at both `/static` and `/` with `html=True`, which is why
page-relative asset paths (`./audio/guitar/steel/E2.mp3`) resolve. Do not "fix" them to
absolute.

`window.AhordianApp` is the global app handle (not `window.app`).

## Layout

| Path | What |
|---|---|
| `app/main.py` | FastAPI app + static mounts |
| `app/engine.py` | backend logic |
| `app/download_samples.py` | fetches the bundled audio packs |
| `app/static/js/` | 24 ES modules — see `.claude/skills/guitar-audio-intelligence/references/ahordian.md` for who owns what |
| `app/static/audio/` | 19 steel + 19 nylon mp3s, 5 drum wavs, `LICENSES.md` |
| `IMPLEMENTATION_PLAN.md` | task groups, effort/token estimates, what's blocked |
| `tasks.txt` | product roadmap (P0 benchmarks → P4 detector UI) |

## Guitar audio work

Use the **`guitar-audio-intelligence`** skill whenever a task touches guitar audio,
detection, chords, transcription, samples, synthesis, or fretboard interpretation. Load only
the reference file the task needs.

Before proposing a new model or audio architecture: inspect the current implementation,
benchmark existing behaviour, and prefer incremental integration over replacement.

## Hard rules

- **`AudioSessionManager` owns all playback.** Register every source node. Never create a
  second audio manager and never start an unmanaged `AudioBufferSourceNode`.
- **`SampleManager.buffers` is one flat map.** Guitar keys must be `guitar:<tone>:<note>` —
  a bare note name collides between tones and overwrites silently, with no error anywhere.
- **After touching audio assets**, update `app/static/audio/LICENSES.md` and run
  `python .claude/skills/guitar-audio-intelligence/scripts/validate_audio_assets.py`.
  The drum pack is CC-BY 3.0 — attribution is a licence condition and must ship.
- **Fretboard panels must not scroll internally** and must size to their content. `.fb-page`
  is the single scroll container. "Avoid scroll" never meant "shrink the boxes".
- **Never present a detection result as certain.** Carry confidence end to end; never
  fabricate a confidence a model did not produce.

## Verification

Browser-verify audio and UI changes; code inspection is not verification. Playwright with
`channel="chrome"` (system Chrome — avoids the 150 MB download). Prove audio actually sounds
with an `AnalyserNode` on `sessionManager.masterGain`, not a try/catch that didn't throw.
The eight `qa_*.py` suites live in `tests/` — `tests/README.md` documents how to run them,
what each covers, and the traps that produce false failures. Screenshots go to
`tests/screenshots/`, never the repo root.
