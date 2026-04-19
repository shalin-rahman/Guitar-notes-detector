import AppConfig from './AppConfig.js';
import MusicEngine from './MusicEngine.js';
import PitchDetector from './PitchDetector.js';
import TrackingManager from './TrackingManager.js';
import UIManager from './UIManager.js';
import FileManager from './FileManager.js';
import AudioPlayer from './AudioPlayer.js';
import FretboardManager from './FretboardManager.js';
import CircleManager from './CircleManager.js';
import Metronome from './Metronome.js';

class App {
    constructor() {
        this.metronome = new Metronome();
        
        this.isStarted = false;
        this.animationId = null;
        this.audioContext = null;
        this.micStream = null;
        this.analyser = null;
        this.lastDetectedNote = null;
        this.sequenceAbortFlag = false;

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
            fileInput: document.getElementById('file-input'),
            navBtns: document.querySelectorAll('.nav-btn'),
            screens: document.querySelectorAll('.screen'),
            fretboardHistory: document.getElementById('fretboard-history'),
            manualNoteInput: document.getElementById('manual-note-input'),
            playNoteBtn: document.getElementById('play-note-btn'),
            positionInfo: document.getElementById('position-info'),
            scaleButtons: document.getElementById('scale-buttons'),
            patternButtons: document.getElementById('pattern-buttons'),
            tuningSelect: document.getElementById('tuning-select'),
            toggleOverlay: document.getElementById('toggle-overlay'),
            displayIntervalsToggle: document.getElementById('display-intervals-toggle'),
            clearOverlayBtn: document.getElementById('clear-overlay-btn'),
            soundToggle: document.getElementById('sound-toggle'),
            sequenceTape: document.getElementById('sequence-tape'),
            
            // Metronome
            metroToggle: document.getElementById('metronome-toggle'),
            metroBpm: document.getElementById('metronome-bpm'),
            metroSound: document.getElementById('metronome-sound'),
            metroSignature: document.getElementById('metronome-signature'),
            metroLight: document.getElementById('metronome-light'),
            
            // Visualizer Extras
            confidenceBar: document.getElementById('confidence-bar'),
            
            // Transcription
            liveCaptureBtn: document.getElementById('live-capture-btn'),
            playTapeBtn: document.getElementById('play-tape-btn'),
            exportTapeBtn: document.getElementById('export-tape-btn'),
            clearTapeBtn: document.getElementById('clear-tape-btn'),
            
            // Custom Tuning
            customTuningInput: document.getElementById('custom-tuning-input'),
            toggleCustomTuningBtn: document.getElementById('toggle-custom-tuning')
        };

        this.tapeBuffer = [];
        this.isCapturing = false;
        this.captureBuffer = []; // Stability buffer for audio capture
        this.lastCapturedNote = null;

        this.tracker = new TrackingManager(this.elements);
        this.ui = new UIManager(this.elements, this.tracker);
        this.fretboard = new FretboardManager('guitar-fretboard');
        this.circleManager = new CircleManager('circle-container', this);
        this.player = null;

