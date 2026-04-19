# Ahordian - Professional Guitar Note Detector & Fretboard Assistant

Hello there! Thank you so kindly for taking the time to visit **Ahordian**. This repository is primarily a passion-driven project built to bridge the gap between high-end music theory visualization and accessible browser-based practice tools.

More importantly, this project holds a very special place in my heart. I built this alongside my son, **Ahiyan**, to assist him in his journey of learning the guitar. Because his musical foundation is rooted in Bengali Sargam, I wanted to create a tool that seamlessly bridges standard Western guitar chords with the Sargam notation he already understands. The name **"Ahordian"** is a blend of his name and our shared love for music: combining the first two letters of "**Ah**iyan", the word "Ch**ord**", and the last three letters of his name "**ian**".

As a music enthusiast and a father, I wanted to create a premium, immersive environment that respects these beautiful notation mappings while providing professional-grade utilities for every guitarist.

## 🚀 The Professional Practice Suite

Ahordian has been evolved into a comprehensive music laboratory. Beyond simple tuning, it now features a suite of advanced engines:

### 1. 🎡 Interactive Harmonic Explorer (Circle of 5ths)
* **Visual Harmony:** A dynamic, rotatable SVG Circle of Fifths that maps out Diatonic Neighbors and Roman Numeral functions (**I, IV, V, ii, iii, vi, vii°**) in real-time.
* **Universal Mode Support:** Select a key on the circle and instantly apply any scale from our library—including Western Modes (Phrygian, Lydian), Pentatonics, and Indian Raags (Yaman, Bhupali).
* **Ear Training Quiz:** An integrated quiz mode where the app plays a mystery note from your current scale, and you must "win" by playing the correct pitch on your physical guitar.

### 2. 🎸 Studio-Grade Fretboard Visualization
* **Topographic Note Rendering:** High-fidelity chromatic color mapping with aggressive visual hierarchy. Root notes are emphasized with bright rims and 3D shadows, while intervals are clearly labeled with either Note Names or Functional Degrees (1, 2, 3...).
* **Chord Voicing Library:** Toggle between abstract theory and physical practice. The fretboard can render standard **Open/Barre Guitar Shapes** directly over the theory markers.
* **CAGED System Filters:** Instantly isolate specific fretboard hand-positions (C-Shape, A-Shape, etc.) for surgical practice.

### 3. 🥁 Precision Practice Tools
* **Master Metronome:** A WebAudio-powered, sample-accurate metronome with a visual pulse indicator and adjustable BPM.
* **Smart Live Transcription:** Record your physical performance directly to a "Sequence Tape." The app uses a stability-buffer algorithm to transcribe your riffs into playable synthesis blocks.
* **Local DSP Audio Analysis:** Drag and drop any MP3 or WAV file. Ahordian's internal engine processes the audio locally in your browser to generate a clickable harmonic timeline of the track.

## 🛠 Technical Hardening

Ahordian uses a custom **Normalized Autocorrelation Function (ACF)** with **Parabolic Interpolation** for sub-sample accuracy. This ensures frequency detection is fast, minimizes latency, and robustly ignores harmonic "octave-jumping" errors.

The architecture is built on strict **SOLID/DRY** principles:
* **Audio Engine:** Fully decoupled from the UI, allowing the DSP logic to be reused across different visualization modules.
* **Rendering:** Coordinate-based SVG mapping ensures the fretboard is mathematically accurate to any scale or custom tuning.
* **Backend:** A lightweight `FastAPI` instance handles local logging and environment stabilization.

## ⚙️ Running Locally

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```
2. **Boot the Server:**
   ```bash
   python app/main.py
   ```
3. **Explore:**
   Visit `http://localhost:8000`. Please allow microphone permissions, select your preferred notation (Sargam or Western), and enjoy your practice session!

---

Thank you again for looking into my experiment! I sincerely hope this tool helps you find the same joy in music that we found building it.

**Developed by Shalin**
