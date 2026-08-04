import GuitarSynthFallback from './GuitarSynthFallback.js';

/**
 * The shipped guitar tones. Keys are the directory under
 * `static/audio/guitar/` *and* the stored `guitarTone` setting value, so they
 * must stay in sync with GUITAR_TONES in `app/download_samples.py`.
 */
export const GUITAR_TONES = [
    { id: 'steel', label: 'Steel-String (bright)' },
    { id: 'nylon', label: 'Nylon / Classical (mellow)' }
];
export const DEFAULT_TONE = 'steel';

export default class GuitarSampler {
    constructor(audioContext, sampleManager, tone = DEFAULT_TONE) {
        this.ctx = audioContext;
        this.sampleManager = sampleManager;
        this.fallbackSynth = new GuitarSynthFallback(this.ctx);
        this.tone = GUITAR_TONES.some(t => t.id === tone) ? tone : DEFAULT_TONE;
        // tone id -> the loadSamples() promise, so switching back to a tone the
        // user already heard is instant and never re-fetches.
        this._loads = new Map();

        // Roughly every 3 semitones from the low open E to above the top of a
        // 22-fret neck, so nothing is pitch-shifted more than ~1.5 semitones.
        //
        // This used to be one sample per open string (E2 A2 D3 G3 B3 E4). Two
        // audible consequences: 5-semitone gaps in the middle, and *nothing at
        // all* above E4, so every note past the 12th fret of the high E was
        // stretched up from E4 — up to an octave, which is where the chipmunk
        // artefact came from. Keep this list in sync with GUITAR_NOTES in
        // app/download_samples.py.
        this.sampledNotes = [
            'E2', 'G2', 'A2', 'C3', 'D3', 'F3', 'G3', 'A3', 'C4',
            'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6'
        ];

        this.sampleMap = this.buildSampleMap(this.tone);
    }

    /**
     * Buffer keys are namespaced by tone. Both packs cover the same note names,
     * so keying on the bare note would make the second tone loaded overwrite the
     * first in `SampleManager.buffers` and a switch back would silently play the
     * wrong timbre.
     */
    buildSampleMap(tone) {
        const map = {};
        for (const note of this.sampledNotes) {
            map[`guitar:${tone}:${note}`] = `./audio/guitar/${tone}/${note}.mp3`;
        }
        return map;
    }

    /** Buffer key for a sampled note in the currently selected tone. */
    keyFor(note) {
        return `guitar:${this.tone}:${note}`;
    }

    async loadSamples() {
        if (!this._loads.has(this.tone)) {
            this._loads.set(this.tone, this.sampleManager.loadSamplePack(this.sampleMap, 'Guitar'));
        }
        await this._loads.get(this.tone);
    }

    /**
     * Switch tone, loading its pack on first use. Returns the load promise so a
     * caller can await the swap; already-heard tones resolve immediately.
     */
    async setTone(tone) {
        if (!GUITAR_TONES.some(t => t.id === tone) || tone === this.tone) return;
        this.tone = tone;
        this.sampleMap = this.buildSampleMap(tone);
        await this.loadSamples();
    }

    getBufferForNote(noteName, duration) {
        // If we have a perfectly matching sample, use it
        const exact = this.keyFor(noteName);
        if (this.sampleManager.hasBuffer(exact)) {
            return {
                buffer: this.sampleManager.getBuffer(exact),
                playbackRate: 1.0,
                isSynth: false
            };
        }

        // Otherwise pitch shift from the closest available sample
        const targetFreq = this.fallbackSynth.noteToFreq(noteName);
        if (!targetFreq) return null;
        
        // Nearest sample measured in *semitones*, not in Hz.
        //
        // The old comparison was `Math.abs(targetFreq - sampleFreq)`, which is a
        // linear-frequency metric on a logarithmic scale: it systematically
        // prefers the higher neighbour, because a semitone is worth more Hz up
        // there. Its `diff < sampleFreq * 0.3` cutoff was asymmetric for the same
        // reason — about +4.7 semitones upward but far less downward.
        let closestSample = null;
        let minSemis = Infinity;

        // Iterate the note names, not sampleMap's keys — those are namespaced
        // (`guitar:steel:E2`) and noteToFreq would reject them.
        for (const sampledNote of this.sampledNotes) {
            if (!this.sampleManager.hasBuffer(this.keyFor(sampledNote))) continue;
            const sampleFreq = this.fallbackSynth.noteToFreq(sampledNote);
            if (!sampleFreq) continue;
            const semis = Math.abs(12 * Math.log2(targetFreq / sampleFreq));
            // At ~3-semitone spacing a correct nearest pick is never more than
            // ~1.5 semitones away; 3 is the tolerance for a partly-loaded pack.
            if (semis < minSemis && semis <= 3) {
                minSemis = semis;
                closestSample = sampledNote;
            }
        }

        if (closestSample) {
            const sampleFreq = this.fallbackSynth.noteToFreq(closestSample);
            return {
                buffer: this.sampleManager.getBuffer(this.keyFor(closestSample)),
                playbackRate: targetFreq / sampleFreq,
                isSynth: false
            };
        }
        
        // Fallback to synth if no sample is close enough or loaded
        return {
            buffer: this.fallbackSynth.getBufferForNote(noteName, duration),
            playbackRate: 1.0,
            isSynth: true
        };
    }
}