        this.bindEvents();
        this.loadFretboardHistory();
        this.loadSamples();
        this.populateTunings();
        FileManager.init(this.elements.dropZone, this.elements.fileInput, this.tracker);
    }

    bindEvents() {
        this.elements.startBtn.addEventListener('click', this.start.bind(this));
        this.elements.stopBtn.addEventListener('click', this.stop.bind(this));
        this.elements.saveBtn.addEventListener('click', () => this.tracker.exportLog());

        this.elements.soundToggle.addEventListener('click', () => {
            if (!this.player) this.initAudioContext();
            const isMuted = !this.player.isMuted;
            this.player.setMuted(isMuted);
            this.elements.soundToggle.classList.toggle('muted', isMuted);
            this.elements.soundToggle.querySelector('.speaker-icon').textContent = isMuted ? '🔇' : '🔊';
        });

        this.elements.tuningSelect.addEventListener('change', (e) => {
            const tuning = AppConfig.ALTERNATE_TUNINGS.find(t => t.name === e.target.value);
            if (tuning) this.fretboard.setTuning(tuning.notes);
        });

        this.elements.clearOverlayBtn.addEventListener('click', () => {
            this.fretboard.clearOverlay();
            this.elements.toggleOverlay.checked = false;
        });

        if (this.elements.displayIntervalsToggle) {
            this.elements.displayIntervalsToggle.addEventListener('change', (e) => {
                this.fretboard.setDisplayMode(e.target.checked ? 'intervals' : 'notes');
            });
        }

        this.elements.navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-target');
                this.elements.screens.forEach(s => s.classList.remove('active'));
                document.getElementById(target).classList.add('active');
                this.elements.navBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        this.elements.playNoteBtn.addEventListener('click', () => {
            const note = this.elements.manualNoteInput.value.trim();
            if (note) this.triggerFretboardNote(note);
        });

        this.elements.manualNoteInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.elements.playNoteBtn.click();
        });
        this.initMetronome();
    }

    initMetronome() {
        this.metronome.onTick = (isDownbeat) => {
            const color = isDownbeat ? '#ffd700' : '#c0c0c0';
            const shadow = isDownbeat ? '0 0 15px #ffd700' : '0 0 8px #c0c0c0';
            this.elements.metroLight.style.background = color;
            this.elements.metroLight.style.boxShadow = shadow;
            setTimeout(() => {
                this.elements.metroLight.style.background = '#333';
                this.elements.metroLight.style.boxShadow = '0 0 5px rgba(0,0,0,0.5)';
            }, 100);
        };

        this.elements.metroToggle.addEventListener('click', () => {
            if (this.metronome.isPlaying) {
                this.metronome.stop();
                this.elements.metroToggle.textContent = '⏵';
            } else {
                this.metronome.start();
                this.elements.metroToggle.textContent = '⏸';
            }
        });

        const updateBpm = (e) => this.metronome.setBpm(parseInt(e.target.value));
        this.elements.metroBpm.addEventListener('change', updateBpm);
        this.elements.metroBpm.addEventListener('input', updateBpm);
        this.elements.metroSound.addEventListener('change', (e) => this.metronome.soundType = e.target.value);
        this.elements.metroSignature.addEventListener('change', (e) => this.metronome.beatsPerMeasure = parseInt(e.target.value));

        // Transcription Controls
        this.elements.liveCaptureBtn.addEventListener('click', () => {
            this.isCapturing = !this.isCapturing;
            this.elements.liveCaptureBtn.textContent = this.isCapturing ? '🟢 Record to Tape: ON' : '🔴 Record to Tape: OFF';
            this.elements.liveCaptureBtn.classList.toggle('active', this.isCapturing);
        });

        this.elements.playTapeBtn.addEventListener('click', () => {
            if (this.tapeBuffer.length > 0) {
                this.playSequence([...this.tapeBuffer]);
            }
        });

        this.elements.exportTapeBtn.addEventListener('click', () => this.exportTape());

        this.elements.clearTapeBtn.addEventListener('click', () => {
            this.tapeBuffer = [];
            this.updateTape(-1);
        });

        // Custom Tuning Toggle
        this.elements.toggleCustomTuningBtn.addEventListener('click', () => {
            const isHidden = this.elements.customTuningInput.style.display === 'none';
            this.elements.customTuningInput.style.display = isHidden ? 'block' : 'none';
            this.elements.tuningSelect.style.display = isHidden ? 'none' : 'block';
            this.elements.toggleCustomTuningBtn.textContent = isHidden ? '✖' : '✎';
        });

        this.elements.customTuningInput.addEventListener('change', (e) => {
            const val = e.target.value.trim().toUpperCase();
            if (val) {
                const notes = val.split('-').map(n => n.trim());
                if (notes.length === 6) {
                    this.fretboard.setTuning(notes);
                    this.elements.positionInfo.textContent = `Custom Tuning Set: ${notes.join('-')}`;
                }
            }
        });

        // 6. Local File Analysis (Drag & Drop)
        const dropZone = document.getElementById('drop-zone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('hover'); });
            dropZone.addEventListener('dragleave', () => dropZone.classList.remove('hover'));
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('hover');
                const file = e.dataTransfer.files[0];
                if (file) this.analyzeLocalFile(file);
            });
            dropZone.addEventListener('click', () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'audio/*';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) this.analyzeLocalFile(file);
                };
                input.click();
            });
        }
    }

    async analyzeLocalFile(file) {
        this.elements.micStatus.textContent = "Analyzing File...";
        this.elements.micStatus.classList.add('active');
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;
                const audioData = await this.audioContext.decodeAudioData(arrayBuffer);
                const rawData = audioData.getChannelData(0);
                const sampleRate = audioData.sampleRate;
                
                this.tapeBuffer = ["FILE START"];
                const chunkSize = 4096;
                let lastNote = "";
                for (let i = 0; i < rawData.length; i += chunkSize) {
                    const chunk = rawData.slice(i, i + chunkSize);
                    const freq = PitchDetector.autoCorrelate(chunk, sampleRate, 85);
                    const note = MusicEngine.freqToNote(freq);
                    if (note) {
                        const nameOnly = note.name.replace(/[0-9]/g, '');
                        if (nameOnly !== lastNote) {
                            this.tapeBuffer.push(nameOnly);
                            lastNote = nameOnly;
                            if (this.tapeBuffer.length > 50) break;
                        }
                    }
                }
                this.tapeBuffer.push("END");
                this.updateTape();
                this.elements.micStatus.textContent = "Analysis Complete";
            } catch (err) {
                console.error("File Analysis Failed:", err);
                this.elements.micStatus.textContent = "Analysis Failed";
            }
        };
        reader.readAsArrayBuffer(file);
    }

    exportTape() {
        if (this.tapeBuffer.length === 0) return;
        const content = "Ahordian Transcription Tape\n" + 
                        "===========================\n" + 
                        "Generated: " + new Date().toLocaleString() + "\n\n" + 
                        "Sequence: " + this.tapeBuffer.join(" - ") + "\n";
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ahordian_transcription_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }

    loadTranscriptionToTape(notes) {
        this.tapeBuffer = notes.slice(0, 24); // Limit to visible tape size
        this.updateTape(-1);
    }

    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.player = new AudioPlayer(this.audioContext);
            this.player.onStateChange = (isPlaying) => {
                this.elements.soundToggle.classList.toggle('playing', isPlaying);
            };
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    triggerFretboardNote(noteInput, duration = 800) {
        this.initAudioContext();
        let targetNote = noteInput.toUpperCase().trim();

        // Check if input is a Sargam syllable (use original case for Bengali)
        const sargamKey = noteInput.trim();
        if (AppConfig.BENGALI_SARGAM_MAP[sargamKey] !== undefined) {
            targetNote = MusicEngine.sargamToNote(sargamKey, this.elements.saRoot.value);
        }

        if (!targetNote) return;

        const pos = this.fretboard.showNote(targetNote, duration);
        if (pos) {
            if (this.elements.positionInfo) {
                this.elements.positionInfo.textContent = `${targetNote} → String ${pos.string + 1}, Fret ${pos.fret}`;
            }
            this.player.playNote(targetNote);
            this.saveToFretboardHistory(targetNote, pos);
        } else {
            if (this.elements.positionInfo) {
                this.elements.positionInfo.textContent = `Note "${noteInput}" is out of range.`;
            }
        }
    }

    saveToFretboardHistory(noteName, pos) {
        const history = JSON.parse(localStorage.getItem('ahinotes_recent') || '[]');
        history.unshift({ note: noteName, pos: `Str ${pos.string + 1}, Fret ${pos.fret}`, time: Date.now() });
        const limited = history.slice(0, 10);
        localStorage.setItem('ahinotes_recent', JSON.stringify(limited));
        this.loadFretboardHistory();
    }

    loadFretboardHistory() {
        const history = JSON.parse(localStorage.getItem('ahinotes_recent') || '[]');
        this.elements.fretboardHistory.innerHTML = history.map(h => `
            <div class="note-tag" onclick="window.AhordianApp.triggerFretboardNote('${h.note}')" style="cursor:pointer">
                <span class="name">${h.note}</span>
                <span class="pos">${h.pos}</span>
            </div>
        `).join('') || '<div style="color:var(--text-muted)">No history yet</div>';
    }

    loadSamples() {
        this.elements.scaleButtons.innerHTML = AppConfig.SCALE_DEFINITIONS.map(scale => `
            <button class="secondary-btn small-btn sample-btn" onclick="window.AhordianApp.triggerScale('${scale.name}')">${scale.name}</button>
        `).join('');

        this.elements.patternButtons.innerHTML = AppConfig.SAMPLE_SEQUENCES.map(pattern => `
            <button class="secondary-btn small-btn sample-btn" onclick="window.AhordianApp.playSequence(${JSON.stringify(pattern.notes).replace(/"/g, '&quot;')})">${pattern.name}</button>
        `).join('');
    }

    populateTunings() {
        this.elements.tuningSelect.innerHTML = AppConfig.ALTERNATE_TUNINGS.map(t => `
            <option value="${t.name}">${t.name}</option>
        `).join('');
    }

    triggerScale(scaleName, customRoot = null) {
        const scale = AppConfig.SCALE_DEFINITIONS.find(s => s.name === scaleName);
        if (!scale) return;

        let rootName = customRoot || this.elements.saRoot.value;
        const manualNote = this.elements.manualNoteInput.value.trim().toUpperCase();
        
        if (!customRoot && manualNote) {
            let letter = manualNote.replace(/[0-9]/g, '');
            const flatMap = { 'DB': 'C#', 'EB': 'D#', 'FB': 'E', 'GB': 'F#', 'AB': 'G#', 'BB': 'A#', 'CB': 'B' };
            if (flatMap[letter]) letter = flatMap[letter];

            if (AppConfig.NOTE_NAMES.includes(letter)) {
                rootName = letter;
            }
        }

        const rootIdx = AppConfig.NOTE_NAMES.indexOf(rootName);
        const baseOctave = 4; // Mid-range guitar octave for clear distinction

        let displayAscending = [];
        let fullScale = [];

        const mapIntervals = (arr) => arr.map(interval => {
            const totalSteps = rootIdx + interval;
            const noteIdx = totalSteps % 12;
            const octaveShift = Math.floor(totalSteps / 12);
            return AppConfig.NOTE_NAMES[noteIdx] + (baseOctave + octaveShift);
        });

        if (scale.arohan && scale.aborohan) {
            displayAscending = mapIntervals(scale.arohan);
            const descending = mapIntervals(scale.aborohan);
            // If descending sequence starts with the last note of ascending sequence, merge smoothly
            if (descending.length > 0 && displayAscending.length > 0 && descending[0] === displayAscending[displayAscending.length - 1]) {
                fullScale = [...displayAscending, ...descending.slice(1)];
            } else {
                fullScale = [...displayAscending, ...descending];
            }
        } else {
            // Build simple symmetric scale
            displayAscending = mapIntervals(scale.intervals);
            const highRoot = rootName + (baseOctave + 1);
            const descending = [...displayAscending].reverse();
            fullScale = [...displayAscending, highRoot, ...descending];
        }

        // Format for display (remove octave numbers)
        const fullDisplayNotes = fullScale.map(n => n.replace(/[0-9]/g, ''));

        if (this.elements.toggleOverlay.checked) {
            this.fretboard.showScale(displayAscending.map(n => n.replace(/[0-9]/g, '')));
        }

        if (this.elements.positionInfo) {
            this.elements.positionInfo.textContent = `▶ ${scaleName}: ${fullDisplayNotes.join('-')}`;
        }

        this.playSequence(fullScale, 350);
    }

    updateTape(currentNoteIdx = -1) {
        this.elements.sequenceTape.innerHTML = this.tapeBuffer.map((n, i) => {
            const hue = (i * 25) % 360;
            const isCurrent = (i === currentNoteIdx);
            const style = isCurrent
                ? `background: rgba(255,215,0,0.3); border-color: #ffd700; color: #ffd700; box-shadow: 0 0 10px rgba(255,215,0,0.3); transform: scale(1.1);`
                : `background: hsla(${hue}, 60%, 50%, 0.12); border-color: hsla(${hue}, 60%, 50%, 0.3); color: hsl(${hue}, 70%, 70%)`;
            return `<div class="tape-node" style="${style}">${n}</div>`;
        }).join('');
        this.elements.sequenceTape.scrollLeft = this.elements.sequenceTape.scrollWidth;
    }

    async playSequence(notes, tempo = 350) {
        this.sequenceAbortFlag = true;
        this._currentSeqId = Date.now();
        const seqId = this._currentSeqId;

        await new Promise(r => setTimeout(r, 60));
        this.sequenceAbortFlag = false;

        this.initAudioContext();
        this.tapeBuffer = [];

        for (let i = 0; i < notes.length; i++) {
            if (this.sequenceAbortFlag || this._currentSeqId !== seqId) return;

            const noteGroup = notes[i];
            this.tapeBuffer.push(noteGroup);
            if (this.tapeBuffer.length > 15) this.tapeBuffer.shift();
            this.updateTape(this.tapeBuffer.length - 1);

            const subNotes = noteGroup.includes('-') ? noteGroup.split('-') : [noteGroup];
            for (const note of subNotes) {
                if (this.sequenceAbortFlag || this._currentSeqId !== seqId) return;
                this.triggerFretboardNote(note, tempo);
                if (subNotes.length > 1) await new Promise(r => setTimeout(r, tempo / 2));
            }
            await new Promise(r => setTimeout(r, tempo));
        }
        this.updateTape(-1);
    }

    async start() {
        try {
            this.initAudioContext();

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

                this.ui.render(freq, PitchDetector.lastCorrelation);

                const noteData = MusicEngine.freqToNote(freq);
                if (noteData && Math.abs(noteData.cents) < 15) {
                    if (this.lastDetectedNote !== noteData.name) {
                        this.lastDetectedNote = noteData.name;
                        this.fretboard.showNote(noteData.name);
                        
                        // Notify CircleManager for possible Quiz validation
                        if (this.circleManager) {
                            this.circleManager.handleDetectedNote(noteData.name);
                        }
                    }

                    // Live Transcription Logic
                    if (this.isCapturing) {
                        this.captureBuffer.push(noteData.name);
                        if (this.captureBuffer.length > 8) { // Buffer for 8 frames (~130ms) to ensure stability
                            const mostFrequent = this.getMostFrequent(this.captureBuffer);
                            if (mostFrequent && mostFrequent !== this.lastCapturedNote) {
                this.lastCapturedNote = mostFrequent;
                                // Add ONLY the note name (without octave) to the tape for cleaner look
                                const noteOnly = mostFrequent.replace(/[0-9]/g, '');
                                this.tapeBuffer.push(noteOnly);
                                if (this.tapeBuffer.length > 24) this.tapeBuffer.shift();
                                this.updateTape(-1);
                            }
                            this.captureBuffer = [];
                        }
                    }
                } else {
                    // Reset capture state on silence/noise
                    if (this.isCapturing) {
                        this.captureBuffer = [];
                        this.lastCapturedNote = null;
                    }
                }

                this.ui.drawWaveform(dataArray);
                this.animationId = requestAnimationFrame(loop);
            };
            loop();
        } catch (err) {
            console.error("Microphone access denied:", err);
            alert("Please allow microphone access to use the tuner.");
        }
    }

    getMostFrequent(arr) {
        const counts = {};
        let max = 0;
        let mostFreq = null;
        for (const val of arr) {
            counts[val] = (counts[val] || 0) + 1;
            if (counts[val] > max) {
                max = counts[val];
                mostFreq = val;
            }
        }
        return max >= 5 ? mostFreq : null; // Require at least 5 matches in the buffer
    }

    stop() {
        this.isStarted = false;
        if (this.micStream) this.micStream.getTracks().forEach(track => track.stop());
        cancelAnimationFrame(this.animationId);

        this.elements.micStatus.textContent = "Microphone Off";
        this.elements.micStatus.classList.remove('active');
        this.elements.startBtn.disabled = false;
        this.elements.stopBtn.disabled = true;
        this.ui.resetUI();
    }

    getMostFrequent(arr) {
        if (!arr || arr.length === 0) return null;
        const counts = {};
        arr.forEach(x => counts[x] = (counts[x] || 0) + 1);
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    }
}

// Global hooks for inline onclick handlers
window.triggerFretboardNote = (note) => window.AhordianApp.triggerFretboardNote(note);
window.triggerScale = (scale) => window.AhordianApp.triggerScale(scale);
window.playSequence = (notes) => window.AhordianApp.playSequence(notes);
window.loadTranscriptionToTape = (notes) => window.AhordianApp.loadTranscriptionToTape(notes);

// Bootstrap
document.addEventListener("DOMContentLoaded", () => {
    window.AhordianApp = new App();
});
