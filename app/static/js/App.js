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
import StorageManager from './StorageManager.js';
import BackingTrackEngine from './BackingTrackEngine.js';
import VoicingGenerator from './VoicingGenerator.js';
import EarTrainingManager from './EarTrainingManager.js';
import LessonManager from './LessonManager.js';
import TabPlayer from './TabPlayer.js';
import AudioSessionManager, { AudioSessionType } from './audio/AudioSessionManager.js';

import SampleManager from './audio/SampleManager.js';
import DrumSampler from './audio/DrumSampler.js';
import RhythmEngine from './audio/RhythmEngine.js';
import { Icons, icon, hydrateIcons } from './Icons.js';

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
        this.isReplaying = false;
        this.replayAbortFlag = false;
        this._replaySeq = 0;
        this.jamBpm = 120;

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
            sequenceTape: document.getElementById('sequence-tape'),
            
            // Music Theory Panel
            theoryPanel: document.getElementById('music-theory-panel'),
            theoryTitle: document.getElementById('theory-title'),
            theoryFormula: document.getElementById('theory-formula'),
            theoryNotes: document.getElementById('theory-notes'),
            theoryDesc: document.getElementById('theory-desc'),
            
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
            toggleCustomTuningBtn: document.getElementById('toggle-custom-tuning'),
            
            // Settings
            settingHandedness: document.getElementById('setting-handedness'),
            settingTuning: document.getElementById('setting-tuning'),
            saveSettingsBtn: document.getElementById('save-settings-btn'),
            
            // Dashboard
            recentItemsList: document.getElementById('recent-items-list'),
            generateChallengeBtn: document.getElementById('generate-challenge-btn'),
            dailyChallengeText: document.getElementById('daily-challenge-text'),
            
            // Jam Station
            jamPlayBtn: document.getElementById('jam-play-btn'),
            jamStopBtn: document.getElementById('jam-stop-btn'),
            jamProgression: document.getElementById('jam-progression'),
            jamKey: document.getElementById('jam-key'),
            jamSoloMode: document.getElementById('jam-solo-mode'),
            liveChordIndicator: document.getElementById('live-chord-indicator'),
            jamBpmSlider: document.getElementById('jam-bpm'),
            jamBpmLabel: document.getElementById('jam-bpm-label'),
            jamGuitarVol: document.getElementById('jam-guitar-vol'),
            jamDrumsVol: document.getElementById('jam-drums-vol'),
            
            // Global Audio
            globalMuteBtn: document.getElementById('global-mute-btn'),
            masterVol: document.getElementById('master-volume'),
            nowPlayingPill: document.getElementById('now-playing-pill'),
            nowPlayingLabel: document.getElementById('now-playing-label'),
            nowPlayingGoto: document.getElementById('now-playing-goto'),
            
            // Detection History
            replayHistoryBtn: document.getElementById('replay-history-btn'),
            
            muteIconOn: document.getElementById('mute-icon-on'),
            muteIconOff: document.getElementById('mute-icon-off')
        };

        this.tapeBuffer = [];
        this.detectionHistory = []; // max 64 items
        this.isCapturing = false;
        this.captureBuffer = []; // Stability buffer for audio capture
        this.lastCapturedNote = null;

        this.tracker = new TrackingManager(this.elements);
        this.ui = new UIManager(this.elements, this.tracker);
        this.fretboard = new FretboardManager('guitar-fretboard');
        this.chordFretboard = new FretboardManager('chord-exp-fretboard');
        this.scaleFretboard = new FretboardManager('scale-exp-fretboard');
        this.circleManager = new CircleManager('circle-container', this);
        this.player = null;
        this.backingEngine = null;
        this.earTraining = null; // initialized lazily on first visit
        this.lessonManager = null;
        this.tabPlayer = null;

        this.bindEvents();
        this.initIcons();
        this.loadFretboardHistory();
        this.renderSampleButtons();
        this.populateTunings();
        this.applySettings();
        this.updateDashboard();
        FileManager.init(this.elements.dropZone, this.elements.fileInput, this.tracker);
    }

    initIcons() {
        document.querySelectorAll('.nav-btn[data-target]').forEach(btn => {
            const target = btn.dataset.target;
            if (target && Icons[target]) {
                // prepend icon SVG, preserve existing text
                const text = btn.textContent.trim();
                btn.innerHTML = Icons[target] + ' ' + text;
            }
        });
        // Fills every `data-icon` placeholder in the static markup.
        hydrateIcons(document);
    }

    /**
     * Rewrites a button's label while keeping its icon. Buttons that toggle
     * (Play/Stop, Loop ON/OFF) set their label from JS, and a plain
     * `textContent =` would wipe the hydrated SVG.
     */
    setBtnLabel(btn, iconName, text, iconClass = '') {
        if (!btn) return;
        btn.innerHTML = `<span class="btn-ico ${iconClass}">${icon(iconName)}</span>${text}`;
    }

    /** Same idea for a button whose whole label is the glyph. */
    setIconOnly(btn, iconName, size = 16) {
        if (!btn) return;
        btn.innerHTML = `<span class="btn-ico-only">${icon(iconName, { size })}</span>`;
    }

    /**
     * One aggregate audio-loading line, e.g. "AUDIO  ✓ Guitar 6/6  ⚠ Drums 3/5".
     * Guitar and drums load independently against one SampleManager, so the
     * breakdown is rendered from its per-pack progress instead of letting
     * whichever loader finished last own the whole message.
     * An incomplete pack stays on screen — the synth fallback must not hide
     * missing production assets.
     */
    renderSampleStatus(status, packs = []) {
        const indicator = document.getElementById('sample-status-indicator');
        if (!indicator) return;

        const label = indicator.querySelector('.sample-status-text');
        const spinner = indicator.querySelector('.sample-status-ico');
        if (!label || !spinner) return;

        const breakdown = packs.map(p => {
            const ok = p.loaded === p.total;
            return `<span class="sample-pack${ok ? '' : ' incomplete'}" title="${p.label}: ${p.loaded} of ${p.total} samples loaded">`
                + `<span class="sample-pack-ico">${icon(ok ? 'check' : 'alert', { size: 12 })}</span>`
                + `${p.label} ${p.loaded}/${p.total}</span>`;
        }).join('');

        indicator.classList.remove('state-ok', 'state-warn', 'state-error');

        if (status === 'idle') {
            indicator.classList.add('is-hidden');
            return;
        }

        indicator.classList.remove('is-hidden');
        const loading = status === 'loading';
        spinner.classList.toggle('spinning', loading);
        spinner.innerHTML = icon(loading ? 'loading' : (status === 'ready' ? 'check' : 'alert'), { size: 14 });

        if (loading) {
            label.innerHTML = breakdown || 'Loading...';
        } else if (status === 'ready') {
            indicator.classList.add('state-ok');
            label.innerHTML = breakdown || 'Ready';
        } else if (status === 'partial') {
            indicator.classList.add('state-warn');
            label.innerHTML = breakdown || 'Partially loaded';
        } else {
            indicator.classList.add('state-error');
            label.innerHTML = `${breakdown}<span class="sample-pack incomplete">Using synth fallback</span>`;
        }
    }

    /**
     * Switches the visible screen and syncs nav highlighting.
     * Deliberately does NOT touch audio — callers that need audio torn down do it
     * themselves. This lets replay navigate to the fretboard without stopping
     * the very audio it is about to use.
     */
    showScreen(target) {
        this.elements.screens.forEach(s => s.classList.remove('active'));
        const targetScreen = document.getElementById(target);
        if (targetScreen) targetScreen.classList.add('active');

        this.elements.navBtns.forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-target') === target);
        });
    }

    /**
     * Navigates to a screen and runs its per-screen setup.
     *
     * `stopAudio` is the only difference between a nav-bar click and the Now Playing
     * pill's jump-to-source button: the nav bar tears audio down, but jumping to
     * what is currently playing must not silence the thing you asked to see.
     *
     * Teardown is a single stopAll() — it fans out to the registered stop handlers,
     * so App does not need to know every audio producer. Any new audio feature must
     * register a handler in initAudioContext() or navigation will not stop it.
     */
    enterScreen(target, { stopAudio = true } = {}) {
        if (!target) return;
        this.showScreen(target);

        if (stopAudio && this.sessionManager) this.sessionManager.stopAll();

        if (target === 'home-screen') this.updateDashboard();

        // Lazy-init Ear Training on first visit
        if (target === 'ear-training-screen' && !this.earTraining) {
            this.initAudioContext();
            this.earTraining = new EarTrainingManager(this);
        }

        // Lazy-init Lessons on first visit
        if (target === 'lessons-screen' && !this.lessonManager) {
            this.initAudioContext();
            this.lessonManager = new LessonManager(this);
        }

        // Lazy-init Tab Player on first visit
        if (target === 'tab-player-screen' && !this.tabPlayer) {
            this.initAudioContext();
            this.tabPlayer = new TabPlayer(this);
        }

        // Refresh high scores when visiting Practice screen
        if (target === 'practice-screen') this.loadHighScores();
    }

    bindEvents() {
        this.elements.startBtn.addEventListener('click', this.start.bind(this));
        this.elements.stopBtn.addEventListener('click', this.stop.bind(this));
        this.elements.saveBtn.addEventListener('click', () => this.tracker.exportLog());

        if (this.elements.globalMuteBtn) {
            this.elements.globalMuteBtn.addEventListener('click', () => {
                if (!this.sessionManager) this.initAudioContext();
                const isMuted = this.sessionManager.toggleMute();
                this.elements.globalMuteBtn.classList.toggle('muted', isMuted);
                if (this.elements.muteIconOn) this.elements.muteIconOn.style.display = isMuted ? 'none' : 'block';
                if (this.elements.muteIconOff) this.elements.muteIconOff.style.display = isMuted ? 'block' : 'none';
            });
        }
        
        if (this.elements.masterVol) {
            this.elements.masterVol.addEventListener('input', (e) => {
                if (!this.sessionManager) this.initAudioContext();
                this.sessionManager.setMasterVolume(parseFloat(e.target.value));
            });
        }
        
        if (this.elements.replayHistoryBtn) {
            this.elements.replayHistoryBtn.addEventListener('click', () => this.replayDetection());
        }

        // Same toggle, reachable from the fretboard screen the replay navigates to.
        this.elements.fbStopReplayBtn = document.getElementById('fb-stop-replay-btn');
        if (this.elements.fbStopReplayBtn) {
            this.elements.fbStopReplayBtn.addEventListener('click', () => this.abortReplay());
        }
        
        if (this.elements.nowPlayingGoto) {
            this.elements.nowPlayingGoto.addEventListener('click', () => {
                // Deliberately not a nav-button click: that would stopAll() and
                // silence the very session the pill is pointing at.
                this.enterScreen(this.elements.nowPlayingGoto.dataset.targetScreen,
                                 { stopAudio: false });
            });
        }

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
                this.enterScreen(btn.getAttribute('data-target'));
            });
        });

        // Practice Generator
        const pracBpm = document.getElementById('prac-bpm');
        const pracBpmLabel = document.getElementById('prac-bpm-label');
        if (pracBpm && pracBpmLabel) {
            pracBpm.addEventListener('input', () => {
                pracBpmLabel.textContent = pracBpm.value + ' BPM';
            });
        }

        const pracGenBtn = document.getElementById('prac-generate-btn');
        if (pracGenBtn) pracGenBtn.addEventListener('click', () => this.generatePracticeRoutine());

        // Tap Tempo
        const tapBtn = document.getElementById('prac-tap-btn');
        if (tapBtn) {
            this._tapTimes = [];
            tapBtn.addEventListener('click', () => {
                const now = Date.now();
                this._tapTimes.push(now);
                if (this._tapTimes.length > 8) this._tapTimes.shift();
                if (this._tapTimes.length >= 2) {
                    const intervals = [];
                    for (let i = 1; i < this._tapTimes.length; i++) {
                        intervals.push(this._tapTimes[i] - this._tapTimes[i - 1]);
                    }
                    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                    const bpm = Math.round(60000 / avgInterval);
                    if (pracBpm) pracBpm.value = Math.min(200, Math.max(40, bpm));
                    if (pracBpmLabel) pracBpmLabel.textContent = Math.min(200, Math.max(40, bpm)) + ' BPM';
                    this.setBtnLabel(tapBtn, 'tap', `${Math.min(200, Math.max(40, bpm))} BPM`);
                    clearTimeout(this._tapTimeout);
                    this._tapTimeout = setTimeout(() => {
                        this.setBtnLabel(tapBtn, 'tap', 'Tap Tempo');
                        this._tapTimes = [];
                    }, 3000);
                }
            });
        }

        if (this.elements.saveSettingsBtn) {
            this.elements.saveSettingsBtn.addEventListener('click', () => {
                StorageManager.saveSettings({
                    handedness: this.elements.settingHandedness.value,
                    defaultTuning: this.elements.settingTuning.value
                });
                this.applySettings();
                
                // Show brief confirmation
                const originalText = this.elements.saveSettingsBtn.textContent;
                this.elements.saveSettingsBtn.textContent = 'Saved!';
                setTimeout(() => this.elements.saveSettingsBtn.textContent = originalText, 1500);
            });
        }
        
        if (this.elements.generateChallengeBtn) {
            this.elements.generateChallengeBtn.addEventListener('click', () => this.generateChallenge());
        }

        // Capo Calculator
        const capoCalcBtn = document.getElementById('capo-calc-btn');
        if (capoCalcBtn) {
            capoCalcBtn.addEventListener('click', () => {
                const orig = document.getElementById('capo-original').value;
                const fret = parseInt(document.getElementById('capo-fret').value);
                const result = MusicEngine.getCapoChord(orig, fret);
                document.getElementById('capo-result').textContent = result;
            });
        }

        // Jam Station Controls
        if (this.elements.jamPlayBtn) {
            this.elements.jamPlayBtn.addEventListener('click', () => {
                this.initAudioContext();
                if (!this.backingEngine) {
                    this.backingEngine = new BackingTrackEngine(this.player, this.rhythmEngine, this.fretboard, this.onJamChordChange.bind(this));
                }
                // Ensure player is linked if created late
                this.backingEngine.player = this.player;
                
                const progId = this.elements.jamProgression.value;
                const key = this.elements.jamKey.value;
                
                this.backingEngine.setBpm(this.jamBpm);
                this.backingEngine.setProgression(progId, key);
                this.backingEngine.start();
                
                this.elements.jamPlayBtn.disabled = true;
                this.elements.jamStopBtn.disabled = false;
                this.elements.liveChordIndicator.style.display = 'block';
            });
        }
        
        if (this.elements.jamStopBtn) {
            this.elements.jamStopBtn.addEventListener('click', () => this.stopJam());
        }
        
        if (this.elements.jamBpmSlider) {
            this.elements.jamBpmSlider.addEventListener('input', (e) => {
                const bpm = parseInt(e.target.value);
                this.jamBpm = bpm;
                if (this.elements.jamBpmLabel) this.elements.jamBpmLabel.textContent = bpm + ' BPM';
                if (this.backingEngine) this.backingEngine.setBpm(bpm);
            });
        }
        
        if (this.elements.jamGuitarVol) {
            this.elements.jamGuitarVol.addEventListener('input', (e) => {
                if (this.sessionManager) this.sessionManager.setInstrumentVolume('guitar', parseFloat(e.target.value));
            });
        }
        
        if (this.elements.jamDrumsVol) {
            this.elements.jamDrumsVol.addEventListener('input', (e) => {
                if (this.sessionManager) this.sessionManager.setInstrumentVolume('drums', parseFloat(e.target.value));
            });
        }
        
        // Explorer Handlers
        const chordBtn = document.getElementById('chord-exp-search-btn');
        if (chordBtn) chordBtn.addEventListener('click', () => this.exploreChord());
        
        const scaleBtn = document.getElementById('scale-exp-view-btn');
        if (scaleBtn) scaleBtn.addEventListener('click', () => this.exploreScale());

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
            // First click on a fresh page had no AudioContext yet, so
            // metronome.start() read currentTime off null.
            this.initAudioContext();
            if (this.metronome.isPlaying) {
                this.metronome.stop();
                this.setIconOnly(this.elements.metroToggle, 'play', 14);
            } else {
                this.metronome.start();
                this.setIconOnly(this.elements.metroToggle, 'pause', 14);
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
            this.setBtnLabel(
                this.elements.liveCaptureBtn,
                'record',
                this.isCapturing ? 'Record to Tape: ON' : 'Record to Tape: OFF',
                this.isCapturing ? 'rec-on' : ''
            );
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
        if(this.elements.toggleCustomTuningBtn) {
            this.elements.toggleCustomTuningBtn.addEventListener('click', () => {
                // The hidden default lives in .custom-tuning-input, not inline,
                // so read the resolved value rather than the style attribute.
                const isHidden = getComputedStyle(this.elements.customTuningInput).display === 'none';
                this.elements.customTuningInput.style.display = isHidden ? 'block' : 'none';
                this.elements.tuningSelect.style.display = isHidden ? 'none' : 'block';
                this.setIconOnly(this.elements.toggleCustomTuningBtn, isHidden ? 'close' : 'edit');
            });
        }

        if(this.elements.customTuningInput) {
            this.elements.customTuningInput.addEventListener('change', (e) => {
                const val = e.target.value.trim().toUpperCase();
                if (val) {
                    const notes = val.split('-').map(n => n.trim());
                    if (notes.length === 6) {
                        this.fretboard.setTuning(notes);
                        if(this.chordFretboard) this.chordFretboard.setTuning(notes);
                        if(this.scaleFretboard) this.scaleFretboard.setTuning(notes);
                        this.elements.positionInfo.textContent = `Custom Tuning Set: ${notes.join('-')}`;
                    }
                }
            });
        }

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

    applySettings() {
        const settings = StorageManager.loadSettings();
        
        // Sync Settings UI
        if (this.elements.settingHandedness) this.elements.settingHandedness.value = settings.handedness;
        // A stored value that matches no <option> leaves the select blank, so fall
        // back to the first tuning. Guards settings saved before the default was
        // aligned with AppConfig.ALTERNATE_TUNINGS names.
        const tuningSel = this.elements.settingTuning;
        if (tuningSel) {
            tuningSel.value = settings.defaultTuning;
            if (!tuningSel.value && tuningSel.options.length) tuningSel.selectedIndex = 0;
        }
        
        // Pass handedness to fretboard if method exists
        if (this.fretboard && typeof this.fretboard.setHandedness === 'function') {
            this.fretboard.setHandedness(settings.handedness);
            if(this.chordFretboard) this.chordFretboard.setHandedness(settings.handedness);
            if(this.scaleFretboard) this.scaleFretboard.setHandedness(settings.handedness);
        }
    }

    updateDashboard() {
        if (!this.elements.recentItemsList) return;
        const recent = StorageManager.getRecentItems();
        if (recent.length === 0) {
            this.elements.recentItemsList.innerHTML = '<li class="empty-state">No recent items found.</li>';
        } else {
            this.elements.recentItemsList.innerHTML = recent.map(item => `
                <li class="recent-item">
                    <span class="recent-item-type">${item.type}</span>: ${item.name}
                </li>
            `).join('');
        }
        
        if (this.elements.dailyChallengeText && this.elements.dailyChallengeText.textContent === 'Loading...') {
            this.generateChallenge();
        }
    }
    
    generateChallenge() {
        if (!this.elements.dailyChallengeText) return;
        const keys = ['C', 'G', 'D', 'A', 'E'];
        const scales = ['Major Pentatonic', 'Minor Pentatonic', 'Blues'];
        const modes = ['Alternate Picking', 'Legato', 'Swing Feel'];
        
        const key = keys[Math.floor(Math.random() * keys.length)];
        const scale = scales[Math.floor(Math.random() * scales.length)];
        const mode = modes[Math.floor(Math.random() * modes.length)];
        const bpm = Math.floor(Math.random() * 40) + 80;
        
        this.elements.dailyChallengeText.innerHTML = `Play the <strong>${key} ${scale}</strong> using <strong>${mode}</strong> at ${bpm} BPM.`;
    }

    generatePracticeRoutine() {
        const focus = document.getElementById('prac-focus')?.value || 'random';
        const bpm = document.getElementById('prac-bpm')?.value || 80;
        const duration = parseInt(document.getElementById('prac-duration')?.value || 10);
        const output = document.getElementById('prac-routine-output');
        if (!output) return;

        const keys = ['C', 'G', 'D', 'A', 'E', 'F', 'Bb'];
        const pentatonics = ['C Major Pentatonic', 'A Minor Pentatonic', 'G Major Pentatonic', 'E Minor Pentatonic'];
        const techniques = ['Alternate Picking', 'Economy Picking', 'Legato (Hammer-ons & Pull-offs)', 'String Skipping', 'Hybrid Picking'];
        const strumPatterns = ['Down-Down-Up-Down-Up', 'Down-Up-Down-Up', 'D-DU-UDU', 'Syncopated Reggae'];
        
        let resolvedFocus = focus;
        if (focus === 'random') {
            const options = ['technique', 'scales', 'chords', 'rhythm', 'theory'];
            resolvedFocus = options[Math.floor(Math.random() * options.length)];
        }

        const perSegment = Math.max(2, Math.floor(duration / 4));
        let routine = [];

        if (resolvedFocus === 'technique') {
            const tech = techniques[Math.floor(Math.random() * techniques.length)];
            const key = keys[Math.floor(Math.random() * keys.length)];
            routine = [
                { title: 'Warm Up', desc: `Chromatic exercise across all strings. Start at 60 BPM.`, duration: perSegment, icon: 'flame' },
                { title: 'Technique Focus', desc: `${tech} — Play ${key} Major scale pattern up and down at ${bpm} BPM.`, duration: perSegment * 2, icon: 'target' },
                { title: 'Apply to Song', desc: `Pick a riff or lick you know. Apply ${tech} throughout.`, duration: perSegment, icon: 'guitar' },
                { title: 'Cool Down', desc: 'Slow, relaxed scale run. Focus on clean tone.', duration: Math.max(1, duration - perSegment * 4), icon: 'sparkle' }
            ];
        } else if (resolvedFocus === 'scales') {
            const scale = pentatonics[Math.floor(Math.random() * pentatonics.length)];
            routine = [
                { title: 'Position 1', desc: `Play ${scale} in Position 1 (open position). Ascending & descending. BPM: ${bpm}`, duration: perSegment, icon: 'pin' },
                { title: 'Position 2 & 3', desc: `Shift to positions 2 and 3. Connect shapes smoothly.`, duration: perSegment, icon: 'pin' },
                { title: 'Full Fretboard Run', desc: `Play all 5 CAGED positions of ${scale} from low E to high e.`, duration: perSegment, icon: 'run' },
                { title: 'Improvise!', desc: `Use ${scale} over a backing track. Try targeting chord tones.`, duration: duration - perSegment * 3, icon: 'note' }
            ];
        } else if (resolvedFocus === 'chords') {
            const key = keys[Math.floor(Math.random() * keys.length)];
            routine = [
                { title: 'Open Chord Review', desc: `Drill G → C → D → Em transitions. Clean fret contact. ${bpm} BPM`, duration: perSegment, icon: 'piano' },
                { title: 'Barre Chord Focus', desc: `Practice F Major, Bm. Slow strumming, focus on full ring.`, duration: perSegment, icon: 'dumbbell' },
                { title: 'Diatonic Triads in ${key}', desc: `Play all 7 diatonic chords in key of ${key}. Use 3-note voicings.`, duration: perSegment, icon: 'sheet' },
                { title: 'Rhythm Variation', desc: `Apply chord changes to a simple I → IV → V → I progression in ${key}.`, duration: duration - perSegment * 3, icon: 'drum' }
            ];
        } else if (resolvedFocus === 'rhythm') {
            const pattern = strumPatterns[Math.floor(Math.random() * strumPatterns.length)];
            routine = [
                { title: 'Tap Tempo Drill', desc: `Use the Tap Tempo button to set ${bpm} BPM. Feel the pulse. Count aloud: 1-2-3-4.`, duration: perSegment, icon: 'drum' },
                { title: 'Pattern Isolation', desc: `Practice strumming pattern: "${pattern}" on an open chord. Slow first.`, duration: perSegment * 2, icon: 'note' },
                { title: 'Chord + Rhythm', desc: `Apply pattern to a G → C → D progression. Keep the groove tight.`, duration: duration - perSegment * 3, icon: 'flame' }
            ];
        } else {
            // theory
            routine = [
                { title: 'Interval Ear Training', desc: `Open the Ear Training module. Do 10 interval recognition questions.`, duration: perSegment, icon: 'ear' },
                { title: 'Circle of Fifths', desc: `Visit the Circle of Fifths. Select 3 keys, identify their relative minors and diatonic chords.`, duration: perSegment, icon: 'wheel' },
                { title: 'Chord Construction', desc: `In the Chord Explorer, build and play a Major 7, Minor 7, and Dominant 7 chord.`, duration: perSegment, icon: 'layers' },
                { title: 'Apply & Improvise', desc: `Find a key using the Circle. Play the diatonic chords, then solo with the matching pentatonic.`, duration: duration - perSegment * 3, icon: 'target' }
            ];
        }

        // --i only carries the stagger index; the animation itself lives in CSS.
        output.innerHTML = routine.map((item, i) => `
            <div class="theory-panel routine-item" style="--i:${i}">
                <div class="theory-header">
                    <span class="routine-title">
                        <span class="btn-ico">${icon(item.icon)}</span>${i + 1}. ${item.title}
                    </span>
                    <span class="routine-duration">${item.duration} min</span>
                </div>
                <div class="routine-desc">${item.desc}</div>
            </div>
        `).join('');
    }

    loadHighScores() {
        const keys = ['intervals', 'chords', 'notes'];
        keys.forEach(k => {
            const el = document.getElementById(`hs-${k}`);
            if (el) el.textContent = localStorage.getItem(`ear_training_${k}`) || '0';
        });
        const streakEl = document.getElementById('hs-streak');
        if (streakEl) streakEl.textContent = localStorage.getItem('ear_best_streak') || '0';
    }

    /**
     * Stops the jam track AND resets its UI. This has to be a method rather than
     * inline in the stop-button handler: the exclusivity sweep also stops the
     * engine, and without this the Play button stayed disabled and the live chord
     * indicator stayed visible after another feature took over the audio session.
     * Safe to call when nothing is playing.
     */
    stopJam() {
        if (this.backingEngine) this.backingEngine.stop();
        if (this.elements.jamPlayBtn) this.elements.jamPlayBtn.disabled = false;
        if (this.elements.jamStopBtn) this.elements.jamStopBtn.disabled = true;
        if (this.elements.liveChordIndicator) {
            this.elements.liveChordIndicator.style.display = 'none';
            this.elements.liveChordIndicator.textContent = '--';
        }
        if (this.fretboard) this.fretboard.clearOverlay();
    }

    onJamChordChange(chordData, numeral) {
        if (this.elements.liveChordIndicator) {
            this.elements.liveChordIndicator.textContent = `${chordData.name} (${numeral})`;
        }
        
        const soloMode = this.elements.jamSoloMode.value;
        if (soloMode === 'none') {
            this.fretboard.clearOverlay();
            return;
        }
        
        const scaleNotes = MusicEngine.getScaleForChord(chordData.root, chordData.type, soloMode);
        
        if (scaleNotes && scaleNotes.length > 0) {
            // Show scale bounded to frets 0-5 to start, can be dynamic later
            this.fretboard.showScale(scaleNotes, {min: 0, max: 12});
        } else {
            this.fretboard.clearOverlay();
        }
    }

    exploreChord() {
        const root = document.getElementById('chord-exp-root').value;
        const type = document.getElementById('chord-exp-type').value;
        
        document.getElementById('chord-exp-title').textContent = `${root} ${type}`;
        
        let intervals = [];
        let formula = "";
        
        switch (type) {
            case 'major': intervals = [0, 4, 7]; formula = "1 - 3 - 5"; break;
            case 'minor': intervals = [0, 3, 7]; formula = "1 - b3 - 5"; break;
            case '7': intervals = [0, 4, 7, 10]; formula = "1 - 3 - 5 - b7"; break;
            case 'maj7': intervals = [0, 4, 7, 11]; formula = "1 - 3 - 5 - 7"; break;
            case 'm7': intervals = [0, 3, 7, 10]; formula = "1 - b3 - 5 - b7"; break;
            case 'sus2': intervals = [0, 2, 7]; formula = "1 - 2 - 5"; break;
            case 'sus4': intervals = [0, 5, 7]; formula = "1 - 4 - 5"; break;
            case 'dim': intervals = [0, 3, 6]; formula = "1 - b3 - b5"; break;
            case 'aug': intervals = [0, 4, 8]; formula = "1 - 3 - #5"; break;
        }

        const rootIdx = AppConfig.NOTE_NAMES.indexOf(root);
        const notes = intervals.map(interval => {
            const noteIdx = (rootIdx + interval) % 12;
            return AppConfig.NOTE_NAMES[noteIdx];
        });
        
        document.getElementById('chord-exp-formula').textContent = formula;
        document.getElementById('chord-exp-notes').textContent = notes.join(" - ");
        
        if(this.chordFretboard) {
            this.chordFretboard.showScale(notes, {min: 0, max: 15});
            
            // Generate Voicings
            const voicingsContainer = document.getElementById('chord-exp-voicings');
            voicingsContainer.innerHTML = '';
            
            const voicings = VoicingGenerator.generateVoicings(this.chordFretboard.strings, notes, root);
            
            if (voicings && voicings.length > 0) {
                // Store the current voicing for playback
                let currentVoicing = null;
                
                voicings.forEach((v, idx) => {
                    const btn = document.createElement('button');
                    btn.className = 'secondary-btn small-btn';
                    btn.textContent = v.name;
                    btn.onclick = () => {
                        this.chordFretboard.showVoicing(v.positions);
                        currentVoicing = v.positions;
                        
                        // Highlight active button
                        Array.from(voicingsContainer.children).forEach(c => c.classList.remove('primary-btn'));
                        Array.from(voicingsContainer.children).forEach(c => c.classList.add('secondary-btn'));
                        btn.classList.remove('secondary-btn');
                        btn.classList.add('primary-btn');
                        
                        document.getElementById('chord-exp-play-btn').disabled = false;
                    };
                    voicingsContainer.appendChild(btn);
                    
                    // Show first voicing by default
                    if (idx === 0) btn.click();
                });
                
                const playBtn = document.getElementById('chord-exp-play-btn');
                playBtn.onclick = () => {
                    if(currentVoicing) {
                        const chordNotes = currentVoicing.map(p => this.chordFretboard.getNoteAt(p.s, p.f));
                        this.playSequence([chordNotes.join('-')], 800);
                    }
                };
                
            } else {
                voicingsContainer.innerHTML = '<span class="empty-state">No common voicings found in this tuning.</span>';
                document.getElementById('chord-exp-play-btn').disabled = true;
            }
        }
    }

    exploreScale() {
        const root = document.getElementById('scale-exp-root').value;
        const type = document.getElementById('scale-exp-type').value;
        
        document.getElementById('scale-exp-title').textContent = `${root} ${type}`;
        
        let intervals = [];
        let formula = "";
        let desc = "";
        
        if (type.includes("Major Pentatonic")) {
            intervals = [0, 2, 4, 7, 9]; formula = "1 - 2 - 3 - 5 - 6"; desc = "5-note scale. Extremely versatile for soloing in rock and pop.";
        } else if (type.includes("Minor Pentatonic")) {
            intervals = [0, 3, 5, 7, 10]; formula = "1 - b3 - 4 - 5 - b7"; desc = "The classic rock soloing scale.";
        } else if (type.includes("Blues")) {
            intervals = [0, 3, 5, 6, 7, 10]; formula = "1 - b3 - 4 - b5 - 5 - b7"; desc = "Features the 'blue note' (flat 5) for tension and soulful expression.";
        } else if (type.includes("Minor")) {
            intervals = [0, 2, 3, 5, 7, 8, 10]; formula = "1 - 2 - b3 - 4 - 5 - b6 - b7"; desc = "Natural minor scale. Sad, melancholic, serious tone.";
        } else {
            // Default Major
            intervals = [0, 2, 4, 5, 7, 9, 11]; formula = "1 - 2 - 3 - 4 - 5 - 6 - 7"; desc = "Bright, happy, resolving tone. The foundation of Western harmony.";
        }

        const rootIdx = AppConfig.NOTE_NAMES.indexOf(root);
        const notes = intervals.map(interval => {
            const noteIdx = (rootIdx + interval) % 12;
            return AppConfig.NOTE_NAMES[noteIdx];
        });
        
        document.getElementById('scale-exp-formula').textContent = formula;
        document.getElementById('scale-exp-notes').textContent = notes.join(" - ");
        document.getElementById('scale-exp-desc').textContent = desc;
        
        if(this.scaleFretboard) {
            // First, map the scale purely as labels on the fretboard
            this.scaleFretboard.showScale(notes, {min: 0, max: 15});
            
            // Collect the full 2-octave sequence for playback
            const rootIdxBase = AppConfig.NOTE_NAMES.indexOf(root);
            const baseOctave = 3;
            
            const playbackSequence = [];
            intervals.forEach(interval => {
                const totalSteps = rootIdxBase + interval;
                const noteIdx = totalSteps % 12;
                const octaveShift = Math.floor(totalSteps / 12);
                playbackSequence.push(AppConfig.NOTE_NAMES[noteIdx] + (baseOctave + octaveShift));
            });
            // Add high octave root
            const highRootSteps = rootIdxBase + 12;
            playbackSequence.push(AppConfig.NOTE_NAMES[highRootSteps % 12] + (baseOctave + Math.floor(highRootSteps / 12)));
            
            const descending = [...playbackSequence].reverse().slice(1);
            const fullScale = [...playbackSequence, ...descending];
            
            const playBtn = document.getElementById('scale-exp-play-btn');
            playBtn.disabled = false;
            playBtn.onclick = () => {
                this.playSequence(fullScale, 300);
            };
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

    /** Cancels an in-flight replay. Safe to call when none is running. */
    abortReplay() {
        if (!this.isReplaying) return;
        this.replayAbortFlag = true;
        // Cut the current inter-note wait short so the stop is felt immediately
        // instead of at the next note boundary (up to MAX_GAP away).
        if (this._replayWake) this._replayWake();
    }

    _resetReplayButton() {
        const btn = this.elements.replayHistoryBtn;
        if (!btn) return;
        const n = this.detectionHistory ? this.detectionHistory.length : 0;
        btn.disabled = n === 0;
        this.setBtnLabel(btn, 'play', n > 0 ? `Replay (${n})` : 'Replay (64 max)');
        if (this.elements.fbStopReplayBtn) this.elements.fbStopReplayBtn.style.display = 'none';
    }

    /**
     * Replays the detected note history, preserving the rhythm it was played in.
     * Acts as a toggle: invoking it during a replay stops that replay.
     */
    async replayDetection() {
        // Second click = stop.
        if (this.isReplaying) {
            this.abortReplay();
            return;
        }
        if (!this.detectionHistory || this.detectionHistory.length === 0) return;

        this.initAudioContext();

        const DEFAULT_GAP = 500;  // fallback when timing is unavailable
        const MIN_GAP = 80;       // keeps fast runs audible as distinct notes
        const MAX_GAP = 1200;     // stops a long pause replaying verbatim

        // History entries are {note, t}, but may be bare strings if they were
        // recorded before timing was tracked. Normalise both shapes.
        const entries = this.detectionHistory.map(e =>
            typeof e === 'string' ? { note: e, t: null } : e
        );

        const replayId = ++this._replaySeq;
        this.isReplaying = true;
        this.replayAbortFlag = false;

        const btn = this.elements.replayHistoryBtn;
        if (btn) {
            btn.disabled = false; // stays clickable so it can cancel
            this.setBtnLabel(btn, 'stop', 'Stop');
        }
        // Explicit value: the hidden default now comes from .is-hidden in CSS,
        // so clearing the inline style would leave it hidden.
        if (this.elements.fbStopReplayBtn) this.elements.fbStopReplayBtn.style.display = 'inline-block';

        // Navigate without the nav handler's audio teardown.
        this.showScreen('fretboard-screen');

        if (this.sessionManager) {
            this.sessionManager.startSession(AudioSessionType.REPLAY, { exclusive: true });
        }

        try {
            for (let i = 0; i < entries.length; i++) {
                if (this.replayAbortFlag || this._replaySeq !== replayId) return;

                const { note, t } = entries[i];

                // Gap to the NEXT note: the interval the user actually played.
                const next = entries[i + 1];
                let gap = DEFAULT_GAP;
                if (t != null && next && next.t != null) {
                    gap = Math.min(MAX_GAP, Math.max(MIN_GAP, next.t - t));
                }

                if (this.fretboard) this.fretboard.showNote(note);
                this.triggerFretboardNote(note, gap);

                await new Promise(resolve => {
                    const timer = setTimeout(finish, gap);
                    function finish() {
                        clearTimeout(timer);
                        resolve();
                    }
                    this._replayWake = finish;
                });
                // Never clear a newer replay's waker if this one has been superseded.
                if (this._replaySeq === replayId) this._replayWake = null;
            }
        } finally {
            // Only the newest replay owns teardown; a superseded one must not
            // clear the fretboard or relabel the button out from under it.
            if (this._replaySeq === replayId) {
                this.isReplaying = false;
                this.replayAbortFlag = false;
                this._replayWake = null;
                if (this.fretboard) this.fretboard.clearOverlay();
                this._resetReplayButton();
                if (this.sessionManager) {
                    this.sessionManager.stopSession(AudioSessionType.REPLAY);
                }
            }
        }
    }

    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.sessionManager = new AudioSessionManager(this.audioContext);
            this.sampleManager = new SampleManager(this.audioContext);
            
            this.player = new AudioPlayer(this.sessionManager, this.sampleManager);
            this.player.onStateChange = (isPlaying) => {
                // We no longer toggle visual on soundToggle since it was removed
            };
            
            this.drumSampler = new DrumSampler(this.audioContext, this.sampleManager, this.sessionManager.getInstrumentDestination('drums'));
            this.rhythmEngine = new RhythmEngine(this.drumSampler);
            
            // If BackingTrackEngine was already created before audioContext, update it
            if (this.backingEngine) {
                this.backingEngine.rhythmEngine = this.rhythmEngine;
            }
            
            // Let exclusivity actually silence engines, not just clear session state.
            // Late-bound closures: tabPlayer / earTraining are lazy-initialised on
            // first visit to their screens, so method references would capture undefined.
            this.sessionManager.registerStopHandler(AudioSessionType.METRONOME, () => {
                if (this.metronome) this.metronome.stop();
            });
            this.sessionManager.registerStopHandler(AudioSessionType.JAM_TRACK, () => {
                // stopJam(), not backingEngine.stop(), so the Jam UI resets too.
                this.stopJam();
            });
            this.sessionManager.registerStopHandler(AudioSessionType.TAB_PLAYER, () => {
                if (this.tabPlayer && typeof this.tabPlayer.stop === 'function') this.tabPlayer.stop();
            });
            this.sessionManager.registerStopHandler(AudioSessionType.EAR_TRAINING, () => {
                if (this.earTraining && typeof this.earTraining.stop === 'function') this.earTraining.stop();
            });
            this.sessionManager.registerStopHandler(AudioSessionType.REPLAY, () => {
                this.abortReplay();
            });
            // Scale/pattern demos run for several seconds, so they must be stoppable by
            // navigation and by stopAll(). Single fretboard-note previews stay
            // session-free on purpose — see triggerFretboardNote().
            this.sessionManager.registerStopHandler(AudioSessionType.NOTE_PREVIEW, () => {
                this.sequenceAbortFlag = true;
            });

            this.sessionManager.onStateChangeCallback = (state) => {
                if (state.active) {
                    if (this.elements.nowPlayingPill) this.elements.nowPlayingPill.style.display = 'flex';
                    if (this.elements.nowPlayingLabel) this.elements.nowPlayingLabel.textContent = state.label;
                    if (this.elements.nowPlayingGoto) this.elements.nowPlayingGoto.dataset.targetScreen = state.screen;
                } else {
                    if (this.elements.nowPlayingPill) this.elements.nowPlayingPill.style.display = 'none';
                }
            };
            
            this.sampleManager.onStatusChange = (status, packs = []) => this.renderSampleStatus(status, packs);
            
            // Kick off sample loading
            this.player.loadSamples();
            this.rhythmEngine.loadSamples();
            
            // Initialize metronome audio here since we now have the session manager
            this.metronome.initAudio(this.sessionManager);
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
            <div class="note-tag clickable" onclick="window.AhordianApp.triggerFretboardNote('${h.note}')">
                <span class="name">${h.note}</span>
                <span class="pos">${h.pos}</span>
            </div>
        `).join('') || '<div class="empty-note">No history yet</div>';
    }

    /**
     * Renders the scale/pattern demo buttons. Named renderSampleButtons, not
     * loadSamples, so it is not confused with audio sample loading — that lives in
     * initAudioContext() and cannot run before the AudioContext exists.
     */
    renderSampleButtons() {
        this.elements.scaleButtons.innerHTML = AppConfig.SCALE_DEFINITIONS.map(scale => `
            <button class="secondary-btn small-btn sample-btn" onclick="window.AhordianApp.triggerScale('${scale.name}')">${scale.name}</button>
        `).join('');

        this.elements.patternButtons.innerHTML = AppConfig.SAMPLE_SEQUENCES.map(pattern => `
            <button class="secondary-btn small-btn sample-btn" onclick="window.AhordianApp.playSequence(${JSON.stringify(pattern.notes).replace(/"/g, '&quot;')})">${pattern.name}</button>
        `).join('');
    }

    populateTunings() {
        const options = AppConfig.ALTERNATE_TUNINGS.map(t => `
            <option value="${t.name}">${t.name}</option>
        `).join('');
        if (this.elements.tuningSelect) this.elements.tuningSelect.innerHTML = options;
        if (this.elements.settingTuning) this.elements.settingTuning.innerHTML = options;
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
            this.elements.positionInfo.textContent = `${scaleName}: ${fullDisplayNotes.join('-')}`;
        }
        
        // Update Music Theory Panel
        if (this.elements.theoryPanel) {
            this.elements.theoryPanel.style.display = 'block';
            this.elements.theoryTitle.textContent = `${rootName} ${scaleName}`;
            
            // Generate Interval Formula Display
            let formulaStr = "";
            if (scale.intervals) {
                // Determine diatonic function
                formulaStr = scale.intervals.map(i => {
                    const steps = i;
                    if(steps===0) return "1";
                    if(steps===1) return "♭2";
                    if(steps===2) return "2";
                    if(steps===3) return "♭3";
                    if(steps===4) return "3";
                    if(steps===5) return "4";
                    if(steps===6) return "♭5";
                    if(steps===7) return "5";
                    if(steps===8) return "♭6";
                    if(steps===9) return "6";
                    if(steps===10) return "♭7";
                    if(steps===11) return "7";
                    return steps;
                }).join(" - ");
            } else if (scale.arohan) {
                formulaStr = "Arohan: " + scale.arohan.join(" ") + " | Aborohan: " + scale.aborohan.join(" ");
            }
            
            this.elements.theoryFormula.textContent = formulaStr;
            this.elements.theoryNotes.textContent = displayAscending.map(n => n.replace(/[0-9]/g, '')).join(" - ");
            
            // Generate characteristic description
            let desc = "Standard diatonic scale.";
            if (scaleName.includes("Major")) desc = "Bright, happy, resolving tone. The foundation of Western harmony.";
            else if (scaleName.includes("Minor")) desc = "Sad, melancholic, serious tone. Natural minor scale.";
            else if (scaleName.includes("Pentatonic")) desc = "5-note scale. Extremely versatile for soloing in rock, blues, and pop.";
            else if (scaleName.includes("Blues")) desc = "Features the 'blue note' (flat 5) for tension and soulful expression.";
            else if (scaleName.includes("Bhairav")) desc = "Morning Raag. Serious and devotional character (♭2, ♭6).";
            else if (scaleName.includes("Yaman")) desc = "Evening Raag. Peaceful and expansive (♯4).";
            
            this.elements.theoryDesc.textContent = desc;
        }

        this.playSequence(fullScale, 350);
    }

    updateTape(currentNoteIdx = -1) {
        this.elements.sequenceTape.innerHTML = this.tapeBuffer.map((n, i) => {
            const hue = (i * 25) % 360;
            const isCurrent = (i === currentNoteIdx);
            // --hue is a data value; the colours themselves come from CSS.
            return `<div class="tape-node${isCurrent ? ' is-current' : ''}" style="--hue:${hue}">${n}</div>`;
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

        // Non-exclusive: playing a scale over a running backing track is a legitimate
        // practice mode, so this must not steal the session from Jam. It registers only
        // so navigation / stopAll() can cut it off instead of orphaning the audio.
        if (this.sessionManager) {
            this.sessionManager.startSession(AudioSessionType.NOTE_PREVIEW, { exclusive: false });
        }

        try {
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
        } finally {
            // Only the newest sequence owns teardown; a superseded one must not close
            // the session out from under the run that replaced it.
            if (this._currentSeqId === seqId && this.sessionManager) {
                this.sessionManager.stopSession(AudioSessionType.NOTE_PREVIEW);
            }
        }
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
                        
                        // Timestamp each onset so replay can reproduce the rhythm.
                        this.detectionHistory.push({ note: noteData.name, t: performance.now() });
                        if (this.detectionHistory.length > 64) {
                            this.detectionHistory.shift();
                        }
                        if (this.elements.replayHistoryBtn && !this.isReplaying) {
                            this._resetReplayButton();
                        }
                        
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
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { window.AhordianApp = new App(); });
} else {
    window.AhordianApp = new App();
}
