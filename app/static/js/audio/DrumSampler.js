export default class DrumSampler {
    constructor(audioContext, sampleManager, destinationNode) {
        this.ctx = audioContext;
        this.sampleManager = sampleManager;
        this.destinationNode = destinationNode;

        // Pearl Master Studio (CC-BY 3.0) — see static/audio/LICENSES.md.
        this.sampleMap = {
            'kick': './audio/drums/kick/kick-acoustic01.wav',
            'snare': './audio/drums/snare/snare-acoustic01.wav',
            'hihat': './audio/drums/hihat/hihat-acoustic01.wav',
            'hihat-open': './audio/drums/hihat/hihat-open01.wav',
            'ride': './audio/drums/ride/ride-acoustic01.wav'
        };

        // Built once on first synth hit, then shared by every noise voice.
        this._noiseBuffer = null;
    }

    async loadSamples() {
        await this.sampleManager.loadSamplePack(this.sampleMap, 'Drums');
    }

    scheduleDrumHit(drumType, startTime, velocity = 0.8) {
        if (!this.ctx || !this.destinationNode) return;

        const buffer = this.sampleManager.getBuffer(drumType);

        if (!buffer) {
            this.playSynthDrum(drumType, startTime, velocity);
            return;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(velocity, startTime);

        source.connect(gainNode);
        gainNode.connect(this.destinationNode);

        source.start(startTime);
    }

    // ---------------------------------------------------------------------
    // Synth fallback
    //
    // Used only when a sample buffer is missing. Every voice except the kick
    // body is filtered noise from a shared buffer — the previous version had no
    // noise source at all (a 250 Hz triangle for the snare, square waves for
    // the cymbals), which is why it read as a test tone rather than a drum.
    // ---------------------------------------------------------------------

    getNoiseBuffer() {
        if (this._noiseBuffer) return this._noiseBuffer;

        const len = Math.floor(this.ctx.sampleRate * 2);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);

        // A deterministic LCG rather than Math.random(), so the fallback timbre
        // is byte-identical across runs and the QA peak-amplitude assertions
        // are not flaky.
        let seed = 0x2f6e2b1;
        for (let i = 0; i < len; i++) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            data[i] = (seed / 0x3fffffff) - 1;
        }

        this._noiseBuffer = buf;
        return buf;
    }

    /**
     * One filtered-noise hit. Returns nothing; the nodes are self-disposing
     * because the buffer source is given an explicit stop time.
     */
    _noiseHit(startTime, { peak, decay, filter = 'highpass', freq, Q = 1, attack = 0.001 }) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.getNoiseBuffer();
        // The buffer is 2 s and the longest decay is ~1.1 s, so looping is only a
        // guard against a short buffer on an unusual sample rate.
        src.loop = true;

        const biquad = this.ctx.createBiquadFilter();
        biquad.type = filter;
        biquad.frequency.setValueAtTime(freq, startTime);
        biquad.Q.setValueAtTime(Q, startTime);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.linearRampToValueAtTime(peak, startTime + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);

        src.connect(biquad);
        biquad.connect(gain);
        gain.connect(this.destinationNode);

        src.start(startTime);
        src.stop(startTime + decay + 0.01);
    }

    /** One decaying sine/triangle partial — drum "body" and cymbal ping. */
    _toneHit(startTime, { peak, decay, freq, endFreq = null, type = 'sine' }) {
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        if (endFreq !== null) {
            osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + decay);
        }

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(peak, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);

        osc.connect(gain);
        gain.connect(this.destinationNode);

        osc.start(startTime);
        osc.stop(startTime + decay + 0.01);
    }

    playSynthDrum(drumType, startTime, velocity) {
        const v = Math.max(0, Math.min(1, velocity));

        switch (drumType) {
            case 'kick':
                // Pitch-drop body plus a short click transient, so it reads as a
                // beater strike and not just a low sine blip.
                this._toneHit(startTime, { peak: v, decay: 0.28, freq: 130, endFreq: 42 });
                this._noiseHit(startTime, {
                    peak: v * 0.25, decay: 0.012, filter: 'highpass', freq: 1200
                });
                break;

            case 'snare':
                // Bandpassed noise is the rattle; two detuned triangles are the
                // shell tone underneath it.
                this._noiseHit(startTime, {
                    peak: v * 0.75, decay: 0.19, filter: 'bandpass', freq: 1900, Q: 0.7
                });
                this._toneHit(startTime, { peak: v * 0.28, decay: 0.09, freq: 185, type: 'triangle' });
                this._toneHit(startTime, { peak: v * 0.18, decay: 0.07, freq: 278, type: 'triangle' });
                break;

            case 'hihat':
                this._noiseHit(startTime, {
                    peak: v * 0.5, decay: 0.045, filter: 'highpass', freq: 8500
                });
                break;

            case 'hihat-open':
                this._noiseHit(startTime, {
                    peak: v * 0.45, decay: 0.34, filter: 'highpass', freq: 7000
                });
                break;

            case 'ride':
                // Long shimmer plus a bandpassed bell partial for the stick ping.
                this._noiseHit(startTime, {
                    peak: v * 0.3, decay: 1.1, filter: 'highpass', freq: 5200
                });
                this._noiseHit(startTime, {
                    peak: v * 0.2, decay: 0.16, filter: 'bandpass', freq: 3400, Q: 3
                });
                break;

            default:
                // Unknown voice: build nothing at all. The old code created and
                // connected an oscillator before discovering it had no branch.
                break;
        }
    }
}
