import AppConfig from './AppConfig.js';
import { AudioSessionType } from './audio/AudioSessionManager.js';

/**
 * EarTrainingManager
 * Gamified ear training: interval recognition, chord ID, note finding
 */
export default class EarTrainingManager {
    constructor(appRef) {
        this.app = appRef;
        this.mode = 'intervals'; // 'intervals' | 'chords' | 'notes'
        this.score = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.totalQuestions = 0;
        this.totalCorrect = 0;
        this.isActive = false;
        this.currentAnswer = null;
        this.currentChoices = [];
        this.waitingForAnswer = false;

        this.INTERVALS = [
            { name: 'Unison',     semitones: 0  },
            { name: 'Minor 2nd',  semitones: 1  },
            { name: 'Major 2nd',  semitones: 2  },
            { name: 'Minor 3rd',  semitones: 3  },
            { name: 'Major 3rd',  semitones: 4  },
            { name: 'Perfect 4th',semitones: 5  },
            { name: 'Tritone',    semitones: 6  },
            { name: 'Perfect 5th',semitones: 7  },
            { name: 'Minor 6th',  semitones: 8  },
            { name: 'Major 6th',  semitones: 9  },
            { name: 'Minor 7th',  semitones: 10 },
            { name: 'Major 7th',  semitones: 11 },
            { name: 'Octave',     semitones: 12 }
        ];

        this.CHORD_TYPES = [
            { label: 'Major',       intervals: [0, 4, 7]  },
            { label: 'Minor',       intervals: [0, 3, 7]  },
            { label: 'Dominant 7',  intervals: [0, 4, 7, 10] },
            { label: 'Major 7',     intervals: [0, 4, 7, 11] },
            { label: 'Minor 7',     intervals: [0, 3, 7, 10] },
            { label: 'Diminished',  intervals: [0, 3, 6]  },
            { label: 'Augmented',   intervals: [0, 4, 8]  },
            { label: 'Sus4',        intervals: [0, 5, 7]  }
        ];

        this.els = {
            modeSelector:    document.getElementById('ear-mode-selector'),
            startBtn:        document.getElementById('ear-start-btn'),
            stopBtn:         document.getElementById('ear-stop-btn'),
            playBtn:         document.getElementById('ear-play-btn'),
            question:        document.getElementById('ear-question'),
            choices:         document.getElementById('ear-choices'),
            feedback:        document.getElementById('ear-feedback'),
            score:           document.getElementById('ear-score'),
            streak:          document.getElementById('ear-streak'),
            accuracy:        document.getElementById('ear-accuracy'),
            bestStreak:      document.getElementById('ear-best-streak'),
        };

        this.bindEvents();
        this.loadHighScores();
    }

    bindEvents() {
        if (this.els.modeSelector) {
            this.els.modeSelector.addEventListener('change', (e) => {
                this.mode = e.target.value;
                if (this.isActive) this.nextQuestion();
            });
        }
        if (this.els.startBtn) {
            this.els.startBtn.addEventListener('click', () => this.start());
        }
        if (this.els.stopBtn) {
            this.els.stopBtn.addEventListener('click', () => this.stop());
        }
        if (this.els.playBtn) {
            this.els.playBtn.addEventListener('click', () => this.playCurrentQuestion());
        }
    }

    start() {
        this.score = 0;
        this.streak = 0;
        this.totalQuestions = 0;
        this.totalCorrect = 0;
        this.isActive = true;
        this.updateStats();
        this.setUIState(true);

        if (this.app && this.app.sessionManager) {
            this.app.sessionManager.startSession(AudioSessionType.EAR_TRAINING, { exclusive: true });
        }

        this.nextQuestion();
    }

    stop() {
        this.isActive = false;
        this.setUIState(false);

        if (this.app && this.app.sessionManager) {
            this.app.sessionManager.stopSession(AudioSessionType.EAR_TRAINING);
        }
        this.saveHighScores();
        if (this.els.question) this.els.question.textContent = 'Press Start to begin!';
        if (this.els.choices) this.els.choices.innerHTML = '';
        if (this.els.feedback) this.els.feedback.textContent = '';
    }

    setUIState(running) {
        if (this.els.startBtn) this.els.startBtn.disabled = running;
        if (this.els.stopBtn)  this.els.stopBtn.disabled  = !running;
        if (this.els.playBtn)  this.els.playBtn.disabled  = !running;
    }

    nextQuestion() {
        if (!this.isActive) return;
        this.waitingForAnswer = true;
        if (this.els.feedback) {
            this.els.feedback.textContent = '';
            this.els.feedback.className = 'ear-feedback';
        }

        if (this.mode === 'intervals') this.askInterval();
        else if (this.mode === 'chords') this.askChord();
        else this.askNote();
    }

    // ---- INTERVALS ----
    askInterval() {
        const active = this.INTERVALS.filter(i => i.semitones <= 12);
        const correct = active[Math.floor(Math.random() * active.length)];
        this.currentAnswer = correct.name;

        // Build 4 choices including the correct one
        const others = active.filter(i => i.name !== correct.name)
            .sort(() => Math.random() - 0.5).slice(0, 3);
        this.currentChoices = [...others, correct].sort(() => Math.random() - 0.5);

        const baseNote = 'C4';
        const targetIdx = (AppConfig.NOTE_NAMES.indexOf('C') + correct.semitones) % 12;
        const octaveShift = Math.floor((0 + correct.semitones) / 12);
        const targetNote = AppConfig.NOTE_NAMES[targetIdx] + (4 + octaveShift);

        this._intervalNotes = [baseNote, targetNote];

        if (this.els.question) this.els.question.textContent = '🎵 What interval is this?';
        this.renderChoices(this.currentChoices.map(c => c.name));
        this.playCurrentQuestion();
    }

