import AppConfig from './AppConfig.js';
import GuitarSampler from './audio/GuitarSampler.js';

export default class AudioPlayer {
    constructor(audioSessionManager, sampleManager) {
        this.sessionManager = audioSessionManager;
        this.ctx = audioSessionManager.ctx;
        this.isMuted = false;
        this.onStateChange = null;
        this.activeVoices = [];
        
        this.sampler = new GuitarSampler(this.ctx, sampleManager);
    }

    async loadSamples() {
        await this.sampler.loadSamples();
    }

    setMuted(val) {
        this.isMuted = val;
    }

    playNote(noteName, duration = 2.5) {
        const time = this.ctx ? this.ctx.currentTime + Math.random() * 0.005 : 0;
        const velocity = 0.6 + Math.random() * 0.4;
        this.scheduleNote(noteName, time, velocity, duration);
    }

    scheduleNote(noteName, startTime, velocity, duration = 2.5) {
        if (!this.ctx || this.isMuted) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const sampleInfo = this.sampler.getBufferForNote(noteName, duration);
        if (!sampleInfo || !sampleInfo.buffer) return;

        // Clean up finished voices
        this.activeVoices = this.activeVoices.filter(v => v.endTime > startTime);

        // Polyphony limit (max 6 strings)
        if (this.activeVoices.length >= 6) {
            const oldest = this.activeVoices.shift();
            try {
                oldest.gainNode.gain.cancelScheduledValues(startTime);
                oldest.gainNode.gain.setValueAtTime(oldest.gainNode.gain.value || 0.001, startTime);
                oldest.gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05);
                if (oldest.sourceNode) oldest.sourceNode.stop(startTime + 0.06);
            } catch (e) {}
        }

        if (this.onStateChange) this.onStateChange(true);
        setTimeout(() => { if (this.onStateChange) this.onStateChange(false); }, ((startTime - this.ctx.currentTime) + duration) * 1000);

        const source = this.ctx.createBufferSource();
        source.buffer = sampleInfo.buffer;
        source.playbackRate.value = sampleInfo.playbackRate;
        
        const masterGain = this.ctx.createGain();
        masterGain.gain.setValueAtTime(0, startTime);
        masterGain.gain.linearRampToValueAtTime(velocity, startTime + 0.01);
        masterGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        if (sampleInfo.isSynth) {
            // Apply body resonance filter for synth sounds
            const bodyFilter = this.ctx.createBiquadFilter();
            bodyFilter.type = 'bandpass';
            const freq = this.sampler.fallbackSynth.noteToFreq(noteName) || 440;
            bodyFilter.frequency.setValueAtTime(Math.min(freq * 1.5, 800), startTime);
            bodyFilter.Q.setValueAtTime(1.2, startTime);

            const highShelf = this.ctx.createBiquadFilter();
            highShelf.type = 'highshelf';
            highShelf.frequency.value = 2500;
            highShelf.gain.value = 4;

            source.connect(bodyFilter);
            bodyFilter.connect(highShelf);
            highShelf.connect(masterGain);

            const directGain = this.ctx.createGain();
            directGain.gain.value = 0.5;
            source.connect(directGain);
            directGain.connect(highShelf);
        } else {
            // Real samples just go straight through the envelope
            source.connect(masterGain);
        }
        masterGain.connect(this.sessionManager.getInstrumentDestination('guitar'));

        source.start(startTime);
        source.stop(startTime + duration + 0.1);

        this.activeVoices.push({
            gainNode: masterGain,
            sourceNode: source,
            endTime: startTime + duration
        });
    }

    noteToFreq(note) {
        return this.sampler.fallbackSynth.noteToFreq(note);
    }
}
