# Guitar-notes-detector
 Python script that detects guitar notes in real-time using your computer's microphone. It uses audio processing libraries to analyze frequencies and convert them to musical note names.

**Requirements:**
Install these packages first:

```bash
pip install numpy pyaudio aubio
```

**Features:**
Real-time guitar note detection from microphone input
Displays note name (e.g., "A2", "E4") and frequency
Confidence indicator for detection accuracy
Handles standard guitar frequency range (82Hz-1318Hz)

**How to Use:**
Connect your guitar to an audio interface OR use your computer's microphone
Run the script
Play single notes on your guitar
See detected notes in the console output

**Important Notes:**
Works best with clean input (use direct USB connection or audio interface)
For acoustic guitar, ensure minimal background noise
Plays single notes at a time (polyphonic detection requires more advanced techniques)
First run might need microphone permissions

**Common Issues & Solutions:**
**No detection?** Increase microphone volume
**Inaccurate notes?** Try lowering `TOLERANCE` to 0.7
**Background noise?** Add threshold: `if magnitudes[index, t] > np.max(magnitudes)*0.2:`