    // ---- CHORDS ----
    askChord() {
        const correct = this.CHORD_TYPES[Math.floor(Math.random() * this.CHORD_TYPES.length)];
        this.currentAnswer = correct.label;

        const others = this.CHORD_TYPES.filter(c => c.label !== correct.label)
            .sort(() => Math.random() - 0.5).slice(0, 3);
        this.currentChoices = [...others, correct].sort(() => Math.random() - 0.5);

        const rootIdx = Math.floor(Math.random() * 12);
        const rootName = AppConfig.NOTE_NAMES[rootIdx];
        this._chordNotes = correct.intervals.map(interval => {
            const noteIdx = (rootIdx + interval) % 12;
            return AppConfig.NOTE_NAMES[noteIdx] + '3';
        });

        if (this.els.question) this.els.question.textContent = '🎹 What chord quality is this?';
        this.renderChoices(this.currentChoices.map(c => c.label));
        this.playCurrentQuestion();
    }

    // ---- NOTES ----
    askNote() {
        const noteIdx = Math.floor(Math.random() * 12);
        this.currentAnswer = AppConfig.NOTE_NAMES[noteIdx];
        this._singleNote = AppConfig.NOTE_NAMES[noteIdx] + '4';

        // 4 choices
        const allNotes = [...AppConfig.NOTE_NAMES];
        const others = allNotes.filter(n => n !== this.currentAnswer)
            .sort(() => Math.random() - 0.5).slice(0, 3);
        this.currentChoices = [...others, this.currentAnswer].sort(() => Math.random() - 0.5);

        if (this.els.question) this.els.question.textContent = '👂 What note do you hear?';
        this.renderChoices(this.currentChoices);
        this.playCurrentQuestion();
    }

    renderChoices(labels) {
        if (!this.els.choices) return;
        this.els.choices.innerHTML = '';
        labels.forEach(label => {
            const btn = document.createElement('button');
            btn.className = 'ear-choice-btn';
            btn.textContent = label;
            btn.addEventListener('click', () => {
                if (!this.waitingForAnswer) return;
                this.checkAnswer(label, btn);
            });
            this.els.choices.appendChild(btn);
        });
    }

    checkAnswer(selected, btn) {
        this.waitingForAnswer = false;
        this.totalQuestions++;
        const isCorrect = selected === this.currentAnswer;

        if (isCorrect) {
            this.totalCorrect++;
            this.score += 10 + (this.streak * 2); // streak bonus
            this.streak++;
            if (this.streak > this.bestStreak) this.bestStreak = this.streak;
            btn.classList.add('correct');
            if (this.els.feedback) {
                this.els.feedback.textContent = `✅ Correct! +${10 + ((this.streak - 1) * 2)} pts${this.streak > 1 ? ` 🔥 ${this.streak} streak!` : ''}`;
                this.els.feedback.className = 'ear-feedback correct';
            }
        } else {
            this.streak = 0;
            btn.classList.add('wrong');
            // Highlight correct answer
            Array.from(this.els.choices.children).forEach(b => {
                if (b.textContent === this.currentAnswer) b.classList.add('correct');
            });
            if (this.els.feedback) {
                this.els.feedback.textContent = `❌ Wrong. Correct answer: ${this.currentAnswer}`;
                this.els.feedback.className = 'ear-feedback wrong';
            }
        }

        this.updateStats();
        // All choices become disabled
        Array.from(this.els.choices.children).forEach(b => b.disabled = true);

        setTimeout(() => {
            if (this.isActive) this.nextQuestion();
        }, 1800);
    }

    playCurrentQuestion() {
        if (!this.app?.player) { this.app?.initAudioContext(); return; }
        this.app.initAudioContext();

        if (this.mode === 'intervals' && this._intervalNotes) {
            this._intervalNotes.forEach((note, i) => {
                setTimeout(() => this.app.player.playNote(note), i * 500);
            });
        } else if (this.mode === 'chords' && this._chordNotes) {
            this._chordNotes.forEach((note, i) => {
                setTimeout(() => this.app.player.playNote(note), i * 80);
            });
        } else if (this.mode === 'notes' && this._singleNote) {
            this.app.player.playNote(this._singleNote);
        }
    }

    updateStats() {
        const acc = this.totalQuestions > 0
            ? Math.round((this.totalCorrect / this.totalQuestions) * 100)
            : 0;
        if (this.els.score)      this.els.score.textContent      = this.score;
        if (this.els.streak)     this.els.streak.textContent     = this.streak;
        if (this.els.accuracy)   this.els.accuracy.textContent   = acc + '%';
        if (this.els.bestStreak) this.els.bestStreak.textContent = this.bestStreak;
    }

    saveHighScores() {
        const key = `ear_training_${this.mode}`;
        const existing = parseInt(localStorage.getItem(key) || '0');
        if (this.score > existing) localStorage.setItem(key, this.score);
        localStorage.setItem(`ear_best_streak`, Math.max(
            this.bestStreak,
            parseInt(localStorage.getItem('ear_best_streak') || '0')
        ));
    }

    loadHighScores() {
        this.bestStreak = parseInt(localStorage.getItem('ear_best_streak') || '0');
        this.updateStats();
    }
}
