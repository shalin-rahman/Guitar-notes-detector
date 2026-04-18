try:
    import numpy as np  # type: ignore
except ImportError:
    np = None

try:
    import aubio  # type: ignore
except ImportError:
    aubio = None

try:
    import librosa  # type: ignore
except ImportError:
    librosa = None

# Note frequency conversion
NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
CHORD_TEMPLATES = {
    'C Maj': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
    'G Maj': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
    'D Maj': [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    'A Maj': [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    'E Maj': [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    'A Min': [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    'E Min': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
    'D Min': [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0]
}

class AudioEngine:
    def __init__(self, sample_rate=44100, buffer_size=1024, tolerance=0.8):
        self.sample_rate = sample_rate
        self.buffer_size = buffer_size
        self.tolerance = tolerance
        if aubio:
            self.pitch_detector = aubio.pitch("default", buffer_size * 2, buffer_size, sample_rate)
            self.pitch_detector.set_unit("Hz")
            self.pitch_detector.set_tolerance(tolerance)
        else:
            self.pitch_detector = None

    @staticmethod
    def frequency_to_note(freq):
        """Convert frequency to note name and octave"""
        if freq == 0 or freq is None or np is None:
            return None
        
        try:
            # Calculate MIDI note number
            midi_note = 69 + 12 * np.log2(freq / 440.0)
            # Get note name and octave
            note_index = int(round(midi_note) % 12)
            octave = int(round(midi_note) // 12 - 1)
            return f"{NOTE_NAMES[note_index]}{octave}"
            return f"{NOTE_NAMES[note_index]}{octave}"
        except Exception:
            return None

    @staticmethod
    def get_tab_from_freq(freq):
        """Map frequency to standard guitar tuning string and fret"""
        if freq == 0 or freq is None or np is None:
            return None
        try:
            midi_note = int(round(69 + 12 * np.log2(freq / 440.0)))
            if midi_note >= 64: return f"1e fret {midi_note - 64}"
            elif midi_note >= 59: return f"2B fret {midi_note - 59}"
            elif midi_note >= 55: return f"3G fret {midi_note - 55}"
            elif midi_note >= 50: return f"4D fret {midi_note - 50}"
            elif midi_note >= 45: return f"5A fret {midi_note - 45}"
            elif midi_note >= 40: return f"6E fret {midi_note - 40}"
            else: return None
        except Exception:
            return None

    def analyze_buffer(self, audio_buffer):
        """Analyze a buffer of audio data (numpy float32)"""
        if self.pitch_detector:
            frequency = self.pitch_detector(audio_buffer)[0]
            confidence = self.pitch_detector.get_confidence()
        elif librosa and np:
            # Fallback to librosa.yin (slower but works without aubio)
            try:
                # yin returns an array of pitches, we take the mean or first
                freqs = librosa.yin(audio_buffer, fmin=50, fmax=2000, sr=self.sample_rate)
                frequency = np.median(freqs)
                confidence = 0.8 # Assume reasonable confidence if detected
            except:
                frequency = 0
                confidence = 0
        else:
            return {"error": "No pitch detection engine available (install aubio or librosa)"}

        note = self.frequency_to_note(frequency) if (confidence > 0.7 and frequency > 50) else None
        tab = self.get_tab_from_freq(frequency) if note else None
        return {
            "frequency": float(frequency),
            "confidence": float(confidence),
            "note": note,
            "tab": tab
        }

    def get_chord_from_chroma(self, chroma):
        """Estimate chord name from a chromagram buffer"""
        best_chord = "Unknown"
        max_sim = -1
        for chord, template in CHORD_TEMPLATES.items():
            sim = np.dot(chroma, template)
            if sim > max_sim:
                max_sim = sim
                best_chord = chord
        return best_chord

    def analyze_file(self, file_path):
        """Full transcription analysis: Chords, BPM, Tone, and Notes"""
        if not librosa or not np:
            return {"error": "Required backend dependencies (librosa/numpy) not installed"}
        
        try:
            y, sr = librosa.load(file_path, sr=self.sample_rate)
            
            # 1. BPM and Strumming Estimation
            tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
            
            # 2. Tone Analysis
            spec_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
            tone = "Bright / Trebly" if spec_centroid > 2500 else "Warm / Mellow"
            if spec_centroid > 4000: tone = "High Gain / Piercing"

            # 3. Chord Progression
            chroma = librosa.feature.chroma_stft(y=y, sr=sr)
            chord_events = []
            for i in range(0, chroma.shape[1], 20):  # Sample every 20 frames
                avg_chroma = np.mean(chroma[:, i:i+20], axis=1)
                chord = self.get_chord_from_chroma(avg_chroma)
                timestamp = librosa.frames_to_time(i, sr=sr)
                if not chord_events or chord_events[-1]["chord"] != chord:
                    chord_events.append({"timestamp": float(timestamp), "chord": chord})

            # 4. Note Detection (Tabs)
            notes = []
            for i in range(0, len(y) - self.buffer_size, self.buffer_size):
                chunk = y[i:i + self.buffer_size].astype(np.float32)
                analysis = self.analyze_buffer(chunk)
                if analysis["note"]:
                    analysis["timestamp"] = i / sr
                    notes.append(analysis)

            return {
                "bpm": float(tempo),
                "tone": tone,
                "chords": chord_events,
                "notes": notes[::5], # Decimate for readability
                "message": "Analysis complete by StellarTuner Engine"
            }
        except Exception as e:
            return {"error": str(e)}
