# Ahordian Integration Map

This file is a **pointer index, not a specification.** It says which file owns which concern
so a task extends the right component instead of writing a second one. For exact exports and
method signatures see the generated `codebase-map.md` — do not grep for them. Behaviour lives
in the source; if this file and the code disagree, **the code is right.** Project memory
(`MEMORY.md` and its topic files) carries the current architectural rules.

Stack: vanilla-JS ES modules under `app/static/js/`, FastAPI backend (`app/main.py`) serving
`static/` at both `/static` and `/` with `html=True`. No build step, no framework.

## Who owns what

| Concern | File |
|---|---|
| Pitch detection from a time-domain buffer | `PitchDetector.js` |
| Note/scale/chord theory, key relationships | `MusicEngine.js` |
| Pitch → playable string/fret voicings | `VoicingGenerator.js` |
| Fretboard rendering and highlighting | `FretboardManager.js` |
| Playback lifecycle, exclusivity, global stop | `audio/AudioSessionManager.js` |
| Buffer store, fetch/decode, load status | `audio/SampleManager.js` |
| Guitar sample playback and tone selection | `audio/GuitarSampler.js` |
| Synth path when samples are unavailable | `audio/GuitarSynthFallback.js` |
| Drum voices | `audio/DrumSampler.js` |
| Groove, swing, pattern scheduling | `audio/RhythmEngine.js` |
| Click | `Metronome.js` |
| Chord-progression backing playback | `BackingTrackEngine.js` |
| Tab rendering and playback | `TabPlayer.js` |
| Note→frequency, playback entry point | `AudioPlayer.js` |
| Uploaded-file analysis | `FileManager.js` |
| Detector readout rendering | `UIManager.js` |
| Practice/progress records | `TrackingManager.js` |
| Lessons, ear training, circle of fifths | `LessonManager.js`, `EarTrainingManager.js`, `CircleManager.js` |
| Persistence | `StorageManager.js` |
| Tunable constants | `AppConfig.js` |
| Screens, nav, wiring, settings, practice routines | `App.js` |
| Icon hydration | `Icons.js` |

`window.AhordianApp` is the global handle.

## Extend, don't duplicate

The two components most likely to be reinvented by a "detection" or "fretboard" task:

- **`PitchDetector`** — already normalized autocorrelation with parabolic interpolation and
  octave suppression. Any new engine goes *alongside* it behind a shared result shape, with
  this path as the fallback.
- **`VoicingGenerator`** — already maps notes to playable string/fret sets
  (`getNoteAt`, `generateVoicings`). Fretboard-mapping work extends these.

## Rules that bite

- **`AudioSessionManager` is the only playback owner.** Register every source node; never
  create a second manager and never start an unmanaged `AudioBufferSourceNode`.
- **`SampleManager.buffers` is one flat map** shared by all packs. Guitar keys are
  `guitar:<tone>:<note>`; a bare note name collides across tones and overwrites silently.
- **`App.js` is large.** Prefer adding a focused module and wiring it from `App.js` over
  growing it further.
- **Detection must not touch the DOM.** Produce a result object; let the UI layer render it.

## Verification

Browser-verify audio and detection changes; do not report them working from code inspection.
See the `verification-workflow` memory for the run command, the system-Chrome Playwright
launch, the `AnalyserNode`-on-`masterGain` audio proof, and the `qa_*.py` suites.
