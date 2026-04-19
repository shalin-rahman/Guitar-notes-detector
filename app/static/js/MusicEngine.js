import AppConfig from './AppConfig.js';

export default class MusicEngine {
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

    static sargamToNote(sargamSyllable, rootName, octave = 4) {
        const rootIdx = AppConfig.NOTE_NAMES.indexOf(rootName);
        const interval = AppConfig.BENGALI_SARGAM_MAP[sargamSyllable];
        
        if (rootIdx === -1 || interval === undefined) return null;
        
        const noteIdx = (rootIdx + interval) % 12;
        const octaveShift = Math.floor((rootIdx + interval) / 12);
        return AppConfig.NOTE_NAMES[noteIdx] + (octave + octaveShift);
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
