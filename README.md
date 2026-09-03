# Ahordian - Professional Guitar Note Detector & Fretboard Assistant

Hello there! Thank you so kindly for taking the time to visit **Ahordian**. This repository is primarily a passion-driven project built to bridge the gap between high-end music theory visualization and accessible browser-based practice tools.

More importantly, this project holds a very special place in my heart. I built this alongside my son, **Ahiyan**, to assist him in his journey of learning the guitar. Because his musical foundation is rooted in Bengali Sargam, I wanted to create a tool that seamlessly bridges standard Western guitar chords with the Sargam notation he already understands. The name **"Ahordian"** is a blend of his name and our shared love for music: combining the first two letters of "**Ah**iyan", the word "Ch**ord**", and the last three letters of his name "**ian**".

As a music enthusiast and a father, I wanted to create a premium, immersive environment that respects these beautiful notation mappings while providing professional-grade utilities for every guitarist.

## The Professional Practice Suite

Ahordian has been evolved into a comprehensive music laboratory. Beyond simple tuning, it now features a suite of advanced engines:

### 1. Interactive Harmonic Explorer (Circle of 5ths)
* **Visual Harmony:** A dynamic, rotatable SVG Circle of Fifths that maps out Diatonic Neighbors and Roman Numeral functions (**I, IV, V, ii, iii, vi, vii°**) in real-time.
* **Universal Mode Support:** Select a key on the circle and instantly apply any scale from our library—including Western Modes (Phrygian, Lydian), Pentatonics, and Indian Raags (Yaman, Bhupali).
* **Ear Training Quiz:** An integrated quiz mode where the app plays a mystery note from your current scale, and you must "win" by playing the correct pitch on your physical guitar.

### 2. Studio-Grade Fretboard Visualization
* **Topographic Note Rendering:** High-fidelity chromatic color mapping with aggressive visual hierarchy. Root notes are emphasized with bright rims and 3D shadows, while intervals are clearly labeled with either Note Names or Functional Degrees (1, 2, 3...).
* **Chord Voicing Library:** Toggle between abstract theory and physical practice. The fretboard can render standard **Open/Barre Guitar Shapes** directly over the theory markers.
* **CAGED System Filters:** Instantly isolate specific fretboard hand-positions (C-Shape, A-Shape, etc.) for surgical practice.

### 3. Precision Practice Tools
* **Master Metronome:** A WebAudio metronome driven by the audio clock rather than `setTimeout` — a 25 ms polling timer schedules ticks 100 ms ahead of playback, so the pulse does not drift when the main thread is busy. Visual pulse indicator and adjustable BPM.
* **Jam Station:** A backing-track engine that pairs chord-progression playback with a rhythm engine and a drum sampler, so you can practise scales and voicings over a real groove instead of a bare click.
* **Tab Player & Songs:** Load a tab and hear it back on the sampled guitar, with the fretboard following along note by note.
* **Smart Live Transcription:** Record your physical performance directly to a "Sequence Tape." The app uses a stability-buffer algorithm to transcribe your riffs into playable synthesis blocks — and **Detection Replay** plays that tape back on the fretboard so you can watch what you actually played.
* **Local DSP Audio Analysis:** Drag and drop any MP3 or WAV file. Ahordian's internal engine processes the audio locally in your browser to generate a clickable harmonic timeline of the track.
* **Lessons & Progress Tracking:** Guided practice items with per-pack progress, high scores, and a dashboard, persisted locally.

## Technical Hardening

Ahordian uses a custom **Normalized Autocorrelation Function (ACF)** with **Parabolic Interpolation** for sub-sample accuracy. This ensures frequency detection is fast, minimizes latency, and robustly ignores harmonic "octave-jumping" errors.

The architecture is built on strict **SOLID/DRY** principles:
* **Audio Engine:** Fully decoupled from the UI, allowing the DSP logic to be reused across different visualization modules. Everything audible routes through a single master chain (`instrument gains → master → compressor → destination`), so levels and mute are global rather than per-feature.
* **One Audio Source At A Time:** `AudioSessionManager` owns exclusivity. Each engine registers a **stop callback**, and starting an exclusive session invokes the losers' callbacks — so "stopping" genuinely silences an engine instead of just changing a label. A **Now Playing** pill shows what is sounding and jumps you back to its screen. Microphone detection is deliberately *not* a session: it is input, not something you are listening to, so it has its own status badge and keeps running as you navigate.
* **Sampled Instruments With Graceful Fallback:** Every sample ships in the repository — 38 guitar MP3s (steel and nylon, 19 notes each) and 5 drum WAVs, about 1.5 MB in total — so a fresh checkout sounds like the demo with no download step. Both instruments still fall back to synthesis if a file is missing or fails to decode, and the fallback is not silent: the sample indicator reports partial or failed loading rather than pretending. Licences and attribution live in [`app/static/audio/LICENSES.md`](app/static/audio/LICENSES.md) — the drum kit is CC-BY 3.0, so shipping the attribution is a condition of the licence, not a courtesy.
* **Rendering:** Coordinate-based SVG mapping ensures the fretboard is mathematically accurate to any scale or custom tuning. Icons are hydrated from a single `Icons.js` registry rather than scattered inline SVG.
* **Backend:** A lightweight `FastAPI` instance handles local logging and environment stabilization.

## Running Locally

1. **Install Dependencies:**
   ```bash
   python -m venv .venv
   .venv/Scripts/activate      # macOS/Linux: source .venv/bin/activate
   python -m pip install -r requirements.txt
   ```
2. **Boot the Server:**
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```
   (`python app/main.py` works too and binds the same port. The test suites hardcode
   `http://127.0.0.1:8123`, so use `--port 8123` if you intend to run them.)
3. **Explore:**
   Visit `http://localhost:8000`. Please allow microphone permissions, select your preferred notation (Sargam or Western), and enjoy your practice session!

### On the audio samples

**There is no asset-download step.** All 44 files under [`app/static/audio/`](app/static/audio/) are tracked in the repository, so steps 1–3 above are the whole setup.

`app/download_samples.py` is a **re-fetch tool, not a setup step**. It skips any file that already exists, which makes it a no-op on a clean checkout; run it only to repair assets you have deleted or corrupted:

```bash
python app/download_samples.py
```

If the sample indicator in the top bar reports partial or failed loading, that is the case it is for. After touching anything under `app/static/audio/`, update `LICENSES.md` and run `python .claude/skills/guitar-audio-intelligence/scripts/validate_audio_assets.py`.

### Verifying a change

The browser test suites are tracked in [`tests/`](tests/) and drive real Chrome through Playwright — see [`tests/README.md`](tests/README.md) for the run instructions, what each suite covers, and the traps that produce false failures.

```bash
python -m pip install playwright
python -X utf8 tests/qa_phase1.py    # and the other seven suites
```

---

Thank you again for looking into my experiment! I sincerely hope this tool helps you find the same joy in music that we found building it.

**Developed by Shalin**

**Live demo:** [ahordian-noise2notes.onrender.com](https://ahordian-noise2notes.onrender.com/)
