export default class AppConfig {
    static SAMPLE_RATE = 44100;
    static BUF_SIZE = 2048;
    static MIN_SAMPLES = 0;
    static CORRELATION_THRESHOLD = 0.9;
    static NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    static DEFAULT_SARGAM_MAP = ["S", "S'", "R", "R'", "G", "M", "M'", "P", "P'", "D", "D'", "N"];
    static ALTERNATE_TUNINGS = [
        { name: "Standard", notes: ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'] },
        { name: "Half-Step Down", notes: ['D#4', 'A#3', 'F#3', 'C#3', 'G#2', 'D#2'] },
        { name: "Drop D", notes: ['E4', 'B3', 'G3', 'D3', 'A2', 'D2'] },
        { name: "DADGAD", notes: ['D4', 'A3', 'G3', 'D3', 'A2', 'D2'] },
        { name: "Open G", notes: ['D4', 'B3', 'G3', 'D3', 'G2', 'D2'] }
    ];
    static BENGALI_SARGAM_MAP = {
        "সা": 0, "রে": 2, "গা": 4, "মা": 5, "পা": 7, "ধা": 9, "নি": 11,
        "ঋ": 1, "জ্ঞ": 3, "হ্ম": 6, "দ": 8, "ণ": 10,
        "S": 0, "S'": 1, "R": 2, "R'": 3, "G": 4, "M": 5, "M'": 6, "P": 7, "P'": 8, "D": 9, "D'": 10, "N": 11
    };
    static SAMPLE_SEQUENCES = [
        { name: "Arohon (Ascending)", notes: ["সা", "রে", "গা", "মা", "পা", "ধা", "নি", "সা"] },
        { name: "Aborohon (Descending)", notes: ["সা", "নি", "ধা", "পা", "মা", "গা", "রে", "সা"] },
        { name: "Alankar 1", notes: ["সা-রে", "রে-গা", "গা-মা", "মা-পা", "পা-ধা", "ধা-নি", "নি-সা"] },
        { name: "Alankar 2", notes: ["সা-রে-গা", "রে-গা-মা", "গা-মা-পা", "মা-পা-ধা", "পা-ধা-নি", "ধা-নি-সা"] },
        { name: "Popular: Purano Sei", notes: ["সা", "সা", "সা", "রে", "গা", "রে", "সা", "ধা", "সা", "রে"] },
        { name: "Popular: Ekla Chalo", notes: ["সা", "রে", "গা", "পা", "পা", "ধা", "পা", "মা", "গা"] }
    ];
    static CHROMATIC_COLORS = {
        'C':  '#EF4444', // Red
        'C#': '#F97316', // Orange-Red
        'D':  '#F59E0B', // Orange
        'D#': '#EAB308', // Yellow
        'E':  '#84CC16', // Yellow-Green
        'F':  '#22C55E', // Green
        'F#': '#06B6D4', // Cyan
        'G':  '#3B82F6', // Light Blue
        'G#': '#6366F1', // Blue-Indigo
        'A':  '#8B5CF6', // Purple
        'A#': '#D946EF', // Magenta
        'B':  '#F43F5E'  // Pink-Red
    };
    static SCALE_DEFINITIONS = [
        // 10 Basic Thaats (Indian Classical)
        { name: "Thaat Bilaval", intervals: [0, 2, 4, 5, 7, 9, 11] },
        { name: "Thaat Kalyan", intervals: [0, 2, 4, 6, 7, 9, 11] },
        { name: "Thaat Khamaj", intervals: [0, 2, 4, 5, 7, 9, 10] },
        { name: "Thaat Bhairav", intervals: [0, 1, 4, 5, 7, 8, 11] },
        { name: "Thaat Bhairavi", intervals: [0, 1, 3, 5, 7, 8, 10] },
        { name: "Thaat Asavari", intervals: [0, 2, 3, 5, 7, 8, 10] },
        { name: "Thaat Kafi", intervals: [0, 2, 3, 5, 7, 9, 10] },
        { name: "Thaat Todi", intervals: [0, 1, 3, 6, 7, 8, 11] },
        { name: "Thaat Purvi", intervals: [0, 1, 4, 6, 7, 8, 11] },
        { name: "Thaat Marwa", intervals: [0, 1, 4, 6, 7, 9, 11] },
        // Raags (Authentic Asymmetric Sequences)
        { name: "Raag Bhupali", arohan: [0, 2, 4, 7, 9, 12], aborohan: [12, 9, 7, 4, 2, 0] },
        { name: "Raag Yaman", arohan: [0, 2, 4, 6, 7, 9, 11, 12], aborohan: [12, 11, 9, 7, 6, 4, 2, 0] },
        { name: "Raag Durga", arohan: [0, 2, 5, 7, 9, 12], aborohan: [12, 9, 7, 5, 2, 0] },
        { name: "Raag Brindavani Sarang", arohan: [0, 2, 5, 7, 11, 12], aborohan: [12, 10, 7, 5, 2, 0] },
        // Western Modes
        { name: "Major (Ionian)", intervals: [0, 2, 4, 5, 7, 9, 11] },
        { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
        { name: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
        { name: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
        { name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
        { name: "Aeolian (Minor)", intervals: [0, 2, 3, 5, 7, 8, 10] },
        { name: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10] },
        { name: "Harmonic Minor", intervals: [0, 2, 3, 5, 7, 8, 11] },
        { name: "Melodic Minor", intervals: [0, 2, 3, 5, 7, 9, 11] },
        // Pentatonic & Blues
        { name: "Major Pentatonic", intervals: [0, 2, 4, 7, 9] },
        { name: "Minor Pentatonic", intervals: [0, 3, 5, 7, 10] },
        { name: "Blues Scale", intervals: [0, 3, 5, 6, 7, 10] }
    ];
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
    static CHORD_VOICINGS = [
        { name: "C", type: "maj", pos: [{ s: 4, f: 3 }, { s: 3, f: 2 }, { s: 1, f: 1 }] },
        { name: "G", type: "maj", pos: [{ s: 5, f: 3 }, { s: 4, f: 2 }, { s: 0, f: 3 }, { s: 1, f: 0 }] },
        { name: "D", type: "maj", pos: [{ s: 2, f: 2 }, { s: 1, f: 3 }, { s: 0, f: 2 }] },
        { name: "A", type: "maj", pos: [{ s: 3, f: 2 }, { s: 2, f: 2 }, { s: 1, f: 2 }] },
        { name: "E", type: "maj", pos: [{ s: 4, f: 2 }, { s: 3, f: 2 }, { s: 2, f: 1 }] },
        { name: "Am", type: "min", pos: [{ s: 3, f: 2 }, { s: 2, f: 2 }, { s: 1, f: 1 }] },
        { name: "Em", type: "min", pos: [{ s: 4, f: 2 }, { s: 3, f: 2 }] },
        { name: "Dm", type: "min", pos: [{ s: 2, f: 2 }, { s: 1, f: 3 }, { s: 0, f: 1 }] },
        { name: "F", type: "maj", pos: [{ s: 3, f: 3 }, { s: 2, f: 2 }, { s: 1, f: 1 }, { s: 0, f: 1 }] }
    ];
}
