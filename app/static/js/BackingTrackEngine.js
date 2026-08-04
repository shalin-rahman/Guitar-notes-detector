import AppConfig from './AppConfig.js';
import MusicEngine from './MusicEngine.js';
import { AudioSessionType } from './audio/AudioSessionManager.js';

export default class BackingTrackEngine {
    constructor(audioPlayer, rhythmEngine, fretboardManager, onChordChange) {
        this.player = audioPlayer;
        this.rhythmEngine = rhythmEngine;
        this.fretboard = fretboardManager;
        this.onChordChange = onChordChange;
        
        this.isPlaying = false;
        this.bpm = 120;
        this.currentTick = 0;
        this.currentMeasure = 0;
        this.timerID = null;
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // s
        this.nextTickTime = 0;
        
        this.activeProgression = null;
        this.keyRoot = "C";
        
        this.progressions = {
            "blues_12_bar": {
                name: "12-Bar Blues",
                measures: 12,
                beatsPerMeasure: 4,
                chords: [
                    { measure: 0, numeral: "I7" },
                    { measure: 1, numeral: "IV7" },
                    { measure: 2, numeral: "I7" },
                    { measure: 3, numeral: "I7" },
                    { measure: 4, numeral: "IV7" },
                    { measure: 5, numeral: "IV7" },
                    { measure: 6, numeral: "I7" },
                    { measure: 7, numeral: "I7" },
                    { measure: 8, numeral: "V7" },
                    { measure: 9, numeral: "IV7" },
                    { measure: 10, numeral: "I7" },
                    { measure: 11, numeral: "V7" }
                ],
                style: "shuffle"
            },
            "pop_1564": {
                name: "Pop Ballad (I-V-vi-IV)",
                measures: 4,
                beatsPerMeasure: 4,
                chords: [
                    { measure: 0, numeral: "I" },
                    { measure: 1, numeral: "V" },
                    { measure: 2, numeral: "vi" },
                    { measure: 3, numeral: "IV" }
                ],
                style: "straight"
            },
            "jazz_251": {
                name: "Jazz ii-V-I",
                measures: 4,
                beatsPerMeasure: 4,
                chords: [
                    { measure: 0, numeral: "ii7" },
                    { measure: 1, numeral: "V7" },
                    { measure: 2, numeral: "Imaj7" },
                    { measure: 3, numeral: "Imaj7" }
                ],
                style: "swing"
            }
        };
    }

    setBpm(bpm) {
        this.bpm = bpm;
    }

    setProgression(progId, key) {
        this.activeProgression = this.progressions[progId];
        this.keyRoot = key;
        this.currentMeasure = 0;
        this.currentTick = 0;
    }

    start() {
        if (!this.activeProgression || !this.player) return;
        if (this.isPlaying) return;
        
        // Ensure AudioContext is running
        if (this.player.ctx.state === 'suspended') {
            this.player.ctx.resume();
        }

        if (this.player.sessionManager) {
            this.player.sessionManager.startSession(AudioSessionType.JAM_TRACK, { exclusive: true });
        }

        this.isPlaying = true;
        this.currentTick = 0;
        this.currentMeasure = 0;
        this.nextTickTime = this.player.ctx.currentTime + 0.1;
        
        // Trigger initial chord immediately
        this.triggerChordUpdate(0);
        
        this.timerID = setInterval(() => this.scheduler(), this.lookahead);
    }

    stop() {
        this.isPlaying = false;
        clearInterval(this.timerID);
        if (this.player && this.player.sessionManager) {
            this.player.sessionManager.stopSession(AudioSessionType.JAM_TRACK);
        }
    }

    scheduler() {
        while (this.nextTickTime < this.player.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleTick(this.currentTick, this.currentMeasure, this.nextTickTime);
            this.advanceTick();
        }
    }

    advanceTick() {
        let secondsPer16thNote = (60.0 / this.bpm) / 4.0;
        
        // Handle swing/shuffle timing dynamically
        if (this.activeProgression.style === "shuffle" || this.activeProgression.style === "swing") {
            // Very simple swing simulation on 16ths:
            // 1 e & a -> 1 longer, e shorter, & longer, a shorter
            if (this.currentTick % 2 === 0) {
                secondsPer16thNote *= 1.33; 
            } else {
                secondsPer16thNote *= 0.67; 
            }
        }
        
        this.nextTickTime += secondsPer16thNote;
        this.currentTick++;
        
        // 16 ticks = 4 beats = 1 measure
        if (this.currentTick >= this.activeProgression.beatsPerMeasure * 4) {
            this.currentTick = 0;
            this.currentMeasure++;
            
            if (this.currentMeasure >= this.activeProgression.measures) {
                this.currentMeasure = 0;
            }
            
            this.triggerChordUpdate(this.currentMeasure);
        }
    }
    
    triggerChordUpdate(measureIdx) {
        const chordDef = this.activeProgression.chords.find(c => c.measure === measureIdx);
        if (chordDef) {
            const actualChord = this.resolveNumeralToChord(chordDef.numeral, this.keyRoot);
            if (this.onChordChange) {
                this.onChordChange(actualChord, chordDef.numeral);
            }
        }
    }

