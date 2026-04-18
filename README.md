# Ahordian - Experimental Guitar Tuner & Transcriptor

Hello there! Thank you so kindly for taking the time to visit **Ahordian**. This repository is primarily an experimental passion project built as a personal exploration into audio signal processing, browser-based frequency detection, and Python-driven transposition logic. 

More importantly, this project holds a very special place in my heart. I built this alongside my son, **Ahiyan**, to assist him in his journey of learning the guitar. Because his musical foundation is rooted in Bengali Sargam, I wanted to create a tool that seamlessly bridges standard Western guitar chords with the Sargam notation he already understands. The name **"Ahordian"** is a blend of his name and our shared love for music: combining the first two letters of "**Ah**iyan", the word "Ch**ord**", and the last three letters of his name "**ian**".

As a music enthusiast and a father, I wanted to try creating a gentle, ad-free, and highly responsive tuning environment that honors these beautiful notation mappings. While this software is very much an ongoing experiment, I sincerely hope you find it interesting or perhaps even useful for your own musical journeys!

## What I've Built Into This Experiment

Ahordian isn't meant to replace professional studio software, but rather to safely test out full-stack audio analysis natively on a local machine. It pairs a lightweight JavaScript UI with a robust Python backend. 

Here are the features I've been experimenting with:

* **Real-Time Dual Notation:** Watch the live microphone feed gently translate into both Standard Western notation (e.g., C#, D) and completely customizable Bengali Sargam (সা, রে, গা, মা). You can respectfully set your own Root note and map out the exact custom symbols you prefer directly from the settings menu.
* **Algorithmic Noise Smoothing:** To soften the experience of a flickering needle, Ahordian experimentally uses a 7-frame rolling buffer that tries its best to lock out harmonic "ghost" frequencies. You can also adjust the microphone sensitivity manually.
* **The 'Fast Buffer' Tracker:** A small array resting quietly below the dial that captures the last 10 stable notes you played, giving you a readable sequence to reflect on before you begin transcribing.
* **Experimental Chord Estimation:** If you play a gentle triad arpeggio, Ahordian will attempt to analyze the rolling buffer and gracefully guess the implied chord.
* **Server-Side Transcription:** If you have an MP3 you'd like to analyze, you can drag and drop it into the dashboard. The frontend safely packets the audio back to the `FastAPI` Python server, where `librosa` systematically processes the frequency bands and attempts to generate a readable timeline log.

## Running the Experiment Locally

If you would kindly like to run this setup yourself, you'll simply need a standard Python environment.

1. **Install the dependencies:**
   Please ensure you have the core scientific libraries installed for offline audio processing:
   ```bash
   pip install fastapi uvicorn librosa numpy scikit-learn soundfile
   ```

2. **Boot the Server:**
   You can respectfully launch the main FastAPI application by running:
   ```bash
   python app/main.py
   ```

3. **Open the Dashboard:**
   Point your web browser to `http://localhost:8000`. Please allow microphone permissions if prompted, dial in your notation symbols, and you are entirely ready to go.

### A Small Note on the Architecture

I've tried my absolute best to keep the codebase clean and organized. The frontend logic attempts to adhere to strict SOLID/DRY principles, completely decoupling the audio engine from the UI rendering arrays. On the backend, `FastAPI` handles chunking and logs any errors securely into a daily revolving file (`ahordian_app.log`), ensuring your system storage is always respected and kept clean.

---

Thank you again for looking into my experiment! Please enjoy tuning, and if you have any questions or notice any areas for improvement, your insights are deeply appreciated.

**Developed by Shalin**
