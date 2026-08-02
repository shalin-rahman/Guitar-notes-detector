import AppConfig from './AppConfig.js';

export default class VoicingGenerator {
    static getNoteAt(strings, stringIdx, fret) {
        const rawTuning = strings[stringIdx];
        const flatMap = { 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B' };
        let normalized = rawTuning;
        for (const [flat, sharp] of Object.entries(flatMap)) {
            if (normalized.startsWith(flat)) normalized = normalized.replace(flat, sharp);
        }
        
        const noteName = normalized.replace(/[0-9]/g, '');
        const baseIdx = AppConfig.NOTE_NAMES.indexOf(noteName);
        if (baseIdx === -1) return null;

        const totalHalfSteps = baseIdx + fret;
        const noteIdx = totalHalfSteps % 12;
        return AppConfig.NOTE_NAMES[noteIdx];
    }

    static generateVoicings(strings, targetNotes, rootNote) {
        const allPossibleNotes = [];
        
        for (let s = 0; s < strings.length; s++) {
            const stringNotes = [];
            for (let f = 0; f <= 15; f++) {
                const note = this.getNoteAt(strings, s, f);
                if (targetNotes.includes(note)) {
                    stringNotes.push({ s, f, note, isRoot: note === rootNote });
                }
            }
            allPossibleNotes.push(stringNotes);
        }

        const voicings = [];
        const rootOccurrences = [];
        // Look for roots on strings 3, 4, 5 (D, A, Low E)
        for (let s = 3; s <= 5; s++) {
            allPossibleNotes[s].forEach(pos => {
                if (pos.isRoot) rootOccurrences.push(pos);
            });
        }
        
        rootOccurrences.forEach(rootPos => {
            const minFret = Math.max(0, rootPos.f - 2);
            const maxFret = Math.min(15, rootPos.f + 3);
            
            let voicing = [rootPos];
            let foundNotes = new Set([rootPos.note]);
            
            // Build upwards to higher strings
            for (let s = rootPos.s - 1; s >= 0; s--) {
                let bestPos = null;
                for (const pos of allPossibleNotes[s]) {
                    if (pos.f === 0 || (pos.f >= minFret && pos.f <= maxFret)) {
                        if (!foundNotes.has(pos.note)) {
                            bestPos = pos;
                            break;
                        } else if (!bestPos) {
                            bestPos = pos; // Fallback
                        }
                    }
                }
                if (bestPos) {
                    voicing.push(bestPos);
                    foundNotes.add(bestPos.note);
                }
            }
            
            const voicingHasAll = targetNotes.every(tn => Array.from(foundNotes).includes(tn));
            if (voicingHasAll && voicing.length >= 3) {
                // Remove duplicates on same string (just in case)
                const uniqueVoicing = [];
                const seenStrings = new Set();
                voicing.forEach(p => {
                    if(!seenStrings.has(p.s)) {
                        seenStrings.add(p.s);
                        uniqueVoicing.push(p);
                    }
                });
                
                voicings.push({
                    name: `Root on Str ${rootPos.s + 1}, Fr ${rootPos.f}`,
                    positions: uniqueVoicing
                });
            }
        });
        
        return voicings.length > 0 ? voicings : null;
    }
}
