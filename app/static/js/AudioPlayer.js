import AppConfig from './AppConfig.js';

export default class AudioPlayer {
    constructor(audioContext) {
        this.ctx = audioContext;
        this.isMuted = false;
        this.onStateChange = null;
        this.activeVoices = [];
        this.stringBuffers = {}; // Cache for precomputed Karplus-Strong buffers
    }

    setMuted(val) {
        this.isMuted = val;
    }
    
    // Generates a Karplus-Strong plucked string buffer mathematically
    generateKarplusStrongBuffer(freq, duration = 3.0) {
        const sampleRate = this.ctx.sampleRate;
        const length = Math.floor(sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        
        // Delay line length in samples
        const delayLength = Math.floor(sampleRate / freq);
        
        // Fill the initial delay line with noise (the "pluck")
        for (let i = 0; i < delayLength; i++) {
            data[i] = (Math.random() * 2 - 1);
        }
        
        // Simulate string vibration using Karplus-Strong algorithm
        // Lowpass filter via moving average: y[n] = 0.5 * (x[n] + x[n-1]) * damping
        const damping = 0.992; // Adjust decay character
        for (let i = delayLength; i < length; i++) {
            const previousValue = data[i - delayLength];
            const olderValue = data[i - delayLength - 1] || 0;
            // Feedback loop with simple lowpass
            data[i] = damping * 0.5 * (previousValue + olderValue);
        }
        
        return buffer;
    }

    playNote(noteName, duration = 2.5) {
        if (!this.ctx || this.isMuted) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const freq = this.noteToFreq(noteName);
        if (!freq) return;

        const startTime = this.ctx.currentTime + Math.random() * 0.005;
        const velocity = 0.6 + Math.random() * 0.4; 

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
        setTimeout(() => { if (this.onStateChange) this.onStateChange(false); }, duration * 1000);

        // Generate or get cached Karplus-Strong buffer for this frequency
        if (!this.stringBuffers[noteName]) {
            this.stringBuffers[noteName] = this.generateKarplusStrongBuffer(freq, duration);
        }

        const source = this.ctx.createBufferSource();
        source.buffer = this.stringBuffers[noteName];
        
        const masterGain = this.ctx.createGain();
        masterGain.gain.setValueAtTime(0, startTime);
        masterGain.gain.linearRampToValueAtTime(velocity, startTime + 0.01);
        masterGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        // Body resonance filter to give it that "wooden" acoustic sound
        const bodyFilter = this.ctx.createBiquadFilter();
        bodyFilter.type = 'bandpass';
        bodyFilter.frequency.setValueAtTime(Math.min(freq * 1.5, 800), startTime);
        bodyFilter.Q.setValueAtTime(1.2, startTime);

        // EQ to boost the low end slightly and crisp the highs
        const highShelf = this.ctx.createBiquadFilter();
        highShelf.type = 'highshelf';
        highShelf.frequency.value = 2500;
        highShelf.gain.value = 4;

        source.connect(bodyFilter);
        bodyFilter.connect(highShelf);
        highShelf.connect(masterGain);
        masterGain.connect(this.ctx.destination);

        // Also connect source directly to highShelf mixed with bodyFilter for a fuller sound
        const directGain = this.ctx.createGain();
        directGain.gain.value = 0.5;
        source.connect(directGain);
        directGain.connect(highShelf);

        source.start(startTime);
        source.stop(startTime + duration + 0.1);

        this.activeVoices.push({
            gainNode: masterGain,
            sourceNode: source,
            endTime: startTime + duration
        });
    }

    noteToFreq(note) {
        const names = AppConfig.NOTE_NAMES;
        const res = /([A-G]#?)([0-9])/.exec(note);
        if (!res) return null;
        const index = names.indexOf(res[1]);
        const octave = parseInt(res[2]);
        if (index === -1) return null;
        return 440 * Math.pow(2, (index - 9 + (octave - 4) * 12) / 12);
    }
}
