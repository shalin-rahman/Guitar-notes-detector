# AhiChord

A premium, real-time guitar note detector and transcription engine.

## Features

- **Real-time Detection**: Zero-latency browser-side pitch detection.
- **Advanced Transcription**: Automated chord charts, BPM estimation, and tone analysis.
- **Sleek UI**: Modern glassmorphic design with dark mode and neon visualizers.
- **Smart Engine**: High-performance detection using `aubio` with a reliable `librosa` fallback.

## Getting Started

1. **Quick Start**:
   ```bash
   pip install fastapi uvicorn numpy librosa
   python app/main.py
   ```
2. Open **http://localhost:8000** in your browser.

## Advanced Requirements

For the highest performance on file analysis, it's recommended to install `aubio`:

```bash
pip install aubio
```

*Note: On Windows, this requires Microsoft Visual C++ Build Tools.*

## Project Structure

- `app/main.py`: FastAPI server & API.
- `app/engine.py`: Multi-engine audio processing logic.
- `app/static/`: Frontend assets.
