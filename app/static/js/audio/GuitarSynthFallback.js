import AppConfig from '../AppConfig.js';

export default class GuitarSynthFallback {
    constructor(audioContext) {
        this.ctx = audioContext;
        this.stringBuffers = {};
    }

    generateKarplusStrongBuffer(freq, duration = 3.0) {
        const sampleRate = this.ctx.sampleRate;
        const length = Math.floor(sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        
        const delayLength = Math.floor(sampleRate / freq);
        
        for (let i = 0; i < delayLength; i++) {
            data[i] = (Math.random() * 2 - 1);
        }
        
        const damping = 0.992;
        for (let i = delayLength; i < length; i++) {
            const previousValue = data[i - delayLength];
            const olderValue = data[i - delayLength - 1] || 0;
            data[i] = damping * 0.5 * (previousValue + olderValue);
        }
        
        return buffer;
    }

    getBufferForNote(noteName, duration = 3.0) {
        if (!this.stringBuffers[noteName]) {
            const freq = this.noteToFreq(noteName);
            if (!freq) return null;
            this.stringBuffers[noteName] = this.generateKarplusStrongBuffer(freq, duration);
        }
        return this.stringBuffers[noteName];
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
