import AppConfig from './AppConfig.js';

export default class AudioPlayer {
    constructor(audioContext) {
        this.ctx = audioContext;
        this.isMuted = false;
        this.onStateChange = null;
        this.activeVoices = [];
    }

    setMuted(val) {
        this.isMuted = val;
    }

    playNote(noteName, duration = 0.8) {
        if (!this.ctx || this.isMuted) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const freq = this.noteToFreq(noteName);
        if (!freq) return;

        // Humanization
        const velocity = 0.6 + Math.random() * 0.3; // Increased volume for more robust sound
        const startTime = this.ctx.currentTime + Math.random() * 0.005;

        // Clean up finished voices
        this.activeVoices = this.activeVoices.filter(v => v.endTime > startTime);

        // Polyphony limit (max 6 strings)
        if (this.activeVoices.length >= 6) {
            const oldest = this.activeVoices.shift();
            try {
                oldest.gainNode.gain.cancelScheduledValues(startTime);
                oldest.gainNode.gain.setValueAtTime(oldest.gainNode.gain.value || 0.001, startTime);
                oldest.gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05); // quick fade out
            } catch (e) {}
        }

        if (this.onStateChange) this.onStateChange(true);
        setTimeout(() => { if (this.onStateChange) this.onStateChange(false); }, duration * 1000);

        // === ACOUSTIC GUITAR SYNTHESIS ===
        // Multiple harmonics at natural ratios, each decaying differently
        const harmonics = [
            { ratio: 1,   gain: 1.0,  decay: duration },       // Fundamental
            { ratio: 2,   gain: 0.5,  decay: duration * 0.7 },  // 2nd harmonic
            { ratio: 3,   gain: 0.25, decay: duration * 0.5 },  // 3rd
            { ratio: 4,   gain: 0.15, decay: duration * 0.35 }, // 4th
            { ratio: 5,   gain: 0.08, decay: duration * 0.25 }, // 5th
            { ratio: 6,   gain: 0.04, decay: duration * 0.2 },  // 6th
        ];

        const masterGain = this.ctx.createGain();
        masterGain.gain.setValueAtTime(0, startTime);
        masterGain.gain.linearRampToValueAtTime(velocity, startTime + 0.002);
        masterGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        this.activeVoices.push({
            gainNode: masterGain,
            endTime: startTime + duration
        });

        // Body resonance filter (simulates guitar body)
        const bodyFilter = this.ctx.createBiquadFilter();
        bodyFilter.type = 'bandpass';
        bodyFilter.frequency.setValueAtTime(Math.min(freq * 2.5, 3000), startTime);
        bodyFilter.Q.setValueAtTime(0.7, startTime);

        // Brightness sweep (high frequencies decay faster, like a real string)
        const brightnessFilter = this.ctx.createBiquadFilter();
        brightnessFilter.type = 'lowpass';
        brightnessFilter.frequency.setValueAtTime(freq * 8, startTime);
        brightnessFilter.frequency.exponentialRampToValueAtTime(freq * 1.5, startTime + duration);
        brightnessFilter.Q.setValueAtTime(1, startTime);

        bodyFilter.connect(brightnessFilter);
        brightnessFilter.connect(masterGain);
        masterGain.connect(this.ctx.destination);

        const vibrato = this.ctx.createOscillator();
        const vibratoDepth = this.ctx.createGain();
        vibrato.frequency.value = 4.5 + Math.random();
        vibratoDepth.gain.setValueAtTime(0, startTime);
        vibratoDepth.gain.linearRampToValueAtTime(freq * 0.006, startTime + duration * 0.4);
        vibrato.connect(vibratoDepth);
        vibrato.start(startTime);
        vibrato.stop(startTime + duration + 0.1);

        // Create each harmonic overtone
        for (const h of harmonics) {
            const osc = this.ctx.createOscillator();
            const hGain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq * h.ratio, startTime);
            vibratoDepth.connect(osc.frequency);

            // Pluck envelope per harmonic
            hGain.gain.setValueAtTime(0, startTime);
            hGain.gain.linearRampToValueAtTime(h.gain, startTime + 0.005); // Ultra-sharp pluck
            hGain.gain.exponentialRampToValueAtTime(0.001, startTime + h.decay);

            osc.connect(hGain);
            hGain.connect(bodyFilter);

            osc.start(startTime);
            osc.stop(startTime + h.decay + 0.05);
        }

        // Pluck transient — short burst of noise for pick attack
        const noiseLen = 0.015;
        const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * noiseLen, this.ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) {
            noiseData[i] = (Math.random() * 2 - 1) * 0.3;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(velocity * 0.4, startTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + noiseLen);
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 2000;
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain);
        noise.start(startTime);
        noise.stop(startTime + noiseLen);


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
