import GuitarSynthFallback from './GuitarSynthFallback.js';

export default class GuitarSampler {
    constructor(audioContext, sampleManager) {
        this.ctx = audioContext;
        this.sampleManager = sampleManager;
        this.fallbackSynth = new GuitarSynthFallback(this.ctx);
        
        // Multi-sample mapping: map certain notes to sample files
        // A full implementation would use more samples and pitch-shift between them.
        this.sampleMap = {
            'E2': './audio/guitar/acoustic/E2.mp3',
            'A2': './audio/guitar/acoustic/A2.mp3',
            'D3': './audio/guitar/acoustic/D3.mp3',
            'G3': './audio/guitar/acoustic/G3.mp3',
            'B3': './audio/guitar/acoustic/B3.mp3',
            'E4': './audio/guitar/acoustic/E4.mp3'
        };
    }

    async loadSamples() {
        await this.sampleManager.loadSamplePack(this.sampleMap, 'Guitar');
    }

    getBufferForNote(noteName, duration) {
        // If we have a perfectly matching sample, use it
        if (this.sampleManager.hasBuffer(noteName)) {
            return {
                buffer: this.sampleManager.getBuffer(noteName),
                playbackRate: 1.0,
                isSynth: false
            };
        }
        
        // Otherwise pitch shift from the closest available sample
        const targetFreq = this.fallbackSynth.noteToFreq(noteName);
        if (!targetFreq) return null;
        
        // Find closest sample (simplified mapping for now)
        let closestSample = null;
        let minDiff = Infinity;
        
        for (const [sampledNote, url] of Object.entries(this.sampleMap)) {
            if (this.sampleManager.hasBuffer(sampledNote)) {
                const sampleFreq = this.fallbackSynth.noteToFreq(sampledNote);
                const diff = Math.abs(targetFreq - sampleFreq);
                // Don't pitch shift too far (max 5 semitones)
                if (diff < minDiff && diff < (sampleFreq * 0.3)) {
                    minDiff = diff;
                    closestSample = sampledNote;
                }
            }
        }
        
        if (closestSample) {
            const sampleFreq = this.fallbackSynth.noteToFreq(closestSample);
            return {
                buffer: this.sampleManager.getBuffer(closestSample),
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
