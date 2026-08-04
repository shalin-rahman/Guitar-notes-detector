---
name: guitar-audio-intelligence
description: Domain knowledge for Ahordian's guitar audio work — pitch/onset detection, transcription, chord recognition, fretboard mapping, sampling, synthesis, and audio licensing. Use when implementing or changing anything that analyses or produces guitar sound.
---

# Ahordian Guitar Audio Intelligence

## Separate problems, separate algorithms

Conflating any two produces the wrong detector.

| Problem | Answers |
|---|---|
| Pitch detection | what frequency is sounding *now* |
| Onset detection | *when* a note started |
| Note transcription | pitch + onset + duration + confidence |
| Polyphonic transcription | several simultaneous notes, each of the above |
| Chord recognition | what harmony simultaneous notes *imply* |
| Voicing identification | which strings/frets produced it |
| Key estimation | what tonal centre fits the passage |
| Beat tracking | where beats and downbeats fall |
| Fretboard inference | which positions are plausible for these pitches |

- **Chord name ≠ note set.** `{C,E,G,A}` is C6 *or* Am7; bass note and key decide.
- **Pitch per frame ≠ a note event ≠ a chord label.** Each is evidence for the next.
- **A monophonic algorithm cannot be tuned into a polyphonic one.** `PitchDetector` returns
  one autocorrelation peak. Chords need a different algorithm, not better thresholds.

## Facts (answer from here — do not load a reference for these)

Standard tuning low→high `E2 A2 D3 G3 B3 E4` = MIDI `40 45 50 55 59 64`; adjacent intervals
**5 5 5 4 5**. Fret *n* adds *n* semitones. Range E2 (82.41 Hz) → D6 (1174.7 Hz) at fret 22;
bounding a search to **75–1350 Hz** kills most octave errors for free.

`midi = 69 + 12*log2(f/440)` · `cents = 1200*log2(f2/f1)` · `rate = 2**((target-src)/12)`

Polyphony ≤ **6**, one note per string. Tolerances are per-task and must not be shared:
tuner ±1–3 cents, note ID ±50 cents, chord recognition ignores cents entirely.

Latency: pitch needs ≥2 periods of the lowest note → E2 = **24.3 ms floor**. `BUF_SIZE` 2048
@44.1 kHz = **46.4 ms**. AudioWorklet quantum = **2.9 ms**. rAF ≈ **16.7 ms**. Live feedback
degrades past **~100 ms** round trip. Never share one window size between tuner and live path.

Samples: 19 per tone, E2–C6, worst shift **1 semitone** (budget 2). Both guitar tones CC0;
drums **CC-BY 3.0, attribution mandatory**.

## Layering

    Audio input → Detection engine → DetectionResult → Music interpretation → Fretboard / chord UI / replay

Each arrow is a boundary. A model may not reach past the second one.
**Microphone capture is input, not playback** — it must never register as a playback session
or appear in Now Playing.

## Before changing detection

1. Read the current implementation. `PitchDetector.autoCorrelate` is normalized
   autocorrelation with parabolic interpolation and first-prominent-peak octave suppression
   — more considered than it looks.
2. Benchmark it on a fixed set first. No model is adopted on reputation.
3. Match the model to the musical task, **never** because it detects pitch.
4. Integrate behind a stable interface with the existing path as fallback.

## Non-negotiables

- **`AudioSessionManager` owns all playback.** No second manager, no unmanaged source node.
- **Never present a prediction as certain.** Carry confidence end to end; show alternatives
  when the margin is thin; never fabricate a confidence a model did not produce.
- **Never add audio of unknown licence.** Record it in `app/static/audio/LICENSES.md` and run
  `scripts/validate_audio_assets.py` (execute it — never read it, it is 1.8K tokens).
- **Never couple a model to the DOM.** Normalize the result, interpret, then render.
- **Never redesign working audio/session architecture to solve a detection problem.** If a
  model needs something the session layer does not offer, add it behind the existing
  interface; do not restructure playback to accommodate an analyser.
- **Never write "AI detects music" / "smart recognition" / "better guitar AI".** Name the
  algorithm and the task.

## Reference loading

Load **at most one** file. Each is self-contained for its own task — the small overlap
between them is deliberate, so no task needs two.

| Task | File |
|---|---|
| Terminology, capo, technique, fretboard mapping | `references/guitar-domain.md` |
| Pitch/onset/transcription, model choice, benchmarking | `references/detection.md` |
| Chord recognition, candidate scoring, smoothing | `references/chords.md` |
| Sampling, strumming, humanization, synth fallback | `references/sound-design.md` |
| Sourcing or licensing audio | `references/audio-sources.md` |
| Which component to extend, and its rules | `references/ahordian.md` |
| Exact exports / method signatures — instead of grepping | `references/codebase-map.md` |

`codebase-map.md` is **generated** from source by `scripts/generate_codebase_map.py`; it lists
the public surface of all 24 modules, so never grep the codebase to find a symbol. Verify it is
current with `--check` (exit 1 = stale) before trusting it for a rename-sensitive change.

For a narrow question in a large file, `Grep` the `##` heading and `Read` with `offset`/`limit`
rather than loading the whole file. `ahordian.md` is a pointer index that defers to the source
and to project memory — if they disagree, the code is right.
