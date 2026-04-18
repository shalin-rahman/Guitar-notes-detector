// src/app.js - Refactored to SOLID Principles & DRY

// --- CONFIGURATION ---
class AppConfig {
    static SAMPLE_RATE = 44100;
    static BUF_SIZE = 2048;
    static MIN_SAMPLES = 0;
    static CORRELATION_THRESHOLD = 0.9;
    static NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    static DEFAULT_SARGAM_MAP = ["S", "S'", "R", "R'", "G", "M", "M'", "P", "P'", "D", "D'", "N"];
    static BASIC_CHORDS = [
        { name: "C Major", notes: ["C", "E", "G"] },
        { name: "G Major", notes: ["G", "B", "D"] },
        { name: "D Major", notes: ["D", "F#", "A"] },
        { name: "A Major", notes: ["A", "C#", "E"] },
        { name: "E Major", notes: ["E", "G#", "B"] },
        { name: "A Minor", notes: ["A", "C", "E"] },
        { name: "E Minor", notes: ["E", "G", "B"] },
        { name: "D Minor", notes: ["D", "F", "A"] }
    ];
}

// --- MUSIC THEORY ENGINE ---
class MusicEngine {
    static freqToNote(freq) {
        if (freq <= 0) return null;
        const midi = 69 + 12 * Math.log2(freq / 440);
        const roundMidi = Math.round(midi);
        const noteIndex = roundMidi % 12;
        const octave = Math.floor(roundMidi / 12) - 1;
        const centsOff = (midi - roundMidi) * 100;
        
        let tab = null;
        if (roundMidi >= 64) tab = `1e fret ${roundMidi - 64}`;
        else if (roundMidi >= 59) tab = `2B fret ${roundMidi - 59}`;
        else if (roundMidi >= 55) tab = `3G fret ${roundMidi - 55}`;
        else if (roundMidi >= 50) tab = `4D fret ${roundMidi - 50}`;
        else if (roundMidi >= 45) tab = `5A fret ${roundMidi - 45}`;
        else if (roundMidi >= 40) tab = `6E fret ${roundMidi - 40}`;

        return { name: AppConfig.NOTE_NAMES[noteIndex] + octave, cents: centsOff, tab: tab, baseName: AppConfig.NOTE_NAMES[noteIndex] };
    }

    static getSargamBase(noteStr, rootName, customSymbolsStr) {
        if (!noteStr) return "";
        const baseNote = noteStr.replace(/[0-9]/g, '');
        const rootIdx = AppConfig.NOTE_NAMES.indexOf(rootName);
        const noteIdx = AppConfig.NOTE_NAMES.indexOf(baseNote);
        if (rootIdx === -1 || noteIdx === -1) return "";
        const interval = (noteIdx - rootIdx + 12) % 12;
        
        if (customSymbolsStr) {
            const customMap = customSymbolsStr.split(',').map(s => s.trim());
            if (customMap.length === 12) return customMap[interval];
        }
        return AppConfig.DEFAULT_SARGAM_MAP[interval];
    }

    static estimateBasicChord(recentNotes) {
        const uniqueNotes = [...new Set(recentNotes)];
        if (uniqueNotes.length < 3) return "None";
        for (let chord of AppConfig.BASIC_CHORDS) {
            let matches = chord.notes.filter(n => uniqueNotes.includes(n));
            if (matches.length === 3) return chord.name;
        }
        return "Unknown";
    }
}

// --- SIGNAL PROCESSING ---
class PitchDetector {
    static autoCorrelate(buf, sampleRate, sensitivityParam = 80) {
        let SIZE = buf.length;
        let MAX_SAMPLES = Math.floor(SIZE / 2);
        let best_offset = -1;
        let best_correlation = 0;
        let rms = 0;

        for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
        rms = Math.sqrt(rms / SIZE);
        
        let threshold = 0.002 + ((100 - sensitivityParam) / 100) * 0.098;
        if (rms < threshold) return -1;

        let lastCorrelation = 1;
        for (let offset = AppConfig.MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
            let correlation = 0;
            for (let i = 0; i < MAX_SAMPLES; i++) {
                correlation += Math.abs((buf[i]) - (buf[i + offset]));
            }
            correlation = 1 - (correlation / MAX_SAMPLES);

            if ((correlation > AppConfig.CORRELATION_THRESHOLD) && (correlation > lastCorrelation)) {
                if (correlation > best_correlation) {
                    best_correlation = correlation;
                    best_offset = offset;
                }
            }
            lastCorrelation = correlation;
        }
        if (best_correlation > 0.01) return sampleRate / best_offset;
        return -1;
    }
}

