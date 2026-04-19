import AppConfig from './AppConfig.js';
import MusicEngine from './MusicEngine.js';
import PitchDetector from './PitchDetector.js';
import TrackingManager from './TrackingManager.js';
import UIManager from './UIManager.js';
import FileManager from './FileManager.js';
import AudioPlayer from './AudioPlayer.js';
import FretboardManager from './FretboardManager.js';
import CircleManager from './CircleManager.js';

class App {
    constructor() {
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
            clearOverlayBtn: document.getElementById('clear-overlay-btn'),
            soundToggle: document.getElementById('sound-toggle'),
            sequenceTape: document.getElementById('sequence-tape')
        };

        this.tapeBuffer = [];

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

    triggerFretboardNote(noteInput) {
        this.initAudioContext();
        let targetNote = noteInput.toUpperCase().trim();

        // Check if input is a Sargam syllable (use original case for Bengali)
        const sargamKey = noteInput.trim();
        if (AppConfig.BENGALI_SARGAM_MAP[sargamKey] !== undefined) {
            targetNote = MusicEngine.sargamToNote(sargamKey, this.elements.saRoot.value);
        }

        if (!targetNote) return;

        const pos = this.fretboard.showNote(targetNote);
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

    triggerScale(scaleName) {
        const scale = AppConfig.SCALE_DEFINITIONS.find(s => s.name === scaleName);
        if (!scale) return;

        let rootName = this.elements.saRoot.value;
        const manualNote = this.elements.manualNoteInput.value.trim().toUpperCase();
        
        if (manualNote) {
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
                this.triggerFretboardNote(note);
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

                this.ui.render(freq);

                const noteData = MusicEngine.freqToNote(freq);
                if (noteData && Math.abs(noteData.cents) < 10) {
                    if (this.lastDetectedNote !== noteData.name) {
                        this.lastDetectedNote = noteData.name;
                        this.fretboard.showNote(noteData.name);
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
}

// Global hooks for inline onclick handlers
window.triggerFretboardNote = (note) => window.AhordianApp.triggerFretboardNote(note);
window.triggerScale = (scale) => window.AhordianApp.triggerScale(scale);
window.playSequence = (notes) => window.AhordianApp.playSequence(notes);

// Bootstrap
document.addEventListener("DOMContentLoaded", () => {
    window.AhordianApp = new App();
});
