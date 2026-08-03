import os
import urllib.request

# Define sources
guitar_url_base = "https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/master/FatBoy/acoustic_guitar_nylon-mp3/"

samples = {
    "static/audio/guitar/acoustic/E2.mp3": guitar_url_base + "E2.mp3",
    "static/audio/guitar/acoustic/A2.mp3": guitar_url_base + "A2.mp3",
    "static/audio/guitar/acoustic/D3.mp3": guitar_url_base + "D3.mp3",
    "static/audio/guitar/acoustic/G3.mp3": guitar_url_base + "G3.mp3",
    "static/audio/guitar/acoustic/B3.mp3": guitar_url_base + "B3.mp3",
    "static/audio/guitar/acoustic/E4.mp3": guitar_url_base + "E4.mp3"
}

def main():
    print("Downloading CC0 audio samples...")
    for path, url in samples.items():
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if not os.path.exists(path):
            print(f"Downloading {url} to {path}...")
            try:
                urllib.request.urlretrieve(url, path)
                print(f"  -> Success: {path}")
            except Exception as e:
                print(f"  -> Error downloading {url}: {e}")
        else:
            print(f"Skipping {path}, already exists.")
            
    print("\nFor drums, please manually place your preferred drum samples:")
    print(" - static/audio/drums/kick/kick-acoustic01.wav")
    print(" - static/audio/drums/snare/snare-acoustic01.wav")
    print(" - static/audio/drums/hihat/hihat-acoustic01.wav")
    print(" - static/audio/drums/hihat/hihat-open01.wav")
    print(" - static/audio/drums/ride/ride-acoustic01.wav")
    print("\nDone!")

if __name__ == "__main__":
    main()
