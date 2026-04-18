// Configuration
const SAMPLE_RATE = 44100;
const BUF_SIZE = 2048;
const MIN_SAMPLES = 0;
const GOOD_ENOUGH_CORRELATION = 0.9;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// State
let audioContext = null;
let analyser = null;
let micStream = null;
let animationId = null;
let isStarted = false;

// DOM Elements
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const micStatus = document.getElementById('mic-status');
const needle = document.getElementById('needle');
const saveBtn = document.getElementById('save-btn');
const currentNoteEl = document.getElementById('current-note');
const currentFreqEl = document.getElementById('current-freq');
const currentTabEl = document.getElementById('current-tab');
const liveChordEl = document.getElementById('live-chord');
const historyList = document.getElementById('history-list');
const canvas = document.getElementById('waveform');
const canvasCtx = canvas.getContext('2d');

// Chord Estimation Buffer
let recentNotes = [];
let noteClearTimeout = null;

const BASIC_CHORDS = [
    { name: "C Major", notes: ["C", "E", "G"] },
    { name: "G Major", notes: ["G", "B", "D"] },
    { name: "D Major", notes: ["D", "F#", "A"] },
    { name: "A Major", notes: ["A", "C#", "E"] },
    { name: "E Major", notes: ["E", "G#", "B"] },
    { name: "A Minor", notes: ["A", "C", "E"] },
    { name: "E Minor", notes: ["E", "G", "B"] },
    { name: "D Minor", notes: ["D", "F", "A"] }
];

function estimateLiveChord() {
    const uniqueNotes = [...new Set(recentNotes)];
    if (uniqueNotes.length < 3) return "None";
    
    for (let chord of BASIC_CHORDS) {
        let matches = chord.notes.filter(n => uniqueNotes.includes(n));
        if (matches.length === 3) return chord.name;
    }
    return "Unknown";
}

// Initialize Canvas
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth - 40;
    canvas.height = 120;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Pitch Detection (Autocorrelation)
