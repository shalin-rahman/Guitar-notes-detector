"""Fetch Ahordian's audio sample packs.

Every file downloaded here is attributed in `static/audio/LICENSES.md`. Two
different licences are in play, so keep the two packs separate:

  * Guitar  — two tones, both via `midi-js-soundfonts`, CC0 / public domain:
              MusyngKite steel and FatBoy nylon. One directory per tone.
  * Drums   — Oramics "Pearl Master Studio" Pack 1 by enoe, CC-BY 3.0. This one
              *requires* attribution; do not drop the LICENSES.md entry.
"""

import os
import urllib.request
from pathlib import Path

# Resolve against this file, not the cwd, so the script can be run from anywhere.
BASE_DIR = Path(__file__).resolve().parent

# --- Guitar ---------------------------------------------------------------
# Both tones ship; the user picks one in Settings → Guitar Tone, and
# `GuitarSampler` reads the matching directory. Keys must stay in sync with
# GUITAR_TONES in app/static/js/audio/GuitarSampler.js.
#
# MusyngKite is the fuller of the two soundfonts, so it supplies the default
# steel tone. FatBoy nylon is a thinner GM patch that reads as a classical
# guitar — kept deliberately, because that is a legitimate voice to want, not a
# worse version of the same one.
SOUNDFONTS = "https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/master/"
GUITAR_TONES = {
    "steel": SOUNDFONTS + "MusyngKite/acoustic_guitar_steel-mp3/",
    "nylon": SOUNDFONTS + "FatBoy/acoustic_guitar_nylon-mp3/",
}

# Roughly every 3 semitones from the low open E to the top of a 22-fret neck, so
# `GuitarSampler` never pitch-shifts a buffer more than ~1.5 semitones. The old
# six-sample set (one per open string) had a 12-semitone hole above E4, which is
# what made high positions sound like a chipmunk.
GUITAR_NOTES = [
    "E2", "G2", "A2", "C3", "D3", "F3", "G3", "A3", "C4",
    "D4", "E4", "G4", "A4", "C5", "D5", "E5", "G5", "A5", "C6",
]

# --- Drums ----------------------------------------------------------------
drum_url_base = "https://oramics.github.io/sampled/DRUMS/pearl-master-studio/samples/"

# Left side is the path DrumSampler.sampleMap already expects; right side is the
# pack's own filename.
DRUM_FILES = {
    "drums/kick/kick-acoustic01.wav": "kick-01.wav",
    "drums/snare/snare-acoustic01.wav": "snare-01.wav",
    "drums/hihat/hihat-acoustic01.wav": "hihat-closed.wav",
    "drums/hihat/hihat-open01.wav": "hihat-open.wav",
    "drums/ride/ride-acoustic01.wav": "ride-01.wav",
}

samples = {
    BASE_DIR / f"static/audio/guitar/{tone}/{note}.mp3": url_base + f"{note}.mp3"
    for tone, url_base in GUITAR_TONES.items()
    for note in GUITAR_NOTES
}
samples.update({
    BASE_DIR / "static/audio" / dest: drum_url_base + src
    for dest, src in DRUM_FILES.items()
})


def main():
    print("Downloading audio samples (guitar: CC0, drums: CC-BY 3.0)...")
    failures = []
    for path, url in samples.items():
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if os.path.exists(path):
            print(f"Skipping {path.name}, already exists.")
            continue
        print(f"Downloading {url} -> {path}...")
        try:
            urllib.request.urlretrieve(url, path)
            print(f"  -> Success: {path.name}")
        except Exception as e:
            print(f"  -> Error downloading {url}: {e}")
            failures.append(path.name)

    if failures:
        # Loud, and a non-zero exit, because a missing sample silently degrades
        # the app to the synth fallback rather than failing visibly.
        print(f"\n{len(failures)} sample(s) failed: {', '.join(failures)}")
        raise SystemExit(1)

    print("\nDone. Drum samples are CC-BY 3.0 — see static/audio/LICENSES.md.")


if __name__ == "__main__":
    main()
