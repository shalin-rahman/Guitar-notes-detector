# Detection, Transcription and Model Selection

## Vocabulary mapping

| User says | Implementation term |
|---|---|
| "find the notes" | pitch detection (one at a time) or note transcription (events) |
| "detect when the note starts" | onset detection |
| "detect the chord" | chord recognition over note evidence |
| "find the song's key" | key estimation from chroma |
| "find the BPM" | tempo estimation |
| "find the rhythm" | beat tracking / downbeat detection |
| "transcribe the solo" | monophonic or polyphonic note transcription |
| "show me where to play it" | fretboard mapping / position inference |
| "recognize my strumming" | onset detection + rhythmic pattern analysis |
| "recognize my playing style" | performance feature extraction |

Restate the user's request in these terms before designing. Most wrong detectors come from
implementing the phrase rather than the task.

## What Ahordian has today

`PitchDetector.autoCorrelate(buf, sampleRate, sensitivity)` — normalized autocorrelation:

- RMS gate: `0.002 + ((100 - sensitivity)/100) * 0.098`, returns `-1` below it.
- Normalizes by energy at lag 0, so correlation is `0…1` and comparable across loudness.
- Skips the DC lobe, then searches lags from `sampleRate/2000` (2 kHz ceiling) to
  `sampleRate/40` (40 Hz floor), bounded in practice by `SIZE/2` lags.
- **Octave-error suppression:** takes the *first* prominent peak above 0.85 and breaks.
  Later peaks are harmonics of it. This is the right heuristic for guitar.
- Parabolic interpolation around the peak for sub-bin accuracy.
- Exposes `PitchDetector.lastCorrelation` as confidence.

Driven from `App.js:1453` — `AnalyserNode`, `fftSize = AppConfig.BUF_SIZE` (2048),
`getFloatTimeDomainData`, called per `requestAnimationFrame`.

**Known limits, in the order they will bite:**

1. **Monophonic by construction.** One global peak, one frequency. Not fixable by tuning.
2. **`lastCorrelation` is a static mutable.** A second concurrent consumer silently reads
   another caller's confidence. Return it in the result instead of reaching for the static.
3. **O(n²) on the main thread.** 1024 lags × 1024 samples ≈ 1M multiply-accumulates per
   frame, ~60 frames/s. FFT-based autocorrelation (multiply the spectrum by its conjugate,
   inverse transform) is O(n log n), or move it to an `AudioWorklet`.
4. **Weakest exactly on the low E.** At the longest lags the overlap is ~1024 samples ≈
   1.9 periods of E2 (82.41 Hz, 12.13 ms). The note guitarists tune most is the one with
   the least evidence. A longer window fixes accuracy and costs latency.
5. **40 Hz floor is below the instrument.** Nothing on a guitar is under 82 Hz; lags for
   40–75 Hz are wasted work and an octave-error opportunity.

## Latency budget

Concrete numbers, not "minimize latency":

- Pitch detection needs **≥2 periods** of the lowest note. E2 = 12.13 ms period → **24.3 ms
  absolute floor**, ~1071 samples at 44.1 kHz. There is no way around this.
- `BUF_SIZE` 2048 @ 44.1 kHz = **46.4 ms** ≈ 3.8 periods of E2. A reasonable choice.
- `AudioWorklet` render quantum = 128 frames = **2.9 ms**.
- `requestAnimationFrame` ≈ **16.7 ms** and is not audio-rate; it drops frames under UI load.
- Perceptible lag for live feedback starts around **100 ms** total round trip. Analysis
  window + hop + render must fit inside it.