// --- HISTORY & TRACKING ---
class TrackingManager {
    constructor(elements) {
        this.elements = elements; 
        this.recentNotes = [];
        this.noteClearTimeout = null;
        this.stabilizationBuffer = [];
        this.last10Buffer = [];
        this.lastHistoryItem = "";
        this.lastHistoryTime = 0;
    }

    addToTicker(text, isChord) {
        const ticker = this.elements.scrollingTicker;
        const el = document.createElement('div');
        el.className = 'ticker-item' + (isChord ? ' chord-item' : '');
        el.textContent = text;
        ticker.appendChild(el);
        setTimeout(() => { if (ticker.contains(el)) el.remove(); }, 4000);
    }

    addToHistory(note) {
        const now = Date.now();
        if (note === this.lastHistoryItem && now - this.lastHistoryTime < 2000) return;
        this.lastHistoryItem = note;
        this.lastHistoryTime = now;

        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `<span class="note">${note}</span><span class="time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>`;
        
        this.elements.historyList.prepend(item);
        this.elements.historyList.querySelectorAll('.empty-state').forEach(p => p.remove());
        if (this.elements.historyList.children.length > 20) this.elements.historyList.removeChild(this.elements.historyList.lastChild);
    }

    updateLast10(note, sargam) {
        const entry = { n: note, s: sargam };
        if (this.last10Buffer.length > 0 && this.last10Buffer[this.last10Buffer.length - 1].n === note) return;
        this.last10Buffer.push(entry);
        if (this.last10Buffer.length > 10) this.last10Buffer.shift();
        
        this.elements.last10List.innerHTML = this.last10Buffer.map(e => `
            <span style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 6px; font-size: 0.8rem; border: 1px solid var(--glass-border);">
                <strong style="color:var(--primary)">${e.n}</strong> 
                <span style="color:#fbbf24">[${e.s}]</span>
            </span>`).join('');
    }

