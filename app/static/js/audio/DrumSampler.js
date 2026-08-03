export default class DrumSampler {
    constructor(audioContext, sampleManager, destinationNode) {
        this.ctx = audioContext;
        this.sampleManager = sampleManager;
        this.destinationNode = destinationNode;
        
        this.sampleMap = {
            'kick': './audio/drums/kick/kick-acoustic01.wav',
            'snare': './audio/drums/snare/snare-acoustic01.wav',
            'hihat': './audio/drums/hihat/hihat-acoustic01.wav',
            'hihat-open': './audio/drums/hihat/hihat-open01.wav',
            'ride': './audio/drums/ride/ride-acoustic01.wav'
        };
    }

    async loadSamples() {
        await this.sampleManager.loadSamplePack(this.sampleMap);
    }

    scheduleDrumHit(drumType, startTime, velocity = 0.8) {
        if (!this.ctx || !this.destinationNode) return;
        
        const buffer = this.sampleManager.getBuffer(drumType);
        
        if (!buffer) {
            // Fallback: simple synthesized drums if samples aren't loaded
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
    
    playSynthDrum(drumType, startTime, velocity) {
        // Basic synthesized fallback
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.destinationNode);
        
        if (drumType === 'kick') {
            osc.frequency.setValueAtTime(150, startTime);
            osc.frequency.exponentialRampToValueAtTime(0.01, startTime + 0.1);
            gain.gain.setValueAtTime(velocity, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.1);
            osc.start(startTime);
            osc.stop(startTime + 0.1);
        } else if (drumType === 'snare') {
            // Noise burst roughly simulated with a high-pitched oscillator for now
            // (True noise requires a buffer, but this is just a fallback)
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(250, startTime);
            gain.gain.setValueAtTime(velocity, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
            osc.start(startTime);
            osc.stop(startTime + 0.2);
        } else if (drumType === 'hihat') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(8000, startTime);
            gain.gain.setValueAtTime(velocity * 0.5, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.05);
            osc.start(startTime);
            osc.stop(startTime + 0.05);
        }
    }
}