function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length;
    let MAX_SAMPLES = Math.floor(SIZE / 2);
    let best_offset = -1;
    let best_correlation = 0;
    let rms = 0;

    for (let i = 0; i < SIZE; i++) {
        let val = buf[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1; // Not enough signal

    let lastCorrelation = 1;
    for (let offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
        let correlation = 0;

        for (let i = 0; i < MAX_SAMPLES; i++) {
            correlation += Math.abs((buf[i]) - (buf[i + offset]));
        }
        correlation = 1 - (correlation / MAX_SAMPLES);

        if ((correlation > GOOD_ENOUGH_CORRELATION) && (correlation > lastCorrelation)) {
            if (correlation > best_correlation) {
                best_correlation = correlation;
                best_offset = offset;
            }
        }
        lastCorrelation = correlation;
    }

    if (best_correlation > 0.01) {
        return sampleRate / best_offset;
    }
    return -1;
}

function freqToNote(freq) {
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

    return {
        name: NOTE_NAMES[noteIndex] + octave,
        cents: centsOff,
        tab: tab
    };
}

function updateUI(freq) {
    if (freq > 0 && freq < 2000) {
        const noteData = freqToNote(freq);
        currentNoteEl.textContent = noteData.name;
        currentFreqEl.textContent = `${freq.toFixed(1)} Hz`;
        currentTabEl.textContent = noteData.tab ? `[ ${noteData.tab} ]` : "";
        
        // Update needle (cents -50 to +50 -> -45deg to +45deg)
        const angle = noteData.cents * 0.9; 
        needle.style.transform = `rotate(${angle}deg)`;
        
        if (Math.abs(noteData.cents) < 6) {
            needle.classList.add('in-tune');
        } else {
            needle.classList.remove('in-tune');
        }

        // Add to history and chord buffer if it's a stable detection
        if (Math.abs(noteData.cents) < 10) {
            addToHistory(noteData.name);
            addToTicker(noteData.name, false);
            
            // Live Chord Logic
            const baseNote = noteData.name.replace(/[0-9]/g, '');
            if (!recentNotes.includes(baseNote)) {
                recentNotes.push(baseNote);
                if (recentNotes.length > 5) recentNotes.shift();
                
                const predicted = estimateLiveChord();
                liveChordEl.textContent = predicted;
                if (predicted !== "None" && predicted !== "Unknown") {
                    addToTicker(predicted, true);
                }
                
                clearTimeout(noteClearTimeout);
                noteClearTimeout = setTimeout(() => {
                    recentNotes = [];
                    liveChordEl.textContent = "None";
                }, 2500); // 2.5 seconds timeout to clear buffer
            }
        }
    } else {
        currentNoteEl.textContent = "--";
        currentFreqEl.textContent = "0.0 Hz";
        currentTabEl.textContent = "";
        needle.style.transform = `rotate(0deg)`;
        needle.classList.remove('in-tune');
    }
}

function addToTicker(text, isChord) {
    const ticker = document.getElementById('scrolling-ticker');
    const el = document.createElement('div');
    el.className = 'ticker-item' + (isChord ? ' chord-item' : '');
    el.textContent = text;
    ticker.appendChild(el);
    setTimeout(() => { if (ticker.contains(el)) el.remove(); }, 4000);
}

let lastHistoryItem = "";
let lastHistoryTime = 0;

function addToHistory(note) {
    const now = Date.now();
    if (note === lastHistoryItem && now - lastHistoryTime < 2000) return;
    
    lastHistoryItem = note;
    lastHistoryTime = now;

    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
        <span class="note">${note}</span>
        <span class="time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
    `;
    
    historyList.prepend(item);
    
    const placeholders = historyList.querySelectorAll('.empty-state');
    placeholders.forEach(p => p.remove());

    if (historyList.children.length > 20) {
        historyList.removeChild(historyList.lastChild);
    }
}

function drawWaveform(dataArray) {
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = '#00f2fe';
    canvasCtx.beginPath();

    const sliceWidth = canvas.width * 1.0 / dataArray.length;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] * 100.0;
        const y = canvas.height / 2 + v;

        if (i === 0) canvasCtx.moveTo(x, y);
        else canvasCtx.lineTo(x, y);

        x += sliceWidth;
    }
    canvasCtx.stroke();
}

async function startDetection() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(micStream);
        
        analyser = audioContext.createAnalyser();
        analyser.fftSize = BUF_SIZE;
        source.connect(analyser);

        const dataArray = new Float32Array(BUF_SIZE);
        
        micStatus.textContent = "Live Detection Active";
        micStatus.classList.add('active');
        startBtn.disabled = true;
        stopBtn.disabled = false;
        isStarted = true;

        const loop = () => {
            if (!isStarted) return;
            analyser.getFloatTimeDomainData(dataArray);
            const freq = autoCorrelate(dataArray, audioContext.sampleRate);
            updateUI(freq);
            drawWaveform(dataArray);
            animationId = requestAnimationFrame(loop);
        };
        loop();

    } catch (err) {
        console.error("Microphone access denied:", err);
        alert("Please allow microphone access to use the tuner.");
    }
}

function stopDetection() {
    isStarted = false;
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
        audioContext.close();
    }
    cancelAnimationFrame(animationId);
    micStatus.textContent = "Microphone Off";
    micStatus.classList.remove('active');
    startBtn.disabled = false;
    stopBtn.disabled = true;
    updateUI(0);
}

saveBtn.addEventListener('click', () => {
    let content = "StellarTuner Transcription Export\n=============================\n\n";
    const items = historyList.querySelectorAll('.history-item');
    if (items.length === 0) {
        alert("No transcription data to save yet.");
        return;
    }
    
    // We reverse so it's chronologically forward
    Array.from(items).reverse().forEach(item => {
        content += item.innerText.replace(/\n+/g, '\n') + "\n\n";
    });

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Transcription-${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
});

startBtn.addEventListener('click', startDetection);
stopBtn.addEventListener('click', stopDetection);

// File Analysis Placeholder (Logic will be via FastAPI)
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--accent)';
});
dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'var(--glass-border)';
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length) handleFileUpload(files[0]);
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFileUpload(e.target.files[0]);
});

async function handleFileUpload(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    addToHistory(`Analyzing ${file.name} (Advanced Transcription)...`);
    
    try {
        const response = await fetch('/analyze', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        // Display High-level Analysis
        const report = document.createElement('div');
        report.className = 'history-item advanced-report';
        report.innerHTML = `
            <div class="report-header">
                <strong>Analysis for ${file.name}</strong>
                <p>BPM: ${data.bpm | 0} | Tone: ${data.tone}</p>
            </div>
            <table>
                <thead><tr><th>Time</th><th>Chord</th></tr></thead>
                <tbody>
                    ${data.chords.map(c => `<tr><td>${c.timestamp.toFixed(1)}s</td><td>${c.chord}</td></tr>`).join('')}
                </tbody>
            </table>
            <div class="tabs-block">
                <strong>Raw Note Sequence (Standard Tuning Tabs):</strong>
                <pre>${data.notes.map(n => n.tab || n.note).join(' -> ')}</pre>
            </div>
        `;
        historyList.prepend(report);
        
        const placeholders = historyList.querySelectorAll('.empty-state');
        placeholders.forEach(p => p.remove());

    } catch (err) {
        addToHistory(`Error: ${err.message}`);
    }
}