    scheduleTick(tickIndex, measureNumber, time) {
        // Trigger drums on every 16th note tick
        if (this.rhythmEngine) {
            this.rhythmEngine.playTick(this.activeProgression.style, tickIndex, time);
        }

        // Chords usually play on quarter notes (tickIndex % 4 === 0)
        // or eighth notes (tickIndex % 2 === 0), depending on style.
        const beatNumber = Math.floor(tickIndex / 4);
        const isQuarterNote = tickIndex % 4 === 0;

        const chordDef = this.activeProgression.chords.find(c => c.measure === measureNumber);
        if (!chordDef) return;

        const actualChord = this.resolveNumeralToChord(chordDef.numeral, this.keyRoot);
        
        let shouldStrum = false;
        let strumVelocity = 0.5;
        
        if (this.activeProgression.style === "straight" && isQuarterNote) {
            // Play on 1 and 3
            if (beatNumber === 0 || beatNumber === 2) {
                shouldStrum = true;
                strumVelocity = beatNumber === 0 ? 0.8 : 0.6;
            }
        } else if (this.activeProgression.style === "shuffle" && isQuarterNote) {
            // Play on 1, 2, 3, 4 with varying accents
            shouldStrum = true;
            strumVelocity = beatNumber === 0 ? 0.9 : 0.5;
        } else if (this.activeProgression.style === "swing" && isQuarterNote) {
            // Play on 2 and 4 (comping)
            if (beatNumber === 1 || beatNumber === 3) {
                shouldStrum = true;
                strumVelocity = 0.7;
            }
        } else if (this.activeProgression.style === "pop") {
            // Typical pop strumming pattern: 1, 2&, 4
            // 1 (tick 0), 2 (tick 4, no strum), & (tick 6), 4 (tick 12)
            if (tickIndex === 0) {
                shouldStrum = true;
                strumVelocity = 0.85;
            } else if (tickIndex === 6) { // "and" of beat 2
                shouldStrum = true;
                strumVelocity = 0.6;
            } else if (tickIndex === 12) { // beat 4
                shouldStrum = true;
                strumVelocity = 0.75;
            }
        } else if (this.activeProgression.style === "rock") {
            // Steady 8th notes
            if (tickIndex % 2 === 0) {
                shouldStrum = true;
                strumVelocity = (tickIndex % 4 === 0) ? 0.8 : 0.5;
            }
        }
        
        if (shouldStrum) {
            this.playChord(actualChord, time, strumVelocity);
        }
    }

    playChord(chordData, startTime, baseVelocity) {
        // Strum effect (slightly delay each note)
        const strumDelay = 0.015; // 15ms between strings
        const duration = (60.0 / this.bpm) * 1.5; // Sustain for 1.5 beats
        
        // Base octave for backing chords
        const baseOctave = 3;
        
        // Light the chord tones up on the fretboard as the strum lands. Notes are
        // scheduled on the audio clock, ahead of now, so the visual has to be delayed by
        // the same lead time or it fires early. Skipped when the board is off screen —
        // a jam can keep running while the user navigates away.
        if (this.fretboard && this.fretboard.isVisible()) {
            const leadMs = Math.max(0, (startTime - this.player.ctx.currentTime) * 1000);
            const voiced = chordData.notes.map((n, i) => `${n}${i > 2 ? 4 : 3}`);
            setTimeout(
                () => this.fretboard.flashNotes(voiced, duration * 1000 * 0.6, strumDelay * 1000),
                leadMs
            );
        }

        chordData.notes.forEach((noteClass, index) => {
            const time = startTime + (index * strumDelay);
            // Quick and dirty octave assignment for chord voicings
            let octave = baseOctave;
            if (index > 2) octave++;
            
            // Exact Web Audio clock scheduling
            const velocity = baseVelocity * (0.8 + Math.random() * 0.4);
            this.player.scheduleNote(`${noteClass}${octave}`, time, velocity, duration);
        });
    }

    resolveNumeralToChord(numeral, key) {
        const rootIdx = AppConfig.NOTE_NAMES.indexOf(key);
        let offset = 0;
        let type = "major";
        
        const isMinor = numeral === numeral.toLowerCase();
        
        const lowerNum = numeral.toLowerCase();
        if      (lowerNum.startsWith("vii")) offset = 11;
        else if (lowerNum.startsWith("vi"))  offset = 9;
        else if (lowerNum.startsWith("v"))   offset = 7;
        else if (lowerNum.startsWith("iv"))  offset = 5;
        else if (lowerNum.startsWith("iii")) offset = 4;
        else if (lowerNum.startsWith("ii"))  offset = 2;
        else if (lowerNum.startsWith("i"))   offset = 0;
        
        const noteIdx = (rootIdx + offset) % 12;
        const rootNote = AppConfig.NOTE_NAMES[noteIdx];
        
        let notes = [];
        // Construct the chord notes
        const rootPitch = noteIdx;
        
        if (numeral.includes("7") && !numeral.includes("maj7")) {
            // Dominant 7 (Root, 3, 5, b7)
            notes = [rootPitch, rootPitch + 4, rootPitch + 7, rootPitch + 10];
            type = "dominant7";
        } else if (numeral.includes("maj7")) {
            // Major 7 (Root, 3, 5, 7)
            notes = [rootPitch, rootPitch + 4, rootPitch + 7, rootPitch + 11];
            type = "major7";
        } else if (isMinor) {
            if (numeral.includes("7")) {
                // Minor 7 (Root, b3, 5, b7)
                notes = [rootPitch, rootPitch + 3, rootPitch + 7, rootPitch + 10];
                type = "minor7";
            } else {
                // Minor triad
                notes = [rootPitch, rootPitch + 3, rootPitch + 7];
                type = "minor";
            }
        } else {
            // Major triad
            notes = [rootPitch, rootPitch + 4, rootPitch + 7];
            type = "major";
        }
        
        const mappedNotes = notes.map(p => AppConfig.NOTE_NAMES[p % 12]);
        
        return {
            name: `${rootNote} ${type}`,
            root: rootNote,
            type: type,
            notes: mappedNotes
        };
    }
}
