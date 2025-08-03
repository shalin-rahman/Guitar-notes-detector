import numpy as np
import pyaudio
import aubio

# Audio setup
SAMPLE_RATE = 44100
BUFFER_SIZE = 1024
TOLERANCE = 0.8

# Create pitch detector
pitch_detector = aubio.pitch("default", BUFFER_SIZE * 2, BUFFER_SIZE, SAMPLE_RATE)
pitch_detector.set_unit("Hz")
pitch_detector.set_tolerance(TOLERANCE)

# Initialize PyAudio
p = pyaudio.PyAudio()
stream = p.open(
    format=pyaudio.paFloat32,
    channels=1,
    rate=SAMPLE_RATE,
    input=True,
    frames_per_buffer=BUFFER_SIZE
)

# Note frequency conversion
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
def frequency_to_note(freq):
    """Convert frequency to note name and octave"""
    if freq == 0:
        return None
    
    # Calculate MIDI note number
    midi_note = 69 + 12 * np.log2(freq / 440.0)
    # Get note name and octave
    note_index = int(round(midi_note) % 12)
    octave = int(round(midi_note) // 12 - 1)
    
    return f"{NOTE_NAMES[note_index]}{octave}"

print("Listening for guitar notes... (Press Ctrl+C to stop)")

try:
    while True:
        # Read audio buffer
        audio_data = np.frombuffer(
            stream.read(BUFFER_SIZE, exception_on_overflow=False),
            dtype=np.float32
        )
        
        # Detect pitch
        frequency = pitch_detector(audio_data)[0]
        confidence = pitch_detector.get_confidence()
        
        # Convert to note
        if confidence > 0.7 and frequency > 50:  # Filter out low confidence/noise
            note = frequency_to_note(frequency)
            print(f"Detected: {note} ({frequency:.1f} Hz) | Confidence: {confidence:.2f}")
except KeyboardInterrupt:
    print("\nStopped listening")
finally:
    stream.stop_stream()
    stream.close()
    p.terminate()

def detect_notes_in_file(filename):
    """Detect notes in an audio file"""
    y, sr = librosa.load(filename, sr=None)
    # Detect pitches
    pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
    # Find dominant pitch in each frame
    for t in range(pitches.shape[1]):
        index = magnitudes[:, t].argmax()
        pitch = pitches[index, t]
        if pitch > 0:
            note = frequency_to_note(pitch)
            print(f"At {t/10:.1f}s: {note} ({pitch:.1f} Hz)")

# Usage:
# detect_notes_in_file("guitar_note.wav")