    exportLog() {
        let content = "Ahordian Transcription Export\n=============================\n\n";
        const items = this.elements.historyList.querySelectorAll('.history-item');
        if (items.length === 0) return alert("No transcription data to save yet.");
        
        Array.from(items).reverse().forEach(item => {
            content += item.innerText.replace(/\n+/g, '\n') + "\n\n";
        });
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ahordian-Export-${new Date().getTime()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// --- UI MANAGER ---
class UIManager {
    constructor(elements, tracker) {
        this.elements = elements;
        this.tracker = tracker;
        this.canvasCtx = this.elements.canvas.getContext('2d');
        window.addEventListener('resize', this.resizeCanvas.bind(this));
        this.resizeCanvas();
    }

    resizeCanvas() {
        this.elements.canvas.width = this.elements.canvas.parentElement.clientWidth - 40;
        this.elements.canvas.height = 120;
    }

    drawWaveform(dataArray) {
        this.canvasCtx.clearRect(0, 0, this.elements.canvas.width, this.elements.canvas.height);
        this.canvasCtx.lineWidth = 2;
        this.canvasCtx.strokeStyle = '#ffd700'; // Match golden theme
        this.canvasCtx.beginPath();
        const sliceWidth = this.elements.canvas.width * 1.0 / dataArray.length;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] * 100.0;
            const y = this.elements.canvas.height / 2 + v;
            if (i === 0) this.canvasCtx.moveTo(x, y);
            else this.canvasCtx.lineTo(x, y);
            x += sliceWidth;
        }
        this.canvasCtx.stroke();
    }

    resetUI() {
        this.elements.currentNote.textContent = "--";
        this.elements.currentSargam.textContent = "-";
        this.elements.currentFreq.textContent = "0.0 Hz";
        this.elements.currentTab.textContent = "";
        this.elements.needle.style.transform = `rotate(0deg)`;
        this.elements.needle.classList.remove('in-tune');
    }

    render(freq) {
        if (freq <= 0 || freq >= 2000) return this.resetUI();

        const noteData = MusicEngine.freqToNote(freq);
        const sargamNote = MusicEngine.getSargamBase(noteData.name, this.elements.saRoot.value, this.elements.saSymbols.value);
        
        // Stabilize
        this.tracker.stabilizationBuffer.push({ name: noteData.name, sargam: sargamNote, cents: noteData.cents, tab: noteData.tab, freq: freq });
        if (this.tracker.stabilizationBuffer.length > 7) this.tracker.stabilizationBuffer.shift();
        
        let modeMap = {};
        let maxEl = this.tracker.stabilizationBuffer[0].name;
        let maxCount = 1;
        for (let d of this.tracker.stabilizationBuffer) {
            modeMap[d.name] = (modeMap[d.name] || 0) + 1;
            if (modeMap[d.name] > maxCount) { maxEl = d.name; maxCount = modeMap[d.name]; }
        }
        
        if (maxCount >= 4) {
            const stableData = this.tracker.stabilizationBuffer.slice().reverse().find(d => d.name === maxEl);
            
            this.elements.currentNote.textContent = stableData.name;
            this.elements.currentSargam.textContent = stableData.sargam;
            this.elements.currentFreq.textContent = `${stableData.freq.toFixed(1)} Hz`;
            this.elements.currentTab.textContent = stableData.tab ? `[ ${stableData.tab} ]` : "";
            
            this.elements.needle.style.transform = `rotate(${stableData.cents * 0.9}deg)`;
            stableData.cents > -6 && stableData.cents < 6 ? this.elements.needle.classList.add('in-tune') : this.elements.needle.classList.remove('in-tune');

            if (Math.abs(stableData.cents) < 10) {
                this.tracker.addToHistory(`${stableData.name} - ${stableData.sargam}`);
                this.tracker.addToTicker(`${stableData.name} [${stableData.sargam}]`, false);
                this.tracker.updateLast10(stableData.name, stableData.sargam);
                this.handleChordLogic(stableData.name, stableData.sargam);
            }
        }
    }
    
    handleChordLogic(stableName) {
        const baseNote = stableName.replace(/[0-9]/g, '');
        if (!this.tracker.recentNotes.includes(baseNote)) {
            this.tracker.recentNotes.push(baseNote);
            if (this.tracker.recentNotes.length > 5) this.tracker.recentNotes.shift();
            
            const predicted = MusicEngine.estimateBasicChord(this.tracker.recentNotes);
            this.elements.liveChord.textContent = predicted;
            if (predicted !== "None" && predicted !== "Unknown") {
                const sargamChordBase = MusicEngine.getSargamBase(predicted.split(' ')[0], this.elements.saRoot.value, this.elements.saSymbols.value);
                this.tracker.addToTicker(`${predicted} [${sargamChordBase}]`, true);
            }
            
            clearTimeout(this.tracker.noteClearTimeout);
            this.tracker.noteClearTimeout = setTimeout(() => {
                this.tracker.recentNotes = [];
                this.elements.liveChord.textContent = "None";
            }, 2500);
        }
    }
}

// --- FILE MANAGER ---
class FileManager {
    static init(dropZone, fileInput, tracker) {
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent)'; });
        dropZone.addEventListener('dragleave', () => dropZone.style.borderColor = 'var(--glass-border)');
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer.files.length) FileManager.handleUpload(e.dataTransfer.files[0], tracker); });
        fileInput.addEventListener('change', (e) => { if (e.target.files.length) FileManager.handleUpload(e.target.files[0], tracker); });
    }

    static async handleUpload(file, tracker) {
        tracker.addToHistory(`Analyzing ${file.name} (Advanced Transcription)...`);
        
        // Find the last inserted history item to attach progress text
        const historyItems = tracker.elements.historyList.querySelectorAll('.history-item');
        let targetItem = historyItems[0];
        
        if (targetItem) {
            const progressDisplay = document.createElement('div');
            progressDisplay.id = 'upload-progress-text';
            progressDisplay.style.cssText = 'color: var(--primary); font-size: 0.85rem; margin-top: 5px; font-weight: bold;';
            progressDisplay.textContent = 'Initiating backend audio matrix...';
            targetItem.querySelector('div').appendChild(progressDisplay);
            
            const progressSteps = [
                "Extracting harmonic arrays...",
                "Running algorithmic librosa bounds...",
                "Filtering overlapping noise gates...",
                "Mapping Sargam relatives...",
                "Finalizing timeline vectors..."
            ];
            let step = 0;
            FileManager.progressInterval = setInterval(() => {
                const pt = document.getElementById('upload-progress-text');
                if (pt) {
                    pt.textContent = progressSteps[step];
                    step = (step + 1) % progressSteps.length;
                }
            }, 3500);
        }

        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch('/analyze', { method: 'POST', body: formData });
            
            if (FileManager.progressInterval) clearInterval(FileManager.progressInterval);
            const pt = document.getElementById('upload-progress-text');
            if (pt) pt.textContent = "Transcription Complete!";

            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            const report = document.createElement('div');
            report.className = 'history-item advanced-report';
            report.innerHTML = `
                <div class="report-header">
                    <strong>Analysis for ${file.name}</strong>
                    <p>BPM: ${data.bpm | 0} | Tone: ${data.tone}</p>
                </div>
                <table>
                    <thead><tr><th>Time</th><th>Chord</th></tr></thead>
                    <tbody>${data.chords.map(c => `<tr><td>${c.timestamp.toFixed(1)}s</td><td>${c.chord}</td></tr>`).join('')}</tbody>
                </table>
                <div class="tabs-block">
                    <strong>Raw Note Sequence (Standard Tuning Tabs):</strong>
                    <pre>${data.notes.map(n => n.tab || n.note).join(' -> ')}</pre>
                </div>
            `;
            tracker.elements.historyList.prepend(report);
            tracker.elements.historyList.querySelectorAll('.empty-state').forEach(p => p.remove());
        } catch (err) {
            tracker.addToHistory(`Error: ${err.message}`);
        }
    }
}