So: a tuner can afford a long window (accuracy matters, latency doesn't). Live note feedback
cannot. Do not use one window size for both.

Live vs. offline is a genuine architectural split — live optimizes latency, offline
optimizes accuracy. Do not assume one pipeline serves both.

## Onset detection

Not derivable from pitch. Compute a spectral-flux envelope (sum of positive frame-to-frame
magnitude increases across bins), then peak-pick with a moving-median threshold and a
refractory period (~50 ms) so one attack isn't counted twice.

Guitar-specific: hammer-ons, pull-offs and slides produce **no attack transient**, so a
flux-only detector misses them. Legato passages need pitch-change detection as a second
onset source. Strumming produces 4–6 onsets within 10–30 ms that must be grouped as one
strum event, not six notes.

## Model selection

| Task | Approach |
|---|---|
| Live monophonic — tuner, single-note practice | autocorrelation (current), YIN, or CREPE-class if a model is warranted |
| Live polyphonic guitar | benchmark a neural transcriber (Basic Pitch) against current |
| Solo / melody transcription | note transcription with onset, duration, confidence, pitch bend |
| Chord detection | note evidence → chord inference (see `chords.md`), never pitch → label |
| Full multi-instrument song | source separation → transcription → chord/beat/key |
| Beat and tempo | beat/downbeat tracking, not onset counting |
| Key | chroma / HPCP → key estimation over a window |
| Fretboard position | detected pitches + tuning + capo + position constraints |

**Never choose a model because it detects pitch. Match it to the musical task.**

### Basic Pitch — the deployment fact that decides the architecture

Basic Pitch is a Python package shipping a TensorFlow model. **It does not run in the
browser as distributed.** Ahordian is a vanilla-JS frontend with a FastAPI backend, which
gives two real options:

- **Server-side endpoint** (`POST /api/transcribe`, audio in, note events out). Natural fit
  for file analysis, where latency is irrelevant. Uses the backend that already exists.
- **ONNX / TFJS conversion** for in-browser inference. The only route for *live* detection,
  and materially more work — conversion, quantization, warm-up cost, and inference off the
  UI thread.

Decide which before writing any integration code; the answer changes the whole design. File
analysis via the server is the cheaper first step and covers tasks.txt P1 for recordings.
MT3 is larger still and is server-side only in practice. It is a candidate for
**multi-instrument transcription** — it is not a chord recognizer, and its note output still
needs the inference layer in `chords.md` before any chord label exists.

## Benchmark before replacing

The benchmark is the deliverable, not a preliminary. Build a fixed set:

clean single notes across all 6 strings · scales · open chords · barre chords · chord
progressions · arpeggios · solos · bends and vibrato · strumming · palm-muted passages ·
noisy/room recordings · full songs.

Cover the low E and the top frets deliberately — those are where the current detector is
weakest and where an average score will hide the failure.

Measure: note accuracy · onset accuracy (tolerance ±50 ms) · duration accuracy · chord
accuracy · **confidence calibration** (does 0.9 mean 90%?) · latency · CPU and memory ·
and enumerate failure cases rather than only reporting an aggregate.

Ahordian's harness already proves audio with an `AnalyserNode` on `sessionManager.masterGain`
— the same technique feeds a known sample in and captures what the detector reports, so the
benchmark can run headlessly in the existing Playwright suites.

## Normalized output contract

Every engine — current or model-backed — returns the same shape, so the UI never knows which
ran:

```
DetectionResult {
  notes:  [{ pitch, midi, onset, duration, velocity, confidence }],
  chords: [{ root, quality, bass, onset, duration, confidence }],
  tempo, key, confidence
}
```

Populate only fields the engine genuinely supports; omit the rest. **Never synthesize a
confidence value a model did not produce** — a fabricated 0.95 is worse than a missing field,
because the UI will display it.

## Performance rules for live paths

Preallocate and reuse buffers; no allocation inside the analysis loop. Keep inference off the
UI thread — `AudioWorklet` for DSP, a Worker for model inference. Throttle *rendering*
independently of *analysis*: analyse at audio rate, repaint at ~30 fps. Never let analysis
code create an unmanaged `AudioBufferSourceNode` — it will bypass `AudioSessionManager` and
break exclusivity.