// --- CORE APP CONTROLLER ---
class App {
    constructor() {
        this.isStarted = false;
        this.animationId = null;
        this.audioContext = null;
        this.micStream = null;
        this.analyser = null;

        this.elements = {
            startBtn: document.getElementById('start-btn'),
            stopBtn: document.getElementById('stop-btn'),
            micStatus: document.getElementById('mic-status'),
            needle: document.getElementById('needle'),
            saveBtn: document.getElementById('save-btn'),
            currentNote: document.getElementById('current-note'),
            currentSargam: document.getElementById('current-sargam'),
            currentFreq: document.getElementById('current-freq'),
            currentTab: document.getElementById('current-tab'),
            liveChord: document.getElementById('live-chord'),
            historyList: document.getElementById('history-list'),
            last10List: document.getElementById('last10-list'),
            scrollingTicker: document.getElementById('scrolling-ticker'),
            canvas: document.getElementById('waveform'),
            saRoot: document.getElementById('sa-root'),
            saSymbols: document.getElementById('sa-symbols'),
            sensitivity: document.getElementById('sensitivity'),
            hwNoiseSuppress: document.getElementById('hw-noise-suppress'),
            dropZone: document.getElementById('drop-zone'),
            fileInput: document.getElementById('file-input')
        };

        this.tracker = new TrackingManager(this.elements);
        this.ui = new UIManager(this.elements, this.tracker);
        
        this.bindEvents();
        FileManager.init(this.elements.dropZone, this.elements.fileInput, this.tracker);
    }

    bindEvents() {
        this.elements.startBtn.addEventListener('click', this.start.bind(this));
        this.elements.stopBtn.addEventListener('click', this.stop.bind(this));
        this.elements.saveBtn.addEventListener('click', () => this.tracker.exportLog());
    }

    async start() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            const useHwNoiseCancellation = this.elements.hwNoiseSuppress.checked;
            const constraints = {
                audio: {
                    echoCancellation: useHwNoiseCancellation,
                    noiseSuppression: useHwNoiseCancellation,
                    autoGainControl: useHwNoiseCancellation
                }
            };
            
            this.micStream = await navigator.mediaDevices.getUserMedia(constraints);
            const source = this.audioContext.createMediaStreamSource(this.micStream);
            
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = AppConfig.BUF_SIZE;
            source.connect(this.analyser);

            const dataArray = new Float32Array(AppConfig.BUF_SIZE);
            this.elements.micStatus.textContent = "Live Detection Active";
            this.elements.micStatus.classList.add('active');
            this.elements.startBtn.disabled = true;
            this.elements.stopBtn.disabled = false;
            this.isStarted = true;

            const loop = () => {
                if (!this.isStarted) return;
                this.analyser.getFloatTimeDomainData(dataArray);
                const sensitivityVal = parseInt(this.elements.sensitivity.value || 80);
                const freq = PitchDetector.autoCorrelate(dataArray, this.audioContext.sampleRate, sensitivityVal);
                this.ui.render(freq);
                this.ui.drawWaveform(dataArray);
                this.animationId = requestAnimationFrame(loop);
            };
            loop();
        } catch (err) {
            console.error("Microphone access denied:", err);
            alert("Please allow microphone access to use the tuner.");
        }
    }

    stop() {
        this.isStarted = false;
        if (this.micStream) this.micStream.getTracks().forEach(track => track.stop());
        if (this.audioContext) this.audioContext.close();
        cancelAnimationFrame(this.animationId);
        
        this.elements.micStatus.textContent = "Microphone Off";
        this.elements.micStatus.classList.remove('active');
        this.elements.startBtn.disabled = false;
        this.elements.stopBtn.disabled = true;
        this.ui.resetUI();
    }
}

// Bootstrap
document.addEventListener("DOMContentLoaded", () => {
    window.AhordianApp = new App();
});
